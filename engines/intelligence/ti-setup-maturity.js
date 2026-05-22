// ════════════════════════════════════════════════════════════════════
// TI SETUP MATURITY
// Olgunluk yüzdesi + "What Needs To Happen Next" eksik konfirmasyonlar.
//
// Maturity ≠ Score. Score kalite ölçer, Maturity tamamlanmışlık ölçer.
// Düşük maturity = sabret. Yüksek maturity = tetik yaklaştı.
// ════════════════════════════════════════════════════════════════════
window.TIMaturity = (() => {
  'use strict';

  function evaluate(setup) {
    if (!setup || !setup.factors) {
      return { percent: 0, confirmed: [], missing: [] };
    }

    const confirmed = [];
    const missing   = [];

    setup.factors.forEach(f => {
      if (!f.available) return;

      // FBR negatif faktör — yüksekse uyarı
      if (f.code === 'FBR') {
        if (f.score >= 6) {
          missing.push('High fakeout risk on current candle structure.');
        }
        return;
      }

      if (f.score >= 8)      confirmed.push(_strongPhrase(f.code));
      else if (f.score >= 6) confirmed.push(_validPhrase(f.code));
      else if (f.score <= 4) {
        const m = _missingPhrase(f.code, setup.dir, setup);
        if (m) missing.push(m);
      }
    });

    const usablePositive = setup.factors.filter(f => f.available && !f.negative).length;
    const percent = usablePositive === 0
      ? 0
      : Math.round((confirmed.length / usablePositive) * 100);

    return { percent, confirmed, missing };
  }

  function _strongPhrase(code) {
    switch (code) {
      case 'STRUCTURE':  return 'Market structure aligned';
      case 'LIQUIDITY':  return 'Liquidity sweep confirmed';
      case 'FUNDING':    return 'Healthy funding';
      case 'OI':         return 'Open interest supports trend';
      case 'LIQS':       return 'Liquidations favor direction';
      case 'VOLUME':     return 'Volume expansion';
      case 'VOLATILITY': return 'Healthy volatility regime';
      case 'MOMENTUM':   return 'Strong momentum';
      case 'HTF':        return 'HTF alignment';
      case 'SMC':        return 'SMC confluence';
      case 'TREND':      return 'Trend alignment';
      case 'RR':         return 'Premium risk/reward';
      default:           return code;
    }
  }

  function _validPhrase(code) {
    switch (code) {
      case 'STRUCTURE':  return 'Structure intact';
      case 'LIQUIDITY':  return 'Liquidity in play';
      case 'FUNDING':    return 'Funding acceptable';
      case 'OI':         return 'OI mildly supportive';
      case 'LIQS':       return 'Liquidations neutral-positive';
      case 'VOLUME':     return 'Volume holding';
      case 'VOLATILITY': return 'Volatility workable';
      case 'MOMENTUM':   return 'Momentum present';
      case 'HTF':        return 'Partial HTF alignment';
      case 'SMC':        return 'SMC partial confluence';
      case 'TREND':      return 'Trend bias supports';
      case 'RR':         return 'Acceptable RR';
      default:           return code;
    }
  }

  function _missingPhrase(code, dir, setup) {
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const entry  = setup.entry;

    switch (code) {
      case 'STRUCTURE':
        return isLong
          ? 'Higher high required to confirm structure shift.'
          : 'Lower low required to confirm structure shift.';
      case 'LIQUIDITY':  return 'Liquidity sweep still pending.';
      case 'FUNDING':    return 'Funding must stabilize before continuation.';
      case 'OI':         return isLong
          ? 'OI must expand on next push higher.'
          : 'OI must expand on next push lower.';
      case 'LIQS':       return 'Liquidation flow not yet favorable.';
      case 'VOLUME':
        return entry
          ? `Volume must expand on move through $${(+entry).toPrecision(4)}.`
          : 'Volume expansion required on next move.';
      case 'VOLATILITY': return 'Volatility expansion needed for clean breakout.';
      case 'MOMENTUM':   return isLong
          ? 'Momentum still lacks confirmation.'
          : 'Downside momentum incomplete.';
      case 'HTF':        return 'HTF confirmation missing.';
      case 'SMC':        return 'SMC confluence still developing.';
      case 'TREND':      return isLong
          ? 'Price must reclaim trend filter.'
          : 'Price must lose trend filter.';
      case 'RR':         return 'Improved target placement would strengthen RR.';
      default:           return null;
    }
  }

  return { evaluate };
})();
