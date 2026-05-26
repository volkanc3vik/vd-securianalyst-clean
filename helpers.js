// ════════════════════════════════════════════════════════════════════
// VIP TRACKER · BOOTSTRAP
// Engine init eder, debug flag default kapalı.
//
// Debug: window.VipTrackerDebug = true ile [VIP-Track:*] logları aç.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // Default kapalı (production)
  window.VipTrackerDebug = window.VipTrackerDebug || false;
  // Telegram update flag de default kapalı (test mode)
  window.ENABLE_TRADE_WATCHER_TELEGRAM = false;

  function init() {
    if (window.TradeWatcher?.init) {
      window.TradeWatcher.init();
    }
    if (window.VipTrackerDebug) {
      console.debug('[VIP-Track] initialized');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
