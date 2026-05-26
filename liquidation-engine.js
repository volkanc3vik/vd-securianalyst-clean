// ════════════════════════════════════════════════════════════════════
// TI MARKET PRESSURE
// Davranışsal piyasa sinyallerini sentezler.
//
// "Hangi coin?" değil, "piyasa ne yapmaya çalışıyor?" cevaplar.
//
// Sinyaller:
//   - FUNDING_PRESSURE      → kalabalık tarafı (long/short)
//   - OI_EXPANSION          → yeni para giriyor (sağlıklı) vs squeeze
//   - TRAPPED_LONGS         → fiyat çıkarken longlar tepede sıkıştı
//   - TRAPPED_SHORTS        → düşüş tükenirken shortlar dipte sıkıştı
//   - LIQUIDITY_ABOVE       → likidite üstte → magnet
//   - LIQUIDITY_BELOW       → likidite altta → stop avı
//   - MOMENTUM_EXHAUSTION   → ivme tükeniyor
//   - CONTINUATION_WEAKNESS → trend görünür devam ediyor ama içten zayıf
//   - LIQ_PRESSURE          → likidasyon yoğunluğu
//
// Çıktı: { signals: [{ code, label, severity, detail }], headline, intensity }
// ════════════════════════════════════════════════════════════════════
window.TIMarketPressure = (() => {
  'use strict';

  const _num = (v) => Number.isFinite(+v) ? +v : 0;

  // ── Bireysel sinyaller ─────────────────────────────────────────
  function _fundingPressure(funding, btcDir) {
    if (!funding || !Number.isFinite(+funding.rate)) return null;
    const r = +funding.rate;
    const absR = Math.abs(r);
    if (absR < 0.015) return null;

    if (r > 0.05) {
      return { code:'FUNDING_PRESSURE', label:'Funding aşırı pozitif',
        severity:'high', detail:'Long tarafı aşırı uzamış — likidasyon kaskadı riski.' };
    }
    if (r < -0.05) {
      return { code:'FUNDING_PRESSURE', label:'Funding derin negatif',
        severity:'high', detail:'Short tarafı aşırı uzamış — squeeze koşulları oluşuyor.' };
    }
    if (r > 0.025) {
      return { code:'FUNDING_BIAS', label:'Funding long tarafına dengesiz',
        severity:'med', detail:'Long kalabalığı birikiyor.' };
    }
    if (r < -0.025) {
      return { code:'FUNDING_BIAS', label:'Funding short tarafına dengesiz',
        severity:'med', detail:'Short kalabalığı birikiyor.' };
    }
    return null;
  }

  function _oiBehavior(oi, btc) {
    if (!oi || !btc?.closes || btc.closes.length < 5) return null;
    const chg = _num(oi.change24h) || _num(oi.changePercent);
    if (!chg || Math.abs(chg) < 1) return null;
    const closes = btc.closes;
    const pChg = (closes[closes.length-1] - closes[closes.length-5]) / closes[closes.length-5];

    if (pChg > 0.005 && chg > 2) {
      return { code:'OI_EXPANSION', label:'OI genişliyor, fiyat yükseliyor',
        severity:'info', detail:'Trend gerçek long pozisyonlarıyla destekleniyor.' };
    }
    if (pChg < -0.005 && chg > 2) {
      return { code:'OI_SHORT_BUILDUP', label:'Düşüşte OI artıyor',
        severity:'med', detail:'Shortlar zayıflığa yaslanıyor — squeeze yakıtı toplanıyor.' };
    }
    if (pChg > 0.005 && chg < -2) {
      return { code:'OI_CONTRACTION', label:'Yükselişte OI daralıyor',
        severity:'med', detail:'Ralli short kapatmalarıyla — yeni alımla değil.' };
    }
    if (pChg < -0.005 && chg < -2) {
      return { code:'OI_LONG_FLUSH', label:'Düşüşte OI azalıyor',
        severity:'info', detail:'Longlar pozisyon kapatıyor — temizlik aşaması.' };
    }
    return null;
  }

  function _trappedTraders(btc) {
    if (!btc?.candles || btc.candles.length < 20) return null;
    const candles = btc.candles.slice(-20);
    const last = candles[candles.length - 1].c;

    // Son 20 mumda en yüksek + en düşük
    const high = Math.max(...candles.map(c => c.h));
    const low  = Math.min(...candles.map(c => c.l));
    const pos  = (last - low) / (high - low);

    // Tepe yakını + üst kuyrukları çok → longlar tepede sıkıştı
    if (pos > 0.85) {
      // En son 3 mumda üst kuyruk
      const wicks = candles.slice(-3).reduce((s, c) => s + (c.h - Math.max(c.o, c.c)), 0);
      const range = high - low;
      if (range > 0 && wicks / range > 0.15) {
        return { code:'TRAPPED_LONGS', label:'Tepede longlar tuzakta',
          severity:'med', detail:'Üst kuyruklar reddedilme gösteriyor — fiyat agresif longları avlayabilir.' };
      }
    }
    if (pos < 0.15) {
      const wicks = candles.slice(-3).reduce((s, c) => s + (Math.min(c.o, c.c) - c.l), 0);
      const range = high - low;
      if (range > 0 && wicks / range > 0.15) {
        return { code:'TRAPPED_SHORTS', label:'Dipte shortlar tuzakta',
          severity:'med', detail:'Alt kuyruklar dip ararken — short kapatmaları hızlanabilir.' };
      }
    }
    return null;
  }

  function _liquidityPositioning(btc) {
    if (!btc?.candles || btc.candles.length < 50) return null;
    const candles = btc.candles.slice(-50);
    const last = candles[candles.length - 1].c;

    let above = 0, below = 0;
    for (let i = 2; i < candles.length - 2; i++) {
      const c = candles[i];
      const isH = c.h > candles[i-1].h && c.h > candles[i-2].h && c.h > candles[i+1].h && c.h > candles[i+2].h;
      const isL = c.l < candles[i-1].l && c.l < candles[i-2].l && c.l < candles[i+1].l && c.l < candles[i+2].l;
      if (isH && c.h > last) above++;
      if (isL && c.l < last) below++;
    }
    if (above === 0 && below === 0) return null;
    if (above > below * 1.5) {
      return { code:'LIQUIDITY_ABOVE', label:'Likidite üstte',
        severity:'info', detail:'Fiyatın üzerinde stop birikimi — magnet oluşmuş.' };
    }
    if (below > above * 1.5) {
      return { code:'LIQUIDITY_BELOW', label:'Likidite altta',
        severity:'info', detail:'Stop avı hedefleri altta bekliyor.' };
    }
    return null;
  }

  function _momentumExhaustion(btc) {
    if (!btc?.ind) return null;
    const rsi = _num(btc.ind.rsi);
    const macdH = _num(btc.ind.macd?.histogram);
    if (rsi > 72 && macdH < 0) {
      return { code:'MOMENTUM_EXHAUSTION', label:'Yukarı momentum tükeniyor',
        severity:'med', detail:'RSI yüksek ama MACD ayrışıyor — yorgunluk sinyali.' };
    }
    if (rsi < 28 && macdH > 0) {
      return { code:'MOMENTUM_EXHAUSTION', label:'Aşağı momentum tükeniyor',
        severity:'med', detail:'RSI düşük ama MACD ayrışıyor — dip tükenme sinyali.' };
    }
    return null;
  }

  function _continuationWeakness(btc) {
    if (!btc?.candles || btc.candles.length < 10) return null;
    const last10 = btc.candles.slice(-10);
    // Trend yönü
    const firstC = last10[0].c, lastC = last10[last10.length-1].c;
    if (Math.abs(lastC - firstC) / firstC < 0.005) return null;
    const isUp = lastC > firstC;
    // Hacim trendi
    const v1 = last10.slice(0, 5).reduce((s,c) => s + (+c.v||0), 0) / 5;
    const v2 = last10.slice(-5).reduce((s,c) => s + (+c.v||0), 0) / 5;
    if (v1 === 0) return null;
    const vDecline = (v1 - v2) / v1;
    if (vDecline > 0.25) {
      return { code:'CONTINUATION_WEAKNESS', label:'Devamlılık zayıflıyor',
        severity:'med',
        detail: isUp
          ? 'Fiyat yükseliyor ama hacim azalıyor — ralli içten zayıf.'
          : 'Fiyat düşüyor ama hacim azalıyor — düşüş zorlanıyor.' };
    }
    return null;
  }

  function _liquidationPressure() {
    if (typeof window.LiquidationEngine === 'undefined') return null;
    try {
      const data = window.LiquidationEngine.getRecentStats?.();
      if (!data) return null;
      const longL  = _num(data.longLiqs || data.longs);
      const shortL = _num(data.shortLiqs || data.shorts);
      const total = longL + shortL;
      if (total === 0) return null;
      // Çok dengesizse rapor et
      const ratio = longL / total;
      if (ratio > 0.78) {
        return { code:'LIQ_PRESSURE_LONG', label:'Long likidasyonları yoğun',
          severity:'high', detail:'Long taraf aktif olarak temizleniyor.' };
      }
      if (ratio < 0.22) {
        return { code:'LIQ_PRESSURE_SHORT', label:'Short likidasyonları yoğun',
          severity:'high', detail:'Short taraf squeeze ediliyor.' };
      }
    } catch {}
    return null;
  }

  // ── Headline & intensity ────────────────────────────────────────
  function _buildHeadline(signals) {
    if (signals.length === 0) return null;
    // En yüksek severity'li sinyali öne al
    const high = signals.filter(s => s.severity === 'high');
    if (high.length > 0) return high[0].label;
    const med = signals.filter(s => s.severity === 'med');
    if (med.length > 0) return med[0].label;
    return signals[0].label;
  }

  function _intensity(signals) {
    if (signals.length === 0) return 0;
    let i = 0;
    signals.forEach(s => {
      if (s.severity === 'high')      i += 30;
      else if (s.severity === 'med')  i += 15;
      else                             i += 5;
    });
    return Math.min(100, i);
  }

  /**
   * Tüm sinyalleri topla ve sentezle.
   */
  function build({ btc, eth, btcFunding, btcOI }) {
    const signals = [];
    const trendDir = btc?.ind && btc.closes
      ? ((btc.ind.ema9 > btc.ind.ema21) ? 'UP' : 'DOWN')
      : null;

    [
      _fundingPressure(btcFunding, trendDir),
      _oiBehavior(btcOI, btc),
      _trappedTraders(btc),
      _liquidityPositioning(btc),
      _momentumExhaustion(btc),
      _continuationWeakness(btc),
      _liquidationPressure(),
    ].forEach(s => { if (s) signals.push(s); });

    return {
      signals,
      headline:  _buildHeadline(signals),
      intensity: _intensity(signals),
    };
  }

  return { build };
})();
