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
      coinglass: typeof window.CoinGlassService !== 'undefined' && !!window.CoinGlassService.isEnabled?.(),
      ws:        typeof window.WSEngine !== 'undefined' || typeof window.WSService !== 'undefined',
    };
  }

  return { splitMajors, toScorerContext, detectDataSources };
})();
