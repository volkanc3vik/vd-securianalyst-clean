// ════════════════════════════════════════════════════════════════════
// VIP TRACKER · STATE
// VD_STATE.activeTrades üzerinden RAM-based trade state yönetimi.
//
// Trade modeli:
//   {
//     signalId,            // benzersiz ID (timestamp + random)
//     symbol,              // 'BTCUSDT'
//     direction,           // 'LONG' | 'SHORT'
//     entry,               // giriş fiyatı
//     stopLoss,            // ilk SL (TP1 hit'te entry'ye taşınır)
//     originalStopLoss,    // ilk SL (referans, breakeven sonrası bilgi için)
//     takeProfits: [tp1, tp2, tp3],
//     confidence,
//     risk,
//     telegramMessageId,
//     status: 'active' | 'closed' | 'stopped' | 'expired',
//     hitTargets: [],      // ['TP1', 'TP2', 'TP3']
//     breakevenApplied: false,
//     createdAt,
//     updatedAt,
//     lastCheckedPrice,
//     expiresAt,           // createdAt + 24h
//   }
//
// Public API:
//   TrackerState.add(trade)
//   TrackerState.update(signalId, patch)
//   TrackerState.findActive()       → aktif trade listesi
//   TrackerState.findById(signalId)
//   TrackerState.list()              → tüm trade'ler
//   TrackerState.clear()             → tümünü sil (debug)
//   TrackerState.count()             → aktif sayısı
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  window.VD_STATE = window.VD_STATE || {};
  window.VD_STATE.activeTrades = window.VD_STATE.activeTrades || [];

  function _trades() {
    return window.VD_STATE.activeTrades;
  }

  function add(trade) {
    if (!trade || !trade.signalId) return false;
    // Aynı signalId varsa eklemeyiz
    if (_trades().some(t => t.signalId === trade.signalId)) return false;
    _trades().push(trade);
    return true;
  }

  function update(signalId, patch) {
    if (!signalId || !patch) return false;
    const t = _trades().find(x => x.signalId === signalId);
    if (!t) return false;
    Object.assign(t, patch, { updatedAt: Date.now() });
    return true;
  }

  function findById(signalId) {
    return _trades().find(t => t.signalId === signalId) || null;
  }

  function findActive() {
    return _trades().filter(t => t.status === 'active');
  }

  function list() {
    return _trades().slice();
  }

  function clear() {
    _trades().length = 0;
  }

  function count() {
    return findActive().length;
  }

  window.TradeWatcherState = { add, update, findById, findActive, list, clear, count };
})();
