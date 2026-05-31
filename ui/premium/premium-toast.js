// ════════════════════════════════════════════════════════════════════
// PREMIUM TOAST (Mini-Aşama B.3-PREMIUM)
//
// Kilitli coin'e tıklanınca öncelikle gösterilen küçük toast.
// "🔒 Bu coin analizi premium kullanıcılar için erişilebilir"
//
// Davranış: 2.5 saniye sonra fade-out. Toast'tan 350ms sonra
// access-control modal'ı açar (UX akışı: toast → modal).
//
// Public API:
//   VDPremiumToast.show()
//   VDPremiumToast.hide()
//
// Güvenlik: textContent kullanılır, innerHTML YOK.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const TOAST_ID = 'vd-premium-toast';
  const DURATION = 2500;

  let _hideTimer = null;
  let _removeTimer = null;

  function _build() {
    const wrap = document.createElement('div');
    wrap.id = TOAST_ID;
    wrap.className = 'vd-premium-toast';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');

    const icon = document.createElement('span');
    icon.className = 'vd-premium-toast-icon';
    icon.textContent = '🔒';

    const text = document.createElement('span');
    text.className = 'vd-premium-toast-text';
    text.textContent = 'Bu coin analizi premium kullanıcılar için erişilebilir';

    wrap.appendChild(icon);
    wrap.appendChild(text);
    return wrap;
  }

  function show() {
    // Mevcut toast varsa yenile
    hide(true);

    const toast = _build();
    document.body.appendChild(toast);

    // Çift RAF animasyon tetiklensin
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('vd-premium-toast-visible'));
    });

    _hideTimer = setTimeout(hide, DURATION);
  }

  function hide(immediate) {
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    if (_removeTimer) { clearTimeout(_removeTimer); _removeTimer = null; }

    const toast = document.getElementById(TOAST_ID);
    if (!toast) return;

    if (immediate) {
      toast.remove();
      return;
    }

    toast.classList.remove('vd-premium-toast-visible');
    toast.classList.add('vd-premium-toast-hide');
    _removeTimer = setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 250);
  }

  window.VDPremiumToast = { show, hide };
})();
