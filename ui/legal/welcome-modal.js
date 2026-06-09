// ════════════════════════════════════════════════════════════════════
// WELCOME MODAL — İlk kullanım için soft modal
//
// Davranış:
//   - localStorage.vd_welcome_seen yoksa veya 6+ ay geçmişse gösterilir
//   - 2 saniye sonra fade-in
//   - X butonu, "Anladım", overlay click, ESC tuşu → kapatma
//   - Soft modal: arkaplan kayar (modal-overlay value clip yapmıyor)
//
// Public API:
//   window.VDWelcomeModal.mount()
//   window.VDWelcomeModal.show()    → manuel göster
//   window.VDWelcomeModal.hide()
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const OVERLAY_ID = 'vd-welcome-overlay';
  const STORAGE_KEY = 'vd_welcome_seen';
  const VALIDITY_MS = 180 * 24 * 60 * 60 * 1000; // 6 ay

  let _escHandler = null;

  function _isInLegalPage() {
    return /\/legal\//.test(window.location.pathname);
  }

  function _seenRecently() {
    try {
      const seenAt = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      if (!seenAt) return false;
      return (Date.now() - seenAt) < VALIDITY_MS;
    } catch (e) {
      return false;
    }
  }

  function _markSeen() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch (e) { /* yut */ }
  }

  // ── i18n: korumalı çeviri (i18n.js yüklü değilse Türkçe yedeğe düşer) ──
  function _t(key, vars, fallback) {
    return (window.VDt) ? window.VDt(key, vars, fallback) : (fallback != null ? fallback : key);
  }

  function _html() {
    var linkTerms = '<a href="/legal/terms.html" target="_blank" rel="noopener">' + _t('welcome.linkTerms', null, 'Kullanım Koşulları') + '</a>';
    var linkRisk  = '<a href="/legal/risk.html" target="_blank" rel="noopener">' + _t('welcome.linkRisk', null, 'Risk Bildirimi') + '</a>';
    var linkKvkk  = '<a href="/legal/kvkk.html" target="_blank" rel="noopener">' + _t('welcome.linkKvkk', null, 'KVKK Aydınlatma Metni') + '</a>';
    var termsText = _t('welcome.termsHtml', { t: linkTerms, r: linkRisk, k: linkKvkk },
      'Devam ederek ' + linkTerms + ', ' + linkRisk + ' ve ' + linkKvkk + '\u2019ni okumayı ve kabul etmeyi onaylamış sayılırsınız.');

    return `
      <div class="vd-welcome-modal">
        <button class="vd-welcome-close" data-action="close" aria-label="${_t('welcome.close', null, 'Kapat')}">✕</button>

        <h2 class="vd-welcome-title" id="vd-welcome-title">${_t('welcome.title', null, 'VD SecuriAnalyst\u2019e Hoş geldiniz')}</h2>

        <p class="vd-welcome-subtitle">${_t('welcome.subtitle', null, 'AI destekli kripto teknik analiz platformu. Algoritmik analizler ve teknik formasyonlar bilgilendirme amaçlıdır.')}</p>

        <div class="vd-welcome-warnings">
          <p><strong>⚠</strong> ${_t('welcome.warn1', null, 'Bu platform <strong>yatırım tavsiyesi vermez</strong>.')}</p>
          <p><strong>⚠</strong> ${_t('welcome.warn2', null, 'İçerikler eğitim ve bilgilendirme amaçlıdır.')}</p>
          <p><strong>⚠</strong> ${_t('welcome.warn3', null, 'Yatırım kararları kullanıcı sorumluluğundadır.')}</p>
        </div>

        <p class="vd-welcome-terms-text">${termsText}</p>

        <div class="vd-welcome-buttons">
          <button class="vd-welcome-btn vd-welcome-btn-secondary" data-action="terms">${_t('welcome.btnTerms', null, 'Kullanım Koşullarını Oku')}</button>
          <button class="vd-welcome-btn vd-welcome-btn-primary" data-action="accept">${_t('welcome.btnAccept', null, 'Anladım, Devam Et')}</button>
        </div>
      </div>
    `;
  }

  function _build() {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'vd-welcome-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'vd-welcome-title');
    overlay.innerHTML = _html();
    overlay.addEventListener('click', _onClick);
    return overlay;
  }

  // Dil değişince, modal açıksa içeriği yeniden çiz (click listener overlay'de kalır)
  window.addEventListener('vd:lang:change', function () {
    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.innerHTML = _html();
  });

  function _onClick(e) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    // Overlay'in kendisine tıklanırsa kapat (modal dışı)
    if (e.target === overlay) {
      hide();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'close' || action === 'accept') {
      if (action === 'accept') _markSeen();
      hide();
    } else if (action === 'terms') {
      window.open('/legal/terms.html', '_blank', 'noopener');
    }
  }

  function show() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = _build();
      document.body.appendChild(overlay);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('vd-welcome-visible'));
    });
    // ESC tuşu ile kapatma
    _escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    };
    document.addEventListener('keydown', _escHandler);
  }

  function hide() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove('vd-welcome-visible');
    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler);
      _escHandler = null;
    }
    setTimeout(() => overlay.remove(), 250);
  }

  function mount() {
    if (_isInLegalPage()) return;
    if (_seenRecently()) return;
    // 2 saniye bekle, sayfa yüklensin önce
    setTimeout(show, 2000);
  }

  window.VDWelcomeModal = { mount, show, hide };
})();
