// ════════════════════════════════════════════════════════════════════
// TI STATE — Trading Intelligence single source of truth
// Snapshot pattern: tüm modüller atomik bir snapshot okur/yazar.
// UI sadece state değiştiğinde re-render olur (event-driven).
// ════════════════════════════════════════════════════════════════════
window.TIState = (() => {
  'use strict';

  const _emptySnapshot = () => ({
    ts:             0,
    ready:          false,
    partial:        false,   // sayfa açılışında ilk scan'den ÖNCE gösterilen erken state
    regime:         null,
    mmBias:         null,
    btc:            null,
    eth:            null,
    bestSetup:      null,
    watchlist:      [],
    warnings:       [],
    volatilityObs:  null,
    marketPressure: null,    // { signals: [], headline, intensity: 0-100 }
    activityFeed:   [],      // son N olay { ts, code, severity, msg, category }
    scanStats:      null,
    dataSources:    { binance: false, coinglass: 'OFF', ws: false },
  });

  const ACTIVITY_MAX = 12;   // hafıza-hafif, son 12 olay yeter
  const ACTIVITY_DEDUPE_MS = 90 * 1000; // 90 sn içinde aynı code tekrarlamaz

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

  /**
   * Hafif olay ekleme — activity feed için.
   * Aynı code 90sn içinde tekrarlamaz (spam koruması).
   */
  function pushActivity(event) {
    if (!event || !event.code || !event.msg) return false;
    const now = Date.now();
    const recent = _snapshot.activityFeed || [];
    // Dedupe: aynı code yakın zamanda varsa atla
    const dup = recent.find(e => e.code === event.code && (now - e.ts) < ACTIVITY_DEDUPE_MS);
    if (dup) return false;
    const next = [
      { ts: now, code: event.code, severity: event.severity || 'info',
        msg: event.msg, category: event.category || 'market' },
      ...recent,
    ].slice(0, ACTIVITY_MAX);
    _snapshot = { ..._snapshot, activityFeed: next };
    _notify();
    return true;
  }

  /**
   * Partial bootstrap commit — ilk scan gelmeden gösterilecek erken intelligence.
   */
  function commitPartial(partial) {
    if (!partial || typeof partial !== 'object') return;
    _snapshot = {
      ..._snapshot,
      ...partial,
      ts: Date.now(),
      partial: true,
      ready: true,
    };
    _notify();
  }

  function reset() {
    _snapshot = _emptySnapshot();
    _notify();
  }

  return { subscribe, get, commit, commitPartial, pushActivity, reset };
})();
