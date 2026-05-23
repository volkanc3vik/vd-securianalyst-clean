// ════════════════════════════════════════════════════════════════════
// TI FEED — Adaptör
// scan sonuçlarını + CoinGlass cache'i engine'lerin "ctx" formatına çevirir.
// Yeni WS aboneliği YOK. Yeni interval YOK. Yeni scan YOK.
//
// CoinGlass disabled ise funding/oi göndermez — scorer o faktörü dışar.
// ════════════════════════════════════════════════════════════════════
window.TIFeed = (() => {
  'use strict';

  function splitMajors(scanResults) {
    if (!Array.isArray(scanResults)) return { btc: null, eth: null, others: [] };
    let btc = null, eth = null;
    const others = [];
    for (const r of scanResults) {
      const s = (r.sym || '').toUpperCase();
      if (s === 'BTCUSDT' || s === 'BTC') { btc = r; continue; }
      if (s === 'ETHUSDT' || s === 'ETH') { eth = r; continue; }
      others.push(r);
    }
    return { btc, eth, others };
  }

  function _resolveDir(item) {
    const explicit = (item.dir || item.direction || '').toString().toUpperCase();
    if (explicit === 'LONG' || explicit === 'SHORT') return explicit;
    const l = +item.lScore || 0;
    const s = +item.sScore || 0;
    if (l > s) return 'LONG';
    if (s > l) return 'SHORT';
    return null;
  }

  function _resolveFunding(item) {
    if (item.funding && Number.isFinite(+item.funding.rate)) return item.funding;
    if (Number.isFinite(+item.fundingRate)) return { rate: +item.fundingRate };
    if (typeof window.CoinGlassService !== 'undefined' && window.CoinGlassService.isEnabled?.()) {
      try {
        const cg = window.CoinGlassService.getCachedFunding?.(item.sym);
        if (cg && Number.isFinite(+cg.rate)) return { rate: +cg.rate };
      } catch {}
    }
    return null;
  }

  function _resolveOI(item) {
    if (item.oi && (Number.isFinite(+item.oi.change24h) || Number.isFinite(+item.oi.changePercent))) {
      return item.oi;
    }
    if (Number.isFinite(+item.oiChange24h)) return { change24h: +item.oiChange24h };
    if (typeof window.CoinGlassService !== 'undefined' && window.CoinGlassService.isEnabled?.()) {
      try {
        const cg = window.CoinGlassService.getCachedOI?.(item.sym);
        if (cg) return cg;
      } catch {}
    }
    return null;
  }

  function toScorerContext(item) {
    if (!item) return null;
    const dir = _resolveDir(item);
    if (!dir) return null;

    const isLong = dir === 'LONG';
    return {
      sym:     item.sym,
      dir,
      closes:  item.closes  || (item.candles ? item.candles.map(c => c.c) : null),
      candles: item.candles || null,
      ind:     item.ind     || null,
      smcData: item.smcData || item._smcData || null,
      entry:   +(isLong ? (item.entry || item.price)        : (item.entryShort || item.price))     || null,
      sl:      +(isLong ? (item.sl    || item.slLong)       : (item.slShort    || item.sl))         || null,
      tp1:     +(isLong ? (item.tp1   || item.tp1Long)      : (item.tp1Short   || item.tp1))        || null,
      tp2:     +(isLong ? (item.tp2   || item.tp2Long)      : (item.tp2Short   || item.tp2))        || null,
      tp3:     +(isLong ? (item.tp3   || item.tp3Long)      : (item.tp3Short   || item.tp3))        || null,
      funding: _resolveFunding(item),
      oi:      _resolveOI(item),
    };
  }

  function detectDataSources() {
    return {
      binance:   typeof window.Binance !== 'undefined' || typeof window.BinanceService !== 'undefined' || true,
      coinglass: _coinglassStatus(),
      ws:        typeof window.WSEngine !== 'undefined' || typeof window.WSService !== 'undefined',
    };
  }

  function _coinglassStatus() {
    if (typeof window.CoinGlassService === 'undefined') return 'OFF';
    if (!window.CoinGlassService.isEnabled?.()) return 'OFF';
    // Hobbyist / Free tier mı, full mü?
    if (window.CoinGlassService.getTier) {
      const tier = window.CoinGlassService.getTier();
      if (tier === 'PRO' || tier === 'FULL') return 'FULL';
      return 'PARTIAL';
    }
    // Tier API yoksa, açık olduğu için PARTIAL kabul et
    return 'PARTIAL';
  }

  /**
   * Partial bootstrap — sayfa açılışında ilk scan'den önce gösterilecek
   * erken intelligence. WSEngine veya cache'de mevcut BTC/ETH verisini
   * kullanır. Yeni WS aboneliği YOK.
   *
   * @returns {Object|null} { btc, eth, regime, volObs } | null
   */
  function bootstrapPartial() {
    if (typeof window.WSEngine === 'undefined' && typeof window.WSService === 'undefined') {
      return null;
    }

    const btcCache = _readWSCache('BTCUSDT');
    const ethCache = _readWSCache('ETHUSDT');

    if (!btcCache && !ethCache) return null;

    // Erken Narrator + Regime için minimum veri
    const partial = { btc: null, eth: null };
    if (btcCache && typeof window.TINarrator !== 'undefined') {
      partial.btc = window.TINarrator.analyzeCoin(btcCache);
    }
    if (ethCache && typeof window.TINarrator !== 'undefined') {
      partial.eth = window.TINarrator.analyzeCoin(ethCache);
      if (partial.btc && partial.eth) {
        partial.eth.vsBTC = window.TINarrator.compareETHvsBTC(partial.btc, partial.eth);
      }
    }

    // Erken regime — BTC bazlı (scan yok ama BTC ind var)
    if (btcCache && typeof window.TIRegime !== 'undefined') {
      // Tek BTC ile minimal scanResults simüle et
      const earlyResults = [btcCache];
      if (ethCache) earlyResults.push(ethCache);
      partial.regime = window.TIRegime.detect(btcCache, earlyResults);
    }

    return partial;
  }

  function _readWSCache(sym) {
    // WSEngine veya WSService'in cache yapısı projeye göre değişir.
    // Genel pattern: window.WSEngine.getCoinData?.(sym) veya benzeri.
    const candidates = [
      () => window.WSEngine?.getCoinData?.(sym),
      () => window.WSEngine?.getCache?.(sym),
      () => window.WSEngine?.cache?.[sym],
      () => window.WSService?.getCoinData?.(sym),
      () => window.WSService?.getCache?.(sym),
    ];

    for (const fn of candidates) {
      try {
        const data = fn();
        if (data && (data.closes || data.candles)) {
          return _normalizeWSData(sym, data);
        }
      } catch {}
    }
    return null;
  }

  function _normalizeWSData(sym, raw) {
    // Farklı WS engine'leri farklı yapı kullanır. En yaygın 2'yi destekle.
    const closes  = raw.closes || (raw.candles ? raw.candles.map(c => +c.c || +c.close) : null);
    const candles = raw.candles || null;
    if (!closes || closes.length < 20) return null;

    return {
      sym,
      closes,
      candles,
      price:   raw.price || raw.lastPrice || closes[closes.length - 1],
      chg:     raw.chg || raw.priceChangePercent || 0,
      ind:     raw.ind || null,
      smcData: null,
    };
  }

  return { splitMajors, toScorerContext, detectDataSources, bootstrapPartial };
})();
