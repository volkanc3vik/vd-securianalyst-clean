// ════════════════════════════════════════════════════════════════════
// VIP TRACKER · PRICE
// Aktif trade'lerin current price'ını sağlar.
//
// Strateji: Binance REST '/fapi/v1/ticker/price' tek istekte tüm
// futures sembollerini döner. Aktif trade varsa polling açılır,
// sembol listesi tek seferde çekilir, RAM cache'e yazılır.
//
// Public API:
//   TrackerPrice.fetchAll()              → tüm price map'i tazele
//   TrackerPrice.getPrice(symbol)        → cache'ten current price
//   TrackerPrice.simulatePrice(sym, p)   → test için override (kalıcı)
//   TrackerPrice.clearSimulation(sym?)   → simülasyonu temizle
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const FBASE = 'https://fapi.binance.com';
  const ENDPOINT = `${FBASE}/fapi/v1/ticker/price`;

  // Cache: { 'BTCUSDT': 50000.5, ... }
  let _cache = {};
  let _lastFetch = 0;
  // Simulated override (test için) — gerçek fiyat değil, manuel
  const _sim = new Map();

  function _debug(...args) {
    if (window.VipTrackerDebug) console.debug('[VIP-Track:Price]', ...args);
  }

  async function fetchAll() {
    try {
      const res = await fetch(ENDPOINT, { method: 'GET' });
      if (!res.ok) {
        _debug('fetch failed status=', res.status);
        return false;
      }
      const arr = await res.json();
      if (!Array.isArray(arr)) return false;
      const next = {};
      for (const item of arr) {
        if (item.symbol && item.price) {
          next[item.symbol] = +item.price;
        }
      }
      _cache = next;
      _lastFetch = Date.now();
      _debug(`cache refreshed, ${Object.keys(_cache).length} symbols`);
      return true;
    } catch (e) {
      _debug('fetch error', e.message);
      return false;
    }
  }

  function getPrice(symbol) {
    if (!symbol) return null;
    const sym = String(symbol).toUpperCase();
    // Simulated override öncelikli
    if (_sim.has(sym)) return _sim.get(sym);
    const p = _cache[sym];
    return Number.isFinite(p) ? p : null;
  }

  function simulatePrice(symbol, price) {
    if (!symbol || !Number.isFinite(+price)) return false;
    _sim.set(String(symbol).toUpperCase(), +price);
    _debug('simulate', symbol, '→', price);
    return true;
  }

  function clearSimulation(symbol) {
    if (!symbol) {
      _sim.clear();
      _debug('all simulations cleared');
      return true;
    }
    return _sim.delete(String(symbol).toUpperCase());
  }

  function getLastFetchTime() {
    return _lastFetch;
  }

  function getCacheSize() {
    return Object.keys(_cache).length;
  }

  window.TradeWatcherPrice = {
    fetchAll,
    getPrice,
    simulatePrice,
    clearSimulation,
    getLastFetchTime,
    getCacheSize,
  };
})();
