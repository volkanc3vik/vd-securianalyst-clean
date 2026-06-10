// ════════════════════════════════════════════════════════════════════
// FUTURES / GRAFİK WORKSPACE (build 132) — GÜVENLİ "ODAK MODU"
//
// NEDEN ODAK MODU (overlay/DOM-move DEĞİL):
//   Bu bölümde gerçek <canvas>/iframe grafik var (TradingView + AI LWC).
//   Bunları gizli bir overlay'e taşımak → canvas 0 boyutta init olur,
//   TradingView iframe reparent'ta yeniden yüklenir → BOŞ/BOZUK grafik.
//   Çözüm: grafikleri ASLA taşıma/gizleme. Workspace açılınca yalnızca
//   ÜSTTEKİ dashboard bloklarını gizle → grafik+analiz yığını yerinde,
//   tam ekran öne çıkar. Açılış/kapanışta resize tetikle (grafik refit).
//
// DOKUNMAZ: scanner, risk/confidence, telegram, archive write, premium,
//   verify-code, SQL. Yeni API/veri yok. Sadece görünürlük + odak.
// ════════════════════════════════════════════════════════════════════
(function () {
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  'use strict';
  if (window.VDFuturesWorkspace) return;
  var _open = false, _hidden = [];

  // Odakta gizlenecek ÜST dashboard blokları (grafik/analiz HARİÇ)
  var HIDE_SEL = ['#regimeBar', '.scan-card', '#setupTracker', '#earlyRadar',
                  '#aiWsLauncher', '#pfWsLauncher', '.vd-analysis-divider', '#fxWsLauncher'];

  var STYLE = ''
    + '.fxws-launcher{margin:14px 12px 0;background:#111722;border:1px solid #1e2836;border-radius:14px;padding:15px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}'
    + '.fxws-launcher .ic{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#ff8a3d,#b85a1a);display:flex;align-items:center;justify-content:center;font-size:19px;color:#1a0f05;flex-shrink:0}'
    + '.fxws-launcher .tx{flex:1;min-width:170px}'
    + '.fxws-launcher .t{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.fxws-launcher .d{font-size:11px;color:#8b98ac;margin-top:3px;line-height:1.5}'
    + '.fxws-open{font-size:13px;font-weight:800;color:#1a0f05;background:linear-gradient(90deg,#ff8a3d,#e07a2e);border:none;border-radius:11px;padding:11px 18px;cursor:pointer;white-space:nowrap}'
    + '.fxws-open:hover{filter:brightness(1.07)}'
    + '.fxws-bar{position:fixed;top:0;left:0;right:0;background:rgba(10,14,23,.97);border-bottom:1px solid #1e2836;display:none;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 16px;z-index:9000}'
    + '.fxws-back{font-size:13px;font-weight:700;color:#e6edf6;background:#111722;border:1px solid #1e2836;border-radius:9px;padding:8px 14px;cursor:pointer}'
    + '.fxws-back:hover{border-color:#2b3a52}'
    + '.fxws-title{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.fxws-note{margin-left:auto;font-size:10px;color:#8b98ac}'
    + 'body.vd-fx-focus{padding-top:52px}';

  function injectStyle() {
    if (document.getElementById('vd-fxws-style')) return;
    var st = document.createElement('style');
    st.id = 'vd-fxws-style';
    st.textContent = STYLE;
    (document.head || document.documentElement).appendChild(st);
  }
  function fireResize() {
    [50, 300, 650].forEach(function (d) { setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, d); });
  }
  function hideEl(el) { if (el) { _hidden.push([el, el.style.display]); el.style.display = 'none'; } }

  function open() {
    if (_open) return;
    _open = true;
    _hidden = [];
    // Piyasa Durumu (başlık + kartlar)
    var mo = document.querySelector('.market-overview');
    if (mo) { var h = mo.previousElementSibling; if (h && /^H[123]$/.test(h.tagName)) hideEl(h); hideEl(mo); }
    // Market Drivers + News (ortak sarmalayıcı)
    var md = document.getElementById('marketDrivers'); if (md && md.parentElement) hideEl(md.parentElement);
    // Diğer üst bloklar
    HIDE_SEL.forEach(function (s) { try { document.querySelectorAll(s).forEach(hideEl); } catch (e) {} });
    document.body.classList.add('vd-fx-focus');
    var bar = document.getElementById('fxWsBar'); if (bar) bar.style.display = 'flex';
    try { window.scrollTo(0, 0); } catch (e) {}
    fireResize(); // grafikler yeni alana otursun
  }
  function close() {
    if (!_open) return;
    _open = false;
    _hidden.forEach(function (p) { try { p[0].style.display = p[1] || ''; } catch (e) {} });
    _hidden = [];
    document.body.classList.remove('vd-fx-focus');
    var bar = document.getElementById('fxWsBar'); if (bar) bar.style.display = 'none';
    fireResize();
  }

  function build() {
    var anchor = document.getElementById('futuresPanelMount');
    if (!anchor || document.getElementById('fxWsLauncher')) return;
    injectStyle();

    // 1) Analiz bölgesinin başına launcher
    var launcher = document.createElement('div');
    launcher.className = 'fxws-launcher';
    launcher.id = 'fxWsLauncher';
    launcher.innerHTML =
      '<div class="ic">\u25c8</div>'
      + '<div class="tx"><div class="t">'+_t('fut.wsTitle',null,'Grafik / Futures Workspace')+'</div>'
      + '<div class="d">'+_t('fut.wsDesc',null,'TradingView + AI grafik \u00b7 SMC \u00b7 Risk Engine \u00b7 OI/Funding \u00b7 Trade Management. Tam ekran analiz \u2014 i\u015flem/y\u00f6n \u00f6nerisi de\u011fildir.')+'</div></div>'
      + '<button class="fxws-open" id="fxWsOpenBtn">'+_t('fut.wsOpen',null,'Tam Ekran A\u00e7')+' \u2192</button>';
    anchor.parentNode.insertBefore(launcher, anchor);

    // 2) Sticky geri-dön bar (odak modunda görünür)
    var bar = document.createElement('div');
    bar.className = 'fxws-bar';
    bar.id = 'fxWsBar';
    bar.innerHTML =
      '<button class="fxws-back" id="fxWsBack">\u2190 '+_t('fut.wsBack',null,'Geri D\u00f6n')+'</button>'
      + '<span class="fxws-title">\u25c8 '+_t('fut.wsTitle',null,'Grafik / Futures Workspace')+'</span>'
      + '<span class="fxws-note">'+_t('fut.wsNote',null,'i\u015flem/y\u00f6n \u00f6nerisi de\u011fildir \u00b7 yat\u0131r\u0131m tavsiyesi de\u011fildir')+'</span>';
    document.body.appendChild(bar);

    // 3) Olaylar
    var ob = document.getElementById('fxWsOpenBtn'); if (ob) ob.addEventListener('click', open);
    var bk = document.getElementById('fxWsBack'); if (bk) bk.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && _open) close(); });
  }

  function init() { try { build(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 600); });
  else setTimeout(init, 600);
  setTimeout(init, 1700);

  window.VDFuturesWorkspace = { open: open, close: close, _build: build };
})();
