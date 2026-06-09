// ════════════════════════════════════════════════════════════════════
// PREMIUM CTA (Mini-Aşama B.3-PREMIUM)
//
// Alt sabit CTA bandı — free kullanıcıya sürekli görünür.
// Cookie banner kapanınca ortaya çıkar (çakışma önleme).
//
// İçerik:
//   "🚀 Tüm coinleri aç + AI analizinin tamamını gör"
//   "Şu anda sadece sınırlı veriyi görüyorsunuz"
//   [Premium'a Geç]
//
// Davranış:
//   - Premium ise → görünmez
//   - Cookie consent verilmemişse → bekler (cookie banner üstte, çakışma)
//   - Consent verilince → fade-in
//
// Public API:
//   VDPremiumCTA.mount()
//   VDPremiumCTA.show()
//   VDPremiumCTA.hide()
//   VDPremiumCTA.unmount()
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

  const BAND_ID = 'vd-premium-cta-band';

  let _mounted = false;

  function _debug(...args) {
    if (window.VDPremiumDebug) console.debug('[PremiumCTA]', ...args);
  }

  function _build() {
    const band = document.createElement('div');
    band.id = BAND_ID;
    band.className = 'vd-premium-cta-band';
    band.setAttribute('role', 'region');
    band.setAttribute('aria-label', _t('prm.promoLabel', null, 'Premium tanıtım'));

    const inner = document.createElement('div');
    inner.className = 'vd-premium-cta-inner';

    // ── Sol: metinler ──
    const textWrap = document.createElement('div');
    textWrap.className = 'vd-premium-cta-text';

    const title = document.createElement('div');
    title.className = 'vd-premium-cta-title';
    const titleIcon = document.createElement('span');
    titleIcon.textContent = '🚀 ';
    const titleMain = document.createElement('span');
    titleMain.textContent = _t('prm.unlockAllCoins', null, 'Tüm coinleri aç + AI analizinin tamamını gör');
    title.appendChild(titleIcon);
    title.appendChild(titleMain);

    const subtitle = document.createElement('div');
    subtitle.className = 'vd-premium-cta-subtitle';
    subtitle.textContent = _t('prm.limitedData', null, 'Şu anda sadece sınırlı veriyi görüyorsunuz');

    textWrap.appendChild(title);
    textWrap.appendChild(subtitle);

    // ── Sağ: buton ──
    const btn = document.createElement('button');
    btn.className = 'vd-premium-cta-btn';
    btn.type = 'button';
    btn.textContent = _t('prm.goPremium', null, "Premium'a Geç");
    btn.addEventListener('click', _onCtaClick);

    inner.appendChild(textWrap);
    inner.appendChild(btn);
    band.appendChild(inner);
    return band;
  }

  function _onCtaClick() {
    if (window.VDPremiumModal?.show) {
      window.VDPremiumModal.show();
    }
  }

  function _shouldShow() {
    if (!window.APP_ACCESS) return false;
    if (window.APP_ACCESS.isPremium()) return false;
    // Hukuki sayfada gösterme
    if (/\/legal\//.test(window.location.pathname)) return false;
    return true;
  }

  function show() {
    if (!_shouldShow()) return;
    let band = document.getElementById(BAND_ID);
    if (!band) {
      band = _build();
      document.body.appendChild(band);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => band.classList.add('vd-premium-cta-visible'));
    });
  }

  function hide() {
    const band = document.getElementById(BAND_ID);
    if (!band) return;
    band.classList.remove('vd-premium-cta-visible');
    setTimeout(() => { if (band.parentNode) band.remove(); }, 300);
  }

  function _checkCookieConsentAndShow() {
    // Cookie consent verilmişse hemen göster
    let hasConsent = false;
    try {
      const c = localStorage.getItem('vd_cookie_consent');
      hasConsent = !!c;
    } catch (e) {}

    if (hasConsent) {
      // 1 saniye bekle, sayfa otursun
      setTimeout(show, 1000);
    } else {
      // Cookie consent verilince göster
      window.addEventListener('vd:cookie:consent', function() {
        setTimeout(show, 500);
      }, { once: true });
      // Yedek: cookie banner kullanılmıyorsa 5sn sonra zorla göster
      setTimeout(() => {
        if (!document.getElementById(BAND_ID)) {
          show();
        }
      }, 6000);
    }
  }

  function _onAccessChanged() {
    if (window.APP_ACCESS.isPremium()) {
      hide();
    } else {
      show();
    }
  }

  function mount() {
    if (_mounted) return;
    _mounted = true;
    if (!_shouldShow()) {
      _debug('not eligible, skipping');
      return;
    }
    _checkCookieConsentAndShow();
    window.addEventListener('vd:access:changed', _onAccessChanged);
    _debug('mounted');
  }

  function unmount() {
    hide();
    window.removeEventListener('vd:access:changed', _onAccessChanged);
    _mounted = false;
  }

  window.VDPremiumCTA = { mount, show, hide, unmount };
})();
