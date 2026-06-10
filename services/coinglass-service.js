// ════════════════════════════════════════════════════════════════════
// COINGLASS SERVICE v2 — V4 API (open-api-v4), Hobbyist paketi doğrulanmış
//
// 5. iş kapsamında yeniden yazıldı. Kök neden düzeltmesi:
//   v1 yolları camelCase idi (/api/futures/fundingRate/...) → v4 kebab-case
//   ister (/api/futures/funding-rate/...) → tüm çağrılar 404 alıyordu
//   ("CoinGlass: Off" bundandı). Yollar resmi dokümandan teyit edildi.
//
// Hobbyist'te AÇIK (kullanılanlar):
//   funding-rate/exchange-list · open-interest/exchange-list (24s % değişim dahil!)
//   liquidation/aggregated-history (interval ≥4h) · global-long-short-account-ratio/history
//   top-long-short-position-ratio/history · taker-buy-sell-volume/exchange-list
// Hobbyist'te KAPALI: heatmap/map/max-pain/order, CVD, netflow, footprint,
//   large-orderbook, hyperliquid, net-position → UNAVAILABLE.
//
// Geriye uyumlu public API: setup, isEnabled, clearCache, getFundingExtreme,
//   getOI, getLSRatio, getLiquidationClusters, getHeatmap, getMarketIntelligence
// Yeni: getLiquidation24h, getTopTraderRatio, getTakerRatio,
//   getCachedFunding, getCachedOI  (TI controller/feed bunları bekliyordu)
// ════════════════════════════════════════════════════════════════════
const CoinGlassService = (() => {

  const CONFIG = { enabled: false, timeout: 8000 };
  const _cache = new Map();
  const TTL = { fund: 120000, oi: 60000, ls: 300000, liq: 300000, top: 300000, taker: 60000 };

  // Hobbyist'te kapalı endpoint'ler (paket tablosundan)
  const UNAVAILABLE = new Set([
    '/api/futures/liquidation/order',
    '/api/futures/liquidation/heatmap',
    '/api/futures/liquidation/aggregated-heatmap/model1',
    '/api/futures/liquidation/map',
    '/api/futures/liquidation/aggregated-map',
    '/api/futures/liquidation/max-pain',
    '/api/futures/orderbook/heatmap',
    '/api/futures/orderbook/large-limit-order',
    '/api/futures/cvd-history',
    '/api/futures/aggregated-cvd-history',
    '/api/futures/netflow',
    '/api/futures/footprint',
    '/api/futures/net-position',
  ]);

  function _getCached(k) {
    const c = _cache.get(k);
    if (!c || Date.now() - c.ts > c.ttl) { _cache.delete(k); return null; }
    return c.data;
  }
  function _setCache(k, data, ttl) { _cache.set(k, { data, ts: Date.now(), ttl }); }

  // Görünür hata logu (endpoint başına 5 dk'da 1 — spam yok, kör de kalmayız)
  const _errLog = new Map();
  function _logErr(endpoint, e) {
    const last = _errLog.get(endpoint) || 0;
    if (Date.now() - last > 300000) {
      _errLog.set(endpoint, Date.now());
      try { console.warn('[CoinGlass] ' + endpoint + ' → ' + (e && e.message ? e.message : e)); } catch (err) {}
    }
  }

  async function _fetch(endpoint, params = {}) {
    if (UNAVAILABLE.has(endpoint)) throw new Error('UNAVAILABLE');
    const proxyUrl = '/api/coinglass';
    const paramStr = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const url = `${proxyUrl}?endpoint=${encodeURIComponent(endpoint)}${paramStr ? '&params=' + encodeURIComponent(paramStr) : ''}`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), CONFIG.timeout);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      if (json.code !== '0' && json.code !== 0) {
        const msg = (json.msg || '').toLowerCase();
        if (msg.includes('upgrade') || msg.includes('plan')) UNAVAILABLE.add(endpoint);
        throw new Error(json.msg || 'API error');
      }
      return json.data;
    } catch (e) { clearTimeout(tid); _logErr(endpoint, e); throw e; }
  }

  const FB = 'https://fapi.binance.com';
  async function _binance(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // BTCUSDT → BTC (CoinGlass coin endpoint'leri sade sembol ister)
  function _coin(sym) { return String(sym || '').toUpperCase().replace(/(USDT|USDC|USD|PERP)$/,''); }

  // ── FUNDING (gerçek v4: funding-rate/exchange-list) ───────────────
  // Yanıt: data[{symbol, stablecoin_margin_list:[{exchange, funding_rate,...}]}]
  // funding_rate yüzde cinsindendir (örn 0.0073 = %0.0073). Ondalık gelirse *100.
  async function getFundingExtreme(sym) {
    const k = 'fund_' + sym;
    const c = _getCached(k); if (c) return c;
    const coin = _coin(sym);
    let result = { fund: null, history: [], extreme: false, bias: 'NEUTRAL', source: 'none' };
    try {
      if (!CONFIG.enabled) throw new Error('disabled');
      const data = await _fetch('/api/futures/funding-rate/exchange-list', { symbol: coin });
      const row = Array.isArray(data) ? (data.find(d => (d.symbol || '').toUpperCase() === coin) || data[0]) : data;
      const list = row && Array.isArray(row.stablecoin_margin_list) ? row.stablecoin_margin_list : [];
      const ex = list.find(d => (d.exchange || '').toLowerCase() === 'binance') || list[0];
      if (ex && ex.funding_rate != null && Number.isFinite(+ex.funding_rate)) {
        let rate = +ex.funding_rate;
        if (Math.abs(rate) > 0 && Math.abs(rate) < 0.0008) rate = rate * 100; // ondalık geldi → yüzdeye çevir
        rate = +rate.toFixed(4);
        result = {
          fund: rate, history: [rate],
          extreme: Math.abs(rate) > 0.1,
          bias: rate > 0.05 ? 'LONG_CROWDED' : rate < -0.05 ? 'SHORT_CROWDED' : 'NEUTRAL',
          source: 'coinglass',
        };
      }
    } catch (e) {
      try { // bölge dışı kullanıcılar için Binance yedeği (TR'de bloklu olabilir)
        const data = await _binance(`${FB}/fapi/v1/fundingRate?symbol=${sym}&limit=8`);
        const arr = Array.isArray(data) ? data : [];
        const latest = +(arr[arr.length - 1]?.fundingRate ?? 0) * 100;
        if (arr.length) result = {
          fund: +latest.toFixed(4),
          history: arr.map(d => +(+d.fundingRate * 100).toFixed(4)),
          extreme: Math.abs(latest) > 0.1,
          bias: latest > 0.05 ? 'LONG_CROWDED' : latest < -0.05 ? 'SHORT_CROWDED' : 'NEUTRAL',
          source: 'binance',
        };
      } catch (e2) {}
    }
    _setCache(k, result, TTL.fund);
    return result;
  }

  // ── OPEN INTEREST (gerçek v4: open-interest/exchange-list) ────────
  // "All" satırı: open_interest_usd + 5m/1h/4h/24h % değişimler HAZIR gelir.
  async function getOI(sym) {
    const k = 'oi_' + sym;
    const c = _getCached(k); if (c) return c;
    const coin = _coin(sym);
    let result = { oi: null, oiUsd: null, oiChange24h: null, oiChange4h: null, oiChange1h: null, oiChange: null, oiExpanding: false, source: 'none' };
    try {
      if (!CONFIG.enabled) throw new Error('disabled');
      const data = await _fetch('/api/futures/open-interest/exchange-list', { symbol: coin });
      const row = Array.isArray(data) ? (data.find(d => (d.exchange || '') === 'All') || data[0]) : null;
      if (row) {
        const c24 = row.open_interest_change_percent_24h, c4 = row.open_interest_change_percent_4h, c1 = row.open_interest_change_percent_1h;
        result = {
          oi: row.open_interest_quantity != null ? +row.open_interest_quantity : null,
          oiUsd: row.open_interest_usd != null ? +row.open_interest_usd : null,
          oiChange24h: c24 != null && Number.isFinite(+c24) ? +c24 : null,
          oiChange4h:  c4  != null && Number.isFinite(+c4)  ? +c4  : null,
          oiChange1h:  c1  != null && Number.isFinite(+c1)  ? +c1  : null,
          oiChange: c24 != null ? +c24 : null,   // eski alanla uyum
          oiExpanding: c4 != null ? +c4 > 0.5 : false,
          source: 'coinglass',
        };
      }
    } catch (e) {
      try {
        const data = await _binance(`${FB}/fapi/v1/openInterest?symbol=${sym}`);
        if (data?.openInterest) result = { ...result, oi: +data.openInterest, source: 'binance' };
      } catch (e2) {}
    }
    _setCache(k, result, TTL.oi);
    return result;
  }

  // ── GLOBAL LONG/SHORT (gerçek v4 — artık Binance'e mahkum değil) ──
  async function getLSRatio(sym) {
    const k = 'ls_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { lsRatio: null, longPct: null, shortPct: null, crowding: null, source: 'none' };
    try {
      if (!CONFIG.enabled) throw new Error('disabled');
      const data = await _fetch('/api/futures/global-long-short-account-ratio/history', {
        exchange: 'Binance', symbol: sym, interval: '4h', limit: 2,
      });
      const last = Array.isArray(data) && data.length ? data[data.length - 1] : null;
      if (last && last.global_account_long_short_ratio != null) {
        const ratio = +last.global_account_long_short_ratio;
        result = {
          lsRatio: ratio,
          longPct: last.global_account_long_percent != null ? +(+last.global_account_long_percent).toFixed(1) : null,
          shortPct: last.global_account_short_percent != null ? +(+last.global_account_short_percent).toFixed(1) : null,
          crowding: ratio > 1.5 ? 'LONG_CROWDED' : ratio < 0.67 ? 'SHORT_CROWDED' : 'NEUTRAL',
          source: 'coinglass',
        };
      }
    } catch (e) {
      try {
        const data = await _binance(`${FB}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`);
        const latest = Array.isArray(data) ? data[0] : null;
        if (latest) {
          const ratio = +latest.longShortRatio;
          result = {
            lsRatio: ratio,
            longPct: +(+latest.longAccount * 100).toFixed(1),
            shortPct: +(+latest.shortAccount * 100).toFixed(1),
            crowding: ratio > 1.5 ? 'LONG_CROWDED' : ratio < 0.67 ? 'SHORT_CROWDED' : 'NEUTRAL',
            source: 'binance',
          };
        }
      } catch (e2) {}
    }
    _setCache(k, result, TTL.ls);
    return result;
  }

  // ── LİKİDASYON 24s (YENİ — gerçek veri, tahmin değil) ─────────────
  // interval=4h (Hobbyist limiti), son 6 kova = 24 saat.
  async function getLiquidation24h(sym) {
    const k = 'liq24_' + sym;
    const c = _getCached(k); if (c) return c;
    const coin = _coin(sym);
    let result = { long24h: null, short24h: null, total24h: null, dominant: null, pace: null, buckets: [], source: 'none' };
    try {
      if (!CONFIG.enabled) throw new Error('disabled');
      const data = await _fetch('/api/futures/liquidation/aggregated-history', {
        exchange_list: 'Binance,OKX,Bybit', symbol: coin, interval: '4h', limit: 7,
      });
      if (Array.isArray(data) && data.length) {
        const buckets = data.slice(-6).map(d => ({
          ts: +d.time,
          long: +(d.aggregated_long_liquidation_usd || 0),
          short: +(d.aggregated_short_liquidation_usd || 0),
        }));
        const long24h = buckets.reduce((s, b) => s + b.long, 0);
        const short24h = buckets.reduce((s, b) => s + b.short, 0);
        const total24h = long24h + short24h;
        const lastT = buckets.length ? buckets[buckets.length - 1].long + buckets[buckets.length - 1].short : 0;
        const prev = buckets.slice(0, -1);
        const avgPrev = prev.length ? prev.reduce((s, b) => s + b.long + b.short, 0) / prev.length : 0;
        result = {
          long24h, short24h, total24h,
          dominant: total24h > 0 ? (long24h >= short24h ? 'LONG' : 'SHORT') : null,
          pace: avgPrev > 0 ? +(lastT / avgPrev).toFixed(2) : null, // son 4s, ortalamaya göre hız
          buckets, source: 'coinglass',
        };
      }
    } catch (e) {}
    _setCache(k, result, TTL.liq);
    return result;
  }

  // ── TOP TRADER POZİSYON ORANI (YENİ — smart money katmanı) ────────
  async function getTopTraderRatio(sym) {
    const k = 'top_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { ratio: null, longPct: null, shortPct: null, source: 'none' };
    try {
      if (!CONFIG.enabled) throw new Error('disabled');
      const data = await _fetch('/api/futures/top-long-short-position-ratio/history', {
        exchange: 'Binance', symbol: sym, interval: '4h', limit: 2,
      });
      const last = Array.isArray(data) && data.length ? data[data.length - 1] : null;
      if (last && last.top_position_long_short_ratio != null) {
        result = {
          ratio: +last.top_position_long_short_ratio,
          longPct: last.top_position_long_percent != null ? +(+last.top_position_long_percent).toFixed(1) : null,
          shortPct: last.top_position_short_percent != null ? +(+last.top_position_short_percent).toFixed(1) : null,
          source: 'coinglass',
        };
      }
    } catch (e) {}
    _setCache(k, result, TTL.top);
    return result;
  }

  // ── BORSA-GENELİ TAKER ORANI (YENİ — FLOW teyit katmanı) ──────────
  async function getTakerRatio(sym) {
    const k = 'taker_' + sym;
    const c = _getCached(k); if (c) return c;
    const coin = _coin(sym);
    let result = { buyPct: null, sellPct: null, buyRatio: null, buyVolUsd: null, sellVolUsd: null, source: 'none' };
    try {
      if (!CONFIG.enabled) throw new Error('disabled');
      const data = await _fetch('/api/futures/taker-buy-sell-volume/exchange-list', { symbol: coin });
      const d = Array.isArray(data) ? data[0] : data;
      if (d && d.buy_ratio != null) {
        result = {
          buyPct: +(+d.buy_ratio).toFixed(1),
          sellPct: d.sell_ratio != null ? +(+d.sell_ratio).toFixed(1) : null,
          buyRatio: +d.buy_ratio / 100,
          buyVolUsd: d.buy_vol_usd != null ? +d.buy_vol_usd : null,
          sellVolUsd: d.sell_vol_usd != null ? +d.sell_vol_usd : null,
          source: 'coinglass',
        };
      }
    } catch (e) {}
    _setCache(k, result, TTL.taker);
    return result;
  }

  // ── Geriye uyumluluk ──────────────────────────────────────────────
  async function getLiquidationClusters(sym) { return { clusters: [], source: 'n/a' }; }
  async function getHeatmap(sym) { return { levels: [], source: 'unavailable' }; }

  // TI controller/feed bu senkron getter'ları bekliyor (cache'ten okur)
  function getCachedFunding(sym) {
    const c = _getCached('fund_' + sym);
    return (c && Number.isFinite(+c.fund)) ? { rate: +c.fund, source: c.source } : null;
  }
  function getCachedOI(sym) {
    const c = _getCached('oi_' + sym);
    return (c && c.oiChange24h != null) ? { change24h: +c.oiChange24h, oiUsd: c.oiUsd, source: c.source } : null;
  }

  // ── Smart Money Divergence (top trader vs retail) ─────────────────
  function _smart(top, ls) {
    if (!top || !ls || top.longPct == null || ls.longPct == null) return null;
    const diff = +(top.longPct - ls.longPct).toFixed(1); // + → top daha long
    if (diff >= 12)  return { divergence: 'TOP_LONG_RETAIL_SHORT', diff, topLong: top.longPct, retailLong: ls.longPct };
    if (diff <= -12) return { divergence: 'TOP_SHORT_RETAIL_LONG', diff, topLong: top.longPct, retailLong: ls.longPct };
    return { divergence: null, diff, topLong: top.longPct, retailLong: ls.longPct };
  }

  // ── Tek çağrı: Market Intelligence (genişletilmiş) ────────────────
  async function getMarketIntelligence(sym) {
    const [fund, oi, ls, liq24h, top, taker] = await Promise.allSettled([
      getFundingExtreme(sym),
      getOI(sym),
      getLSRatio(sym),
      getLiquidation24h(sym),
      getTopTraderRatio(sym),
      getTakerRatio(sym),
    ]);
    const F = s => s.status === 'fulfilled' ? s.value : null;
    const fundV = F(fund) || { fund: null };
    const oiV   = F(oi)   || { oi: null };
    const lsV   = F(ls)   || { lsRatio: null };
    const topV  = F(top)  || { ratio: null };
    return {
      fund: fundV, oi: oiV, ls: lsV,
      liq: { clusters: [] },                 // eski alan — uyum için
      liq24h: F(liq24h) || { total24h: null },
      topTrader: topV,
      taker: F(taker) || { buyPct: null },
      smart: _smart(topV, lsV),
      source: CONFIG.enabled ? 'coinglass' : 'fallback',
      ts: Date.now(),
    };
  }

  function setup(apiKey) {
    CONFIG.enabled = true;
    try { console.log('✅ CoinGlass v4 aktif — kebab-case yollar (Hobbyist paketi)'); } catch (e) {}
  }
  function isEnabled() { return CONFIG.enabled; }
  function clearCache() { _cache.clear(); }

  return {
    setup, isEnabled, clearCache,
    getFundingExtreme, getOI, getLSRatio,
    getLiquidationClusters, getHeatmap,
    getLiquidation24h, getTopTraderRatio, getTakerRatio,
    getCachedFunding, getCachedOI,
    getMarketIntelligence,
  };
})();
window.CoinGlassService = CoinGlassService;
