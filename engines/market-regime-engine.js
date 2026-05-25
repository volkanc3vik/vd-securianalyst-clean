// ═══════════════════════════════════════════════
// MARKET REGIME ENGINE — Trend/Range/Panic tespiti
// ═══════════════════════════════════════════════
import { calcATR, calcBB, calcRSI } from '../modules/indicators.js';

class MarketRegimeEngine {

  /**
   * Piyasa rejimini tespit et
   * @returns {string} TREND | RANGE | BREAKOUT | VOLATILE | SQUEEZE | PANIC | SIDEWAYS
   */
  detect(closes, candles, oiData = null) {
    if (!closes?.length || !candles?.length) return 'SIDEWAYS';

    const price  = closes[closes.length - 1];
    const atr    = calcATR(candles);
    const atrPct = (atr / price) * 100;
    const bb     = calcBB(closes);
    const rsi    = calcRSI(closes);

    // EMA trend kontrolü
    const ema20  = this._ema(closes, 20);
    const ema50  = this._ema(closes, 50);
    const ema200 = this._ema(closes, 200);

    // Son 20 mum yön analizi
    const recentCloses = closes.slice(-20);
    const priceChange  = ((recentCloses[recentCloses.length - 1] - recentCloses[0]) / recentCloses[0]) * 100;

    // PANIC — sert düşüş + yüksek volatilite
    if (rsi < 25 && priceChange < -8 && atrPct > 4) return 'PANIC';

    // SQUEEZE — BB çok dar
    if (bb.width < 2) return 'SQUEEZE';

    // VOLATILE
    if (atrPct > 4) return 'VOLATILE';

    // TREND — EMA hizalama
    if (ema20 > ema50 && ema50 > ema200 && priceChange > 2) return 'TREND';
    if (ema20 < ema50 && ema50 < ema200 && priceChange < -2) return 'TREND';

    // BREAKOUT — BB dışına çıkış
    if (price > bb.upper * 0.998 || price < bb.lower * 1.002) return 'BREAKOUT';

    // RANGE
    if (Math.abs(priceChange) < 1.5 && atrPct < 2) return 'RANGE';

    return 'SIDEWAYS';
  }

  /**
   * Rejim rengini döndür
   */
  getColor(regime) {
    const colors = {
      TREND:    'var(--green)',
      RANGE:    'var(--yellow)',
      BREAKOUT: 'var(--cyan)',
      VOLATILE: 'var(--orange)',
      SQUEEZE:  'var(--purple)',
      PANIC:    'var(--red)',
      SIDEWAYS: 'var(--text3)',
    };
    return colors[regime] || 'var(--text3)';
  }

  /**
   * Rejim açıklaması
   */
  getDesc(regime) {
    const descs = {
      TREND:    'Güçlü trend — momentum sinyalleri geçerli',
      RANGE:    'Range market — kırılım bekleniyor',
      BREAKOUT: 'Kırılım modu — momentum yüksek',
      VOLATILE: 'Yüksek volatilite — stop aralığını genişlet',
      SQUEEZE:  'Bollinger sıkışması — büyük hareket bekle',
      PANIC:    'Panik satış — long girişlerden kaçın',
      SIDEWAYS: 'Yön belirsiz — konfirmasyon bekle',
    };
    return descs[regime] || '—';
  }

  _ema(closes, period) {
    if (closes.length < period) return closes[closes.length - 1];
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  }
}

export const RegimeEngine = new MarketRegimeEngine();
