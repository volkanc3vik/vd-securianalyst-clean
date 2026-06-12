// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — PANEL GATE (11. iş ek paketi)
// Smart Money & Liquidity Engine (#smcPanel) ve Destek & Direnç
// (#srPanel) panelleri public/free görünümde TAM KİLİT kartıyla kapanır
// (AI Grafik kilidiyle birebir aynı görünüm: styles/teaser.css'teki
// lwc-gate-* sınıfları yeniden kullanılır — yeni CSS yok).
//
// Kurallar:
//   • Premium + admin → kilit YOK (overlay varsa kaldırılır).
//   • VDAccess yüklenmemişse AÇIK davranılır (yük sırası aksiliği
//     premium deneyimi kırmasın — 11. iş kuralıyla tutarlı).
//   • Buton → window.openPremiumLogin() (chart-gate ile aynı akış).
//   • chart-gate'in döngü dersine uyulur: attribute observer YOK;
//     access event + periyodik kontrol yeterli.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const OVERLAY_ID_PREFIX = 'vdPanelGate_';

  const PANELS = [
    {
      sel: '#smcPanel',
      titleKey: 'pg.smcTitle', titleFb: 'Smart Money & Liquidity Engine · Premium',
      descKey: 'pg.smcDesc',  descFb: 'Likidite haritası, order block, FVG ve sweep analizi Premium üyelere özeldir.',
    },
    {
      sel: '#srPanel',
      titleKey: 'pg.srTitle', titleFb: 'Destek & Direnç Seviyeleri · Premium',
      descKey: 'pg.srDesc',  descFb: 'Algoritmik destek/direnç seviyeleri Premium üyelere özeldir.',
    },
  ];

  function _isPremium() {
    try {
      if (window.VDAccess && typeof window.VDAccess.isPremium === 'function') {
        return window.VDAccess.isPremium();
      }
    } catch (e) {}
    return true; // VDAccess yok → açık davran
  }

  function _overlayHTML(cfg) {
    return '' +
      '<div class="lwc-gate-card">' +
        '<div class="lwc-gate-ic">🔒</div>' +
        '<div class="lwc-gate-title">' + _t(cfg.titleKey, null, cfg.titleFb) + '</div>' +
        '<div class="lwc-gate-msg">' + _t(cfg.descKey, null, cfg.descFb) + '</div>' +
        '<button class="lwc-gate-btn" data-panel-premium type="button">' +
          _t('pg.btn', null, 'Premium Erişim Kodu Gir') + '</button>' +
      '</div>';
  }

  function _ovId(cfg) { return OVERLAY_ID_PREFIX + cfg.sel.replace(/[^\w]/g, ''); }

  function _remove(panel, cfg) {
    const o = panel.querySelector('#' + _ovId(cfg));
    if (o) o.remove();
    panel.classList.remove('lwc-gated');
  }

  function _add(panel, cfg) {
    if (panel.querySelector('#' + _ovId(cfg))) return; // zaten kilitli
    panel.style.position = panel.style.position || 'relative';
    panel.classList.add('lwc-gated');
    const ov = document.createElement('div');
    ov.id = _ovId(cfg);
    ov.className = 'lwc-gate-overlay';
    ov.innerHTML = _overlayHTML(cfg);
    panel.appendChild(ov);
    const btn = ov.querySelector('[data-panel-premium]');
    if (btn) btn.addEventListener('click', function () {
      if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin();
      else window.location.href = 'index.html#premium';
    });
  }

  function apply() {
    const prem = _isPremium();
    for (let i = 0; i < PANELS.length; i++) {
      const cfg = PANELS[i];
      let panel = null;
      try { panel = document.querySelector(cfg.sel); } catch (e) {}
      if (!panel) continue;
      if (prem) _remove(panel, cfg);
      else _add(panel, cfg);
    }
  }

  function init() {
    apply();
    window.addEventListener('vd:access:changed', apply);
    window.addEventListener('vd:access:lock-changed', apply);
    setInterval(apply, 5000);
  }

  window.VDPanelGate = { apply };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
