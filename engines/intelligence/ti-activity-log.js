// ════════════════════════════════════════════════════════════════════
// TI ACTIVITY LOG
// State diff motoru — önceki ve şu anki snapshot'ı karşılaştırarak
// anlamlı olaylar üretir. Spam yok — sadece gerçek değişimler loglanır.
//
// Çıktı: TIState.pushActivity() ile state'e enjekte edilen event listesi.
//
// Olay kategorileri:
//   - regime       (regime kodu değişti)
//   - pressure     (pressure sinyali eklendi/değişti)
//   - setup        (best setup leader değişti)
//   - volatility   (vol kalitesi sınıfı değişti)
//   - scan         (scan tamamlandı — info olay)
//   - btc/eth      (momentum/dir değişimi)
// ════════════════════════════════════════════════════════════════════
window.TIActivityLog = (() => {
  // ── 11. İŞ: erişim maskesi — tek doğruluk kaynağı VDAccess.canAccessSymbol ──
  // VDAccess yoksa AÇIK davranır (premium deneyimi yük sırası aksiliklerinde kırılmasın).
  function _symLocked(sym) {
    try {
      if (window.VDAccess && typeof window.VDAccess.canAccessSymbol === 'function') {
        return !window.VDAccess.canAccessSymbol(sym);
      }
    } catch (e) {}
    return false;
  }
  function _maskSym(sym) { return _symLocked(sym) ? '🔒•••' : sym; }

  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

  /**
   * Önceki ve yeni snapshot arasındaki anlamlı değişimleri tespit eder.
   * @param {Object} prev - bir önceki snapshot
   * @param {Object} next - şu anki snapshot
   * @returns {Array} events
   */
  function diff(prev, next) {
    const events = [];
    if (!next) return events;

    // ── 1. Scan tamamlandı (her zaman ilk event) ────────────────
    if (next.scanStats?.total) {
      events.push({
        code: 'SCAN_COMPLETE',
        severity: 'info',
        category: 'system',
        msg: _t('tia.scanDone',{n:next.scanStats.total},'Tarama tamamlandı — '+next.scanStats.total+' coin değerlendirildi.'),
      });
    }

    // ── 2. Regime değişimi ──────────────────────────────────────
    if (prev?.regime?.code && next.regime?.code && prev.regime.code !== next.regime.code) {
      events.push({
        code: 'REGIME_SHIFT',
        severity: 'high',
        category: 'regime',
        msg: _t('tia.regimeShift',{a:prev.regime.label,b:next.regime.label},'Piyasa rejimi değişti: '+prev.regime.label+' → '+next.regime.label),
      });
    }

    // ── 3. Volatility kondisyon değişimi ────────────────────────
    const prevVol = prev?.regime?.diagnostics?.vol?.quality;
    const nextVol = next.regime?.diagnostics?.vol?.quality;
    if (prevVol && nextVol && prevVol !== nextVol) {
      events.push({
        code: 'VOL_CONDITION_CHANGE',
        severity: 'med',
        category: 'volatility',
        msg: _t('tia.volShift',{a:_volTR(prevVol),b:_volTR(nextVol)},'Volatilite kondisyonu: '+_volTR(prevVol)+' → '+_volTR(nextVol)),
      });
    }

    // ── 4. Setup leader değişimi ────────────────────────────────
    const prevSetup = prev?.bestSetup?.sym;
    const nextSetup = next.bestSetup?.sym;
    if (nextSetup && prevSetup !== nextSetup) {
      if (prevSetup) {
        events.push({
          code: 'SETUP_LEADER_CHANGE',
          severity: 'med',
          category: 'setup',
          msg: _t('tia.leaderChange',{a:prevSetup,b:nextSetup,s:next.bestSetup.score},'Lider setup değişti: '+prevSetup+' → '+nextSetup+' ('+next.bestSetup.score+')'),
        });
      } else {
        events.push({
          code: 'SETUP_LEADER_NEW',
          severity: 'info',
          category: 'setup',
          msg: _t('tia.leaderNew',{sym:_maskSym(nextSetup),dir:next.bestSetup.dir,s:next.bestSetup.score},'Yeni lider setup: '+_maskSym(nextSetup)+' '+next.bestSetup.dir+' · skor '+next.bestSetup.score),
        });
      }
    }

    // ── 5. Pressure sinyalleri (yeni eklenenler) ────────────────
    const prevPressureCodes = new Set((prev?.marketPressure?.signals || []).map(s => s.code));
    const nextPressure = next.marketPressure?.signals || [];
    nextPressure.forEach(sig => {
      if (!prevPressureCodes.has(sig.code)) {
        events.push({
          code: 'PRESSURE_' + sig.code,
          severity: sig.severity || 'med',
          category: 'pressure',
          msg: sig.label,
        });
      }
    });

    // ── 6. BTC dir/momentum değişimi ────────────────────────────
    if (prev?.btc?.dir && next.btc?.dir && prev.btc.dir !== next.btc.dir) {
      events.push({
        code: 'BTC_DIR_CHANGE',
        severity: 'high',
        category: 'btc',
        msg: _t('tia.btcDir',{a:_dirTR(prev.btc.dir),b:_dirTR(next.btc.dir)},'BTC yön değişimi: '+_dirTR(prev.btc.dir)+' → '+_dirTR(next.btc.dir)),
      });
    }
    if (prev?.btc?.momentum && next.btc?.momentum && prev.btc.momentum !== next.btc.momentum) {
      // Sadece kritik geçişler
      const criticalShifts = [
        ['Strong', 'Weakening'], ['Strong', 'Exhausted'],
        ['Healthy', 'Weakening'], ['Weakening', 'Strong'],
        ['Exhausted', 'Building'],
      ];
      const m = criticalShifts.find(([a,b]) => prev.btc.momentum === a && next.btc.momentum === b);
      if (m) {
        events.push({
          code: 'BTC_MOMENTUM_SHIFT',
          severity: 'med',
          category: 'btc',
          msg: `BTC momentum: ${m[0]} → ${m[1]}`,
        });
      }
    }

    // ── 7. ETH dir değişimi (BTC kadar kritik değil ama önemli) ─
    if (prev?.eth?.dir && next.eth?.dir && prev.eth.dir !== next.eth.dir) {
      events.push({
        code: 'ETH_DIR_CHANGE',
        severity: 'med',
        category: 'eth',
        msg: _t('tia.ethDir',{a:_dirTR(prev.eth.dir),b:_dirTR(next.eth.dir)},'ETH yön değişimi: '+_dirTR(prev.eth.dir)+' → '+_dirTR(next.eth.dir)),
      });
    }

    return events;
  }

  function _volTR(v) {
    switch (v) {
      case 'SQUEEZED':  return _t('tia.volSqueezed',null,'Sıkışık');
      case 'HEALTHY':   return _t('tia.volHealthy',null,'Sağlıklı');
      case 'ELEVATED':  return _t('tia.volElevated',null,'Yüksek');
      case 'EXTREME':   return _t('tia.volExtreme',null,'Aşırı');
      default:          return v;
    }
  }

  function _dirTR(d) {
    switch (d) {
      case 'UP':   return _t('tia.dirUp',null,'Yükseliş');
      case 'DOWN': return _t('tia.dirDown',null,'Düşüş');
      case 'FLAT': return _t('tia.dirFlat',null,'Yatay');
      default:     return d;
    }
  }

  /**
   * Bootstrap event — sistem başlatıldığında.
   */
  function bootstrapEvent() {
    return {
      code: 'TI_BOOTSTRAP',
      severity: 'info',
      category: 'system',
      msg: _t('tia.ready',null,'Piyasa istihbarat motoru hazır.'),
    };
  }

  return { diff, bootstrapEvent };
})();
