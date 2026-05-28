// ════════════════════════════════════════════════════════════════════
// PREMIUM MODAL (Mini-Aşama B.3-PREMIUM)
//
// Premium tanıtım modal — bekleme listesi YOK, sadece bilgilendirme.
//
// Tetikleyiciler:
//   - Kilitli coin tıklama (access-control)
//   - Alt CTA bant butonu (premium-cta)
//   - AI yorum altındaki "Premium'a Geç" butonu
//   - Visual lock overlay butonu
//
// Public API:
//   VDPremiumModal.show({ requestedSym? })
//   VDPremiumModal.hide()
//
// Güvenlik: createElement + textContent, innerHTML YOK.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const OVERLAY_ID = 'vd-premium-modal-overlay';
  let _escHandler = null;

  function _addText(parent, text, tag, className) {
    const el = document.createElement(tag || 'div');
    if (className) el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  function _build(opts) {
    opts = opts || {};
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'vd-premium-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'vd-premium-modal-title');

    const modal = document.createElement('div');
    modal.className = 'vd-premium-modal';

    // ── Close button ──
    const closeBtn = document.createElement('button');
    closeBtn.className = 'vd-premium-modal-close';
    closeBtn.setAttribute('aria-label', 'Kapat');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', hide);
    modal.appendChild(closeBtn);

    // ── Title ──
    const title = document.createElement('h2');
    title.id = 'vd-premium-modal-title';
    title.className = 'vd-premium-modal-title';
    const titleIcon = document.createElement('span');
    titleIcon.textContent = '🚀 ';
    const titleText = document.createElement('span');
    titleText.textContent = 'VD SecuriAnalyst Premium';
    title.appendChild(titleIcon);
    title.appendChild(titleText);
    modal.appendChild(title);

    // ── Intro ──
    _addText(modal, 'Premium üyelikle açılan özellikler:', 'p', 'vd-premium-modal-intro');

    // ── Features list ──
    const features = document.createElement('ul');
    features.className = 'vd-premium-modal-features';
    const items = [
      'Tüm coinlere erişim',
      'AI analizlerinin tamamı',
      'Giriş / hedef / risk seviyeleri',
      'Gelişmiş veri katmanları',
    ];
    items.forEach(itemText => {
      const li = document.createElement('li');
      const check = document.createElement('span');
      check.className = 'vd-premium-modal-check';
      check.textContent = '✔';
      const txt = document.createElement('span');
      txt.textContent = itemText;
      li.appendChild(check);
      li.appendChild(txt);
      features.appendChild(li);
    });
    modal.appendChild(features);

    // ── Risk warning ──
    const warning = document.createElement('div');
    warning.className = 'vd-premium-modal-warning';
    const warnIcon = document.createElement('span');
    warnIcon.textContent = '⚠️ ';
    const warnText = document.createElement('span');
    warnText.textContent = 'Eksik veri ile değerlendirme yapmak risklidir';
    warning.appendChild(warnIcon);
    warning.appendChild(warnText);
    modal.appendChild(warning);

    // ── CTA Button ──
    const cta = document.createElement('button');
    cta.className = 'vd-premium-modal-cta';
    cta.type = 'button';
    cta.textContent = "Premium'a Geç";
    cta.addEventListener('click', _onCtaClick);
    modal.appendChild(cta);

    // ── B.5: "Zaten kodum var" linki ──
    const codeLink = document.createElement('button');
    codeLink.className = 'vd-premium-modal-code-link';
    codeLink.type = 'button';
    codeLink.textContent = '🔑 Zaten kodum var → Premium Kod Gir';
    codeLink.addEventListener('click', _onCodeLinkClick);
    modal.appendChild(codeLink);

    // ── Footer note ──
    _addText(modal,
      'Yakında lansman — detaylar için takipte kalın.',
      'p', 'vd-premium-modal-footer');

    overlay.appendChild(modal);

    // Overlay click → kapat (modal dışına tıklama)
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) hide();
    });

    return overlay;
  }

  function _onCtaClick() {
    // Premium üyelik vitrini (pricing) sayfasına yönlendir.
    // Mevcut sayfa kök (index.html) olduğundan legal/ alt yoluna gidilir.
    hide(true);
    window.location.href = 'legal/premium.html';
  }

  // ── B.5: "Kodum var" linki → premium modal kapat + loginScreen aç ──
  function _onCodeLinkClick() {
    hide(true);  // immediate close
    // Kısa gecikme ile loginScreen modal'ı aç (hide animasyonu çakışmasın)
    setTimeout(() => {
      try {
        if (typeof window.openPremiumLogin === 'function') {
          window.openPremiumLogin();
        } else {
          // Fallback: doğrudan class manipülasyonu
          const screen = document.getElementById('loginScreen');
          if (screen) {
            screen.style.display = '';
            screen.classList.remove('hiding');
            screen.classList.add('is-open');
          }
        }
      } catch(e) {}
    }, 100);
  }

  function show(opts) {
    // Mevcut modal varsa önce kapat (overlay duplicate olmasın)
    hide(true);

    const overlay = _build(opts || {});
    document.body.appendChild(overlay);

    // Animasyon tetikleme
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('vd-premium-modal-visible'));
    });

    // ESC ile kapat
    _escHandler = function(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    };
    document.addEventListener('keydown', _escHandler);
  }

  function hide(immediate) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler);
      _escHandler = null;
    }

    if (immediate) {
      overlay.remove();
      return;
    }

    overlay.classList.remove('vd-premium-modal-visible');
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 250);
  }

  window.VDPremiumModal = { show, hide };
})();
