// ════════════════════════════════════════════════════════════════════
// PERFORMANCE / LEARNING WORKSPACE (build 131)
// Performance Analytics (#analyticsPanel — Win Rate · Coin Leaderboard ·
// Sinyal Geçmişi · Session) + Learning Engine (#learningPanel) panellerini
// ana ekrandan ayrı bir workspace overlay'ine TAŞIR (DOM move; yeniden
// render yok → mevcut Analytics/Learning JS panelleri id ile aynen doldurur).
//
// NOT: Bu panellerde <canvas> YOK (gauge = CSS ring, session = flex div'ler),
//   yani canvas-resize riski yoktur.
//
// DOKUNMAZ: scanner, risk/confidence, telegram, archive write, premium,
//   verify-code, SQL. Yeni API/veri yok. Sadece DOM yerleşimi + görünürlük.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDPerfWorkspace) return;
  var _open = false;

  var STYLE = ''
    + '.pfws-launcher{margin:16px 12px 0;background:#111722;border:1px solid #1e2836;border-radius:14px;padding:15px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}'
    + '.pfws-launcher .ic{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#36d399,#1d9e75);display:flex;align-items:center;justify-content:center;font-size:19px;color:#04130d;flex-shrink:0}'
    + '.pfws-launcher .tx{flex:1;min-width:170px}'
    + '.pfws-launcher .t{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.pfws-launcher .d{font-size:11px;color:#8b98ac;margin-top:3px;line-height:1.5}'
    + '.pfws-open{font-size:13px;font-weight:800;color:#04130d;background:linear-gradient(90deg,#36d399,#1d9e75);border:none;border-radius:11px;padding:11px 18px;cursor:pointer;white-space:nowrap}'
    + '.pfws-open:hover{filter:brightness(1.07)}'
    + '.pfws-overlay{position:fixed;inset:0;background:#0a0e17;z-index:9000;overflow-y:auto;display:none}'
    + '.pfws-overlay.open{display:block}'
    + '.pfws-bar{position:sticky;top:0;background:rgba(10,14,23,.96);border-bottom:1px solid #1e2836;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 16px;z-index:2}'
    + '.pfws-back{font-size:13px;font-weight:700;color:#e6edf6;background:#111722;border:1px solid #1e2836;border-radius:9px;padding:8px 14px;cursor:pointer}'
    + '.pfws-back:hover{border-color:#2b3a52}'
    + '.pfws-title{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.pfws-note{margin-left:auto;font-size:10px;color:#8b98ac}'
    + '.pfws-body{padding:16px;max-width:1100px;margin:0 auto}'
    + '.pfws-seph{font-size:10px;font-weight:800;letter-spacing:.08em;color:#5b6677;text-transform:uppercase;margin:18px 4px 8px}'
    + '.pfws-collapse{width:100%;margin:18px 0 0;background:#0e1626;border:1px solid #1e2836;border-radius:11px;padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;font-size:11px;font-weight:800;letter-spacing:.04em;color:#cbd5e6;text-align:left}'
    + '.pfws-collapse:hover{border-color:#2b3a52}'
    + '.pfws-caret{color:#36d399;font-size:13px;flex-shrink:0}';

  function injectStyle() {
    if (document.getElementById('vd-pfws-style')) return;
    var st = document.createElement('style');
    st.id = 'vd-pfws-style';
    st.textContent = STYLE;
    (document.head || document.documentElement).appendChild(st);
  }

  function open() {
    var ov = document.getElementById('vdPerfWS');
    if (!ov) return;
    ov.classList.add('open');
    _open = true;
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
    // Canvas yok ama her ihtimale karşı layout tazele (zararsız)
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
  }
  function close() {
    var ov = document.getElementById('vdPerfWS');
    if (ov) ov.classList.remove('open');
    _open = false;
    try { document.body.style.overflow = ''; } catch (e) {}
  }

  function build() {
    var perf = document.getElementById('analyticsPanel');
    if (!perf || document.getElementById('vdPerfWS')) return; // panel yok ya da zaten kurulu
    injectStyle();

    // 1) Ana ekrana, Performance panelinin TAM yerine kompakt launcher
    var launcher = document.createElement('div');
    launcher.className = 'pfws-launcher';
    launcher.id = 'pfWsLauncher';
    launcher.innerHTML =
      '<div class="ic">\u25c8</div>'
      + '<div class="tx"><div class="t">Performance &amp; Learning</div>'
      + '<div class="d">Win Rate \u00b7 Coin Leaderboard \u00b7 Sinyal Ge\u00e7mi\u015fi \u00b7 AI Learning. Ge\u00e7mi\u015f do\u011frulanm\u0131\u015f sonu\u00e7lar\u0131n \u00f6zeti \u2014 yat\u0131r\u0131m tavsiyesi de\u011fildir.</div></div>'
      + '<button class="pfws-open" id="pfWsOpenBtn">A\u00e7 \u2192</button>';
    perf.parentNode.insertBefore(launcher, perf);

    // 2) Overlay kur
    var ov = document.createElement('div');
    ov.id = 'vdPerfWS';
    ov.className = 'pfws-overlay';
    ov.innerHTML =
      '<div class="pfws-bar"><button class="pfws-back" id="pfWsBack">\u2190 Dashboard\u2019a D\u00f6n</button>'
      + '<span class="pfws-title">\u25c8 Performance &amp; Learning</span>'
      + '<span class="pfws-note">ge\u00e7mi\u015f do\u011frulanm\u0131\u015f g\u00f6zlem \u00b7 yat\u0131r\u0131m tavsiyesi de\u011fildir</span></div>'
      + '<div class="pfws-body" id="pfWsBody"></div>';
    document.body.appendChild(ov);

    var body = document.getElementById('pfWsBody');
    // 3a) Performance panelini TAŞI
    body.appendChild(perf);
    // 3b) Learning Engine wrapper'ını TAŞI (varsa) — id-güncellemeleri korunur
    var lp = document.getElementById('learningPanel');
    if (lp && lp.parentElement) {
      var sep = document.createElement('div');
      sep.className = 'pfws-seph';
      sep.textContent = 'AI LEARNING';
      body.appendChild(sep);
      body.appendChild(lp.parentElement);
    }
    // 3c) AI Performance / Öğrenme Motoru (#aiPanel) — katlanır, varsayılan KAPALI
    var ai = document.getElementById('aiPanel');
    if (ai && !document.getElementById('pfEngineToggle')) {
      var tg = document.createElement('button');
      tg.type = 'button';
      tg.className = 'pfws-collapse';
      tg.id = 'pfEngineToggle';
      tg.innerHTML = '<span>\u25c8 \u00d6\u011eRENME MOTORU \u2014 Adaptif A\u011f\u0131rl\u0131klar \u00b7 Coin Performans\u0131 \u00b7 Oto Takip</span><span class="pfws-caret">\u25b8</span>';
      body.appendChild(tg);
      body.appendChild(ai);
      ai.style.display = 'none';
      tg.addEventListener('click', function () {
        var openNow = ai.style.display === 'none';
        ai.style.display = openNow ? '' : 'none';
        var c = tg.querySelector('.pfws-caret'); if (c) c.textContent = openNow ? '\u25be' : '\u25b8';
      });
    }

    // 4) Olaylar
    var ob = document.getElementById('pfWsOpenBtn'); if (ob) ob.addEventListener('click', open);
    var bk = document.getElementById('pfWsBack'); if (bk) bk.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && _open) close(); });
  }

  function init() { try { build(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  else setTimeout(init, 500);
  setTimeout(init, 1600);

  window.VDPerfWorkspace = { open: open, close: close, _build: build };
})();
