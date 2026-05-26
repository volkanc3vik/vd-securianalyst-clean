// ════════════════════════════════════════════════════════════════════
// PREMIUM INIT (Mini-Aşama B.3-PREMIUM)
//
// Visual lock + AI comment lock + Premium CTA bant başlatıcısı.
// Bu dosya silinirse premium gating tamamen kalkar.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // Debug flag (default kapalı)
  window.VDPremiumDebug = window.VDPremiumDebug || false;

  function init() {
    // Hukuki sayfalardayken mount etme
    if (/\/legal\//.test(window.location.pathname)) return;

    if (window.VDVisualLock?.mount) {
      try { window.VDVisualLock.mount(); }
      catch (e) { if (window.VDPremiumDebug) console.error('[Premium-Init] visual-lock:', e); }
    }
    if (window.VDAICommentLock?.mount) {
      try { window.VDAICommentLock.mount(); }
      catch (e) { if (window.VDPremiumDebug) console.error('[Premium-Init] ai-comment:', e); }
    }
    if (window.VDPremiumCTA?.mount) {
      try { window.VDPremiumCTA.mount(); }
      catch (e) { if (window.VDPremiumDebug) console.error('[Premium-Init] cta:', e); }
    }

    if (window.VDPremiumDebug) console.debug('[Premium-Init] initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
