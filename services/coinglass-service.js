// ════════════════════════════════════════════════════════════════════
// COINGLASS SERVICE — V4 API, Hobbyist Plan uyumlu
// Çalışan: exchange-list endpoints (anlık veri)
// Çalışmayan: history endpoints → sessiz Binance fallback
// ════════════════════════════════════════════════════════════════════
const CoinGlassService = (() => {

  const CONFIG = {
    enabled: false,
    timeout: 8000,
  };

  const _cache = new Map();
  const TTL = { fund: 120000, oi: 60000, ls: 120000, liq: 60000 };

  // Hobbyist'te çalışmayan endpoint'ler — sessizce atla
  const UNAVAILABLE = new Set([
    '/api/futures/fundingRate/ohlc-history',
    '/api/futures/fundingRate/oi-weight-ohlc-history',
    '/api/futures/fundingRate/chart',
    '/api/futures/openInterest/ohlc-history',
    '/api/futures/openInterest/ohlc-aggregated-history',
    '/api/futures/openInterest/chart',
    '/api/futures/globalLongShortAccountRatio/history',
    '/api/futures/globalLongShortAccountRatio/chart',
    '/api/futures/liquidation/history',
    '/api/futures/liquidation/symbol/chart',
    '/api/futures/liquidation/level',
    '/api/futures/liquidation/heatmap',
    '/api/futures/coins-markets',
  ]);

  function _getCached(k) {
    const c = _cache.get(k);
    if (!c || Date.now() - c.ts > c.ttl) { _cache.delete(k); return null; }
    return c.data;
  }
  function _setCache(k, data, ttl) { _cache.set(k, { data, ts: Date.now(), ttl }); }

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
        const msg = json.msg || '';
        if (msg.toLowerCase().includes('upgrade') || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('endpoint')) {
          UNAVAILABLE.add(endpoint); // Dinamik olarak işaretle
        }
        throw new Error(msg || 'API error');
      }
      return json.data;
    } catch (e) { clearTimeout(tid); throw e; }
  }

  const FB = 'https://fapi.binance.com';
  async function _binance(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // ── Funding Rate ─────────────────────────────────────────────────
  // exchange-list: Hobbyist'te çalışan anlık veri
  async function getFundingExtreme(sym) {
    const k = 'fund_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { fund: null, history: [], extreme: false, bias: 'NEUTRAL', source: 'binance' };
    try {
      if (CONFIG.enabled) {
        const data = await _fetch('/api/futures/fundingRate/exchange-list', {
          symbol: sym.replace('USDT', ''),
        });
        if (Array.isArray(data) && data.length > 0) {
          const binRow = data.find(d => (d.exchangeName || d.exchange || '').toLowerCase() === 'binance') || data[0];
          const rate = +(+(binRow?.fundingRate ?? binRow?.rate ?? 0) * 100).toFixed(4);
          result = {
            fund: rate,
            history: [rate],
            extreme: Math.abs(rate) > 0.1,
            bias: rate > 0.05 ? 'LONG_CROWDED' : rate < -0.05 ? 'SHORT_CROWDED' : 'NEUTRAL',
            source: 'coinglass',
          };
        }
      } else throw new Error('disabled');
    } catch (e) {
      try {
        const data = await _binance(`${FB}/fapi/v1/fundingRate?symbol=${sym}&limit=8`);
        const arr = Array.isArray(data) ? data : [];
        const latest = arr[arr.length - 1]?.fundingRate ?? 0;
        result = {
          fund: +(+latest * 100).toFixed(4),
          history: arr.map(d => +(+d.fundingRate * 100).toFixed(4)),
          extreme: Math.abs(+latest * 100) > 0.1,
          bias: +latest > 0.05 ? 'LONG_CROWDED' : +latest < -0.05 ? 'SHORT_CROWDED' : 'NEUTRAL',
          source: 'binance',
        };
      } catch {}
    }
    _setCache(k, result, TTL.fund);
    return result;
  }

  // ── Open Interest ─────────────────────────────────────────────────
  // exchange-list: Hobbyist'te çalışan anlık veri
  async function getLiquidationClusters(sym) {
    // Hobbyist'te liquidation endpoint'leri çalışmıyor — sessiz fallback
    const k = 'liq_' + sym;
    const c = _getCached(k); if (c) return c;
    const result = { clusters: [], source: 'unavailable' };
    _setCache(k, result, TTL.liq);
    return result;
  }

  // ── Open Interest ─────────────────────────────────────────────────
  async function getOI(sym) {
    const k = 'oi_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { oi: null, oiChange: null, oiExpanding: false, source: 'binance' };
    try {
      if (CONFIG.enabled) {
        const data = await _fetch('/api/futures/openInterest/exchange-list', {
          symbol: sym.replace('USDT', ''),
        });
        if (Array.isArray(data)) {
          const total = data.reduce((s, d) => s + (+d.openInterestAmount || +d.openInterest || 0), 0);
          result = { oi: total || null, oiChange: null, oiExpanding: false, source: 'coinglass' };
        }
      } else throw new Error('disabled');
    } catch (e) {
      try {
        const data = await _binance(`${FB}/fapi/v1/openInterest?symbol=${sym}`);
        result = { oi: data?.openInterest ? +data.openInterest : null, oiChange: null, oiExpanding: false, source: 'binance' };
      } catch {}
    }
    _setCache(k, result, TTL.oi);
    return result;
  }

  // ── Long/Short Ratio — Binance direkt ────────────────────────────
  async function getLSRatio(sym) {
    const k = 'ls_' + sym;
    const c = _getCached(k); if (c) return c;
    let result = { lsRatio: null, longPct: null, shortPct: null, crowding: 'NEUTRAL', source: 'binance' };
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
    } catch {}
    _setCache(k, result, TTL.ls);
    return result;
  }

  // ── Heatmap — Professional plan, sessiz fallback ─────────────────
  async function getHeatmap(sym) {
    return { levels: [], source: 'unavailable' };
  }

  // ── Market Intelligence — tek çağrı ──────────────────────────────
  async function getMarketIntelligence(sym) {
    const [fund, oi, ls, liq] = await Promise.allSettled([
      getFundingExtreme(sym),
      getOI(sym),
      getLSRatio(sym),
      getLiquidationClusters(sym),
    ]);
    return {
      fund: fund.status === 'fulfilled' ? fund.value : { fund: null },
      oi: oi.status === 'fulfilled' ? oi.value : { oi: null },
      ls: ls.status === 'fulfilled' ? ls.value : { lsRatio: null },
      liq: liq.status === 'fulfilled' ? liq.value : { clusters: [] },
      source: CONFIG.enabled ? 'coinglass+binance' : 'binance',
      ts: Date.now(),
    };
  }

  function setup(apiKey) {
    CONFIG.enabled = true;
    console.log('✅ CoinGlass V4 aktif (Hobbyist: exchange-list endpoints)');
  }

  function isEnabled() { return CONFIG.enabled; }
  function clearCache() { _cache.clear(); }

  return {
    setup, isEnabled, clearCache,
    getLiquidationClusters, getFundingExtreme,
    getOI, getLSRatio, getHeatmap, getMarketIntelligence,
  };

})();
