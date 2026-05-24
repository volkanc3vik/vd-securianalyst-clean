// ═══════════════════════════════════════════════
// WEBSOCKET SERVICE — Binance Futures WS yönetimi
// Reconnect, health monitor, multi-stream
// ═══════════════════════════════════════════════
import { API } from '../modules/constants.js';
import { Bus } from '../modules/helpers.js';
import { rafThrottle } from '../modules/debounce.js';

class WebSocketService {
  constructor() {
    this._sockets   = {};   // sym → WebSocket
    this._data      = {};   // sym → son veri
    this._callbacks = {};   // sym → callback[]
    this._status    = 'disconnected';
    this._health    = {
      packetCount:    0,
      lastPacketTs:   0,
      latencySamples: [],
      pingTs:         0,
      uptime:         0,
      startTs:        Date.now(),
      errors:         0,
    };

    // UI güncelleme rafThrottle ile — max 60fps
    this._updateHealthUI = rafThrottle(this._renderHealthUI.bind(this));
  }

  // ── Abone ol ──────────────────────────────────
  subscribe(sym, callback) {
    const key = sym.toLowerCase();
    if (!this._callbacks[key]) this._callbacks[key] = [];
    this._callbacks[key].push(callback);

    if (!this._sockets[key]) {
      this._connect(key);
    }
  }

  // ── Aboneliği kaldır ──────────────────────────
  unsubscribe(sym) {
    const key = sym.toLowerCase();
    if (this._sockets[key]) {
      this._sockets[key].close();
      delete this._sockets[key];
    }
    delete this._callbacks[key];
    delete this._data[key];
  }

  // ── WS bağlantısı ──────────────────────────────
  _connect(key) {
    const streams = [
      `${key}@aggTrade`,
      `${key}@depth5@100ms`,
      `${key}@forceOrder`,
    ].join('/');

    const url = `${API.WS}/stream?streams=${streams}`;
    const ws  = new WebSocket(url);
    this._sockets[key] = ws;
    this._status = 'connecting';

    ws.onopen = () => {
      this._status = 'connected';
      Bus.emit('ws:connected', { key });
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._processMessage(key, msg.data || msg);
        this._trackHealth();
      } catch {}
    };

    ws.onerror = () => {
      this._health.errors++;
      this._status = 'error';
    };

    ws.onclose = () => {
      this._status = 'disconnected';
      delete this._sockets[key];
      // 3 saniye sonra yeniden bağlan
      setTimeout(() => {
        if (this._callbacks[key]?.length) this._connect(key);
      }, 3000);
    };
  }

  // ── Mesaj işle ────────────────────────────────
  _processMessage(key, msg) {
    if (!this._data[key]) this._data[key] = {};
    const d = this._data[key];

    // aggTrade — alım/satım akışı
    if (msg.e === 'aggTrade') {
      d.aggressiveBuy  = msg.m === false;
      d.aggressiveSell = msg.m === true;
      d.lastTradeSize  = +msg.q * +msg.p;
      d.lastPrice      = +msg.p;

      // Volume Delta
      if (!d._vdBuy)  d._vdBuy  = 0;
      if (!d._vdSell) d._vdSell = 0;
      if (!d._vdResetTs) d._vdResetTs = Date.now();

      const val   = d.lastTradeSize;
      const isBuy = msg.m === false;
      if (isBuy) d._vdBuy += val; else d._vdSell += val;
      d.volumeDelta = d._vdBuy - d._vdSell;

      // Whale tespiti (>50K$)
      if (val > 50000) {
        d.lastWhale = { val, buy: isBuy, ts: Date.now(), price: +msg.p };
        Bus.emit('ws:whale', { key, whale: d.lastWhale });
      }

      // 60 saniyede sıfırla
      if (Date.now() - d._vdResetTs > 60000) {
        d._vdBuy = 0; d._vdSell = 0; d._vdResetTs = Date.now();
      }

      const total = d._vdBuy + d._vdSell;
      d.aggressiveBuyRatio = total > 0 ? d._vdBuy / total : 0.5;
    }

    // depthUpdate — order book
    if (msg.e === 'depthUpdate' || msg.e === 'depth') {
      if (msg.b?.length && msg.a?.length) {
        const bidVol = msg.b.slice(0, 5).reduce((s, x) => s + +x[0] * +x[1], 0);
        const askVol = msg.a.slice(0, 5).reduce((s, x) => s + +x[0] * +x[1], 0);
        const total  = bidVol + askVol;
        d.obImbalance = total > 0 ? bidVol / total : 0.5;
        d.bidVol = bidVol;
        d.askVol = askVol;
        d.bestBid = msg.b[0] ? +msg.b[0][0] : null;
        d.bestAsk = msg.a[0] ? +msg.a[0][0] : null;
        d.spread  = d.bestBid && d.bestAsk
          ? ((d.bestAsk - d.bestBid) / d.bestBid * 100).toFixed(4)
          : null;
        d.obPressure = d.obImbalance > 0.6 ? 'ALIM' : d.obImbalance < 0.4 ? 'SATIŞ' : 'NÖTR';
      }
    }

    // forceOrder — likidasyon
    if (msg.e === 'forceOrder') {
      const o = msg.o;
      const liq = {
        sym:   o.s,
        side:  o.S,
        price: +o.p,
        qty:   +o.q,
        value: +o.p * +o.q,
        ts:    Date.now(),
      };
      d.lastLiquidation = liq;
      Bus.emit('ws:liquidation', { key, liq });
    }

    // Callback'leri çalıştır
    this._callbacks[key]?.forEach(cb => {
      try { cb({ ...d }); } catch {}
    });
  }

  // ── Health tracking ───────────────────────────
  _trackHealth() {
    const h   = this._health;
    const now = performance.now();

    h.packetCount++;
    h.lastPacketTs = Date.now();
    h.uptime = Math.floor((Date.now() - h.startTs) / 1000);

    // Latency örnekleme (her 50 pakette)
    if (h.pingTs > 0) {
      const lat = now - h.pingTs;
      if (lat < 5000) {
        h.latencySamples.push(lat);
        if (h.latencySamples.length > 30) h.latencySamples.shift();
      }
      h.pingTs = 0;
    }
    if (h.packetCount % 50 === 0) h.pingTs = now;

    this._updateHealthUI();
  }

  _renderHealthUI() {
    const el = document.getElementById('wsHealthPanel');
    if (!el) return;

    const h   = this._health;
    const lat = h.latencySamples.length
      ? (h.latencySamples.reduce((a, b) => a + b, 0) / h.latencySamples.length).toFixed(0)
      : null;
    const latCol = !lat ? 'var(--text3)' : +lat < 100 ? 'var(--green)' : +lat < 300 ? 'var(--yellow)' : 'var(--red)';
    const pkt    = h.packetCount > 999 ? (h.packetCount / 1000).toFixed(1) + 'K' : h.packetCount;
    const upSec  = h.uptime;
    const upTxt  = upSec < 60 ? upSec + 's' : upSec < 3600 ? Math.floor(upSec / 60) + 'm' : Math.floor(upSec / 3600) + 'h';

    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">LATENCY</span>
          <span style="font-size:12px;font-weight:700;color:${latCol}">${lat ? lat + 'ms' : '—'}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">PAKET</span>
          <span style="font-size:12px;font-weight:700;color:var(--cyan)">${pkt}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">UPTIME</span>
          <span style="font-size:12px;font-weight:700;color:var(--green)">${upTxt}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">DURUM</span>
          <span style="font-size:12px;font-weight:700;color:${this._status === 'connected' ? 'var(--green)' : 'var(--red)'}">
            ${this._status === 'connected' ? 'CANLI' : 'KESİLDİ'}
          </span>
        </div>
      </div>`;
  }

  // ── Public API ────────────────────────────────
  getData(sym)    { return this._data[sym.toLowerCase()] || {}; }
  getStatus()     { return this._status; }
  getHealth()     { return { ...this._health }; }
}

export const WSService = new WebSocketService();
