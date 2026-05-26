// ════════════════════════════════════════════════════════════════════
// LEGAL INIT (Mini-Aşama B.1)
// Footer + Cookie Banner + Welcome Modal başlatıcı.
//
// Modüler tasarım: bu dosya silinirse hukuki altyapı tamamen kalkar,
// hiçbir mevcut özellik bozulmaz.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function init() {
    // Hukuki sayfalardayken hiçbirini mount etme (zaten kendi footer'ları var)
    const inLegalPage = /\/legal\//.test(window.location.pathname);
    if (inLegalPage) return;

    // Sıra önemli — footer önce, sonra banner ve modal
    if (window.VDLegalFooter?.mount)  window.VDLegalFooter.mount();
    if (window.VDCookieBanner?.mount) window.VDCookieBanner.mount();
    if (window.VDWelcomeModal?.mount) window.VDWelcomeModal.mount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
