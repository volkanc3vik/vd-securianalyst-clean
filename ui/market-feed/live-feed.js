// ════════════════════════════════════════════════════════════════════
// LIVE MARKET FEED — Sağ sticky panel · canlı aggTrade akışı
//
// Mimari (kullanıcı onaylı):
//   - Veri: Binance aggTrade (public WS, key gerektirmez)
//   - SADECE aktif coin (window.SYM) için tek izole socket
//   - Mevcut WSEngine ticker/kline/depth akışına DOKUNMAZ (ayrı socket)
//   - Son MAX_TRADES (≤60) trade tutulur — memory koruması
//   - Render throttle: UI en fazla 1 sn'de 1 kez güncellenir
//   - Whale highlight: ≥ WHALE_USD ($50K) turkuaz/parlak satır
//   - Küçük trade'ler sönük gösterilir
//   - Mock veri YOK; veri yoksa "Canlı akış bekleniyor" fallback
//
// Public API:
//   window.VDLiveFeed.mount()         → paneli ekler + aktif coin'e bağlanır
//   window.VDLiveFeed.setSymbol(sym)  → aktif coin değişince çağrılır
//   window.VDLiveFeed.unmount()       → paneli kaldırır, socket'i kapatır
//
// Modüler: bu dosyayı silmek = panel kaybolur, başka hiçbir şey kırılmaz.
// ════════════════════════════════════════════════════════════════════
window.VDLiveFeed = (function () {
  'use strict';

  // i18n: korumalı çeviri (i18n.js yoksa Türkçe yedeğe düşer)
  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  // Endpoint: Binance SPOT tek-stream. (Futures fstream bazı bölgelerde
  // bloklu — teşhisle doğrulandı; spot stream.binance.com erişilebilir.)
  // Tek-stream → düz aggTrade objesi: { e:'aggTrade', p, q, m, ... }
  const FWSS       = 'wss://stream.binance.com:9443/ws/';
  const PANEL_ID   = 'vd-live-feed';
  const MAX_TRADES = 50;       // son 50 trade (kural: 40–60)
  const WHALE_USD  = 50000;    // whale highlight eşiği
  const DIM_USD    = 5000;     // bu altı "küçük trade" → sönük
  const RENDER_MS  = 1000;     // render throttle: 1 sn'de 1

  let _socket        = null;
  let _curKey        = null;   // şu an dinlenen coin (lowercase)
  let _trades        = [];     // [{ ts, price, val, buy, whale }]
  let _renderTimer   = null;
  let _dirty         = false;
  let _reconnectT    = null;
  let _attempts      = 0;
  let _mounted       = false;
  let _status        = 'idle'; // idle | connecting | live | error

  function _setStatus(s) {
    _status = s;
    const dot = document.querySelector('#' + PANEL_ID + ' .vd-lf-dot');
    if (dot) dot.className = 'vd-lf-dot st-' + s;
    if (!_trades.length) _scheduleRender(); // boş ekranda durum metnini güncelle
  }

  // ── Sayı formatları ────────────────────────────────────────────────
  function _fmtVal(v) {
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + v.toFixed(0);
  }
  function _fmtPrice(p) {
    if (p >= 1000) return p.toFixed(1);
    if (p >= 1)    return p.toFixed(3);
    return p.toFixed(5);
  }
  function _relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 1)  return _t('lf.now', null, 'şimdi');
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return m + 'd';
    return Math.floor(m / 60) + 'sa';
  }

  // ── Panel iskeleti ─────────────────────────────────────────────────
  function _panelHTML() {
    return '<div class="vd-lf-hdr">' +
        '<span class="vd-lf-dot st-' + _status + '"></span>' +
        '<span class="vd-lf-title">' + _t('lf.title', null, 'LIVE MARKET FEED') + '</span>' +
        '<span class="vd-lf-spot">SPOT</span>' +
        '<span class="vd-lf-sym" id="vdLfSym">' + (_curKey ? _curKey.toUpperCase() : '—') + '</span>' +
        '<button class="vd-lf-collapse" id="vdLfCollapse" aria-label="' + _t('lf.collapse', null, 'Gizle/Göster') + '">▾</button>' +
      '</div>' +
      '<div class="vd-lf-body" id="vdLfBody">' +
        '<div class="vd-lf-empty" id="vdLfEmpty">' +
          '<span class="vd-lf-empty-ic">📡</span>' +
          _t('lf.waiting', null, 'Canlı akış bekleniyor…') +
        '</div>' +
        '<div class="vd-lf-list" id="vdLfList"></div>' +
      '</div>' +
      '<div class="vd-lf-foot">' +
        '<span class="vd-lf-foot-lbl">' + _t('lf.poweredBy', null, 'Binance · canlı işlem akışı') + '</span>' +
      '</div>';
  }

  function _bindCollapse(el) {
    const cBtn = el.querySelector('#vdLfCollapse');
    if (cBtn) {
      cBtn.addEventListener('click', function () {
        el.classList.toggle('is-collapsed');
        cBtn.textContent = el.classList.contains('is-collapsed') ? '▴' : '▾';
      });
    }
  }

  function _ensurePanel() {
    const mountTarget = document.getElementById('vdLfMount');
    let el = document.getElementById(PANEL_ID);

    if (el) {
      // Panel var: rail mount noktası oluştuysa oraya taşı (innerHTML ezmesi sonrası)
      if (mountTarget && el.parentNode !== mountTarget) {
        mountTarget.appendChild(el);
        el.classList.add('vd-lf-railed');
        _bindCollapse(el);  // innerHTML korunduğu için event'ler durur ama güvenli
      }
      return;
    }

    el = document.createElement('aside');
    el.id = PANEL_ID;
    el.className = mountTarget ? 'vd-lf vd-lf-railed' : 'vd-lf';
    el.setAttribute('role', 'complementary');
    el.innerHTML = _panelHTML();
    (mountTarget || document.body).appendChild(el);
    _bindCollapse(el);
    _render();
  }

  // ── Render (throttle'lı) ───────────────────────────────────────────
  function _scheduleRender() {
    _dirty = true;
    if (_renderTimer) return;
    _renderTimer = setTimeout(function () {
      _renderTimer = null;
      if (_dirty) { _dirty = false; _render(); }
    }, RENDER_MS);
  }

  function _render() {
    const list  = document.getElementById('vdLfList');
    const empty = document.getElementById('vdLfEmpty');
    if (!list) return;

    if (!_trades.length) {
      if (empty) {
        empty.style.display = '';
        const txt = _status === 'connecting' ? _t('lf.connecting', null, 'Bağlanıyor…')
                  : _status === 'error'      ? _t('lf.reconnecting', null, 'Yeniden bağlanıyor…')
                  :                            _t('lf.waiting', null, 'Canlı akış bekleniyor…');
        empty.innerHTML = '<span class="vd-lf-empty-ic">📡</span>' + txt;
      }
      list.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    // En yeni üstte
    let html = '';
    for (let i = _trades.length - 1; i >= 0; i--) {
      const t   = _trades[i];
      const cls = t.whale ? 'whale' : (t.buy ? 'buy' : 'sell');
      const dim = (!t.whale && t.val < DIM_USD) ? ' is-dim' : '';
      const arrow = t.buy ? '▲' : '▼';
      html +=
        '<div class="vd-lf-row ' + cls + dim + '">' +
          '<span class="vd-lf-arr">' + arrow + '</span>' +
          '<span class="vd-lf-price">' + _fmtPrice(t.price) + '</span>' +
          '<span class="vd-lf-val">' + _fmtVal(t.val) + '</span>' +
          '<span class="vd-lf-time">' + _relTime(t.ts) + '</span>' +
        '</div>';
    }
    list.innerHTML = html;
  }

  // ── Trade ekle ─────────────────────────────────────────────────────
  function _pushTrade(price, qty, isBuyerMaker) {
    const val = price * qty;
    // taker buy = buyer is NOT maker (m === false)
    const buy = (isBuyerMaker === false);
    _trades.push({ ts: Date.now(), price: price, val: val, buy: buy, whale: val >= WHALE_USD });
    if (_trades.length > MAX_TRADES) _trades.shift();
    _scheduleRender();
  }

  // ── İzole aggTrade socket ──────────────────────────────────────────
  function _connect(key) {
    _disconnect();
    _curKey = key;
    _setStatus('connecting');
    const symEl = document.getElementById('vdLfSym');
    if (symEl) symEl.textContent = key.toUpperCase();

    let url;
    try {
      url = FWSS + key + '@aggTrade';
      _socket = new WebSocket(url);
    } catch (e) { _setStatus('error'); _scheduleReconnect(key); return; }

    _socket.onopen = function () {
      _attempts = 0;
      _setStatus('live');
      try { console.log('[LiveFeed] connected:', url); } catch (e) {}
    };
    _socket.onmessage = function (e) {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      // Binance combined stream → { stream, data:{...} }; tek stream → düz obje.
      // Her iki formata dayanıklı: önce data, yoksa msg'in kendisi.
      const d = (msg && msg.data) ? msg.data : msg;
      if (!d || d.e !== 'aggTrade') return;
      const price = +d.p, qty = +d.q;
      if (!Number.isFinite(price) || !Number.isFinite(qty)) return;
      if (_status !== 'live') _setStatus('live');
      _pushTrade(price, qty, d.m);
    };
    _socket.onclose = function () {
      if (_curKey === key) { _setStatus('error'); _scheduleReconnect(key); }
    };
    _socket.onerror = function () {
      _setStatus('error');
      try { console.warn('[LiveFeed] ws error:', url); } catch (e) {}
      try { _socket.close(); } catch (e) {}
    };
  }

  function _scheduleReconnect(key) {
    if (_reconnectT) clearTimeout(_reconnectT);
    const delay = Math.min(2000 * Math.pow(2, _attempts), 30000);
    _attempts++;
    _reconnectT = setTimeout(function () {
      if (_curKey === key && _mounted) _connect(key);
    }, delay);
  }

  function _disconnect() {
    if (_reconnectT) { clearTimeout(_reconnectT); _reconnectT = null; }
    if (_socket) {
      try { _socket.onclose = null; _socket.close(); } catch (e) {}
      _socket = null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────
  function setSymbol(sym) {
    if (!sym) return;
    const key = String(sym).toLowerCase();
    if (key === _curKey) return;
    _trades = [];           // yeni coin → akış sıfırlanır
    _render();
    if (_mounted) _connect(key);
  }

  function mount() {
    if (_mounted) return;
    _mounted = true;
    _ensurePanel();
    const sym = window.SYM || 'BTCUSDT';
    try { console.log('[LiveFeed] mount → sym:', sym); } catch (e) {}
    _connect(String(sym).toLowerCase());
    // Saniyede bir "x s önce" zaman etiketlerini tazele (yeni trade gelmese de)
    setInterval(function () { if (_trades.length) _scheduleRender(); }, 5000);
  }

  function unmount() {
    _mounted = false;
    _disconnect();
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
  }

  // right-rail her render'da innerHTML'i ezer; panel mount noktasına
  // yeniden yerleştirilir ve içerik tazelenir (socket'e dokunulmaz).
  function remount() {
    if (!_mounted) return;
    _ensurePanel();
    _render();
  }

  // Market Pulse FLOW kartı için: son trade'lerden gerçek taker özeti.
  // { buyRatio: 0-1, n: örnek sayısı, ts: son trade zamanı } | null (veri yoksa)
  function flowSummary() {
    if (!_trades.length) return null;
    let buyVal = 0, total = 0;
    for (let i = 0; i < _trades.length; i++) {
      total += _trades[i].val;
      if (_trades[i].buy) buyVal += _trades[i].val;
    }
    if (total <= 0) return null;
    return { buyRatio: buyVal / total, n: _trades.length, ts: _trades[_trades.length - 1].ts };
  }

  return { mount, unmount, setSymbol, remount, flowSummary };
})();
