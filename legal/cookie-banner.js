// ════════════════════════════════════════════════════════════════════
// COOKIE CONSENT BANNER
//
// Davranış:
//   - localStorage.vd_cookie_consent yoksa banner gösterilir
//   - 3 seçenek: Tümünü Kabul / Sadece Gerekli / Detaylar
//   - Slide-up animasyon
//   - Karar verildikten sonra 1 yıl tekrar gösterilmez
//
// Public API:
//   window.VDCookieBanner.mount()   → banner'ı kur
//   window.VDCookieBanner.show()    → manuel göster (footer "Çerez Ayarları")
//   window.VDCookieBanner.hide()    → manuel gizle
//   window.VDCookieBanner.consent() → mevcut consent'i döner
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // i18n: korumalı çeviri (route diline göre TR/EN)
  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const BANNER_ID = 'vd-cookie-banner';
  const STORAGE_KEY = 'vd_cookie_consent';
  const STORAGE_EXPIRES_KEY = 'vd_cookie_consent_until';
  const VALID_FOR_MS = 365 * 24 * 60 * 60 * 1000; // 1 yıl

  function _isInLegalPage() {
    return /\/legal\//.test(window.location.pathname);
  }

  function _getConsent() {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      const until = parseInt(localStorage.getItem(STORAGE_EXPIRES_KEY) || '0', 10);
      if (!consent || !until || Date.now() > until) return null;
      return consent; // 'all' | 'necessary'
    } catch (e) {
      return null;
    }
  }

  function _setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
      localStorage.setItem(STORAGE_EXPIRES_KEY, String(Date.now() + VALID_FOR_MS));
    } catch (e) { /* yut */ }
  }

  function _emitConsent(value) {
    try {
      window.dispatchEvent(new CustomEvent('vd:cookie:consent', {
        detail: { consent: value }
      }));
    } catch (e) { /* yut */ }
  }

  function _build() {
    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'vd-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', _t('cookie.aria', null, 'Çerez tercihi'));

    banner.innerHTML = `
      <div class="vd-cookie-banner-inner">
        <div class="vd-cookie-text">
          ${_t('cookie.text', null, '🍪 <strong>Çerez kullanımı:</strong> Platform analytics ve oturum yönetimi için çerez kullanır. Tercihinizi değiştirmek için "Detaylar"a bakın.')}
        </div>
        <div class="vd-cookie-buttons">
          <button class="vd-cookie-btn" data-action="necessary">${_t('cookie.necessary', null, 'Sadece Gerekli')}</button>
          <button class="vd-cookie-btn vd-cookie-btn-primary" data-action="all">${_t('cookie.acceptAll', null, 'Tümünü Kabul Et')}</button>
          <button class="vd-cookie-btn" data-action="details">${_t('cookie.details', null, 'Detaylar →')}</button>
        </div>
      </div>
    `;

    banner.addEventListener('click', _onClick);
    return banner;
  }

  function _onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'all' || action === 'necessary') {
      _setConsent(action);
      _emitConsent(action);
      hide();
    } else if (action === 'details') {
      // Hukuki sayfaya yönlendir — banner kaybolmasın
      var path = /\/legal\//.test(window.location.pathname) ? 'cookies.html' : (/^\/en(\/|$)/i.test(window.location.pathname) ? '/en/legal/cookies.html' : '/legal/cookies.html');
      window.location.href = path;
    }
  }

  function show() {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = _build();
      document.body.appendChild(banner);
    }
    // 1 frame bekle ki transition tetiklensin
    requestAnimationFrame(() => {
      requestAnimationFrame(() => banner.classList.add('vd-cookie-visible'));
    });
  }

  function hide() {
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.classList.remove('vd-cookie-visible');
    setTimeout(() => banner.remove(), 300);
  }

  function consent() {
    return _getConsent();
  }

  function mount() {
    if (_isInLegalPage()) return;
    if (_getConsent() !== null) return; // zaten karar verilmiş
    // İlk yüklendiğinde 600ms bekleyip göster (sayfa yüklensin önce)
    setTimeout(show, 600);
  }

  window.VDCookieBanner = { mount, show, hide, consent };
})();
