// ═══════════════════════════════════════════════
// INDICATORS — Teknik analiz hesaplamaları
// UI'dan bağımsız, saf hesaplama fonksiyonları
// ═══════════════════════════════════════════════

/**
 * RSI hesapla
 */
export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains  += diff;
    else          losses -= diff;
  }
  const avgGain = gains  / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

/**
 * EMA hesapla
 */
export function calcEMA(closes, period) {
  if (closes.length < period) return closes[closes.length - 1];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * MACD hesapla
 */
export function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast   = calcEMA(closes, fast);
  const emaSlow   = calcEMA(closes, slow);
  const macdLine  = emaFast - emaSlow;

  // Signal line için son N MACD değerleri
  const macdVals = [];
  for (let i = slow; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    macdVals.push(calcEMA(slice, fast) - calcEMA(slice, slow));
  }
  const signalLine = calcEMA(macdVals, signal);
  const histogram  = macdLine - signalLine;

  return {
    macd:   +macdLine.toFixed(6),
    signal: +signalLine.toFixed(6),
    hist:   +histogram.toFixed(6),
  };
}

/**
 * Bollinger Bands hesapla
 */
export function calcBB(closes, period = 20, stdMult = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, width: 0 };
  const slice  = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b) / period;
  const std    = Math.sqrt(slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period);
  const upper  = middle + std * stdMult;
  const lower  = middle - std * stdMult;
  const width  = ((upper - lower) / middle) * 100;
  return { upper, middle, lower, width: +width.toFixed(3) };
}

/**
 * ATR hesapla
 */
export function calcATR(candles, period = 14) {
  if (candles.length < 2) return 0;
  const trs = candles.slice(1).map((c, i) =>
    Math.max(
      c.h - c.l,
      Math.abs(c.h - candles[i].c),
      Math.abs(c.l - candles[i].c)
    )
  );
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Volume Ratio — mevcut hacim / ortalama hacim
 */
export function calcVolumeRatio(candles, period = 10) {
  if (candles.length < period + 1) return 1;
  const recent = candles.slice(-period - 1);
  const avg    = recent.slice(0, period).reduce((s, c) => s + c.v, 0) / period;
  const cur    = recent[recent.length - 1].v;
  return avg > 0 ? +(cur / avg).toFixed(2) : 1;
}

/**
 * Tüm indikatörleri tek seferde hesapla
 */
export function calcAllIndicators(closes, candles) {
  const ema9  = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const ema50 = calcEMA(closes, 50);
  const rsi   = calcRSI(closes);
  const macd  = calcMACD(closes);
  const bb    = calcBB(closes);
  const atr   = calcATR(candles);
  const volR  = calcVolumeRatio(candles);

  // EMA alignment string
  const emaAlign = ema9 > ema21 && ema21 > ema50 ? '▲▲▲'
    : ema9 < ema21 && ema21 < ema50 ? '▼▼▼'
    : ema9 > ema21 ? '▲▲—'
    : '▼▼—';

  return { ema9, ema21, ema50, emaAlign, rsi, macd, bb, atr, volR };
}
