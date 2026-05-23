// ════════════════════════════════════════════════════════════════════
// VIP TRACKER · LOGGER
// Trade event'lerini formatlı konsol mesajına çevirir.
//
// Public API:
//   TrackerLogger.tpHit(trade, targetLabel, price)
//   TrackerLogger.stopHit(trade, price)
//   TrackerLogger.breakeven(trade)
//   TrackerLogger.tradeAdded(trade)
//   TrackerLogger.tradeExpired(trade)
//   TrackerLogger.finalMessage(trade, price)   ← TP3 özel "HEDEF GELDİ"
//   TrackerLogger.pollSummary(activeCount)
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function _pct(price, base) {
    if (!Number.isFinite(+price) || !Number.isFinite(+base) || +base === 0) return null;
    return ((+price - +base) / +base) * 100;
  }

  function _fmtPct(v) {
    if (v == null || !Number.isFinite(v)) return '';
    const sign = v >= 0 ? '+' : '−';
    return `${sign}${Math.abs(v).toFixed(2)}%`;
  }

  function _fmtPrice(v) {
    const n = +v;
    if (!Number.isFinite(n)) return '—';
    if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 100)   return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 1)     return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (n >= 0.01)  return n.toLocaleString('en-US', { maximumFractionDigits: 5 });
    return n.toPrecision(4);
  }

  function _symDisp(sym) {
    if (!sym) return '—';
    const s = String(sym).toUpperCase();
    if (s.endsWith('USDT')) return s.slice(0, -4) + '/USDT';
    return s;
  }

  function tradeAdded(t) {
    console.log(
      `[VIP-TRACK] + ${t.symbol} ${t.direction} @ ${_fmtPrice(t.entry)} ` +
      `(SL ${_fmtPrice(t.stopLoss)}, TPs ${t.takeProfits.map(_fmtPrice).join('/')})`
    );
  }

  function tpHit(t, targetLabel, price) {
    // targetLabel: 'TP1' | 'TP2' | 'TP3'
    const tpIdx = parseInt(targetLabel.replace('TP', ''), 10) - 1;
    const tpPrice = t.takeProfits[tpIdx];
    const pct = _pct(tpPrice, t.entry);
    // SHORT için yüzdeyi terse çevir (kâr pozitif)
    const sign = t.direction === 'SHORT' ? -1 : 1;
    const displayPct = pct != null ? sign * pct : null;
    console.log(
      `[VIP-TRACK] ${t.symbol} ${t.direction} → ${targetLabel} HIT @ ${_fmtPrice(price)} (${_fmtPct(displayPct)})`
    );
  }

  function stopHit(t, price) {
    const pct = _pct(price, t.entry);
    const sign = t.direction === 'SHORT' ? -1 : 1;
    const displayPct = pct != null ? sign * pct : null;
    console.log(
      `[VIP-TRACK] ${t.symbol} ${t.direction} → STOP HIT @ ${_fmtPrice(price)} (${_fmtPct(displayPct)})`
    );
  }

  function breakeven(t) {
    console.log(
      `[VIP-TRACK] ${t.symbol} ${t.direction} → Breakeven aktif (SL @ ${_fmtPrice(t.entry)})`
    );
  }

  function tradeExpired(t) {
    console.log(
      `[VIP-TRACK] ${t.symbol} ${t.direction} → EXPIRED (24h doldu)`
    );
  }

  function finalMessage(t, price) {
    const tp3 = t.takeProfits[2];
    const pct = _pct(tp3, t.entry);
    const sign = t.direction === 'SHORT' ? -1 : 1;
    const displayPct = pct != null ? sign * pct : null;
    const symDisp = _symDisp(t.symbol);

    // Yapılandırılmış final mesaj — gelecekte Telegram'a da gönderilebilecek
    console.log(`[VIP-TRACK] ${t.symbol} ${t.direction} → TARGET REACHED (FINAL)`);
    console.log(
      `🏁 ${symDisp} ${t.direction} — HEDEF GELDİ\n` +
      `TP3: ${_fmtPrice(tp3)} (${_fmtPct(displayPct)})\n` +
      `Not: Final hedef tamamlandı. İşlem başarıyla sonuçlandı.`
    );
  }

  function pollSummary(activeCount) {
    if (window.VipTrackerDebug) {
      console.debug(`[VIP-Track:Poll] tick, ${activeCount} active`);
    }
  }

  window.TradeWatcherLogger = {
    tradeAdded,
    tpHit,
    stopHit,
    breakeven,
    tradeExpired,
    finalMessage,
    pollSummary,
  };
})();
