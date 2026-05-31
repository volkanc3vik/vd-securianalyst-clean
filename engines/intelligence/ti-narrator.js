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
      if (momentum === 'Strong')    return 'Yükseliş yapısı güçlü devam ediyor';
      if (momentum === 'Healthy')   return 'Yükseliş yapısı sağlam';
      if (momentum === 'Weakening') return 'Yükseliş yapısı yorgunluk gösteriyor';
      if (momentum === 'Exhausted') return 'Yükseliş yapısı aşırı uzamış';
      return 'Yükseliş yapısı oluşuyor';
    }
    if (dir === 'DOWN') {
      if (momentum === 'Strong')    return 'Düşüş yapısı güçlü devam ediyor';
      if (momentum === 'Healthy')   return 'Düşüş yapısı sağlam';
      if (momentum === 'Weakening') return 'Düşüş yapısı momentum kaybediyor';
      if (momentum === 'Exhausted') return 'Düşüş yapısı aşırı uzamış';
      return 'Düşüş yapısı oluşuyor';
    }
    return 'Net yönlü yapı yok';
  }

  function _summary(dir, momentum, risk) {
    if (dir === 'UP') {
      if (momentum === 'Exhausted') return 'Uzama riski yüksek — yukarı yönlü görünümde temkin.';
      if (momentum === 'Weakening') return 'Geri çekilme riski artıyor — kârı koru.';
      if (momentum === 'Strong')    return 'Trend devamı destekleniyor.';
      if (momentum === 'Healthy')   return 'Devamlılık için yapıcı koşullar.';
      return 'Erken aşama hareket — onay bekle.';
    }
    if (dir === 'DOWN') {
      if (momentum === 'Exhausted') return 'Ortalama dönüş riski — geç aşağı yönlü görünüm zayıf.';
      if (momentum === 'Weakening') return 'Aşağı yön momentum kaybediyor — sıçrama mümkün.';
      if (momentum === 'Strong')    return 'Aşağı yön devamı destekleniyor.';
      if (momentum === 'Healthy')   return 'Düşüş yönlü bias korunuyor.';
      return 'Erken aşama düşüş — onay bekle.';
    }
    if (risk === 'High') return 'Yüksek volatiliteyle range — fakeout meyilli.';
    return 'Yön konvansiyonu yok — sabır gerekli.';
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
      if (ethM > btcM + 1) return 'ETH momentum BTC\'den daha sağlam.';
      if (btcM > ethM + 1) return 'BTC önde — ETH yönsel olarak geride.';
      return 'BTC ve ETH uyumlu.';
    }
    if (btcAnalysis.dir === 'UP'   && ethAnalysis.dir === 'DOWN') return 'ETH, BTC gücüne karşı zayıf ayrışıyor.';
    if (btcAnalysis.dir === 'DOWN' && ethAnalysis.dir === 'UP')   return 'ETH, BTC\'ye göre göreceli güç gösteriyor.';
    if (btcAnalysis.dir === 'FLAT' && ethAnalysis.dir !== 'FLAT') return 'ETH önde, BTC sıkışıyor.';
    if (ethAnalysis.dir === 'FLAT' && btcAnalysis.dir !== 'FLAT') return 'ETH, BTC yönüne göre geride.';
    return null;
  }

  return { analyzeCoin, compareETHvsBTC };
})();
