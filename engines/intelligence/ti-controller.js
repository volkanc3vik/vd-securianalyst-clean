// ════════════════════════════════════════════════════════════════════
// TI CONTROLLER — Orchestrator
// 1. 'vd:scan:complete' event'i dinler (yeni interval/WS yok)
// 2. BTC/ETH ayır → narrator
// 3. Tüm coinleri scorer → maturity
// 4. Regime + MM Bias
// 5. Best Setup + Watchlist (sadece VALID+) + Warnings
// 6. State'e atomik commit
// ════════════════════════════════════════════════════════════════════
window.TIController = (() => {
  'use strict';

  let _listenerAttached = false;
  let _lastScanResults  = null;
  let _processing       = false;

  // ── Funding/OI yardımcıları (BTC/ETH için aynı feed mantığı) ────
  function _resolveFunding(item) {
    if (!item) return null;
    if (item.funding && Number.isFinite(+item.funding.rate)) return item.funding;
    if (Number.isFinite(+item.fundingRate)) return { rate: +item.fundingRate };
    if (typeof window.CoinGlassService !== 'undefined' && window.CoinGlassService.isEnabled?.()) {
      try {
        const cg = window.CoinGlassService.getCachedFunding?.(item.sym);
        if (cg && Number.isFinite(+cg.rate)) return cg;
      } catch {}
    }
    return null;
  }

  function _resolveOI(item) {
    if (!item) return null;
    if (item.oi) return item.oi;
    if (Number.isFinite(+item.oiChange24h)) return { change24h: +item.oiChange24h };
    if (typeof window.CoinGlassService !== 'undefined' && window.CoinGlassService.isEnabled?.()) {
      try {
        const cg = window.CoinGlassService.getCachedOI?.(item.sym);
        if (cg) return cg;
      } catch {}
    }
    return null;
  }

  // ── Warning kuralları ───────────────────────────────────────────
  function _buildWarnings(regime, mmBias, bestSetup) {
    const warnings = [];

    // Genel piyasa uyarıları
    if (regime?.code === 'LIQUIDITY_TRAP') {
      warnings.push({
        code: 'LIQ_TRAP', severity: 'high',
        msg: 'Liquidity trap conditions — breakouts unreliable.',
      });
    }
    if (regime?.code === 'CHOPPY' && regime.diagnostics?.vol?.quality === 'ELEVATED') {
      warnings.push({
        code: 'CHOP_VOL', severity: 'med',
        msg: 'Choppy market with elevated volatility — patience required.',
      });
    }

    // MM bias headline kritikse
    if (mmBias?.headline) {
      const h = mmBias.headline.toLowerCase();
      if (h.includes('overheating') || h.includes('overextended')) {
        warnings.push({ code: 'FUNDING_OH', severity: 'high', msg: mmBias.headline });
      }
    }

    // Best Setup'a özel
    if (bestSetup && bestSetup.factors) {
      const fbr = bestSetup.factors.find(f => f.code === 'FBR');
      if (fbr?.available && fbr.score >= 7) {
        warnings.push({
          code: 'BS_FBR', severity: 'high',
          msg: `${bestSetup.sym}: high fakeout risk on entry candle.`,
        });
      }
      const fund = bestSetup.factors.find(f => f.code === 'FUNDING');
      if (fund?.available && fund.score <= 3) {
        warnings.push({
          code: 'BS_FUNDING', severity: 'med',
          msg: `${bestSetup.sym}: funding stressed — late entry risk.`,
        });
      }
      const vol = bestSetup.factors.find(f => f.code === 'VOLUME');
      if (vol?.available && vol.score <= 4 && bestSetup.tier?.code !== 'WEAK') {
        warnings.push({
          code: 'BS_VOL', severity: 'med',
          msg: `${bestSetup.sym}: breakout confirmation missing on volume.`,
        });
      }
    }

    // De-dupe
    const seen = new Set();
    return warnings.filter(w => {
      if (seen.has(w.code)) return false;
      seen.add(w.code);
      return true;
    });
  }

  // ── Ana pipeline ─────────────────────────────────────────────────
  function _process(scanResults) {
    if (_processing) return;
    if (!Array.isArray(scanResults) || scanResults.length === 0) return;
    _processing = true;
    _lastScanResults = scanResults;

    try {
      const Feed     = window.TIFeed;
      const Regime   = window.TIRegime;
      const MMBias   = window.TIMMBias;
      const Scorer   = window.TISetupScorer;
      const Maturity = window.TIMaturity;
      const Narrator = window.TINarrator;
      const State    = window.TIState;

      if (!Feed || !Regime || !MMBias || !Scorer || !Maturity || !Narrator || !State) {
        console.warn('[TIController] Missing engines, abort.');
        return;
      }

      // 1. Majors ayır
      const { btc: btcRaw, eth: ethRaw, others } = Feed.splitMajors(scanResults);

      // 2. Regime
      const regime = Regime.detect(btcRaw, scanResults);

      // 3. MM Bias
      const mmBias = MMBias.build({
        btcData:    btcRaw,
        regimeDiag: regime.diagnostics,
        funding:    _resolveFunding(btcRaw),
        oi:         _resolveOI(btcRaw),
      });

      // 4. BTC + ETH commentary
      const btcAnalysis = btcRaw ? Narrator.analyzeCoin(btcRaw) : null;
      const ethAnalysis = ethRaw ? Narrator.analyzeCoin(ethRaw) : null;
      if (ethAnalysis && btcAnalysis) {
        ethAnalysis.vsBTC = Narrator.compareETHvsBTC(btcAnalysis, ethAnalysis);
      }

      // 5. Tüm coinleri skorla
      const scored = [];
      for (const item of others) {
        const ctx = Feed.toScorerContext(item);
        if (!ctx) continue;
        const r = Scorer.score(ctx);
        if (!r) continue;
        r.maturity = Maturity.evaluate(r);
        scored.push(r);
      }

      // 6. Sırala — sadece VALID+ kalır
      scored.sort((a, b) => b.score - a.score);

      let bestSetup = null;
      const watchlist = [];
      for (const s of scored) {
        const t = s.tier?.code;
        if (!t || t === 'AVOID' || t === 'WEAK') continue;
        if (!bestSetup) { bestSetup = s; continue; }
        if (watchlist.length < 2) watchlist.push(s);
        else break;
      }

      // 7. Warnings
      const warnings = _buildWarnings(regime, mmBias, bestSetup);

      // 8. Atomik commit
      State.commit({
        regime,
        mmBias,
        btc:         btcAnalysis,
        eth:         ethAnalysis,
        bestSetup,
        watchlist,
        warnings,
        dataSources: Feed.detectDataSources(),
      });
    } catch (e) {
      console.warn('[TIController] process error:', e);
    } finally {
      _processing = false;
    }
  }

  function _onScanEvent(ev) {
    const results = ev?.detail?.results;
    _process(results);
  }

  function start() {
    if (_listenerAttached) return;
    window.addEventListener('vd:scan:complete', _onScanEvent);
    _listenerAttached = true;
  }

  function stop() {
    if (!_listenerAttached) return;
    window.removeEventListener('vd:scan:complete', _onScanEvent);
    _listenerAttached = false;
  }

  function refresh() {
    if (_lastScanResults) { _process(_lastScanResults); return true; }
    return false;
  }

  return { start, stop, refresh, _process };
})();
