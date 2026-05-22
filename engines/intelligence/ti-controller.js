// ════════════════════════════════════════════════════════════════════
// TI CONTROLLER v2 — Orchestrator
// 1. 'vd:scan:complete' event'i dinler
// 2. Tüm pipeline'ı çalıştırır (regime, mm bias, narrator, scorer, maturity)
// 3. Panel ASLA BOŞ KALMAZ — bestSetup yoksa bile regime/BTC/ETH/MM bias gösterir
// 4. Debug logging — her aşamayı raporlar
// ════════════════════════════════════════════════════════════════════
window.TIController = (() => {
  'use strict';

  let _listenerAttached = false;
  let _lastScanResults  = null;
  let _processing       = false;
  let _debug            = true; // konsolda debug logları görünür

  function _log(...args) {
    if (_debug) console.log('[TI]', ...args);
  }
  function _warn(...args) {
    console.warn('[TI]', ...args);
  }

  // ── Funding/OI yardımcı ────────────────────────────────────────
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

  // ── Warnings ─────────────────────────────────────────────────────
  function _buildWarnings(regime, mmBias, bestSetup) {
    const warnings = [];

    if (regime?.code === 'LIQUIDITY_TRAP') {
      warnings.push({ code:'LIQ_TRAP', severity:'high',
        msg:'Liquidity trap conditions — breakouts unreliable.' });
    }
    if (regime?.code === 'CHOPPY' && regime.diagnostics?.vol?.quality === 'ELEVATED') {
      warnings.push({ code:'CHOP_VOL', severity:'med',
        msg:'Choppy market with elevated volatility — patience required.' });
    }

    if (mmBias?.headline) {
      const h = mmBias.headline.toLowerCase();
      if (h.includes('overheating') || h.includes('overextended')) {
        warnings.push({ code:'FUNDING_OH', severity:'high', msg: mmBias.headline });
      }
    }

    if (bestSetup && bestSetup.factors) {
      const fbr = bestSetup.factors.find(f => f.code === 'FBR');
      if (fbr?.available && fbr.score >= 7) {
        warnings.push({ code:'BS_FBR', severity:'high',
          msg:`${bestSetup.sym}: high fakeout risk on entry candle.` });
      }
      const fund = bestSetup.factors.find(f => f.code === 'FUNDING');
      if (fund?.available && fund.score <= 3) {
        warnings.push({ code:'BS_FUNDING', severity:'med',
          msg:`${bestSetup.sym}: funding stressed — late entry risk.` });
      }
    }

    const seen = new Set();
    return warnings.filter(w => seen.has(w.code) ? false : (seen.add(w.code), true));
  }

  // ── Ana pipeline ─────────────────────────────────────────────────
  function _process(scanResults) {
    if (_processing) { _log('reentrancy blocked'); return; }
    if (!Array.isArray(scanResults) || scanResults.length === 0) {
      _warn('empty scanResults — abort');
      return;
    }
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
        _warn('missing engines:',
          { Feed:!!Feed, Regime:!!Regime, MMBias:!!MMBias, Scorer:!!Scorer,
            Maturity:!!Maturity, Narrator:!!Narrator, State:!!State });
        return;
      }

      _log('────────── PIPELINE START ──────────');
      _log('Input: ' + scanResults.length + ' coins');

      // 1. BTC/ETH ayır
      const { btc: btcRaw, eth: ethRaw, others } = Feed.splitMajors(scanResults);
      _log('Majors split: BTC=' + (btcRaw ? '✓' : '✗') +
                       ' ETH=' + (ethRaw ? '✓' : '✗') +
                       ' Others=' + others.length);

      // 2. Regime
      const regime = Regime.detect(btcRaw, scanResults);
      _log('Regime: ' + regime.code + ' / ' + regime.label);
      _log('  trend:', regime.diagnostics?.trend);
      _log('  vol:',   regime.diagnostics?.vol);
      _log('  breadth:', regime.diagnostics?.breadth);

      // 3. MM Bias
      const mmBias = MMBias.build({
        btcData:    btcRaw,
        regimeDiag: regime.diagnostics,
        funding:    _resolveFunding(btcRaw),
        oi:         _resolveOI(btcRaw),
      });
      _log('MM Bias: ' + (mmBias?.headline || '(none)'));

      // 4. BTC + ETH narrator
      const btcAnalysis = btcRaw ? Narrator.analyzeCoin(btcRaw) : null;
      const ethAnalysis = ethRaw ? Narrator.analyzeCoin(ethRaw) : null;
      if (ethAnalysis && btcAnalysis) {
        ethAnalysis.vsBTC = Narrator.compareETHvsBTC(btcAnalysis, ethAnalysis);
      }
      _log('BTC: ' + (btcAnalysis ? btcAnalysis.dir+'/'+btcAnalysis.momentum : '(none)'));
      _log('ETH: ' + (ethAnalysis ? ethAnalysis.dir+'/'+ethAnalysis.momentum : '(none)'));

      // 5. Tüm coinleri skorla
      const scored = [];
      let scoreFailed = 0;
      let scoreSucceeded = 0;
      for (const item of others) {
        const ctx = Feed.toScorerContext(item);
        if (!ctx) { scoreFailed++; continue; }
        const r = Scorer.score(ctx);
        if (!r) { scoreFailed++; continue; }
        r.maturity = Maturity.evaluate(r);
        scored.push(r);
        scoreSucceeded++;
      }
      _log('Scored: ' + scoreSucceeded + ' / Failed: ' + scoreFailed);

      // 6. Sırala ve tier kategorize
      scored.sort((a, b) => b.score - a.score);
      const tierCounts = {};
      scored.forEach(s => {
        const t = s.tier?.code || 'UNKNOWN';
        tierCounts[t] = (tierCounts[t] || 0) + 1;
      });
      _log('Tier dağılımı:', tierCounts);

      // Top 5 skorlu coin — debug için
      const top5 = scored.slice(0, 5).map(s => `${s.sym}:${s.score}(${s.tier?.code})`);
      _log('Top 5:', top5);

      // 7. Best Setup + Watchlist seçimi
      // Esnek strateji: önce VALID+ ara, yoksa WEAK kabul et, yoksa en yüksek skorluyu al
      let bestSetup = null;
      const watchlist = [];
      const eligibleTiers = ['ELITE', 'STRONG', 'VALID', 'WEAK'];

      for (const s of scored) {
        const t = s.tier?.code;
        if (!eligibleTiers.includes(t)) continue;
        if (!bestSetup) { bestSetup = s; continue; }
        if (watchlist.length < 2) watchlist.push(s);
        else break;
      }

      // Hala yoksa — en yüksek skorlu olanı al (sadece AVOID değilse)
      if (!bestSetup && scored.length > 0 && scored[0].score >= 30) {
        bestSetup = scored[0];
        _log('Best fallback: top scored (' + bestSetup.sym + ':' + bestSetup.score + ')');
      }

      _log('Best: ' + (bestSetup ? `${bestSetup.sym} ${bestSetup.dir} ${bestSetup.score} (${bestSetup.tier?.code})` : '(none)'));
      _log('Watchlist: ' + watchlist.map(w => `${w.sym}:${w.score}`).join(', ') || '(empty)');

      // 8. Warnings
      const warnings = _buildWarnings(regime, mmBias, bestSetup);
      _log('Warnings: ' + warnings.length);

      // 9. Volatility observation (fallback intelligence)
      const volObs = _buildVolatilityObservation(regime, btcAnalysis);

      // 10. State commit — panel her zaman dolu
      State.commit({
        regime,
        mmBias,
        btc:         btcAnalysis,
        eth:         ethAnalysis,
        bestSetup,
        watchlist,
        warnings,
        volatilityObs: volObs,
        scanStats:   {
          total:     scanResults.length,
          scored:    scoreSucceeded,
          failed:    scoreFailed,
          tierCounts,
        },
        dataSources: Feed.detectDataSources(),
      });

      _log('────────── PIPELINE END ──────────');
    } catch (e) {
      _warn('PIPELINE ERROR:', e);
    } finally {
      _processing = false;
    }
  }

  function _buildVolatilityObservation(regime, btcAnalysis) {
    const vol = regime?.diagnostics?.vol;
    if (!vol) return null;
    const map = {
      'SQUEEZED': { label: 'Volatility compressed', tone: 'Awaiting expansion. Breakout likely soon.' },
      'HEALTHY':  { label: 'Healthy volatility',    tone: 'Conditions favor structured trades.' },
      'ELEVATED': { label: 'Elevated volatility',   tone: 'Wider stops required; size down.' },
      'EXTREME':  { label: 'Extreme volatility',    tone: 'Hands-off zone; high noise.' },
      'UNKNOWN':  null,
    };
    return map[vol.quality] || null;
  }

  // ── Event handler ────────────────────────────────────────────────
  function _onScanEvent(ev) {
    const results = ev?.detail?.results;
    _log('vd:scan:complete received (' + (results?.length || 0) + ' results)');
    _process(results);
  }

  function start() {
    if (_listenerAttached) return;
    window.addEventListener('vd:scan:complete', _onScanEvent);
    _listenerAttached = true;
    _log('listener attached');
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

  function setDebug(on) { _debug = !!on; }

  return { start, stop, refresh, setDebug, _process };
})();
