// ════════════════════════════════════════════════════════════════════
// FUNNEL INIT (Mini-Aşama B.2)
// Site funnel + TI panel click handler bootstrap.
//
// Bu dosya silinirse funnel sistemi tamamen kalkar, hiçbir mevcut
// özellik etkilenmez.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // Debug flag (default kapalı)
  window.VDFunnelDebug = window.VDFunnelDebug || false;

  function init() {
    // 1) URL funnel — sembol + referrer
    if (window.VDSiteFunnel?.init) {
      try {
        window.VDSiteFunnel.init();
      } catch (e) {
        if (window.VDFunnelDebug) console.error('[Funnel-Init] site-funnel error:', e);
      }
    }

    // 2) TI panel click handler
    if (window.VDTIClickHandler?.mount) {
      try {
        window.VDTIClickHandler.mount();
      } catch (e) {
        if (window.VDFunnelDebug) console.error('[Funnel-Init] ti-click error:', e);
      }
    }

    if (window.VDFunnelDebug) console.debug('[Funnel-Init] initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
