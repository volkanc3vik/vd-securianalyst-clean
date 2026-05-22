// ════════════════════════════════════════════════════════════════════
// TI STATE — Trading Intelligence single source of truth
// Snapshot pattern: tüm modüller atomik bir snapshot okur/yazar.
// UI sadece state değiştiğinde re-render olur (event-driven).
// ════════════════════════════════════════════════════════════════════
window.TIState = (() => {
  'use strict';

  const _emptySnapshot = () => ({
    ts:          0,
    ready:       false,
    regime:      null,
    mmBias:      null,
    btc:         null,
    eth:         null,
    bestSetup:   null,
    watchlist:   [],
    warnings:    [],
    dataSources: { binance: false, coinglass: false, ws: false },
  });

  let _snapshot = _emptySnapshot();
  const _listeners = new Set();

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  }

  function _notify() {
    _listeners.forEach(fn => {
      try { fn(_snapshot); } catch (e) {
        console.warn('[TIState] listener error:', e);
      }
    });
  }

  function get() {
    // Donmuş shallow copy — UI mutate edemesin
    return Object.freeze({ ..._snapshot });
  }

  /**
   * Atomik snapshot güncelleme. Sadece TI Controller bunu çağırır.
   */
  function commit(partial) {
    if (!partial || typeof partial !== 'object') return;
    _snapshot = {
      ..._snapshot,
      ...partial,
      ts: Date.now(),
      ready: true,
    };
    _notify();
  }

  function reset() {
    _snapshot = _emptySnapshot();
    _notify();
  }

  return { subscribe, get, commit, reset };
})();
