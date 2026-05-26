// ════════════════════════════════════════════════════════════════════
// TELEGRAM UI · BOOTSTRAP
// Telegram UI modüllerini başlatır.
//
// Aktivasyon sırası:
//   1. AdminMode mount → sağ üst köşeye buton
//   2. CardButton init → admin event listener
//   3. Admin aktif olursa CardButton.enable() otomatik tetiklenir
//
// Debug: window.TelegramUI.debug = true ile console.debug açılır.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  if (!window.TelegramUI) {
    console.warn('[TG-UI] namespace yok, modüller yüklendi mi?');
    return;
  }

  // Production'da sessiz, dev'de manuel açılır
  window.TelegramUI.debug = false;

  function init() {
    if (window.TelegramUI.AdminMode?.init) {
      window.TelegramUI.AdminMode.init();
    }
    if (window.TelegramUI.CardButton?.init) {
      window.TelegramUI.CardButton.init();
    }
    if (window.TelegramUI.debug) {
      console.debug('[TG-UI] initialized');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
