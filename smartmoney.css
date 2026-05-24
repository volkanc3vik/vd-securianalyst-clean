// ═══════════════════════════════════════════════
// BINANCE SERVICE — Tüm Binance API çağrıları
// UI ve engine'lerden tamamen bağımsız
// ═══════════════════════════════════════════════
import { API } from '../modules/constants.js';

class BinanceService {
  constructor() {
    this._cache    = new Map();
    this._cacheTTL = 5000; // 5 saniye cache
  }

  async _fetch(url, useCache = true) {
    if (useCache && this._cache.has(url)) {
      const { data, ts } = this._cache.get(url);
      if (Date.now() - ts < this._cacheTTL) return data;
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    if (data?.code && +data.code < 0) throw new Error(data.msg || 'API hatası');
    if (useCache) this._cache.set(url, { data, ts: Date.now() });
    return data;
  }

  // Kline (mum) verisi
  async getKlines(sym, interval = '15m', limit = 200) {
    return this._fetch(`${API.FBASE}/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${limit}`);
  }

  // 24hr ticker
  async getTicker24h(sym = null) {
    const url = sym
      ? `${API.FBASE}/fapi/v1/ticker/24hr?symbol=${sym}`
      : `${API.FBASE}/fapi/v1/ticker/24hr`;
    return this._fetch(url, !sym); // Tek sembol cache'leme
  }

  // Open Interest
  async getOpenInterest(sym) {
    try {
      const [oi, hist] = await Promise.all([
        this._fetch(`${API.FBASE}/fapi/v1/openInterest?symbol=${sym}`, false),
        this._fetch(`${API.FBASE}/futures/data/openInterestHist?symbol=${sym}&period=5m&limit=2`, false),
      ]);
      const cur  = +oi.openInterest;
      const prev = hist.length >= 2 ? +hist[0].sumOpenInterest : cur;
      return {
        oi:       cur,
        oiChange: prev > 0 ? ((cur - prev) / prev * 100).toFixed(2) : null,
      };
    } catch { return { oi: null, oiChange: null }; }
  }

  // Funding Rate
  async getFundingRate(sym) {
    try {
      const data = await this._fetch(
        `${API.FBASE}/fapi/v1/premiumIndex?symbol=${sym}`, false
      );
      return { fund: data?.lastFundingRate !== undefined ? +data.lastFundingRate * 100 : null };
    } catch { return { fund: null }; }
  }

  // Long/Short Ratio
  async getLSRatio(sym) {
    try {
      const data = await this._fetch(
        `${API.FBASE}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`, false
      );
      return { lsRatio: data?.[0] ? +data[0].longShortRatio : null };
    } catch { return { lsRatio: null }; }
  }

  // OI + Funding + LS birleşik
  async getMarketData(sym) {
    const [oiData, fundData, lsData] = await Promise.all([
      this.getOpenInterest(sym),
      this.getFundingRate(sym),
      this.getLSRatio(sym),
    ]);
    return { ...oiData, ...fundData, ...lsData };
  }

  // Futures sembol listesi
  async getFuturesSymbols() {
    try {
      const data = await this._fetch(`${API.FBASE}/fapi/v1/exchangeInfo`);
      return data.symbols
        .filter(s => s.status === 'TRADING' && s.symbol.endsWith('USDT'))
        .map(s => s.symbol);
    } catch { return []; }
  }

  // Top 100 hacker coin (hacme göre)
  async getTopSymbols(limit = 100) {
    try {
      const tickers = await this._fetch(`${API.FBASE}/fapi/v1/ticker/24hr`);
      return tickers
        .filter(t => t.symbol.endsWith('USDT'))
        .sort((a, b) => +b.quoteVolume - +a.quoteVolume)
        .slice(0, limit)
        .map(t => t.symbol);
    } catch { return []; }
  }

  // Cache temizle
  clearCache() {
    this._cache.clear();
  }
}

export const Binance = new BinanceService();
