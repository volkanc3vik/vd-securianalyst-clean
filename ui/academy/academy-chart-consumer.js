// ════════════════════════════════════════════════════════════════════
// ui/academy/academy-chart-consumer.js   (index.html'de çalışır)
//
// Academy "Grafikte Göster" / Timeline olayı → bu köprüyü tetikler:
//   index.html?lesson=<id>&sym=<SYM>   veya   sessionStorage.vd_academy_chart_intent
//   ↓ premium gate ↓ openCoin(sym) ↓ ilgili AI Grafik katmanını aktive et + vurgula
//
// Phase 3 (bu faz): coin yükle + grafik aç + ilgili katmanı aç/vurgula.
// Çizim/işaretleme YOK (sonraki faz). Scanner/Timeline/Archive/Telegram'a DOKUNMAZ.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const KEY = 'vd_academy_chart_intent';

  // ders id → AI Grafik katmanı / panel
  //   'sr' | 'tp' | 'ms' | 'pat'  → LWC.toggle butonu
  //   'oiFund'                    → Open Interest & Funding paneli
  const LAYER = {
    // seviye / likidite tabanlı → S/R
    'liquidity-sweep':'sr','equal-high':'sr','equal-low':'sr','stop-hunt':'sr',
    'sr':'sr','breakout':'sr','retest':'sr','fake-breakout':'sr','trend':'sr',
    'ikili-tepe':'sr','ikili-dip':'sr',
    // yapı (BOS/CHoCH/OB/FVG) → Yapı
    'bos':'ms','choch':'ms','order-block':'ms','fvg':'ms',
    // formasyon → Formasyonlar
    'obo':'pat','ters-obo':'pat','cekic':'pat','ters-cekic':'pat','yutan':'pat',
    'doji':'pat','ucgen':'pat','bayrak':'pat',
    // risk → Entry/TP/SL
    'risk-reward':'tp','leverage':'tp','liquidation':'tp',
    // futures → OI & Funding paneli
    'funding':'oiFund','open-interest':'oiFund','long-short-ratio':'oiFund',
  };
  const LWC_BTN = { sr:'lwcBtnSR', tp:'lwcBtnTP', ms:'lwcBtnMS', pat:'lwcBtnPat' };

  function _isPremium() {
    try {
      if (window.VDAccess && window.VDAccess.isPremium) return window.VDAccess.isPremium();
      if (window.APP_ACCESS && window.APP_ACCESS.isPremium) return window.APP_ACCESS.isPremium();
    } catch (e) {}
    return false;
  }

  function _readIntent() {
    // 1) URL parametresi öncelikli
    try {
      const p = new URLSearchParams(location.search);
      const sym = p.get('sym'), lesson = p.get('lesson');
      if (sym || lesson) return { sym: (sym || '').toUpperCase(), lesson: lesson || '' };
    } catch (e) {}
    // 2) sessionStorage
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) { const o = JSON.parse(raw); return { sym: (o.sym || '').toUpperCase(), lesson: o.lesson || '' }; }
    } catch (e) {}
    return null;
  }

  function _clearIntent() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    try {
      if (location.search) history.replaceState({}, '', location.pathname + location.hash);
    } catch (e) {}
  }

  function _pulse(el) {
    if (!el) return;
    el.classList.add('vd-ac-pulse');
    setTimeout(() => el.classList.remove('vd-ac-pulse'), 1800);
  }

  function _activateLayer(lesson) {
    const layer = LAYER[lesson];
    if (!layer) return;
    if (layer === 'oiFund') {
      const sec = document.getElementById('oiFundSection');
      if (sec) { sec.scrollIntoView({ behavior: 'smooth', block: 'center' }); _pulse(sec); }
      return;
    }
    const btn = document.getElementById(LWC_BTN[layer]);
    if (btn) {
      // katman kapalıysa aç (butonun onclick'i LWC.toggle çağırır)
      if (!btn.classList.contains('on')) { try { btn.click(); } catch (e) {} }
      _pulse(btn);
    }
  }

  function _injectStyle() {
    if (document.getElementById('vd-ac-pulse-style')) return;
    const st = document.createElement('style'); st.id = 'vd-ac-pulse-style';
    st.textContent = '@keyframes vdAcPulse{0%,100%{box-shadow:0 0 0 0 rgba(0,209,255,0)}40%{box-shadow:0 0 0 4px rgba(0,209,255,.5)}}.vd-ac-pulse{animation:vdAcPulse 1.8s ease;outline:1px solid rgba(0,209,255,.6);border-radius:8px}';
    document.head.appendChild(st);
  }

  function _run(intent) {
    // premium gate
    if (!_isPremium()) {
      if (window.VDPremiumModal && window.VDPremiumModal.show) window.VDPremiumModal.show();
      return;
    }
    _injectStyle();
    const sym = intent.sym || '';
    const go = () => {
      try {
        if (sym && typeof window.openCoin === 'function') window.openCoin(sym);
        else if (sym && typeof window.loadCoin === 'function') { window.SYM = sym; window.loadCoin(sym, window.INTV || '15m'); }
      } catch (e) {}
      // grafik render olduktan sonra katmanı aktive et
      setTimeout(() => _activateLayer(intent.lesson), 1400);
    };
    // openCoin/loadCoin hazır olana kadar kısa bekleme
    let tries = 0;
    (function wait() {
      if (typeof window.openCoin === 'function' || typeof window.loadCoin === 'function') return go();
      if (tries++ < 40) return setTimeout(wait, 150);
      go();
    })();
  }

  function init() {
    const intent = _readIntent();
    if (!intent || (!intent.sym && !intent.lesson)) return;
    _clearIntent();                 // tek seferlik; refresh tekrar tetiklemesin
    setTimeout(() => _run(intent), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  window.VDAcademyChartBridge = { _readIntent, _activateLayer, LAYER };
})();
