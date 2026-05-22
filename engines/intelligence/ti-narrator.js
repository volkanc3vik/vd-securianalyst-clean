// ════════════════════════════════════════════════════════════════════
// TI NARRATOR — BTC ve ETH için professional commentary üretici
// Şablon değil — gerçek koşullara göre çoklu cümle çeşitliliği.
//
// Çıktı: { dir, structure, momentum, risk, summary }
//   dir:       'UP' | 'DOWN' | 'FLAT'
//   structure: kısa cümle ('Bullish structure intact')
//   momentum:  'Strong' | 'Healthy' | 'Weakening' | 'Exhausted' | 'Building' | 'Weak'
//   risk:      'Low' | 'Moderate' | 'High'
//   summary:   tek cümle özet
// ════════════════════════════════════════════════════════════════════
window.TINarrator = (() => {
  'use strict';

  const _num = (v) => Number.isFinite(+v) ? +v : 0;

  function _dirAnalysis(closes, ind) {
    if (!closes || closes.length < 20 || !ind) return null;
    const last = closes[closes.length - 1];
    const e9   = ind.ema9  || ind.e9;
    const e21  = ind.ema21 || ind.e21;
    const e50  = ind.ema50 || ind.e50;
    if (!e9 || !e21 || !e50) return null;

    let dir = 'FLAT';
    if (e9 > e21 && e21 > e50 && last > e21) dir = 'UP';
    else if (e9 < e21 && e21 < e50 && last < e21) dir = 'DOWN';

    return { dir, last, e9, e21, e50 };
  }

  function _momentumLevel(ind, dir) {
    if (!ind) return 'Building';
    const rsi   = _num(ind.rsi);
    const macdH = _num(ind.macd?.histogram);

    if (dir === 'UP') {
      if (rsi > 70 && macdH > 0)  return 'Strong';
      if (rsi > 55 && macdH > 0)  return 'Healthy';
      if (rsi > 55 && macdH < 0)  return 'Weakening';
      if (rsi > 70 && macdH < 0)  return 'Exhausted';
      if (rsi > 45)               return 'Building';
      return 'Weak';
    }
    if (dir === 'DOWN') {
      if (rsi < 30 && macdH < 0)  return 'Strong';
      if (rsi < 45 && macdH < 0)  return 'Healthy';
      if (rsi < 45 && macdH > 0)  return 'Weakening';
      if (rsi < 30 && macdH > 0)  return 'Exhausted';
      if (rsi < 55)               return 'Building';
      return 'Weak';
    }
    return 'Building';
  }

  function _riskLevel(ind, closes) {
    if (!ind || !closes) return 'Moderate';
    const last = closes[closes.length - 1];
    const atrPct = ind.atr && last ? ind.atr / last * 100 : 0;
    if (atrPct === 0)  return 'Moderate';
    if (atrPct < 0.8)  return 'Low';
    if (atrPct < 2.0)  return 'Moderate';
    return 'High';
  }

  function _structurePhrase(dir, momentum) {
    if (dir === 'UP') {
      if (momentum === 'Strong')    return 'Bullish structure with strong follow-through';
      if (momentum === 'Healthy')   return 'Bullish structure intact';
      if (momentum === 'Weakening') return 'Bullish structure showing fatigue';
      if (momentum === 'Exhausted') return 'Bullish structure overextended';
      return 'Bullish structure forming';
    }
    if (dir === 'DOWN') {
      if (momentum === 'Strong')    return 'Bearish structure with strong follow-through';
      if (momentum === 'Healthy')   return 'Bearish structure intact';
      if (momentum === 'Weakening') return 'Bearish structure losing steam';
      if (momentum === 'Exhausted') return 'Bearish structure overextended';
      return 'Bearish structure forming';
    }
    return 'No clean directional structure';
  }

  function _summary(dir, momentum, risk) {
    if (dir === 'UP') {
      if (momentum === 'Exhausted') return 'Extension risk elevated — caution on new longs.';
      if (momentum === 'Weakening') return 'Pullback risk increasing — protect profits.';
      if (momentum === 'Strong')    return 'Trend continuation favored.';
      if (momentum === 'Healthy')   return 'Constructive setup for continuation.';
      return 'Early-stage move — wait for confirmation.';
    }
    if (dir === 'DOWN') {
      if (momentum === 'Exhausted') return 'Mean reversion risk — late shorts vulnerable.';
      if (momentum === 'Weakening') return 'Downside losing momentum — bounce possible.';
      if (momentum === 'Strong')    return 'Downside continuation favored.';
      if (momentum === 'Healthy')   return 'Bearish bias intact.';
      return 'Early-stage decline — wait for confirmation.';
    }
    if (risk === 'High') return 'Range with elevated volatility — fakeout-prone.';
    return 'No directional conviction — patience required.';
  }

  function analyzeCoin(coinData) {
    if (!coinData) return null;
    const a = _dirAnalysis(coinData.closes, coinData.ind);
    if (!a) return null;

    const momentum  = _momentumLevel(coinData.ind, a.dir);
    const risk      = _riskLevel(coinData.ind, coinData.closes);
    const structure = _structurePhrase(a.dir, momentum);
    const summary   = _summary(a.dir, momentum, risk);

    return { dir: a.dir, structure, momentum, risk, summary };
  }

  function compareETHvsBTC(btcAnalysis, ethAnalysis) {
    if (!btcAnalysis || !ethAnalysis) return null;
    const rank = { 'Exhausted': 1, 'Weak': 2, 'Weakening': 3, 'Building': 4, 'Healthy': 5, 'Strong': 6 };
    const btcM = rank[btcAnalysis.momentum] || 3;
    const ethM = rank[ethAnalysis.momentum] || 3;

    if (btcAnalysis.dir === ethAnalysis.dir) {
      if (ethM > btcM + 1) return 'ETH momentum remains healthier than BTC.';
      if (btcM > ethM + 1) return 'BTC leading — ETH lags directionally.';
      return 'BTC and ETH aligned.';
    }
    if (btcAnalysis.dir === 'UP'   && ethAnalysis.dir === 'DOWN') return 'ETH diverges weak against BTC strength.';
    if (btcAnalysis.dir === 'DOWN' && ethAnalysis.dir === 'UP')   return 'ETH showing relative strength against BTC.';
    if (btcAnalysis.dir === 'FLAT' && ethAnalysis.dir !== 'FLAT') return 'ETH leading while BTC consolidates.';
    if (ethAnalysis.dir === 'FLAT' && btcAnalysis.dir !== 'FLAT') return 'ETH lagging BTC direction.';
    return null;
  }

  return { analyzeCoin, compareETHvsBTC };
})();
