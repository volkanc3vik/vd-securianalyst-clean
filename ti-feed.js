// ════════════════════════════════════════════════════════════════════
// FUTURES PNL ENGINE
// Unrealized PNL, ROI, Margin Ratio hesapları.
// LONG  : pnl = qty × (mark - entry)
// SHORT : pnl = qty × (entry - mark)
//
// ROI (Binance gösterimi): pnl / margin × 100   (leverage etkili)
// Margin Ratio: |pnl| / margin × 100   (likidasyona yakınlık göstergesi)
// ════════════════════════════════════════════════════════════════════
window.FuturesPnl = (() => {
  'use strict';

  const _num = (v) => {
    const n = +v;
    return Number.isFinite(n) ? n : 0;
  };

  /**
   * Unrealized PNL (USDT).
   * @param {string} dir - 'LONG' | 'SHORT'
   * @param {number} entry - giriş fiyatı
   * @param {number} mark - güncel mark price
   * @param {number} qty - coin miktarı
   * @returns {number}
   */
  function pnl(dir, entry, mark, qty) {
    const e = _num(entry), m = _num(mark), q = _num(qty);
    if (e <= 0 || m <= 0 || q <= 0) return 0;
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const diff   = isLong ? (m - e) : (e - m);
    return +(diff * q).toFixed(4);
  }

  /**
   * ROI yüzdesi.
   * Binance gösterimi: pnl / margin × 100
   * Bu, leverage'ı yansıtır (örn. 100x'te %1 fiyat hareketi = %100 ROI).
   */
  function roi(pnlValue, margin) {
    const p = _num(pnlValue), m = _num(margin);
    if (m <= 0) return 0;
    return +(p / m * 100).toFixed(2);
  }

  /**
   * Margin Ratio (% — likidasyona yakınlık).
   * Margin'in ne kadarı zarar tarafından yutulmuş.
   * Sadece kayıp tarafında anlam taşır; kâr varsa 0'a sabitlenir.
   *
   * Binance benzeri: marginRatio = maintMargin / (margin + unrealizedPnl) × 100
   * Burada basit yaklaşım: zarar oranı.
   */
  function marginRatio(pnlValue, margin) {
    const p = _num(pnlValue), m = _num(margin);
    if (m <= 0) return 0;
    if (p >= 0) return 0;
    return +Math.min(100, Math.abs(p) / m * 100).toFixed(1);
  }

  /**
   * Cross mode için margin ratio — toplam cüzdana göre.
   */
  function crossMarginRatio(pnlValue, walletBalance) {
    const p = _num(pnlValue), w = _num(walletBalance);
    if (w <= 0) return 0;
    if (p >= 0) return 0;
    return +Math.min(100, Math.abs(p) / w * 100).toFixed(1);
  }

  /**
   * Mark price'ın price bar üzerindeki yüzdesel konumu.
   * Bar SL'den TP3'e (yoksa TP2/TP1) doğru uzanır.
   *
   * LONG için: SL solda (0%), TP3 sağda (100%), entry aralarda.
   * SHORT için: SL sağda (0%-yansıma), TP3 solda. (UI ters render edebilir.)
   *
   * @returns {Object} { pct, entryPct, tp1Pct, tp2Pct, tp3Pct, zone }
   *   zone: 'STOP' | 'PRE_ENTRY' | 'PROFIT_1' | 'PROFIT_2' | 'PROFIT_3' | 'BEYOND'
   */
  function priceBarPosition(dir, entry, mark, sl, tp1, tp2, tp3) {
    const e = _num(entry), m = _num(mark);
    const s = sl  ? _num(sl)  : null;
    const t1 = tp1 ? _num(tp1) : null;
    const t2 = tp2 ? _num(tp2) : null;
    const t3 = tp3 ? _num(tp3) : null;
    const isLong = (dir || '').toUpperCase() === 'LONG';

    // Bar uçları — tek normalize edilmiş çizgi: SL → en uzak TP
    const tpMax = t3 || t2 || t1;
    if (!s || !tpMax || !e || !m) {
      return { pct: 50, entryPct: 50, tp1Pct: null, tp2Pct: null, tp3Pct: null, zone: 'PRE_ENTRY' };
    }

    // LONG: SL < entry < TP. Bar değeri = (x - SL) / (TP - SL)
    // SHORT: SL > entry > TP. Bar değeri = (SL - x) / (SL - TP)
    const toPct = (x) => {
      if (x === null || !Number.isFinite(x)) return null;
      const num = isLong ? (x - s) : (s - x);
      const den = isLong ? (tpMax - s) : (s - tpMax);
      if (den <= 0) return null;
      return +Math.max(0, Math.min(100, num / den * 100)).toFixed(2);
    };

    const entryPct = toPct(e);
    const pct      = toPct(m);
    const tp1Pct   = toPct(t1);
    const tp2Pct   = toPct(t2);
    const tp3Pct   = toPct(t3);

    // Zone tespiti
    let zone = 'PRE_ENTRY';
    if (pct === null) {
      zone = 'PRE_ENTRY';
    } else if (pct <= 0 || (entryPct !== null && pct < entryPct * 0.5)) {
      zone = 'STOP';
    } else if (t3 && tp3Pct !== null && pct >= tp3Pct) {
      zone = 'PROFIT_3';
    } else if (t2 && tp2Pct !== null && pct >= tp2Pct) {
      zone = 'PROFIT_2';
    } else if (t1 && tp1Pct !== null && pct >= tp1Pct) {
      zone = 'PROFIT_1';
    } else if (entryPct !== null && pct >= entryPct) {
      zone = 'IN_PROFIT';
    } else if (entryPct !== null && pct < entryPct) {
      zone = 'PRE_ENTRY';
    }

    return { pct, entryPct, tp1Pct, tp2Pct, tp3Pct, zone };
  }

  /**
   * TP/SL hit kontrolü — fiyat seviyeyi geçti mi?
   * @returns {Object} { tp1: bool, tp2: bool, tp3: bool, sl: bool }
   */
  function checkHits(dir, mark, levels) {
    const m = _num(mark);
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const out = { tp1: false, tp2: false, tp3: false, sl: false };
    if (m <= 0) return out;

    if (levels.tp1) out.tp1 = isLong ? m >= +levels.tp1 : m <= +levels.tp1;
    if (levels.tp2) out.tp2 = isLong ? m >= +levels.tp2 : m <= +levels.tp2;
    if (levels.tp3) out.tp3 = isLong ? m >= +levels.tp3 : m <= +levels.tp3;
    if (levels.sl)  out.sl  = isLong ? m <= +levels.sl  : m >= +levels.sl;

    return out;
  }

  /**
   * Likidasyon hit kontrolü.
   */
  function checkLiqHit(dir, mark, liqPrice) {
    const m = _num(mark), l = _num(liqPrice);
    if (m <= 0 || l <= 0) return false;
    const isLong = (dir || '').toUpperCase() === 'LONG';
    return isLong ? m <= l : m >= l;
  }

  return {
    pnl,
    roi,
    marginRatio,
    crossMarginRatio,
    priceBarPosition,
    checkHits,
    checkLiqHit,
  };
})();
