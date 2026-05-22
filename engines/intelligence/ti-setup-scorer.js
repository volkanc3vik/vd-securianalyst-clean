// ════════════════════════════════════════════════════════════════════
// TI SETUP SCORER — 13-faktör ağırlıklı setup kalite skoru
//
// Felsefe:
//   - ELITE için 90+ skor + en az 3 faktör 8+/10
//   - Veri yoksa o faktör skordan ÇIKARILIR (fake fallback yok)
//   - FBR negatif faktör — yüksek skor cezalandırır
//
// API: score(ctx) → { sym, dir, score, tier, factors, ... }
// ════════════════════════════════════════════════════════════════════
window.TISetupScorer = (() => {
  'use strict';

  const _num = (v) => Number.isFinite(+v) ? +v : 0;

  const FACTOR_DEFS = [
    { code: 'STRUCTURE',  label: 'Market Structure',     weight: 12 },
    { code: 'LIQUIDITY',  label: 'Liquidity Behavior',   weight: 11 },
    { code: 'FUNDING',    label: 'Funding Health',       weight: 8  },
    { code: 'OI',         label: 'Open Interest',        weight: 9  },
    { code: 'LIQS',       label: 'Liquidation Position', weight: 9  },
    { code: 'VOLUME',     label: 'Volume Confirmation',  weight: 8  },
    { code: 'VOLATILITY', label: 'Volatility Quality',   weight: 7  },
    { code: 'MOMENTUM',   label: 'Momentum Health',      weight: 8  },
    { code: 'HTF',        label: 'HTF Alignment',        weight: 9  },
    { code: 'SMC',        label: 'SMC Confirmations',    weight: 8  },
    { code: 'TREND',      label: 'Trend Alignment',      weight: 6  },
    { code: 'FBR',        label: 'Fake Breakout Risk',   weight: 10, negative: true },
    { code: 'RR',         label: 'Risk/Reward Quality',  weight: 5  },
  ];

  // ── Faktör değerlendiriciler ─────────────────────────────────────
  function _structure(ctx) {
    const smc = ctx.smcData;
    if (!smc) return { available: false };
    let s = 5;
    if (smc.bos)   s += 2;
    if (smc.choch) s += 1;
    if (smc.structure === 'BULLISH' && ctx.dir === 'LONG')  s += 2;
    if (smc.structure === 'BEARISH' && ctx.dir === 'SHORT') s += 2;
    return { available: true, score: Math.max(0, Math.min(10, s)) };
  }

  function _liquidity(ctx) {
    const smc = ctx.smcData;
    if (!smc) return { available: false };
    let s = 4;
    if (smc.liquiditySweep) s += 3;
    if (smc.equalHighs || smc.equalLows) s += 1;
    if (smc.orderBlock) s += 2;
    return { available: true, score: Math.max(0, Math.min(10, s)) };
  }

  function _funding(ctx) {
    const f = ctx.funding;
    if (!f || !Number.isFinite(+f.rate)) return { available: false };
    const r = +f.rate;
    const absR = Math.abs(r);
    let s;
    if (absR < 0.01)      s = 9;
    else if (absR < 0.03) s = 7;
    else if (absR < 0.05) s = 4;
    else                  s = 1;
    if (ctx.dir === 'LONG'  && r > 0.03)  s = Math.max(0, s - 2);
    if (ctx.dir === 'SHORT' && r < -0.03) s = Math.max(0, s - 2);
    return { available: true, score: s };
  }

  function _oi(ctx) {
    const oi = ctx.oi;
    if (!oi) return { available: false };
    const chg = _num(oi.change24h) || _num(oi.changePercent);
    const closes = ctx.closes;
    if (!closes || closes.length < 5) return { available: false };
    const priceChg = (closes[closes.length-1] - closes[closes.length-5]) / closes[closes.length-5];
    const isLong = ctx.dir === 'LONG';

    if (isLong  && priceChg > 0 && chg > 0)   return { available: true, score: 9 };
    if (!isLong && priceChg < 0 && chg > 0)   return { available: true, score: 9 };
    if (isLong  && priceChg > 0 && chg < 0)   return { available: true, score: 4 };
    if (!isLong && priceChg < 0 && chg < 0)   return { available: true, score: 4 };
    return { available: true, score: 6 };
  }

  function _liqs(ctx) {
    if (typeof window.LiquidationEngine === 'undefined') return { available: false };
    try {
      const recent = window.LiquidationEngine.getRecentStats?.();
      if (!recent) return { available: false };
      const longL  = _num(recent.longLiqs || recent.longs);
      const shortL = _num(recent.shortLiqs || recent.shorts);
      const total  = longL + shortL;
      if (total === 0) return { available: false };
      const longRatio = longL / total;
      const isLong = ctx.dir === 'LONG';
      if (isLong) {
        if (longRatio < 0.3) return { available: true, score: 9 };
        if (longRatio > 0.7) return { available: true, score: 7 };
        return { available: true, score: 5 };
      } else {
        if (longRatio > 0.7) return { available: true, score: 9 };
        if (longRatio < 0.3) return { available: true, score: 7 };
        return { available: true, score: 5 };
      }
    } catch { return { available: false }; }
  }

  function _volume(ctx) {
    const candles = ctx.candles;
    if (!candles || candles.length < 20) return { available: false };
    const recent = candles.slice(-5).map(c => +c.v || 0);
    const baseline = candles.slice(-20, -5).map(c => +c.v || 0);
    const avgRecent = recent.reduce((a,b) => a+b, 0) / recent.length;
    const avgBase   = baseline.reduce((a,b) => a+b, 0) / baseline.length;
    if (avgBase === 0) return { available: false };
    const ratio = avgRecent / avgBase;
    let s;
    if (ratio > 1.5)      s = 9;
    else if (ratio > 1.2) s = 7;
    else if (ratio > 0.9) s = 5;
    else                  s = 3;
    return { available: true, score: s };
  }

  function _volatility(ctx) {
    const ind = ctx.ind;
    if (!ind || !ind.atr || !ctx.closes) return { available: false };
    const last = ctx.closes[ctx.closes.length - 1];
    if (!last) return { available: false };
    const atrPct = ind.atr / last * 100;
    let s;
    if (atrPct < 0.4)      s = 3;
    else if (atrPct < 1.2) s = 9;
    else if (atrPct < 2.5) s = 6;
    else                    s = 3;
    return { available: true, score: s };
  }

  function _momentum(ctx) {
    const ind = ctx.ind;
    if (!ind) return { available: false };
    const rsi = ind.rsi;
    if (!Number.isFinite(rsi)) return { available: false };
    const isLong = ctx.dir === 'LONG';
    let s = 5;

    if (isLong) {
      if (rsi > 70)      s = 3;
      else if (rsi > 55) s = 8;
      else if (rsi > 45) s = 7;
      else if (rsi > 30) s = 5;
      else               s = 4;
    } else {
      if (rsi < 30)      s = 3;
      else if (rsi < 45) s = 8;
      else if (rsi < 55) s = 7;
      else if (rsi < 70) s = 5;
      else               s = 4;
    }

    if (ind.macd?.histogram > 0 && isLong)  s = Math.min(10, s + 1);
    if (ind.macd?.histogram < 0 && !isLong) s = Math.min(10, s + 1);
    if (ind.macd?.histogram < 0 && isLong)  s = Math.max(0, s - 1);
    if (ind.macd?.histogram > 0 && !isLong) s = Math.max(0, s - 1);

    return { available: true, score: s };
  }

  function _htf(ctx) {
    const ind = ctx.ind;
    if (!ind) return { available: false };
    const e9  = ind.ema9  || ind.e9;
    const e21 = ind.ema21 || ind.e21;
    const e50 = ind.ema50 || ind.e50;
    if (!e9 || !e21 || !e50) return { available: false };
    const isLong = ctx.dir === 'LONG';

    let s = 5;
    if (isLong) {
      if (e9 > e21 && e21 > e50)      s = 9;
      else if (e9 > e21 || e21 > e50) s = 6;
      else                             s = 3;
    } else {
      if (e9 < e21 && e21 < e50)      s = 9;
      else if (e9 < e21 || e21 < e50) s = 6;
      else                             s = 3;
    }
    return { available: true, score: s };
  }

  function _smc(ctx) {
    const smc = ctx.smcData;
    if (!smc) return { available: false };
    let s = 4;
    if (smc.orderBlock)    s += 2;
    if (smc.fvg)           s += 2;
    if (smc.breakerBlock)  s += 1;
    if (smc.confluence >= 2) s += 2;
    return { available: true, score: Math.max(0, Math.min(10, s)) };
  }

  function _trendAlign(ctx) {
    const ind = ctx.ind;
    if (!ind) return { available: false };
    const e21 = ind.ema21 || ind.e21;
    const e50 = ind.ema50 || ind.e50;
    if (!e21 || !e50 || !ctx.closes) return { available: false };
    const last = ctx.closes[ctx.closes.length - 1];
    const isLong = ctx.dir === 'LONG';

    let s = 5;
    if (isLong  && last > e21 && last > e50)       s = 9;
    else if (!isLong && last < e21 && last < e50)  s = 9;
    else if (isLong  && last > e50)                s = 7;
    else if (!isLong && last < e50)                s = 7;
    else                                            s = 3;
    return { available: true, score: s };
  }

  function _fbr(ctx) {
    if (typeof window.FBDetector !== 'undefined') {
      try {
        const fb = window.FBDetector.detect?.(ctx.candles, ctx.dir);
        if (!fb) return { available: false };
        return { available: true, score: Math.max(0, Math.min(10, (+fb.risk || 0) * 10)) };
      } catch {}
    }
    // candle-bazlı fallback
    if (!ctx.candles || ctx.candles.length < 5) return { available: false };
    const c   = ctx.candles[ctx.candles.length - 1];
    const range = c.h - c.l;
    if (!range) return { available: false };
    const body      = Math.abs(c.c - c.o);
    const upperWick = c.h - Math.max(c.c, c.o);
    const lowerWick = Math.min(c.c, c.o) - c.l;
    let risk = 0;
    if (ctx.dir === 'LONG'  && upperWick / range > 0.5) risk = 8;
    if (ctx.dir === 'SHORT' && lowerWick / range > 0.5) risk = 8;
    if (body / range < 0.3) risk = Math.max(risk, 5);
    return { available: true, score: risk };
  }

  function _rr(ctx) {
    const entry = +ctx.entry, sl = +ctx.sl, tp = +ctx.tp1;
    if (!entry || !sl || !tp) return { available: false };
    const risk   = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    if (risk <= 0) return { available: false };
    const rr = reward / risk;
    let s;
    if (rr >= 3)      s = 10;
    else if (rr >= 2) s = 8;
    else if (rr >= 1.5) s = 6;
    else if (rr >= 1) s = 4;
    else              s = 2;
    return { available: true, score: s };
  }

  const _evaluators = {
    STRUCTURE: _structure, LIQUIDITY: _liquidity, FUNDING: _funding,
    OI: _oi, LIQS: _liqs, VOLUME: _volume, VOLATILITY: _volatility,
    MOMENTUM: _momentum, HTF: _htf, SMC: _smc, TREND: _trendAlign,
    FBR: _fbr, RR: _rr,
  };

  function _tierFor(score, factors) {
    if (score >= 90) {
      const strong = factors.filter(f => !f.negative && f.available && f.score >= 8).length;
      if (strong >= 3) return { code: 'ELITE',  label: 'ELITE SETUP',  color: 'purple' };
      return                  { code: 'STRONG', label: 'STRONG SETUP', color: 'cyan' };
    }
    if (score >= 80) return { code: 'STRONG', label: 'STRONG SETUP', color: 'cyan' };
    if (score >= 70) return { code: 'VALID',  label: 'VALID SETUP',  color: 'green' };
    if (score >= 60) return { code: 'WEAK',   label: 'WEAK SETUP',   color: 'yellow' };
    return                  { code: 'AVOID',  label: 'AVOID',         color: 'red' };
  }

  /**
   * Setup'ı skorla.
   * @param {Object} ctx - { sym, dir, closes, candles, ind, entry, sl, tp1, tp2, tp3, smcData, funding, oi }
   */
  function score(ctx) {
    if (!ctx || !ctx.dir) return null;

    const factors = [];
    const missing = [];

    for (const def of FACTOR_DEFS) {
      const fn = _evaluators[def.code];
      const r  = fn ? fn(ctx) : { available: false };

      if (!r || !r.available) {
        missing.push(def.code);
        factors.push({ code: def.code, label: def.label, weight: def.weight,
                       available: false, score: null, negative: !!def.negative });
        continue;
      }

      const s = Math.max(0, Math.min(10, +r.score || 0));
      factors.push({ code: def.code, label: def.label, weight: def.weight,
                     available: true, score: s, negative: !!def.negative });
    }

    // Normalize: pozitif faktörlerin ağırlıklı yüzdesi - FBR cezası
    const positiveFactors = factors.filter(f => f.available && !f.negative);
    const positiveWeightTotal = positiveFactors.reduce((s, f) => s + f.weight, 0);
    const positiveScore       = positiveFactors.reduce((s, f) => s + (f.score / 10) * f.weight, 0);

    let finalScore = 0;
    if (positiveWeightTotal > 0) {
      finalScore = (positiveScore / positiveWeightTotal) * 100;
      const negativeContribution = factors
        .filter(f => f.available && f.negative)
        .reduce((s, f) => s + (f.score / 10) * f.weight, 0);
      const fbrPenalty = Math.min(15, negativeContribution);
      finalScore = Math.max(0, finalScore - fbrPenalty);
    }

    finalScore = Math.round(finalScore);
    const tier = _tierFor(finalScore, factors);

    return {
      sym:            ctx.sym,
      dir:            ctx.dir,
      score:          finalScore,
      tier,
      factors,
      availableCount: factors.filter(f => f.available).length,
      missingFactors: missing,
      entry: ctx.entry, sl: ctx.sl, tp1: ctx.tp1, tp2: ctx.tp2, tp3: ctx.tp3,
      price: ctx.closes ? ctx.closes[ctx.closes.length - 1] : null,
    };
  }

  return { score, FACTOR_DEFS };
})();
