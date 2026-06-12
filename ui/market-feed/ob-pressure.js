// ════════════════════════════════════════════════════════════════════
// ORDER BOOK PRESSURE — 8. iş · LIVE FEED altı bid/ask denge barı
//
// Ne gösterir: aktif coin'in fiyatın ±%1 bandındaki TOPLAM bid (defans)
// vs ask (tavan) derinliği — Binance+OKX+Bybit toplamı (CoinGlass).
// Trade akışı "ne oldu"yu, bu bar "ne bekliyor"u söyler.
//
// Dürüstlük: pasif derinlik manipüle edilebilir (spoofing) → mikro notta
// açıkça yazar; bu bir BAĞLAM göstergesidir, sinyal değildir.
//
// Konum: sağ rail'de #vdLfMount'un hemen altı. Rail yeniden render
// olursa kendini yeniden bağlar (her tikte _ensure).
// Veri: CoinGlassService.getOrderBook(sym) — 120s cache, coin değişince taze.
//
// Public API: window.VDObPressure.mount() / .unmount() / .get()
// ════════════════════════════════════════════════════════════════════
window.VDObPressure = (function () {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const EL_ID = 'vdObPressure';
  const TICK_MS = 15000;          // ensure + render tiki (veri 120s cache'li)
  let _mounted = false;
  let _timer = null;
  let _last = null;               // son veri {bidPct, ...}
  let _lastSym = null;
  let _fetching = false;

  function _usd(v) {
    if (v == null || !Number.isFinite(+v)) return '—';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + (+v).toFixed(0);
  }

  function _ensure() {
    if (document.getElementById(EL_ID)) return true;
    const lf = document.getElementById('vdLfMount');
    if (!lf || !lf.parentNode) return false;
    const el = document.createElement('div');
    el.id = EL_ID;
    el.className = 'vd-ob';
    lf.parentNode.insertBefore(el, lf.nextSibling);
    return true;
  }

  function _stateLabel(d) {
    if (!d || d.bidPct == null) return null;
    if (d.bidPct >= 58) return { k: 'ob.bidStrong', f: 'Defans altta güçlü', cls: 'up' };
    if (d.bidPct <= 42) return { k: 'ob.askHeavy', f: 'Tavan üstte ağır', cls: 'dn' };
    return { k: 'ob.balanced', f: 'Derinlik dengeli', cls: 'mid' };
  }

  function _render() {
    const el = document.getElementById(EL_ID);
    if (!el) return;
    const d = _last;
    const sym = (window.SYM || 'BTCUSDT').replace('USDT', '');
    const head = '<div class="vd-ob-head"><span class="vd-ob-title">' +
      _t('ob.title', null, 'ORDER BOOK PRESSURE') + '</span>' +
      '<span class="vd-ob-sym">' + sym + ' ±%' + ((d && d.range) || '1') + '</span></div>';

    if (!d || d.bidPct == null) {
      el.innerHTML = head + '<div class="vd-ob-na">' + _t('ob.waiting', null, 'Derinlik verisi bekleniyor…') + '</div>';
      return;
    }
    const st = _stateLabel(d);
    el.innerHTML = head +
      '<div class="vd-ob-track"><div class="vd-ob-fill" style="width:' + d.bidPct + '%"></div>' +
        '<span class="vd-ob-pct l">Bid %' + d.bidPct + '</span>' +
        '<span class="vd-ob-pct r">Ask %' + d.askPct + '</span></div>' +
      '<div class="vd-ob-row">' +
        '<span class="vd-ob-st ' + st.cls + '">' + _t(st.k, null, st.f) + '</span>' +
        '<span class="vd-ob-amt">' + _usd(d.bidsUsd) + ' vs ' + _usd(d.asksUsd) + '</span>' +
      '</div>' +
      '<div class="vd-ob-micro">' + _t('ob.micro', null, 'Pasif derinlik (3 borsa) — manipüle edilebilir; bağlam amaçlıdır, sinyal değildir.') + '</div>';
  }

  async function _fetch() {
    if (_fetching) return;
    const CG = window.CoinGlassService;
    if (!CG || !CG.getOrderBook || !CG.isEnabled || !CG.isEnabled()) return;
    const sym = window.SYM || 'BTCUSDT';
    _fetching = true;
    try {
      const d = await CG.getOrderBook(sym);
      _last = (d && d.bidPct != null) ? d : _last && _lastSym === sym ? _last : null;
      _lastSym = sym;
    } catch (e) {}
    _fetching = false;
    _render();
  }

  function _tick() {
    if (!_ensure()) return;
    const sym = window.SYM || 'BTCUSDT';
    if (sym !== _lastSym) { _last = null; _render(); _fetch(); }   // coin değişti → taze çek
    else { _fetch(); }                                              // cache TTL yönetir
  }

  function mount() {
    if (_mounted) return;
    // 11. iş: public/free görünümde HİÇ mount edilmez (premium+admin görür).
    // VDAccess yoksa açık davran — premium deneyimi kırılmasın.
    try {
      if (window.VDAccess && typeof window.VDAccess.isPremium === 'function' && !window.VDAccess.isPremium()) return;
    } catch (e) {}
    _mounted = true;
    _ensure();
    _render();
    _fetch();
    _timer = setInterval(_tick, TICK_MS);
    try { console.log('[ObPressure] mount ✓'); } catch (e) {}
  }

  function unmount() {
    _mounted = false;
    if (_timer) clearInterval(_timer);
    _last = null; _lastSym = null;     // temiz başlangıç (aynı oturumda re-mount için)
    const el = document.getElementById(EL_ID);
    if (el) el.remove();
  }

  // AI Terminal bağlamı için
  function get() { return _last; }

  return { mount, unmount, get };
})();
