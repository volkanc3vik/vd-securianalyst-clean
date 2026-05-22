// ════════════════════════════════════════════════════════════════════
// TI MARKET MAKER BIAS
// "Liquidity is currently building above price." gibi profesyonel
// commentary üretir. Koşullara göre dinamik — şablon değil.
//
// Girdiler:
//   - btcData (likidite seviyeleri, son hareket)
//   - regimeDiag (trend, vol, breadth, liq bias)
//   - funding / oi (varsa)
// ════════════════════════════════════════════════════════════════════
window.TIMMBias = (() => {
  'use strict';

  const _num = (v) => Number.isFinite(+v) ? +v : 0;

  function _liquidityLocation(btcData) {
    if (!btcData || !btcData.candles || btcData.candles.length < 50) return null;
    const candles = btcData.candles.slice(-50);
    const last    = candles[candles.length - 1].c;

    let above = 0, below = 0;
    for (let i = 2; i < candles.length - 2; i++) {
      const c = candles[i];
      const isHigh = c.h > candles[i-1].h && c.h > candles[i-2].h &&
                     c.h > candles[i+1].h && c.h > candles[i+2].h;
      const isLow  = c.l < candles[i-1].l && c.l < candles[i-2].l &&
                     c.l < candles[i+1].l && c.l < candles[i+2].l;
      if (isHigh && c.h > last) above++;
      if (isLow  && c.l < last) below++;
    }

    if (above === 0 && below === 0) return null;
    if (above > below * 1.5) return 'ABOVE';
    if (below > above * 1.5) return 'BELOW';
    return 'BALANCED';
  }

  function _fundingPressure(funding) {
    if (!funding || !Number.isFinite(+funding.rate)) return null;
    const r = +funding.rate;
    if (r > 0.05)   return 'OVERHEATED_LONG';
    if (r < -0.05)  return 'OVERHEATED_SHORT';
    if (r > 0.02)   return 'ELEVATED_LONG';
    if (r < -0.02)  return 'ELEVATED_SHORT';
    return 'NEUTRAL';
  }

  function _oiSignal(btcData, oi) {
    if (!oi || !btcData || !btcData.closes) return null;
    const closes = btcData.closes.slice(-10);
    if (closes.length < 5) return null;
    const priceChg = (closes[closes.length-1] - closes[0]) / closes[0];
    const oiChg    = _num(oi.change24h) || _num(oi.changePercent);
    if (!oiChg || Math.abs(priceChg) < 0.001) return null;

    const pUp = priceChg > 0;
    const oUp = oiChg > 0;

    if (pUp && oUp)   return 'TREND_HEALTHY_LONG';
    if (!pUp && !oUp) return 'TREND_HEALTHY_SHORT';
    if (pUp && !oUp)  return 'SQUEEZE_RALLY';
    if (!pUp && oUp)  return 'SHORT_BUILDUP';
    return null;
  }

  function build({ btcData, regimeDiag, funding, oi }) {
    const loc   = _liquidityLocation(btcData);
    const fund  = _fundingPressure(funding);
    const oiSig = _oiSignal(btcData, oi);
    const trend = regimeDiag?.trend;

    let headline;
    const detail = [];

    if (fund === 'OVERHEATED_LONG') {
      headline = 'Funding overheating — long crowd at risk.';
      detail.push('Late longs vulnerable to liquidation cascade.');
    }
    else if (fund === 'OVERHEATED_SHORT') {
      headline = 'Funding deeply negative — short squeeze setup forming.';
      detail.push('Short side overextended; rallies can trap covers.');
    }
    else if (oiSig === 'SQUEEZE_RALLY') {
      headline = 'Rally driven by short covers, not new longs.';
      detail.push('Rally quality questionable without OI confirmation.');
    }
    else if (oiSig === 'SHORT_BUILDUP') {
      headline = 'Shorts building into weakness — squeeze fuel accumulating.';
    }
    else if (loc === 'ABOVE' && trend?.dir === 'UP') {
      headline = 'Liquidity sits above price — natural magnet for continuation.';
      detail.push('Buy-side liquidity targets remain unfilled.');
    }
    else if (loc === 'ABOVE' && trend?.dir !== 'UP') {
      headline = 'Liquidity building above price — long traps possible.';
      detail.push('Market may target aggressive longs before reversal.');
    }
    else if (loc === 'BELOW' && trend?.dir === 'DOWN') {
      headline = 'Liquidity sits below price — downside targets unfilled.';
    }
    else if (loc === 'BELOW' && trend?.dir !== 'DOWN') {
      headline = 'Stops resting below — sweep risk before any reversal.';
      detail.push('Late shorts likely to get hunted.');
    }
    else if (oiSig === 'TREND_HEALTHY_LONG') {
      headline = 'Trend supported by genuine long positioning.';
    }
    else if (oiSig === 'TREND_HEALTHY_SHORT') {
      headline = 'Trend supported by genuine short positioning.';
    }
    else if (trend?.dir === 'FLAT') {
      headline = 'No directional conviction — wait for structure to develop.';
    }
    else {
      headline = 'Market behavior consistent with current trend.';
    }

    if (fund === 'ELEVATED_LONG' && !headline.includes('Funding')) {
      detail.push('Funding elevated on the long side.');
    }
    if (fund === 'ELEVATED_SHORT' && !headline.includes('Funding')) {
      detail.push('Funding elevated on the short side.');
    }

    return { headline, detail };
  }

  return { build };
})();
