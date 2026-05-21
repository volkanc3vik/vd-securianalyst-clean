// ════════════════════════════════════════════════════════════════════
// COINGLASS SERVICE — V4 API
// Hobbyist plan: sadece exchange-list endpoint'leri çalışıyor
// Diğerleri graceful Binance fallback ile devam eder
// ════════════════════════════════════════════════════════════════════
const CoinGlassService = (() => {

  const CONFIG = {
    enabled: false,
    timeout: 8000,
  };

  const _cache = new Map();
  const TTL = { fund:120000, oi:60000, ls:120000, liq:60000 };

  // Hangi endpoint'lerin Hobbyist'te çalışmadığını biliyoruz
  // Bunları sessizce atla, Binance fallback kullan
  const UNAVAILABLE = new Set([
    '/api/futures/fundingRate/ohlc-history',
    '/api/futures/fundingRate/oi-weight-ohlc-history',
    '/api/futures/fundingRate/vol-weight-ohlc-history',
    '/api/futures/openInterest/ohlc-aggregated-history',
    '/api/futures/openInterest/ohlc-history',
    '/api/futures/globalLongShortAccountRatio/history',
    '/api/futures/liquidation/history',
    '/api/futures/coins-markets',
  ]);

  function _getCached(k) {
    const c = _cache.get(k);
    if (!c || Date.now()-c.ts > c.ttl) { _cache.delete(k); return null; }
    return c.data;
  }
  function _setCache(k, data, ttl) { _cache.set(k, {data, ts:Date.now(), ttl}); }

  async function _fetch(endpoint, params={}) {
    // Hobbyist'te çalışmayan endpoint'leri hemen reddet
    if (UNAVAILABLE.has(endpoint)) throw new Error('UNAVAILABLE');

    const proxyUrl = '/api/coinglass';
    const paramStr = Object.entries(params).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
    const url = `${proxyUrl}?endpoint=${encodeURIComponent(endpoint)}${paramStr?'&params='+encodeURIComponent(paramStr):''}`;
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), CONFIG.timeout);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(tid);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const json = await r.json();
      // Plan hatası veya endpoint bulunamadı → UNAVAILABLE olarak işaretle
      if (json.code !== '0' && json.code !== 0) {
        const msg = json.msg || '';
        if (msg.includes('Upgrade') || msg.includes('not found') || msg.includes('endpoint')) {
          UNAVAILABLE.add(endpoint);
        }
        throw new Error(msg || 'API error');
      }
      return json.data;
    } catch(e) { clearTimeout(tid); throw e; }
  }

  // ── Binance fallback ──────────────────────────────────────────────
  const FB = 'https://fapi.binance.com';
  async function _binance(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // ── Exchange-list: Hobbyist'te çalışan anlık funding rate ─────────
  async function _getFundingExchangeList(sym) {
    const data = await _fetch('/api/futures/fundingRate/exchange-list', {
      symbol: sym.replace('USDT',''),
    });
    if (!Array.isArray(data)) throw new Error('no data');
    // Binance verisini bul
    const binanceRow = data.find(d => d.exchangeName === 'Binance' || d.exchange === 'Binance');
    const row = binanceRow || data[0];
    const rate = row?.fundingRate ?? row?.rate ?? 0;
    return +(+rate*100).toFixed(4);
  }

  // 1. Funding Rate
  async function getFunding(sym) {
    const k = 'fund_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { fund:null, history:[], extreme:false, bias:'NEUTRAL', source:'binance' };
    try {
      if (CONFIG.enabled) {
        const fund = await _getFundingExchangeList(sym);
        result = {
          fund,
          history: [fund],
          extreme: Math.abs(fund) > 0.1,
          bias:    fund > 0.05 ? 'LONG_CROWDED' : fund < -0.05 ? 'SHORT_CROWDED' : 'NEUTRAL',
          source:  'coinglass',
        };
      } else {
        throw new Error('disabled');
      }
    } catch(e) {
      // Sessizce Binance fallback
      try {
        const data = await _binance(`${FB}/fapi/v1/fundingRate?symbol=${sym}&limit=8`);
        const arr  = Array.isArray(data) ? data : [];
        const latest = arr[arr.length-1]?.fundingRate ?? 0;
        result = {
          fund:    +(+latest*100).toFixed(4),
          history: arr.map(d => +(+d.fundingRate*100).toFixed(4)),
          extreme: Math.abs(+latest*100) > 0.1,
          bias:    +latest > 0.05 ? 'LONG_CROWDED' : +latest < -0.05 ? 'SHORT_CROWDED' : 'NEUTRAL',
          source:  'binance',
        };
      } catch {}
    }
    _setCache(k, result, TTL.fund);
    return result;
  }

  // 2. Open Interest — Hobbyist exchange-list üzerinden
  async function getOI(sym) {
    const k = 'oi_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { oi:null, oiChange:null, oiExpanding:false, source:'binance' };
    try {
      if (CONFIG.enabled) {
        const data = await _fetch('/api/futures/openInterest/exchange-list', {
          symbol: sym.replace('USDT',''),
        });
        if (Array.isArray(data)) {
          const total = data.reduce((s,d) => s + (+d.openInterestAmount||0), 0);
          result = { oi: total || null, oiChange: null, oiExpanding: false, source: 'coinglass' };
        }
      } else {
        throw new Error('disabled');
      }
    } catch(e) {
      try {
        const data = await _binance(`${FB}/fapi/v1/openInterest?symbol=${sym}`);
        result = { oi: data?.openInterest ? +data.openInterest : null, oiChange:null, oiExpanding:false, source:'binance' };
      } catch {}
    }
    _setCache(k, result, TTL.oi);
    return result;
  }

  // 3. Long/Short Ratio — Hobbyist'te history çalışmıyor, Binance fallback
  async function getLSRatio(sym) {
    const k = 'ls_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { lsRatio:null, longPct:null, shortPct:null, crowding:'NEUTRAL', source:'binance' };
    try {
      const data = await _binance(`${FB}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`);
      const latest = Array.isArray(data) ? data[0] : null;
      if (latest) {
        const ratio = +latest.longShortRatio;
        result = {
          lsRatio:  ratio,
          longPct:  +(+latest.longAccount*100).toFixed(1),
          shortPct: +(+latest.shortAccount*100).toFixed(1),
          crowding: ratio > 1.5 ? 'LONG_CROWDED' : ratio < 0.67 ? 'SHORT_CROWDED' : 'NEUTRAL',
          source:   'binance',
        };
      }
    } catch {}
    _setCache(k, result, TTL.ls);
    return result;
  }

  // 4. Liquidation — Hobbyist'te çalışmıyor, sessiz fallback
  async function getLiquidations(sym) {
    const k = 'liq_' + sym;
    const c = _getCached(k); if (c) return c;
    const result = {
      liq24h:null, liqLong24h:null, liqShort24h:null,
      liqSpike:false, liqBias:'NEUTRAL', liqClusters:[],
      source:'unavailable',
    };
    _setCache(k, result, TTL.liq);
    return result;
  }

  // 5. Heatmap — Professional plan gerektirir
  async function getHeatmap(sym) {
    return { levels:[], source:'unavailable' };
  }

  // 6. Market Intelligence
  async function getMarketIntelligence(sym) {
    const [fund, oi, ls, liq] = await Promise.allSettled([
      getFunding(sym),
      getOI(sym),
      getLSRatio(sym),
      getLiquidations(sym),
    ]);
    return {
      fund:   fund.status==='fulfilled'  ? fund.value   : {fund:null},
      oi:     oi.status==='fulfilled'    ? oi.value     : {oi:null},
      ls:     ls.status==='fulfilled'    ? ls.value     : {lsRatio:null},
      liq:    liq.status==='fulfilled'   ? liq.value    : {liq24h:null},
      source: CONFIG.enabled ? 'coinglass+binance' : 'binance',
      ts:     Date.now(),
    };
  }

  function setup(apiKey) {
    CONFIG.enabled = true;
    console.log('✅ CoinGlass V4 aktif (Hobbyist: exchange-list endpoints)');
  }

  function isEnabled()  { return CONFIG.enabled; }
  function clearCache() { _cache.clear(); }

  return {
    setup, isEnabled, clearCache,
    getFunding, getOI, getLSRatio, getLiquidations, getHeatmap,
    getMarketIntelligence,
  };

})();
