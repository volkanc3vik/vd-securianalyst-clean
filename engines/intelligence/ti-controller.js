// ════════════════════════════════════════════════════════════════════
// TI CONTROLLER v2 — Orchestrator
// 1. 'vd:scan:complete' event'i dinler
// 2. Tüm pipeline'ı çalıştırır (regime, mm bias, narrator, scorer, maturity)
// 3. Panel ASLA BOŞ KALMAZ — bestSetup yoksa bile regime/BTC/ETH/MM bias gösterir
// 4. Debug logging — her aşamayı raporlar
// ════════════════════════════════════════════════════════════════════
window.TIController = (() => {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

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
        msg:_t('tiw.liqTrap',null,'Likidite tuzağı koşulları — kırılımlar güvenilmez.') });
    }
    if (regime?.code === 'CHOPPY' && regime.diagnostics?.vol?.quality === 'ELEVATED') {
      warnings.push({ code:'CHOP_VOL', severity:'med',
        msg:_t('tiw.chopVol',null,'Yatay piyasada yüksek volatilite — sabır gerekli.') });
    }

    if (mmBias?.headline) {
      const h = mmBias.headline.toLowerCase();
      if (h.includes('aşırı ısınmış') || h.includes('aşırı uzamış') || h.includes('aşırı negatif')) {
        warnings.push({ code:'FUNDING_OH', severity:'high', msg: mmBias.headline });
      }
    }

    if (bestSetup && bestSetup.factors) {
      const fbr = bestSetup.factors.find(f => f.code === 'FBR');
      if (fbr?.available && fbr.score >= 7) {
        warnings.push({ code:'BS_FBR', severity:'high',
          msg:_t('tiw.fbr',{sym:bestSetup.sym},bestSetup.sym+': giriş mumunda yüksek fakeout riski.') });
      }
      const fund = bestSetup.factors.find(f => f.code === 'FUNDING');
      if (fund?.available && fund.score <= 3) {
        warnings.push({ code:'BS_FUNDING', severity:'med',
          msg:_t('tiw.funding',{sym:bestSetup.sym},bestSetup.sym+': funding stres altında — geç giriş riski.') });
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
      const Pressure = window.TIMarketPressure;
      const RiskAss  = window.TIRiskAssessor;
      const Activity = window.TIActivityLog;

      if (!Feed || !Regime || !MMBias || !Scorer || !Maturity || !Narrator || !State) {
        _warn('missing core engines:',
          { Feed:!!Feed, Regime:!!Regime, MMBias:!!MMBias, Scorer:!!Scorer,
            Maturity:!!Maturity, Narrator:!!Narrator, State:!!State });
        return;
      }

      _log('────────── PIPELINE START ──────────');
      _log('Input: ' + scanResults.length + ' coins');

      // Önceki snapshot — diff için
      const prevSnapshot = State.get();

      // 1. BTC/ETH ayır
      const { btc: btcRaw, eth: ethRaw, others } = Feed.splitMajors(scanResults);
      _log('Majors split: BTC=' + (btcRaw ? '✓' : '✗') +
                       ' ETH=' + (ethRaw ? '✓' : '✗') +
                       ' Others=' + others.length);

      // 2. Regime
      const regime = Regime.detect(btcRaw, scanResults);
      _log('Regime: ' + regime.code + ' / ' + regime.label);

      // 3. Funding/OI çöz
      const btcFunding = _resolveFunding(btcRaw);
      const btcOI      = _resolveOI(btcRaw);

      // 4. MM Bias
      const mmBias = MMBias.build({
        btcData:    btcRaw,
        regimeDiag: regime.diagnostics,
        funding:    btcFunding,
        oi:         btcOI,
      });
      _log('MM Bias: ' + (mmBias?.headline || '(none)'));

      // 5. BTC + ETH narrator
      const btcAnalysis = btcRaw ? Narrator.analyzeCoin(btcRaw) : null;
      const ethAnalysis = ethRaw ? Narrator.analyzeCoin(ethRaw) : null;
      if (ethAnalysis && btcAnalysis) {
        ethAnalysis.vsBTC = Narrator.compareETHvsBTC(btcAnalysis, ethAnalysis);
      }

      // 6. Market Pressure (yeni)
      let marketPressure = null;
      if (Pressure) {
        marketPressure = Pressure.build({
          btc:        btcRaw,
          eth:        ethRaw,
          btcFunding,
          btcOI,
        });
        _log('Pressure: ' + (marketPressure?.headline || '(none)') +
             ' · ' + (marketPressure?.signals?.length || 0) + ' signals');
      }

      // 7. Tüm coinleri skorla
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

      scored.sort((a, b) => b.score - a.score);
      const tierCounts = {};
      scored.forEach(s => {
        const t = s.tier?.code || 'UNKNOWN';
        tierCounts[t] = (tierCounts[t] || 0) + 1;
      });
      _log('Tier dağılımı:', tierCounts);

      // 8. Best Setup + Watchlist
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
      if (!bestSetup && scored.length > 0 && scored[0].score >= 30) {
        bestSetup = scored[0];
      }

      // 9. Risk Assessor — best setup için ayrı risk değerlendirmesi
      if (bestSetup && RiskAss) {
        bestSetup.risk = RiskAss.assess(bestSetup, regime.diagnostics);
        _log('Best risk: ' + bestSetup.risk.level + ' (' + bestSetup.risk.score + ')');
      }

      _log('Best: ' + (bestSetup ? `${bestSetup.sym} ${bestSetup.dir} ${bestSetup.score} (${bestSetup.tier?.code}) risk=${bestSetup.risk?.level || '—'}` : '(none)'));

      // 10. Warnings
      const warnings = _buildWarnings(regime, mmBias, bestSetup);

      // 11. Volatility observation
      const volObs = _buildVolatilityObservation(regime, btcAnalysis);

      // 12. State commit
      State.commit({
        regime,
        mmBias,
        btc:           btcAnalysis,
        eth:           ethAnalysis,
        bestSetup,
        watchlist,
        warnings,
        volatilityObs: volObs,
        marketPressure,
        scanStats:     {
          total:     scanResults.length,
          scored:    scoreSucceeded,
          failed:    scoreFailed,
          tierCounts,
        },
        dataSources:   Feed.detectDataSources(),
      });

      // 13. Activity Log diff — commit'ten sonra
      if (Activity) {
        const nextSnapshot = State.get();
        const events = Activity.diff(prevSnapshot, nextSnapshot);
        events.forEach(ev => State.pushActivity(ev));
        _log('Activity events: ' + events.length);
      }

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
      'SQUEEZED': { label: _t('tiv.sqLabel',null,'Volatilite sıkışmış'), tone: _t('tiv.sqTone',null,'Genişleme bekleniyor. Kırılım yakın olabilir.') },
      'HEALTHY':  { label: _t('tiv.hlLabel',null,'Sağlıklı volatilite'), tone: _t('tiv.hlTone',null,'Koşullar yapılandırılmış işlemler için uygun.') },
      'ELEVATED': { label: _t('tiv.elLabel',null,'Yüksek volatilite'), tone: _t('tiv.elTone',null,'Daha geniş stoplar gerekli; pozisyon küçült.') },
      'EXTREME':  { label: _t('tiv.exLabel',null,'Aşırı volatilite'), tone: _t('tiv.exTone',null,'El sürme bölgesi; gürültü çok yüksek.') },
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

    // Bootstrap event — sistem başlatıldı
    const State    = window.TIState;
    const Activity = window.TIActivityLog;
    if (State && Activity) {
      State.pushActivity(Activity.bootstrapEvent());
    }

    // Partial bootstrap — WSEngine cache'inde BTC/ETH varsa erken intelligence
    _bootstrapPartial();
  }

  function _bootstrapPartial() {
    try {
      const Feed     = window.TIFeed;
      const State    = window.TIState;
      if (!Feed || !State) return;
      const partial = Feed.bootstrapPartial?.();
      if (!partial || (!partial.btc && !partial.eth && !partial.regime)) return;

      const Regime = window.TIRegime;
      const volObs = partial.regime
        ? _buildVolatilityObservation(partial.regime, partial.btc)
        : null;

      State.commitPartial({
        regime:        partial.regime,
        btc:           partial.btc,
        eth:           partial.eth,
        volatilityObs: volObs,
        dataSources:   Feed.detectDataSources(),
      });
      _log('Partial bootstrap committed');
    } catch (e) {
      _warn('Partial bootstrap error:', e);
    }
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
