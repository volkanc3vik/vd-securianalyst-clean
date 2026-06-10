// ════════════════════════════════════════════════════════════════════
// TI SETUP MATURITY
// Olgunluk yüzdesi + "What Needs To Happen Next" eksik konfirmasyonlar.
//
// Maturity ≠ Score. Score kalite ölçer, Maturity tamamlanmışlık ölçer.
// Düşük maturity = sabret. Yüksek maturity = tetik yaklaştı.
// ════════════════════════════════════════════════════════════════════
window.TIMaturity = (() => {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

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
      case 'STRUCTURE':  return _t('tim.sStructure',null,'Piyasa yapısı hizalı');
      case 'LIQUIDITY':  return _t('tim.sLiquidity',null,'Likidite sweep onaylandı');
      case 'FUNDING':    return _t('tim.sFunding',null,'Funding sağlıklı');
      case 'OI':         return _t('tim.sOi',null,'Open Interest trendi destekliyor');
      case 'LIQS':       return _t('tim.sLiqs',null,'Likidasyonlar yönü destekliyor');
      case 'VOLUME':     return _t('tim.sVolume',null,'Hacim genişlemesi');
      case 'VOLATILITY': return _t('tim.sVolatility',null,'Sağlıklı volatilite');
      case 'MOMENTUM':   return _t('tim.sMomentum',null,'Güçlü momentum');
      case 'HTF':        return _t('tim.sHtf',null,'HTF hizalama');
      case 'SMC':        return _t('tim.sSmc',null,'SMC konfluans');
      case 'TREND':      return _t('tim.sTrend',null,'Trend hizalama');
      case 'RR':         return _t('tim.sRr',null,'Premium risk/ödül');
      default:           return code;
    }
  }

  function _validPhrase(code) {
    switch (code) {
      case 'STRUCTURE':  return _t('tim.vStructure',null,'Yapı korunuyor');
      case 'LIQUIDITY':  return _t('tim.vLiquidity',null,'Likidite aktif');
      case 'FUNDING':    return _t('tim.vFunding',null,'Funding kabul edilebilir');
      case 'OI':         return _t('tim.vOi',null,'OI ılımlı destek');
      case 'LIQS':       return _t('tim.vLiqs',null,'Likidasyonlar nötr-pozitif');
      case 'VOLUME':     return _t('tim.vVolume',null,'Hacim korunuyor');
      case 'VOLATILITY': return _t('tim.vVolatility',null,'Volatilite uygun');
      case 'MOMENTUM':   return _t('tim.vMomentum',null,'Momentum mevcut');
      case 'HTF':        return _t('tim.vHtf',null,'Kısmi HTF hizalama');
      case 'SMC':        return _t('tim.vSmc',null,'SMC kısmi konfluans');
      case 'TREND':      return _t('tim.vTrend',null,'Trend bias destekliyor');
      case 'RR':         return _t('tim.vRr',null,'Kabul edilebilir R/R');
      default:           return code;
    }
  }

  function _missingPhrase(code, dir, setup) {
    const isLong = (dir || '').toUpperCase() === 'LONG';
    const entry  = setup.entry;

    switch (code) {
      case 'STRUCTURE':
        return isLong
          ? _t('tim.mStructUp',null,'Yapı değişimi için daha yüksek tepe gerekli.')
          : _t('tim.mStructDown',null,'Yapı değişimi için daha düşük dip gerekli.');
      case 'LIQUIDITY':  return _t('tim.mLiquidity',null,'Likidite sweep henüz tamamlanmadı.');
      case 'FUNDING':    return _t('tim.mFunding',null,'Devamlılık için funding\'in stabilize olması gerekli.');
      case 'OI':         return isLong
          ? _t('tim.mOiUp',null,'OI bir sonraki yukarı harekette genişlemeli.')
          : _t('tim.mOiDown',null,'OI bir sonraki aşağı harekette genişlemeli.');
      case 'LIQS':       return _t('tim.mLiqs',null,'Likidasyon akışı henüz lehte değil.');
      case 'VOLUME':
        return entry
          ? _t('tim.mVolumeAt',{p:(+entry).toPrecision(4)},'$'+(+entry).toPrecision(4)+' seviyesinde hacim genişlemesi gerekli.')
          : _t('tim.mVolume',null,'Sonraki harekette hacim genişlemesi gerekli.');
      case 'VOLATILITY': return _t('tim.mVolatility',null,'Temiz kırılım için volatilite genişlemesi gerekli.');
      case 'MOMENTUM':   return isLong
          ? _t('tim.mMomentumUp',null,'Momentum hâlâ onay bekliyor.')
          : _t('tim.mMomentumDown',null,'Aşağı yön momentum eksik.');
      case 'HTF':        return _t('tim.mHtf',null,'HTF onayı eksik.');
      case 'SMC':        return _t('tim.mSmc',null,'SMC konfluans gelişiyor.');
      case 'TREND':      return isLong
          ? _t('tim.mTrendUp',null,'Fiyat trend filtresini geri almalı.')
          : _t('tim.mTrendDown',null,'Fiyat trend filtresini kaybetmeli.');
      case 'RR':         return _t('tim.mRr',null,'Hedef yerleşimi iyileştirilirse R/R güçlenir.');
      default:           return null;
    }
  }

  return { evaluate };
})();
