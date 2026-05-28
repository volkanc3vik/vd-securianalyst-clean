// ════════════════════════════════════════════════════════════════════
// FUTURES CALC — Saf hesaplama fonksiyonları
// DOM bağımsız. Tüm input validasyonu burada yapılır.
// Binance Futures USDT-margined perpetual mantığı.
// ════════════════════════════════════════════════════════════════════
window.FuturesCalc = (() => {
  'use strict';

  // ── Yardımcılar ───────────────────────────────────────────────────
  const _num = (v) => {
    const n = +v;
    return Number.isFinite(n) ? n : 0;
  };

  const _positive = (v) => {
    const n = _num(v);
    return n > 0 ? n : 0;
  };

  /**
   * Bir sayıyı belirli ondalık basamağa yuvarla (binary float toleranslı).
   */
  function round(value, decimals = 4) {
    const n = _num(value);
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
  }

  // ── Çekirdek hesaplamalar ─────────────────────────────────────────

  /**
   * Pozisyon büyüklüğü (notional USDT).
   * Binance: positionSize = margin × leverage
   */
  function positionSize(margin, leverage) {
    const m = _positive(margin);
    const l = _positive(leverage);
    if (m === 0 || l === 0) return 0;
    return round(m * l, 4);
  }

  /**
   * Coin miktarı (quantity).
   * qty = positionSize / entryPrice
   */
  function quantity(margin, leverage, entryPrice) {
    const e = _positive(entryPrice);
    if (e === 0) return 0;
    const size = positionSize(margin, leverage);
    return round(size / e, 8);
  }

  /**
   * Required initial margin verilen size & leverage için.
   * margin = size / leverage
   */
  function initialMargin(positionSize, leverage) {
    const s = _positive(positionSize);
    const l = _positive(leverage);
    if (l === 0) return 0;
    return round(s / l, 4);
  }

  // ── TP/SL validasyonu ─────────────────────────────────────────────
  /**
   * Verilen değerler işlemin yönüne göre tutarlı mı?
   * LONG için: SL < entry < TP1 ≤ TP2 ≤ TP3
   * SHORT için: SL > entry > TP1 ≥ TP2 ≥ TP3
   * @returns {Object} { valid: bool, error: string | null }
   */
  function validateLevels(dir, entry, sl, tp1, tp2, tp3) {
    const D  = (dir || '').toUpperCase();
    const e  = _num(entry);
    if (e <= 0) return { valid: false, error: 'Giriş fiyatı pozitif olmalı.' };
    if (D !== 'LONG' && D !== 'SHORT') return { valid: false, error: 'Yön LONG veya SHORT olmalı.' };

    const isLong = D === 'LONG';

    // SL kontrolü (opsiyonel)
    if (sl !== null && sl !== undefined && sl !== '' && sl !== 0) {
      const s = _num(sl);
      if (s <= 0) return { valid: false, error: 'Stop Loss pozitif olmalı.' };
      if (isLong  && s >= e) return { valid: false, error: 'LONG için Stop Loss girişten küçük olmalı.' };
      if (!isLong && s <= e) return { valid: false, error: 'SHORT için Stop Loss girişten büyük olmalı.' };
    }

    // TP'leri sırala
    const tps = [];
    [tp1, tp2, tp3].forEach((tp, i) => {
      if (tp !== null && tp !== undefined && tp !== '' && tp !== 0) {
        const t = _num(tp);
        if (t > 0) tps.push({ idx: i + 1, val: t });
      }
    });

    for (const { idx, val } of tps) {
      if (isLong  && val <= e) return { valid: false, error: `LONG için TP${idx} girişten büyük olmalı.` };
      if (!isLong && val >= e) return { valid: false, error: `SHORT için TP${idx} girişten küçük olmalı.` };
    }

    return { valid: true, error: null };
  }

  // ── Risk-Reward ───────────────────────────────────────────────────
  /**
   * R/R oranı = (TP - entry) / (entry - SL)  (LONG için)
   * @returns {number | null}
   */
  function riskReward(dir, entry, sl, tp) {
    const e = _num(entry), s = _num(sl), t = _num(tp);
    if (e <= 0 || s <= 0 || t <= 0) return null;
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const risk   = isLong ? (e - s) : (s - e);
    const reward = isLong ? (t - e) : (e - t);
    if (risk <= 0 || reward <= 0) return null;
    return round(reward / risk, 2);
  }

  /**
   * Position'ın tahmini SL kaybı (USDT cinsinden).
   */
  function expectedLoss(dir, entry, sl, qty) {
    const e = _num(entry), s = _num(sl), q = _num(qty);
    if (e <= 0 || s <= 0 || q <= 0) return 0;
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const diff   = isLong ? (e - s) : (s - e);
    if (diff <= 0) return 0;
    return round(diff * q, 2);
  }

  /**
   * Position'ın tahmini TP kazancı (USDT cinsinden).
   */
  function expectedGain(dir, entry, tp, qty) {
    const e = _num(entry), t = _num(tp), q = _num(qty);
    if (e <= 0 || t <= 0 || q <= 0) return 0;
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const diff   = isLong ? (t - e) : (e - t);
    if (diff <= 0) return 0;
    return round(diff * q, 2);
  }

  // ── Public API ────────────────────────────────────────────────────
  return {
    round,
    positionSize,
    quantity,
    initialMargin,
    validateLevels,
    riskReward,
    expectedLoss,
    expectedGain,
  };
})();
