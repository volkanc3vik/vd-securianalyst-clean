// ════════════════════════════════════════════════════════════════════
// FUTURES CONTROLLER — Orkestrasyon katmanı
// State + Calc + Liquidation + PNL motorlarını birleştirir.
// WS aboneliklerini yönetir, duplicate WS yok, abone olmadığı sembol için
// data çekmez. Pozisyon kapanınca ilgili sembol için unsubscribe yapar
// (eğer başka aktif pozisyon o sembolde yoksa).
// ════════════════════════════════════════════════════════════════════
window.FuturesController = (() => {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

  // Aboneliği bilinen semboller (sym → unsubscribe handle yoksa true)
  const _subscribedSymbols = new Set();

  // En son hit edilmiş TP/SL'leri tekrar bildirimi engellemek için
  // (her tick'te aynı event spam etmesin)
  // → bu zaten position.tp1Hit gibi flag'lerde tutulduğu için fazlası gereksiz

  // ── WS bağlantı yardımcısı ────────────────────────────────────────
  function _ensureSubscribed(symFull) {
    if (!symFull) return;
    const key = symFull.toLowerCase();
    if (_subscribedSymbols.has(key)) return;

    // WSEngine globalden gelir (eski mevcut sistem)
    if (typeof window.WSEngine !== 'undefined' && typeof window.WSEngine.subscribe === 'function') {
      try {
        window.WSEngine.subscribe(key, (data) => _onWsTick(symFull, data));
        _subscribedSymbols.add(key);
      } catch (e) {
        console.warn('[FuturesController] WS subscribe error:', e);
      }
    } else {
      // WSEngine yoksa REST fallback
      _startRestFallback(symFull);
    }
  }

  function _maybeUnsubscribe(symFull) {
    const active = window.FuturesState.getActivePositions();
    const stillUsed = active.some(p => (p.symFull || '').toLowerCase() === symFull.toLowerCase());
    if (stillUsed) return; // başka pozisyon hala kullanıyor

    const key = symFull.toLowerCase();
    if (!_subscribedSymbols.has(key)) return;

    if (typeof window.WSEngine !== 'undefined' && typeof window.WSEngine.unsubscribe === 'function') {
      try { window.WSEngine.unsubscribe(key); } catch {}
    }
    _subscribedSymbols.delete(key);

    // REST fallback timer varsa durdur
    if (_restTimers[key]) {
      clearInterval(_restTimers[key]);
      delete _restTimers[key];
    }
  }

  // ── REST fallback (WSEngine yoksa) ────────────────────────────────
  const _restTimers = {};
  function _startRestFallback(symFull) {
    const key = symFull.toLowerCase();
    if (_restTimers[key]) return;
    _restTimers[key] = setInterval(async () => {
      try {
        const url = `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symFull.toUpperCase()}`;
        const r   = await fetch(url);
        const j   = await r.json();
        if (j && j.price) _onWsTick(symFull, { lastPrice: +j.price });
      } catch {}
    }, 3000);
    _subscribedSymbols.add(key);
  }

  // ── Tick işleme ───────────────────────────────────────────────────
  function _onWsTick(symFull, data) {
    if (!data || !Number.isFinite(+data.lastPrice)) return;
    const mark = +data.lastPrice;
    const cleanFull = (symFull || '').toUpperCase();
    const active    = window.FuturesState.getActivePositions();

    active.forEach(p => {
      if ((p.symFull || '').toUpperCase() !== cleanFull) return;
      _updatePositionPrice(p, mark);
    });
  }

  function _updatePositionPrice(position, mark) {
    const FP = window.FuturesPnl;
    const FL = window.FuturesLiquidation;

    const newPnl  = FP.pnl(position.dir, position.entry, mark, position.qty);
    const newRoi  = FP.roi(newPnl, position.margin);
    const ratio   = position.mode === 'CROSS'
      ? FP.crossMarginRatio(newPnl, window.FuturesState.getBalance())
      : FP.marginRatio(newPnl, position.margin);

    const hits    = FP.checkHits(position.dir, mark, position);
    const liqHit  = FP.checkLiqHit(position.dir, mark, position.liq);

    // Yeni hit'leri tespit et (önce flag'ler false iken şimdi true olanlar)
    const patch = {
      markPrice:   mark,
      pnl:         newPnl,
      roi:         newRoi,
      marginRatio: ratio,
      lastTick:    Date.now(),
      _persist:    false,   // her tick'te localStorage yazma — sadece event'lerde
    };

    let needPersist = false;

    if (hits.tp1 && !position.tp1Hit) { patch.tp1Hit = true; needPersist = true; _emitHit(position, 'TP1', mark); }
    if (hits.tp2 && !position.tp2Hit) { patch.tp2Hit = true; needPersist = true; _emitHit(position, 'TP2', mark); }
    if (hits.tp3 && !position.tp3Hit) { patch.tp3Hit = true; needPersist = true; _emitHit(position, 'TP3', mark); }
    if (hits.sl  && !position.slHit)  { patch.slHit  = true; needPersist = true; _emitHit(position, 'SL', mark); }

    if (needPersist) patch._persist = true;

    window.FuturesState.updatePosition(position.id, patch);

    // Likidasyon hit → otomatik kapat
    if (liqHit) {
      // sadece bir kere kapatılır
      const p = window.FuturesState.getPositionById(position.id);
      if (p && p.status === 'ACTIVE') {
        closePosition(position.id, mark, 'LIQUIDATED');
      }
      return;
    }

    // SL hit → otomatik kapat (kullanıcı isterse)
    if (hits.sl && position.autoCloseOnSL !== false) {
      const p = window.FuturesState.getPositionById(position.id);
      if (p && p.status === 'ACTIVE') {
        closePosition(position.id, mark, 'SL_HIT');
      }
    }
  }

  function _emitHit(position, level, price) {
    try {
      // Bildirim sistemine ilet (eski NC var)
      if (typeof window.NC !== 'undefined' && typeof window.NC.add === 'function') {
        const sym = position.sym || (position.symFull || '').replace('USDT', '');
        window.NC.add({
          sym:  position.symFull,
          dir:  'entry',
          level: level === 'SL' ? 'high' : 'normal',
          msg:  `${level === 'SL' ? '🛑 STOP HIT' : '🎯 ' + level + ' HIT'} — ${sym} ${position.dir} @ $${(+price).toFixed(4)}`,
        });
      }
    } catch {}

    // Custom DOM event — UI dinleyebilir (pulse animasyon vs)
    try {
      document.dispatchEvent(new CustomEvent('futures:hit', {
        detail: { id: position.id, level, price, position },
      }));
    } catch {}
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Manuel pozisyon aç.
   * @param {Object} input - { sym, dir, mode, leverage, margin, entry, sl, tp1, tp2, tp3 }
   * @returns {Object} { ok, id?, error? }
   */
  function openPosition(input) {
    const FC = window.FuturesCalc;
    const FL = window.FuturesLiquidation;
    const FS = window.FuturesState;

    if (!input) return { ok: false, error: _t('fut.errInput',null,'Geçersiz girdi.') };

    const symRaw = (input.sym || '').toString().toUpperCase().trim();
    if (!symRaw) return { ok: false, error: _t('fut.errSym',null,'Sembol boş olamaz.') };
    const symFull = symRaw.endsWith('USDT') ? symRaw : symRaw + 'USDT';
    const sym     = symFull.replace('USDT', '');

    const dir     = (input.dir || 'LONG').toUpperCase();
    if (dir !== 'LONG' && dir !== 'SHORT') return { ok: false, error: _t('fut.errDir',null,'Yön LONG veya SHORT olmalı.') };

    const mode    = (input.mode || FS.getMode() || 'CROSS').toUpperCase();
    if (mode !== 'CROSS' && mode !== 'ISOLATED') return { ok: false, error: _t('fut.errMode',null,'Mod CROSS veya ISOLATED olmalı.') };

    const entry   = +input.entry;
    const lev     = +input.leverage;
    const margin  = +input.margin;
    if (!Number.isFinite(entry) || entry <= 0)   return { ok: false, error: _t('fut.errEntryInvalid',null,'Giriş fiyatı geçersiz.') };
    if (!Number.isFinite(lev) || lev < 1 || lev > 125) return { ok: false, error: _t('fut.errLevRange',null,'Kaldıraç 1-125 arası olmalı.') };
    if (!Number.isFinite(margin) || margin <= 0) return { ok: false, error: _t('fut.errMarginPos',null,'Margin pozitif olmalı.') };

    // Bakiye kontrolü
    const balance       = FS.getBalance();
    const activePos     = FS.getActivePositions();
    const usedMargin    = activePos.reduce((s, p) => s + (+p.margin || 0), 0);
    const availableBal  = balance - usedMargin;
    if (margin > availableBal + 0.01) {
      return { ok: false, error: _t('fut.errBalance',{a:availableBal.toFixed(2)},'Yetersiz bakiye. Kullanılabilir: $'+availableBal.toFixed(2)) };
    }

    // SL/TP validasyon
    const v = FC.validateLevels(dir, entry, input.sl, input.tp1, input.tp2, input.tp3);
    if (!v.valid) return { ok: false, error: v.error };

    // Hesaplamalar
    const size    = FC.positionSize(margin, lev);
    const qty     = FC.quantity(margin, lev, entry);
    const liqPrice = FL.compute({
      mode, dir, entry, leverage: lev, margin,
      walletBalance: balance,
      usedMargin,
    });

    // Pozisyon objesi
    const id = 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const position = {
      id,
      sym,
      symFull,
      dir,
      mode,
      lev:        +lev,
      margin:     +margin,
      entry:      +entry,
      qty:        +qty,
      size:       +size,
      liq:        +liqPrice,
      sl:         input.sl  ? +input.sl  : null,
      tp1:        input.tp1 ? +input.tp1 : null,
      tp2:        input.tp2 ? +input.tp2 : null,
      tp3:        input.tp3 ? +input.tp3 : null,
      markPrice:  +entry,
      pnl:        0,
      roi:        0,
      marginRatio: 0,
      tp1Hit:     false,
      tp2Hit:     false,
      tp3Hit:     false,
      slHit:      false,
      autoCloseOnSL: true,
      status:     'ACTIVE',
      openTs:     Date.now(),
      lastTick:   Date.now(),
    };

    FS.addPosition(position);
    _ensureSubscribed(symFull);

    return { ok: true, id, position };
  }

  /**
   * Pozisyonu manuel kapat.
   */
  function closePosition(id, exitPrice = null, reason = 'MANUAL') {
    const p = window.FuturesState.getPositionById(id);
    if (!p) return { ok: false, error: _t('fut.errNotFound',null,'Pozisyon bulunamadı.') };
    if (p.status !== 'ACTIVE') return { ok: false, error: _t('fut.errClosed',null,'Pozisyon zaten kapalı.') };

    const finalPrice = Number.isFinite(+exitPrice) ? +exitPrice : (p.markPrice || p.entry);
    window.FuturesState.closePosition(id, finalPrice, reason);

    // Eğer bu sembolde başka pozisyon yoksa abonelikten çık
    _maybeUnsubscribe(p.symFull);

    return { ok: true };
  }

  /**
   * Sayfa açılışında aktif pozisyonlar varsa WS aboneliklerini kur.
   */
  function rehydrate() {
    const active = window.FuturesState.getActivePositions();
    const unique = new Set(active.map(p => p.symFull));
    unique.forEach(s => _ensureSubscribed(s));
  }

  /**
   * Global cleanup — sayfa kapanırken (sayfa içi kullanımda gerek yok).
   */
  function cleanup() {
    Object.keys(_restTimers).forEach(k => clearInterval(_restTimers[k]));
    _subscribedSymbols.clear();
  }

  return {
    openPosition,
    closePosition,
    rehydrate,
    cleanup,
  };
})();
