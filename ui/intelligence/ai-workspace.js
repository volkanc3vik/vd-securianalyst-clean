// ════════════════════════════════════════════════════════════════════
// AI WORKSPACE (build 130) — "AI Karar Motoru" kümesini ana ekrandan
// ayrı bir workspace overlay'ine TAŞIR (yeniden render etmez → mevcut
// AI motor JS'i panelleri id ile güncellemeye devam eder, listener'lar korunur).
//
// Ana ekran: kompakt "AI Intelligence" launcher kartı + "AI Workspace'i Aç".
// Workspace: ← Geri Dön + tam phase1Section (Reasoning · Ağırlıklı
//   Confirmation · ECE 2.0 · Narrative · WS durum).
//
// DOKUNMAZ: scanner, risk/confidence motoru, telegram, archive, premium,
//   verify-code, SQL. Yeni API/veri yok. Sadece DOM yerleşimi + görünürlük.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDAiWorkspace) return;
  var _open = false;

  var STYLE = ''
    + '.aiws-launcher{margin:16px 12px 0;background:#111722;border:1px solid #1e2836;border-radius:14px;padding:15px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}'
    + '.aiws-launcher .ic{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,#3b9eff,#9d7dfa);display:flex;align-items:center;justify-content:center;font-size:19px;color:#04101f;flex-shrink:0}'
    + '.aiws-launcher .tx{flex:1;min-width:170px}'
    + '.aiws-launcher .t{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.aiws-launcher .d{font-size:11px;color:#8b98ac;margin-top:3px;line-height:1.5}'
    + '.aiws-open{font-size:13px;font-weight:800;color:#04101f;background:linear-gradient(90deg,#3b9eff,#9d7dfa);border:none;border-radius:11px;padding:11px 18px;cursor:pointer;white-space:nowrap}'
    + '.aiws-open:hover{filter:brightness(1.07)}'
    + '.aiws-overlay{position:fixed;inset:0;background:#0a0e17;z-index:9000;overflow-y:auto;display:none}'
    + '.aiws-overlay.open{display:block}'
    + '.aiws-bar{position:sticky;top:0;background:rgba(10,14,23,.96);border-bottom:1px solid #1e2836;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 16px;z-index:2}'
    + '.aiws-back{font-size:13px;font-weight:700;color:#e6edf6;background:#111722;border:1px solid #1e2836;border-radius:9px;padding:8px 14px;cursor:pointer}'
    + '.aiws-back:hover{border-color:#2b3a52}'
    + '.aiws-title{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.aiws-note{margin-left:auto;font-size:10px;color:#8b98ac}'
    + '.aiws-body{padding:16px;max-width:1100px;margin:0 auto}';

  function injectStyle() {
    if (document.getElementById('vd-aiws-style')) return;
    var st = document.createElement('style');
    st.id = 'vd-aiws-style';
    st.textContent = STYLE;
    (document.head || document.documentElement).appendChild(st);
  }

  function open() {
    var ov = document.getElementById('vdAiWS');
    if (!ov) return;
    ov.classList.add('open');
    _open = true;
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  }
  function close() {
    var ov = document.getElementById('vdAiWS');
    if (ov) ov.classList.remove('open');
    _open = false;
    try { document.body.style.overflow = ''; } catch (e) {}
  }

  function build() {
    var panel = document.getElementById('phase1Section');
    if (!panel || document.getElementById('vdAiWS')) return; // panel yok ya da zaten kurulu
    injectStyle();

    // 1) Ana ekrana, panelin TAM yerine kompakt launcher koy
    var launcher = document.createElement('div');
    launcher.className = 'aiws-launcher';
    launcher.id = 'aiWsLauncher';
    launcher.innerHTML =
      '<div class="ic">\u25c8</div>'
      + '<div class="tx"><div class="t">AI Intelligence \u2014 Karar Motoru</div>'
      + '<div class="d">AI Reasoning \u00b7 A\u011f\u0131rl\u0131kl\u0131 Confirmation \u00b7 ECE 2.0 \u00b7 Narrative. Bir coin se\u00e7ince derinle\u015fir \u2014 i\u015flem/y\u00f6n \u00f6nerisi de\u011fildir.</div></div>'
      + '<button class="aiws-open" id="aiWsOpenBtn">AI Workspace\u2019i A\u00e7 \u2192</button>';
    panel.parentNode.insertBefore(launcher, panel);

    // 2) Overlay kur
    var ov = document.createElement('div');
    ov.id = 'vdAiWS';
    ov.className = 'aiws-overlay';
    ov.innerHTML =
      '<div class="aiws-bar"><button class="aiws-back" id="aiWsBack">\u2190 Geri D\u00f6n</button>'
      + '<span class="aiws-title">\u25c8 AI Intelligence \u2014 Karar Motoru</span>'
      + '<span class="aiws-note">geçmiş verilerden türetilmiş gözlem \u00b7 yatırım tavsiyesi değildir</span></div>'
      + '<div class="aiws-body" id="aiWsBody"></div>';
    document.body.appendChild(ov);

    // 3) GERÇEK paneli overlay gövdesine TAŞI (id-güncellemeleri + listener'lar korunur)
    document.getElementById('aiWsBody').appendChild(panel);

    // 4) Olaylar
    var ob = document.getElementById('aiWsOpenBtn'); if (ob) ob.addEventListener('click', open);
    var bk = document.getElementById('aiWsBack'); if (bk) bk.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && _open) close(); });
  }

  function init() { try { build(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 400); });
  else setTimeout(init, 400);
  setTimeout(init, 1500); // motor/panel geç yüklenirse ikinci deneme

  window.VDAiWorkspace = { open: open, close: close, _build: build };
})();
