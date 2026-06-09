// ════════════════════════════════════════════════════════════════════
// LEGAL FOOTER — ana siteye dinamik inject
//
// Davranış:
//   - DOMContentLoaded'da body'nin sonuna footer eklenir
//   - Mevcut layout'a dokunmaz (sadece append)
//   - Idempotent: tekrar yüklenirse 2. footer eklemez
//
// Public API:
//   window.VDLegalFooter.mount()    → footer'ı ekler
//   window.VDLegalFooter.unmount()  → footer'ı kaldırır (test için)
//
// Modüler: bu dosyayı silmek = footer kaybolur, başka şey kırılmaz.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  // i18n: korumalı çeviri (route diline göre TR/EN; i18n.js yoksa Türkçe yedek)
  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  const FOOTER_ID = 'vd-legal-footer';
  const LEGAL_PATH = '/legal/';

  function _isInLegalPage() {
    // Hukuki sayfa içindeysek mount etme (zaten kendi footer'ı var)
    return /\/legal\//.test(window.location.pathname);
  }

  function mount() {
    if (_isInLegalPage()) return;
    if (document.getElementById(FOOTER_ID)) return;

    const footer = document.createElement('footer');
    footer.id = FOOTER_ID;
    footer.className = 'vd-legal-footer';
    footer.setAttribute('role', 'contentinfo');

    footer.innerHTML = `
      <div class="vd-legal-footer-inner">
        <div class="vd-legal-disclaimer">
          ${_t('footerc.disclaimer', null, '⚠ Bu platform yatırım tavsiyesi vermez. Tüm içerikler bilgilendirme amaçlıdır. Kripto para işlemleri yüksek risk içerir.')}
        </div>
        <div class="vd-legal-links">
          <a href="archive.html">${_t('footerc.archive', null, 'Analiz Arşivi')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}about.html">${_t('footerc.about', null, 'Hakkımızda')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}disclaimer.html">${_t('footerc.disclaimerLink', null, 'Yatırım Tavsiyesi Değildir')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}terms.html">${_t('footerc.terms', null, 'Kullanım Koşulları')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}risk.html">${_t('footerc.risk', null, 'Risk Bildirimi')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}privacy.html">${_t('footerc.privacy', null, 'Gizlilik')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}kvkk.html">${_t('footerc.kvkk', null, 'KVKK')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}cookies.html">${_t('footerc.cookies', null, 'Çerez')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="${LEGAL_PATH}contact.html">${_t('footerc.contact', null, 'İletişim')}</a>
          <span class="vd-legal-links-sep">·</span>
          <a href="#" id="vd-cookie-reset">${_t('footerc.cookieSettings', null, 'Çerez Ayarları')}</a>
        </div>
        <div class="vd-legal-copyright">
          © 2026 VD SecuriAnalyst — ${_t('footerc.copyrightTag', null, 'AI Kripto Analiz Platformu')}
        </div>
      </div>
    `;

    document.body.appendChild(footer);

    // "Çerez Ayarları" linki → consent'i sıfırla, banner'ı tekrar göster
    const cookieReset = document.getElementById('vd-cookie-reset');
    if (cookieReset) {
      cookieReset.addEventListener('click', function(e) {
        e.preventDefault();
        try { localStorage.removeItem('vd_cookie_consent'); } catch (err) {}
        if (window.VDCookieBanner?.show) {
          window.VDCookieBanner.show();
        } else {
          location.reload();
        }
      });
    }
  }

  function unmount() {
    const el = document.getElementById(FOOTER_ID);
    if (el) el.remove();
  }

  window.VDLegalFooter = { mount, unmount };
})();
