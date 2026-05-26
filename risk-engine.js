// ════════════════════════════════════════════════════════════════════
// TI REGIME — Market Regime tespiti
// Çıktı: Risk-On / Liquidity Trap / Choppy / Risk-Off / variants
//
// BTC öncülüğünde 4 boyut:
//   1. Trend strength (EMA stack + son N mum yönü + MACD)
//   2. Volatility quality (ATR sağlıklı mı, squeeze mi)
//   3. Breadth (scan'deki long/short oranı)
//   4. Likidasyon bias (varsa)
// ════════════════════════════════════════════════════════════════════
window.TIRegime = (() => {
  'use strict';

  const _num = (v) => Number.isFinite(+v) ? +v : 0;

  function _trend(btc) {
    if (!btc || !btc.ind || !btc.closes || btc.closes.length < 20) {
      return { dir: 'FLAT', strength: 0 };
    }
    const ind  = btc.ind;
    const last = btc.closes[btc.closes.length - 1];
    const e9   = ind.ema9  || ind.e9;
    const e21  = ind.ema21 || ind.e21;
    const e50  = ind.ema50 || ind.e50;
    if (!e9 || !e21 || !e50) return { dir: 'FLAT', strength: 0 };

    let score = 0;
    if (e9 > e21 && e21 > e50)      score += 35;
    else if (e9 < e21 && e21 < e50) score -= 35;
    if (last > e50) score += 15; else score -= 15;
    const recent = btc.closes.slice(-10);
    const slope  = (recent[recent.length - 1] - recent[0]) / recent[0] * 100;
    score += Math.max(-30, Math.min(30, slope * 5));
    if (ind.macd?.histogram > 0) score += 10;
    else if (ind.macd?.histogram < 0) score -= 10;

    const abs = Math.abs(score);
    const strength = Math.min(100, abs);
    if (abs < 15) return { dir: 'FLAT', strength };
    return { dir: score > 0 ? 'UP' : 'DOWN', strength };
  }

  function _volatility(btc) {
    if (!btc || !btc.ind) return { quality: 'UNKNOWN', atrPct: 0 };
    const last = btc.closes ? btc.closes[btc.closes.length - 1] : 0;
    const atr  = btc.ind.atr || 0;
    if (!last || !atr) return { quality: 'UNKNOWN', atrPct: 0 };
    const atrPct = atr / last * 100;
    if (atrPct < 0.4)  return { quality: 'SQUEEZED',  atrPct };
    if (atrPct < 1.2)  return { quality: 'HEALTHY',   atrPct };
    if (atrPct < 2.5)  return { quality: 'ELEVATED',  atrPct };
    return                    { quality: 'EXTREME',   atrPct };
  }

  function _breadth(scanResults) {
    if (!Array.isArray(scanResults) || scanResults.length === 0) {
      return { longs: 0, shorts: 0, ratio: 0.5, total: 0 };
    }
    let longs = 0, shorts = 0;
    for (const r of scanResults) {
      const dir = (r.dir || r.direction || '').toString().toUpperCase();
      const lS  = +r.lScore || 0;
      const sS  = +r.sScore || 0;
      if (dir === 'LONG'  || lS > sS) longs++;
      else if (dir === 'SHORT' || sS > lS) shorts++;
    }
    const total = longs + shorts;
    return { longs, shorts, total, ratio: total === 0 ? 0.5 : longs / total };
  }

  function _liqBias() {
    if (typeof window.LiquidationEngine === 'undefined') return null;
    try {
      const data = window.LiquidationEngine.getRecentStats?.();
      if (!data) return null;
      const longLiq  = _num(data.longLiqs || data.longs);
      const shortLiq = _num(data.shortLiqs || data.shorts);
      const total = longLiq + shortLiq;
      if (total === 0) return null;
      return {
        longBias: longLiq / total,
        dominant: longLiq > shortLiq ? 'LONG' : 'SHORT',
      };
    } catch { return null; }
  }

  /**
   * Regime tespiti.
   * @param {Object} btcData - scan'den BTC item'ı (closes, candles, ind, smcData)
   * @param {Array}  scanResults - tüm scan sonuçları
   */
  function detect(btcData, scanResults) {
    const trend   = _trend(btcData);
    const vol     = _volatility(btcData);
    const breadth = _breadth(scanResults);
    const liq     = _liqBias();

    let code, label, color, summary;
    const longHeavy  = breadth.ratio > 0.65;
    const shortHeavy = breadth.ratio < 0.35;
    const balanced   = !longHeavy && !shortHeavy;

    if (trend.dir === 'FLAT' && (vol.quality === 'SQUEEZED' || vol.quality === 'HEALTHY') && balanced) {
      code = 'CHOPPY'; label = 'Yatay / Belirsiz Piyasa'; color = 'yellow';
      summary = 'Net bir yön yok. Kırılım kovalamak yerine sabırlı ol.';
    }
    else if (trend.dir === 'UP' && trend.strength > 40 && (vol.quality === 'HEALTHY' || vol.quality === 'ELEVATED') && longHeavy) {
      code = 'RISK_ON'; label = 'Risk-On Ortamı'; color = 'green';
      summary = 'Trend devamı destekleniyor. Geri çekilmeler alım fırsatı.';
    }
    else if (trend.dir === 'DOWN' && trend.strength > 40 && shortHeavy) {
      code = 'RISK_OFF'; label = 'Risk-Off Ortamı'; color = 'red';
      summary = 'Aşağı yönlü baskı sürüyor. Trende karşı long yüksek riskli.';
    }
    else if (vol.quality === 'EXTREME' || (trend.strength < 30 && vol.quality === 'ELEVATED' && !balanced)) {
      code = 'LIQUIDITY_TRAP'; label = 'Likidite Tuzağı'; color = 'orange';
      summary = 'Net trend yok ama volatilite yüksek. Fakeout riski yüksek.';
    }
    else if (trend.dir === 'UP') {
      code = 'RISK_ON_FRAGILE'; label = 'Temkinli Risk-On'; color = 'green';
      summary = 'Trend var ama genişlik dar. Sadece seçici longlar.';
    }
    else if (trend.dir === 'DOWN') {
      code = 'RISK_OFF_FRAGILE'; label = 'Temkinli Risk-Off'; color = 'red';
      summary = 'Aşağı yön korunuyor ama tükenme sinyalleri var. Geç shortlardan kaçın.';
    }
    else {
      code = 'CHOPPY'; label = 'Yatay / Belirsiz Piyasa'; color = 'yellow';
      summary = 'Karışık sinyaller. Konfluans için bekle.';
    }

    return {
      code, label, color, summary,
      diagnostics: { trend, vol, breadth, liq },
    };
  }

  return { detect };
})();
