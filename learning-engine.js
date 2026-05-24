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
      case 'STRUCTURE':  return 'Piyasa yapısı hizalı';
      case 'LIQUIDITY':  return 'Likidite sweep onaylandı';
      case 'FUNDING':    return 'Funding sağlıklı';
      case 'OI':         return 'Open Interest trendi destekliyor';
      case 'LIQS':       return 'Likidasyonlar yönü destekliyor';
      case 'VOLUME':     return 'Hacim genişlemesi';
      case 'VOLATILITY': return 'Sağlıklı volatilite';
      case 'MOMENTUM':   return 'Güçlü momentum';
      case 'HTF':        return 'HTF hizalama';
      case 'SMC':        return 'SMC konfluans';
      case 'TREND':      return 'Trend hizalama';
      case 'RR':         return 'Premium risk/ödül';
      default:           return code;
    }
  }

  function _validPhrase(code) {
    switch (code) {
      case 'STRUCTURE':  return 'Yapı korunuyor';
      case 'LIQUIDITY':  return 'Likidite aktif';
      case 'FUNDING':    return 'Funding kabul edilebilir';
      case 'OI':         return 'OI ılımlı destek';
      case 'LIQS':       return 'Likidasyonlar nötr-pozitif';
      case 'VOLUME':     return 'Hacim korunuyor';
      case 'VOLATILITY': return 'Volatilite uygun';
      case 'MOMENTUM':   return 'Momentum mevcut';
      case 'HTF':        return 'Kısmi HTF hizalama';
      case 'SMC':        return 'SMC kısmi konfluans';
      case 'TREND':      return 'Trend bias destekliyor';
      case 'RR':         return 'Kabul edilebilir R/R';
      default:           return code;
    }
  }

  function _missingPhrase(code, dir, setup) {
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const entry  = setup.entry;

    switch (code) {
      case 'STRUCTURE':
        return isLong
          ? 'Yapı değişimi için daha yüksek tepe gerekli.'
          : 'Yapı değişimi için daha düşük dip gerekli.';
      case 'LIQUIDITY':  return 'Likidite sweep henüz tamamlanmadı.';
      case 'FUNDING':    return 'Devamlılık için funding\'in stabilize olması gerekli.';
      case 'OI':         return isLong
          ? 'OI bir sonraki yukarı harekette genişlemeli.'
          : 'OI bir sonraki aşağı harekette genişlemeli.';
      case 'LIQS':       return 'Likidasyon akışı henüz lehte değil.';
      case 'VOLUME':
        return entry
          ? `$${(+entry).toPrecision(4)} seviyesinde hacim genişlemesi gerekli.`
          : 'Sonraki harekette hacim genişlemesi gerekli.';
      case 'VOLATILITY': return 'Temiz kırılım için volatilite genişlemesi gerekli.';
      case 'MOMENTUM':   return isLong
          ? 'Momentum hâlâ onay bekliyor.'
          : 'Aşağı yön momentum eksik.';
      case 'HTF':        return 'HTF onayı eksik.';
      case 'SMC':        return 'SMC konfluans gelişiyor.';
      case 'TREND':      return isLong
          ? 'Fiyat trend filtresini geri almalı.'
          : 'Fiyat trend filtresini kaybetmeli.';
      case 'RR':         return 'Hedef yerleşimi iyileştirilirse R/R güçlenir.';
      default:           return null;
    }
  }

  return { evaluate };
})();
