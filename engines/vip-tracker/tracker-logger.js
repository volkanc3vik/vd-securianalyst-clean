// ════════════════════════════════════════════════════════════════════
// VIP TRACKER · LOGGER (Mini-Aşama A — Dil Dönüşümü)
//
// HUKUKİ DÖNÜŞÜM:
//   - "TP hit / Stop hit" → "Hedef bölgeye ulaşıldı / Risk limiti test edildi"
//   - "HEDEF GELDİ / İşlem başarıyla sonuçlandı" → "Hedef bölgeleri tamamlandı"
//   - "Trade" → "Analiz takibi"
//   - Emir dili → Analiz dili
//
// Bu dosya internal console log üretir (test mode). Aşama 5'te bu
// mesajların Telegram'a yayını da aynı dile uygun olacak.
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

  // Target label dönüşümü: 'TP1' → 'Hedef bölge 1'
  function _targetLabel(tag) {
    const m = String(tag).match(/^TP(\d+)$/);
    if (m) return `Hedef bölge ${m[1]}`;
    return tag;
  }

  function tradeAdded(t) {
    // İç log — sadece konsol, kullanıcıya gösterilmez
    console.log(
      `[ANALYSIS-TRACK] + ${t.symbol} (${t.direction}) takibe alındı · ` +
      `Referans: ${_fmtPrice(t.entry)} · Risk limiti: ${_fmtPrice(t.stopLoss)} · ` +
      `Hedef bölgeler: ${t.takeProfits.map(_fmtPrice).join(' / ')}`
    );
  }

  function tpHit(t, targetLabel, price) {
    const tpIdx = parseInt(targetLabel.replace('TP', ''), 10) - 1;
    const tpPrice = t.takeProfits[tpIdx];
    const pct = _pct(tpPrice, t.entry);
    const sign = t.direction === 'SHORT' ? -1 : 1;
    const displayPct = pct != null ? sign * pct : null;
    const label = _targetLabel(targetLabel);
    console.log(
      `[ANALYSIS-TRACK] ${t.symbol} (${t.direction}) → ${label}'e ulaşıldı @ ${_fmtPrice(price)} (${_fmtPct(displayPct)})`
    );
  }

  function stopHit(t, price) {
    const pct = _pct(price, t.entry);
    const sign = t.direction === 'SHORT' ? -1 : 1;
    const displayPct = pct != null ? sign * pct : null;
    console.log(
      `[ANALYSIS-TRACK] ${t.symbol} (${t.direction}) → Risk limiti test edildi @ ${_fmtPrice(price)} (${_fmtPct(displayPct)})`
    );
  }

  function breakeven(t) {
    console.log(
      `[ANALYSIS-TRACK] ${t.symbol} (${t.direction}) → Risk limiti referans seviyesine güncellendi (${_fmtPrice(t.entry)})`
    );
  }

  function tradeExpired(t) {
    console.log(
      `[ANALYSIS-TRACK] ${t.symbol} (${t.direction}) → Takip süresi doldu (24 saat)`
    );
  }

  function finalMessage(t, price) {
    const tp3 = t.takeProfits[2];
    const pct = _pct(tp3, t.entry);
    const sign = t.direction === 'SHORT' ? -1 : 1;
    const displayPct = pct != null ? sign * pct : null;
    const symDisp = _symDisp(t.symbol);

    console.log(`[ANALYSIS-TRACK] ${t.symbol} (${t.direction}) → Tüm hedef bölgeleri tamamlandı`);
    // Aşama 5'te Telegram'a gönderilecek mesajın taslağı (şimdilik sadece console)
    console.log(
      `📊 ${symDisp} · ${t.direction} — Tüm hedef bölgeler test edildi\n` +
      `Final hedef: ${_fmtPrice(tp3)} (${_fmtPct(displayPct)})\n` +
      `Teknik analiz tamamlandı. Detaylar platformda.\n` +
      `⚠ Yatırım tavsiyesi değildir.`
    );
  }

  function pollSummary(activeCount) {
    if (window.VipTrackerDebug) {
      console.debug(`[ANALYSIS-Track:Poll] tick, ${activeCount} aktif takip`);
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
