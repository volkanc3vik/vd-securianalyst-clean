// ═══════════════════════════════════════════════
// MAIN.JS — App Bootstrap & Orchestration
// Sadece init, mounting ve koordinasyon
// Business logic buraya GELMEZ
// ═══════════════════════════════════════════════
import { Bus, onReady, isMobile } from './modules/helpers.js';
import { Timers }                  from './modules/debounce.js';
import { DEFAULT_SYM, DEFAULT_INTV, SCAN_INTERVAL, REFRESH_INTERVAL } from './modules/constants.js';
import { Binance }                 from './services/binance-service.js';
import { WSService }               from './services/websocket-service.js';
import { Storage }                 from './services/storage-service.js';
import { NC, Toast }               from './engines/notification-engine.js';
import { AIEng }                   from './engines/ai-engine.js';
import { SMCEngine }               from './engines/smartmoney-engine.js';
import { RegimeEngine }            from './engines/market-regime-engine.js';
import { RiskEng }                 from './engines/risk-engine.js';
import { calcAllIndicators }       from './modules/indicators.js';
import { formatPrice, formatPct, setEl, cleanSym } from './modules/formatters.js';

// ── App State ─────────────────────────────────
const App = {
  sym:      DEFAULT_SYM,
  interval: DEFAULT_INTV,
  ticker:   null,
  candles:  [],
  ind:      null,
  oiData:   null,
  btcData:  null,
  wsData:   {},
  regimeMode: 'SIDEWAYS',
};

// ── Initialization ────────────────────────────
onReady(async () => {
  console.log('VD SecuriAnalyst — Başlatılıyor...');

  _initHeader();
  _initToast();
  _initNotifPanel();
  _initMobile();
  _initClock();

  // Auth kontrol — login screen
  // (mevcut kod index.html içinde kalıyor, burası sadece post-auth)
  Bus.on('app:authenticated', _onAuthenticated);
});

async function _onAuthenticated() {
  await _loadCoin(App.sym, App.interval);
  _startScan();
  _startTicker();

  // WS aboneliği
  WSService.subscribe(App.sym, (wsD) => {
    App.wsData = wsD;
    Bus.emit('ws:data', wsD);
  });

  // Periyodik yenileme
  Timers.setInterval('refresh', () => _loadCoin(App.sym, App.interval), REFRESH_INTERVAL);
}

// ── Coin yükle ────────────────────────────────
async function _loadCoin(sym, interval) {
  try {
    setEl('ldr', '◌ Yükleniyor...');
    document.getElementById('ldr')?.style && (document.getElementById('ldr').style.display = 'block');

    const [klines, ticker] = await Promise.all([
      Binance.getKlines(sym, interval, 200),
      Binance.getTicker24h(sym),
    ]);

    const closes  = klines.map(k => +k[4]);
    const candles = klines.map(k => ({ h: +k[2], l: +k[3], c: +k[4], o: +k[1], v: +k[5] }));
    const price   = +ticker.lastPrice;
    const chg     = +ticker.priceChangePercent;

    App.candles = candles;
    App.ticker  = ticker;

    // İndikatörler
    App.ind = calcAllIndicators(closes, candles);

    // Market rejimi
    const oiData = await Binance.getMarketData(sym).catch(() => ({}));
    App.oiData   = oiData;
    App.regimeMode = RegimeEngine.detect(closes, candles, oiData);

    // BTC verisi (eğer BTCUSDT değilse)
    if (sym !== 'BTCUSDT') {
      const btcTicker = await Binance.getTicker24h('BTCUSDT').catch(() => null);
      App.btcData = btcTicker ? { chg: +btcTicker.priceChangePercent } : null;
    } else {
      App.btcData = { chg };
    }

    // SMC
    const smcData = SMCEngine.analyze(candles, price);

    // Tüm event'leri yayınla — componentler dinler
    Bus.emit('coin:loaded', { sym, interval, closes, candles, price, chg, ticker, oiData, btcData: App.btcData, smcData, regimeMode: App.regimeMode, ind: App.ind });

  } catch (e) {
    console.warn('loadCoin hata:', e);
  } finally {
    document.getElementById('ldr')?.style && (document.getElementById('ldr').style.display = 'none');
  }
}

// ── Market Scan ───────────────────────────────
async function _startScan() {
  await _runScan();
  Timers.setInterval('scan', _runScan, SCAN_INTERVAL);
}

async function _runScan() {
  try {
    const syms = await Binance.getTopSymbols(100);
    Bus.emit('scan:start', { total: syms.length });

    const results = [];
    for (let i = 0; i < syms.length; i++) {
      const sym = syms[i];
      Bus.emit('scan:progress', { current: i + 1, total: syms.length, sym });

      try {
        const [klines, ticker] = await Promise.all([
          Binance.getKlines(sym, App.interval, 100),
          Binance.getTicker24h(sym),
        ]);
        if (!Array.isArray(klines) || klines.length < 30) continue;

        const closes  = klines.map(k => +k[4]);
        const candles = klines.map(k => ({ h: +k[2], l: +k[3], c: +k[4], o: +k[1], v: +k[5] }));
        const price   = +ticker.lastPrice;
        const chg     = +ticker.priceChangePercent;
        const ind     = calcAllIndicators(closes, candles);

        results.push({ sym, price, chg, closes, candles, ind, ticker });
      } catch {}

      await new Promise(r => setTimeout(r, 60));
    }

    Bus.emit('scan:complete', results);
  } catch (e) {
    console.warn('Scan hata:', e);
  }
}

// ── Ticker scroll ─────────────────────────────
async function _startTicker() {
  const _update = async () => {
    try {
      const tickers = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','LINKUSDT','PEPEUSDT'];
      const data = await Promise.all(tickers.map(s => Binance.getTicker24h(s).catch(() => null)));
      data.forEach((t, i) => {
        if (!t) return;
        const sym = tickers[i].replace('USDT','').toLowerCase();
        const chg = +t.priceChangePercent;
        setEl(`t_${sym}`, formatPrice(+t.lastPrice));
        const chgEl = document.getElementById(`tc_${sym}`);
        if (chgEl) {
          chgEl.textContent = formatPct(chg);
          chgEl.className   = 'ticker-chg ' + (chg >= 0 ? 'up' : 'dn');
        }
      });
    } catch {}
  };
  await _update();
  Timers.setInterval('ticker', _update, 10_000);
}

// ── Header offset (sticky fix) ────────────────
function _initHeader() {
  function fix() {
    const tb  = document.querySelector('.topbar');
    const tk  = document.querySelector('.ticker-wrap');
    const main = document.querySelector('.main');
    const ex  = document.querySelector('.exec-mode-bar');
    const nc  = document.getElementById('ncPopup');
    const np  = document.querySelector('.nc-panel');

    if (!tb || !main) return;
    const tbH = tb.getBoundingClientRect().height || 52;
    const tkH = tk ? tk.getBoundingClientRect().height || 34 : 0;

    main.style.paddingTop = (tbH + tkH + 20) + 'px';
    if (tk) tk.style.top  = tbH + 'px';
    if (ex) ex.style.top  = (tbH + tkH) + 'px';
    if (nc) nc.style.top  = (tbH + 8) + 'px';
    if (np && !isMobile()) np.style.top = (tbH + 4) + 'px';
  }
  fix();
  window.addEventListener('resize', fix);
  setTimeout(fix, 300);
  setTimeout(fix, 1000);
}

// ── Toast toggle UI ───────────────────────────
function _initToast() {
  Bus.on('toast:toggle', enabled => {
    document.querySelectorAll('.toast-toggle').forEach(btn => {
      btn.classList.toggle('enabled', enabled);
      const dot = btn.querySelector('.tt-dot');
      const txt = btn.querySelector('.tt-txt');
      if (dot) dot.style.background = enabled ? 'var(--green)' : 'var(--text3)';
      if (txt) txt.textContent = enabled ? 'Toast Açık' : 'Toast Kapalı';
    });
  });
}

// ── Bildirim paneli ───────────────────────────
function _initNotifPanel() {
  // NC event'leri dinle
  Bus.on('notification:toggle', open => {
    const panel   = document.getElementById('ncPanel');
    const overlay = document.getElementById('ncOverlay');
    const btn     = document.getElementById('ncBtn');
    const bnNotif = document.getElementById('bn-notif');

    if (panel) panel.classList.toggle('open', open);
    if (overlay) overlay.classList.toggle('show', open);
    if (btn) btn.classList.toggle('active', open);
    if (bnNotif) bnNotif.classList.toggle('active', open);
    document.body.style.overflow = open && isMobile() ? 'hidden' : '';
  });

  Bus.on('notification:badge', count => {
    const badge    = document.getElementById('ncBadge');
    const bnBadge  = document.getElementById('bnNotifBadge');
    const badgeTxt = count > 0 ? String(count > 99 ? '99+' : count) : '';
    if (badge)   { badge.textContent = badgeTxt; badge.classList.toggle('show', count > 0); }
    if (bnBadge) { bnBadge.textContent = badgeTxt; bnBadge.style.display = count > 0 ? 'flex' : 'none'; }
  });

  Bus.on('notification:cleared', () => {
    const list = document.getElementById('ncList');
    if (list) list.innerHTML = '<div class="nc-empty"><span>🔔</span>Bildirim yok</div>';
  });
}

// ── Mobil ────────────────────────────────────
function _initMobile() {
  if (!isMobile()) return;

  // Swipe to close bildirim paneli
  const panel  = document.getElementById('ncPanel');
  const handle = document.getElementById('ncDragHandle');
  if (!panel || !handle) return;

  let startY = 0, isDragging = false;
  handle.addEventListener('touchstart', e => { startY = e.touches[0].clientY; isDragging = true; panel.style.transition = 'none'; }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const delta = Math.max(0, e.touches[0].clientY - startY);
    panel.style.transform = `translateY(${delta}px)`;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    panel.style.transition = '';
    if (e.changedTouches[0].clientY - startY > 80) NC.toggle();
    else panel.style.transform = '';
  });
}

// ── Saat ─────────────────────────────────────
function _initClock() {
  const update = () => {
    const el = document.getElementById('liveTime');
    if (el) el.textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  update();
  Timers.setInterval('clock', update, 1000);
}

// ── Global API (geriye dönük uyumluluk) ──────
// Mevcut HTML onclick="..." çağrıları için
window.NC      = { toggle: () => NC.toggle(), filter: k => NC.setFilter(k), clearAll: () => { if (confirm('Sil?')) NC.clearAll(); } };
window.loadCoin = (sym, intv) => { App.sym = sym; App.interval = intv; _loadCoin(sym, intv); };
window.doSearch = () => {
  const v = document.getElementById('symInput')?.value?.trim().toUpperCase();
  if (v) window.loadCoin(v.includes('USDT') ? v : v + 'USDT', App.interval);
};
window.startScan = _runScan;
window.Toast   = Toast;
window.Storage = Storage;

export { App, _loadCoin as loadCoin };
