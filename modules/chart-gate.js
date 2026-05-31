// ════════════════════════════════════════════════════════════════════
// modules/chart-gate.js
// CHART PANEL ACCESS GATE
//
// "◈ AI GRAFİK ANALİZİ" panelini (#lwcPanel) erişim seviyesine göre kapatır.
//   admin / premium → tam erişim
//   teaser          → yalnız linkteki coin (VDTeaser.symbol) · 5 dk
//   free / visitor  → kilitli (premium gate kartı)
//
// Mevcut VDAccess / VDTeaser kullanılır; yeni access sistemi yok.
// Panel KALDIRILMAZ; chart üzerine kilit overlay'i bindirilir.
// window.VDChartGate
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDChartGate) return;
  const PANEL_ID = 'lwcPanel';
  const OVERLAY_ID = 'lwc-gate-overlay';

  function _level() { try { return window.VDAccess && window.VDAccess.level ? window.VDAccess.level() : 'free'; } catch (e) { return 'free'; } }
  function _coinOf(s) { try { return window.VDTeaser && window.VDTeaser.coinOf ? window.VDTeaser.coinOf(s) : String(s || '').toUpperCase().replace(/USDT$|USDC$|BUSD$|PERP$/g, ''); } catch (e) { return ''; } }

  function _curSym() {
    if (window.SYM) return window.SYM;
    const el = document.getElementById('lwcSym');
    return el ? (el.textContent || '').trim() : '';
  }

  // Bu sembol için grafik görülebilir mi?
  function _canView(sym) {
    const lv = _level();
    if (lv === 'admin' || lv === 'premium') return true;
    if (lv === 'teaser') {
      try {
        if (window.VDTeaser && window.VDTeaser.isActive && window.VDTeaser.isActive()) {
          return _coinOf(sym) === _coinOf(window.VDTeaser.symbol());
        }
      } catch (e) {}
      return false;
    }
    return false; // free / visitor
  }

  function _reason(sym) {
    const lv = _level();
    if (lv === 'teaser') {
      const tc = (window.VDTeaser && window.VDTeaser.symbol) ? _coinOf(window.VDTeaser.symbol()) : '';
      return `Önizleme yalnızca <b>${tc}</b> grafiği içindir. Diğer coin grafiklerini görmek için Premium erişim gereklidir.`;
    }
    return 'Detaylı grafik, S/R, Entry/TP/SL ve yapı analizi Premium üyelere özeldir.';
  }

  function _overlayHTML(sym) {
    return `
      <div class="lwc-gate-card">
        <div class="lwc-gate-ic">🔒</div>
        <div class="lwc-gate-title">AI Grafik Analizi · Premium</div>
        <div class="lwc-gate-msg">${_reason(sym)}</div>
        <button class="lwc-gate-btn" data-chart-premium type="button">Premium Erişim Kodu Gir</button>
      </div>`;
  }

  function _removeOverlay(panel) {
    const o = panel.querySelector('#' + OVERLAY_ID);
    if (o) o.remove();
    panel.classList.remove('lwc-gated');
  }

  function _addOverlay(panel, sym) {
    if (panel.querySelector('#' + OVERLAY_ID)) {
      // mevcut overlay mesajını güncelle (sembol değişmiş olabilir)
      const msg = panel.querySelector('#' + OVERLAY_ID + ' .lwc-gate-msg');
      if (msg) msg.innerHTML = _reason(sym);
      return;
    }
    panel.style.position = panel.style.position || 'relative';
    panel.classList.add('lwc-gated');
    const ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.className = 'lwc-gate-overlay';
    ov.innerHTML = _overlayHTML(sym);
    panel.appendChild(ov);
    const btn = ov.querySelector('[data-chart-premium]');
    if (btn) btn.addEventListener('click', () => {
      if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin();
      else window.location.href = 'index.html#premium';
    });
  }

  let _busy = false;
  function apply() {
    if (_busy) return;
    _busy = true;
    try {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      const sym = _curSym();
      if (_canView(sym)) _removeOverlay(panel);
      else _addOverlay(panel, sym);
    } finally { _busy = false; }
  }

  // ── Tetikleyiciler ──
  function _observeSym() {
    const symEl = document.getElementById('lwcSym');
    if (symEl && window.MutationObserver) {
      new MutationObserver(() => apply()).observe(symEl, { childList: true, characterData: true, subtree: true });
    }
    // NOT: #lwcPanel attribute observer KULLANILMAZ — overlay eklerken panel'in
    // kendi class/style'ını değiştirdiği için self-trigger/döngü riski taşır.
    // Sembol değişimi (lwcSym) + access event + periyodik kontrol yeterli.
  }

  function init() {
    apply();
    _observeSym();
    window.addEventListener('vd:access:changed', apply);
    window.addEventListener('vd:access:lock-changed', apply);
    // teaser süresi dolduğunda yeniden değerlendir (tam-ekran gate ayrıca açılır)
    setInterval(apply, 5000);
  }

  window.VDChartGate = { apply, _canView };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
