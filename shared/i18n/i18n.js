// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — i18n ÇEKİRDEĞİ (ZIP 170.B-1) — SADECE MOTOR
//
// Bu adımda HİÇBİR METİN ÇEVRİLMEZ. Yalnız altyapı kurulur:
//   • Dil durumu (tr / en) + localStorage hafızası ('vd_lang', varsayılan tr)
//   • <html lang> dinamik yönetimi
//   • t(anahtar, yedek) sözlük arama (sözlükler şimdilik BOŞ → yedek/anahtar döner)
//   • applyStatic(): [data-i18n] / [data-i18n-attr] düğümlerini çevirir
//     (şimdilik sayfalarda böyle düğüm YOK → no-op; B-2+ kullanılacak)
//   • Nav'a TR/EN dil değiştirici enjekte eder (üst nav + mobil drawer)
//
// GÜVENLİK: Mevcut hiçbir mantığa dokunmaz. nav.js DEĞİŞMEZ (switcher buradan
// DOM'a eklenir). Metin katmanı 170.B-2+ adımlarında doldurulacak.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var LS_KEY  = 'vd_lang';
  var LANGS   = ['tr', 'en'];
  var DEFAULT = 'tr';

  // ── SÖZLÜKLER — 170.B-2: ortak metinler (nav, footer, toast, login). Onaylı çeviriler.
  var DICT = {
    tr: {
      'nav.performans': 'Performans',
      'footer.disclaimer': '⚠ Bu sistem yatırım tavsiyesi değildir. Kripto para yatırımları yüksek risk içerir. Kendi araştırmanızı yapın.',
      'toast.welcome': 'Hoş geldiniz',
      'toast.welcomeSource': '{src} hoş geldiniz',
      'toast.analysisLoaded': '{sym} analizi yüklendi · İncelemeye başlayın',
      'toast.platformLoaded': 'Analiz platformu yüklendi',
      'login.premiumActivation': 'PREMIUM AKTİVASYON',
      'login.premiumDesc': 'Premium üyelik kodunuzu girin. Tüm coinler ve detaylı analizler açılacak.',
      'login.premiumCode': 'Premium Kodu',
      'login.codePlaceholder': 'Premium kodunuzu girin...',
      'login.activate': 'Premium’u Aktive Et',
      'login.signIn': 'Giriş Yap',
      'login.verifying': 'Doğrulanıyor...',
      'login.enterCode': '⚠ Lütfen erişim kodunuzu girin.',
      'login.invalidCode': 'Geçersiz erişim kodu',
      'login.tooManyTry': 'Çok fazla deneme. {n} dakika sonra tekrar deneyin.',
      'login.tooManyFail': 'Çok fazla hatalı deneme. 15 dakika bekleyin.',
      'login.lockedWait': '🔒 Hesap {n} dakika kilitli. Lütfen bekleyin.',
      'login.locked': '🔒 Hesap {n} dakika kilitli.',
      'login.lockedAfter': '🔒 {msg}. Hesap {n} dakika kilitlendi.',
      'login.tryAgainSuffix': '. Lütfen tekrar deneyin.',
      'login.deviceLimit': '🔒 Bu premium kodu izin verilen cihaz sayısına ulaşmıştır. Destek için support@vd-securianalyst.com',
      'login.lockedBtn': 'Kilitli...',
      'login.connError': '⚠ Bağlantı hatası: {msg}',
      'login.noCodeFooter': 'Premium kodun yoksa sitede free olarak kullanmaya devam edebilirsin.',
      'login.contactForCode': 'Kod almak için iletişime geç.',
      'timer.remaining': 'Kalan:',
      'timer.unitDay': 'g',
      'timer.unitHour': 's',
      'timer.unitMin': 'dk',
      'timer.unitSec': 'sn',
      'timer.adminAccess': 'Yönetici erişimi',
      'timer.unlimited': 'Sınırsız',
      'access.unlimited': 'Sınırsız Erişim',
      'access.day1': '1 Gün',
      'access.days': '{n} Gün',
      'welcome.close': 'Kapat',
      'welcome.title': 'VD SecuriAnalyst\u2019e Hoş geldiniz',
      'welcome.subtitle': 'AI destekli kripto teknik analiz platformu. Algoritmik analizler ve teknik formasyonlar bilgilendirme amaçlıdır.',
      'welcome.warn1': 'Bu platform <strong>yatırım tavsiyesi vermez</strong>.',
      'welcome.warn2': 'İçerikler eğitim ve bilgilendirme amaçlıdır.',
      'welcome.warn3': 'Yatırım kararları kullanıcı sorumluluğundadır.',
      'welcome.linkTerms': 'Kullanım Koşulları',
      'welcome.linkRisk': 'Risk Bildirimi',
      'welcome.linkKvkk': 'KVKK Aydınlatma Metni',
      'welcome.termsHtml': 'Devam ederek {t}, {r} ve {k}\u2019ni okumayı ve kabul etmeyi onaylamış sayılırsınız.',
      'welcome.btnTerms': 'Kullanım Koşullarını Oku',
      'welcome.btnAccept': 'Anladım, Devam Et'
    },
    en: {
      'nav.performans': 'Performance',
      'footer.disclaimer': '⚠ This platform does not provide financial advice. Crypto assets involve high risk. Always do your own research.',
      'toast.welcome': 'Welcome',
      'toast.welcomeSource': 'Welcome — {src}',
      'toast.analysisLoaded': '{sym} analysis loaded · Start reviewing',
      'toast.platformLoaded': 'Analysis platform loaded',
      'login.premiumActivation': 'PREMIUM ACTIVATION',
      'login.premiumDesc': 'Enter your premium code. All coins and detailed analysis will unlock.',
      'login.premiumCode': 'Premium Code',
      'login.codePlaceholder': 'Enter your premium code...',
      'login.activate': 'Activate Premium',
      'login.signIn': 'Sign in',
      'login.verifying': 'Verifying...',
      'login.enterCode': '⚠ Please enter your access code.',
      'login.invalidCode': 'Invalid access code',
      'login.tooManyTry': 'Too many attempts. Try again in {n} minutes.',
      'login.tooManyFail': 'Too many failed attempts. Wait 15 minutes.',
      'login.lockedWait': '🔒 Account locked for {n} minutes. Please wait.',
      'login.locked': '🔒 Account locked for {n} minutes.',
      'login.lockedAfter': '🔒 {msg}. Account locked for {n} minutes.',
      'login.tryAgainSuffix': '. Please try again.',
      'login.deviceLimit': '🔒 This premium code has reached its device limit. Contact support@vd-securianalyst.com',
      'login.lockedBtn': 'Locked...',
      'login.connError': '⚠ Connection error: {msg}',
      'login.noCodeFooter': "If you don't have a premium code, you can keep using the site for free.",
      'login.contactForCode': 'Contact us to get a code.',
      'timer.remaining': 'Remaining:',
      'timer.unitDay': 'd',
      'timer.unitHour': 'h',
      'timer.unitMin': 'm',
      'timer.unitSec': 's',
      'timer.adminAccess': 'Admin access',
      'timer.unlimited': 'Unlimited',
      'access.unlimited': 'Unlimited access',
      'access.day1': '1 day',
      'access.days': '{n} days',
      'welcome.close': 'Close',
      'welcome.title': 'Welcome to VD SecuriAnalyst',
      'welcome.subtitle': 'AI-powered crypto technical analysis platform. Algorithmic analysis and technical patterns are for informational purposes only.',
      'welcome.warn1': 'This platform <strong>does not provide investment advice</strong>.',
      'welcome.warn2': 'Content is for educational and informational purposes.',
      'welcome.warn3': "Investment decisions are the user's responsibility.",
      'welcome.linkTerms': 'Terms of Use',
      'welcome.linkRisk': 'Risk Disclosure',
      'welcome.linkKvkk': 'Privacy Notice (KVKK)',
      'welcome.termsHtml': 'By continuing, you confirm that you have read and accept the {t}, {r} and {k}.',
      'welcome.btnTerms': 'Read Terms of Use',
      'welcome.btnAccept': 'I Understand, Continue'
    }
  };

  function _norm(l) {
    l = String(l || '').toLowerCase().slice(0, 2);
    return LANGS.indexOf(l) >= 0 ? l : DEFAULT;
  }
  function _stored() { try { return localStorage.getItem(LS_KEY); } catch (e) { return null; } }

  // ── 170 EN View Layer: dil ROUTE'tan belirlenir ──────────────────────
  // /en, /en/, /en/*.html → 'en';  diğer tüm yollar → 'tr'.
  // Bu, localStorage sızıntısını engeller (TR sayfada EN kalıntısı olmaz) ve
  // ortak dinamik JS'in (terminal kartları) doğru dilde render olmasını sağlar.
  function _routeLang() {
    try {
      return /^\/en(\/|$)/i.test(location.pathname || '') ? 'en' : 'tr';
    } catch (e) { return null; }
  }

  // TR/EN butonu için hedef route'u hesapla (artık route switch gibi çalışır)
  function _routeFor(lang) {
    var p = location.pathname || '/';
    var inEn = /^\/en(\/|$)/i.test(p);
    if (lang === 'en') {
      if (inEn) return null;
      return (p === '/' || p === '') ? '/en/' : '/en' + p;
    }
    if (!inEn) return null;
    return p.replace(/^\/en(\/|$)/i, '/') || '/';
  }

  var _lang = _norm(_routeLang() || _stored() || DEFAULT);

  function getLang() { return _lang; }

  function _applyHtmlLang() {
    try { document.documentElement.setAttribute('lang', _lang); } catch (e) {}
  }

  function setLang(l) {
    var nl = _norm(l);
    if (nl === _lang) { _applyHtmlLang(); _syncSwitches(); return _lang; }
    _lang = nl;
    try { localStorage.setItem(LS_KEY, _lang); } catch (e) {}
    _applyHtmlLang();
    _syncSwitches();
    applyStatic(document);     // statik [data-i18n] düğümlerini yeni dile çevir
    _translateNav(document);   // nav "Performans" etiketini yeni dile çevir
    try { window.dispatchEvent(new CustomEvent('vd:lang:change', { detail: { lang: _lang } })); } catch (e) {}
    return _lang;
  }
  function toggle() { return setLang(_lang === 'tr' ? 'en' : 'tr'); }

  function _interp(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars[k] != null) ? vars[k] : m;
    });
  }
  function _lookup(key, fallback) {
    var d = DICT[_lang] || {};
    if (Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    if (fallback != null) return fallback;
    var dtr = DICT.tr || {};
    if (Object.prototype.hasOwnProperty.call(dtr, key)) return dtr[key];
    return key;
  }
  // t(anahtar)                → çeviri
  // t(anahtar, "yedek")       → sözlükte yoksa yedek metin (applyStatic kullanır)
  // t(anahtar, { n: 5 })      → {n} gibi yer tutucuları doldurur
  function t(key, opt) {
    var isVars = (opt && typeof opt === 'object');
    var str = _lookup(key, isVars ? null : opt);
    return isVars ? _interp(str, opt) : str;
  }

  // Statik HTML çevirisi: [data-i18n="anahtar"] → textContent; [data-i18n-attr="placeholder:anahtar;title:anahtar2"] → öznitelik.
  // 170.B-1'de sayfalarda böyle düğüm YOK → güvenli no-op. B-2+ kullanılacak.
  function applyStatic(root) {
    try {
      root = root || document;
      if (!root.querySelectorAll) return;
      var nodes = root.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i], key = el.getAttribute('data-i18n');
        if (key) el.textContent = t(key, el.textContent);
      }
      var attrNodes = root.querySelectorAll('[data-i18n-attr]');
      for (var j = 0; j < attrNodes.length; j++) {
        var el2 = attrNodes[j];
        var spec = el2.getAttribute('data-i18n-attr') || '';
        var pairs = spec.split(';');
        for (var k = 0; k < pairs.length; k++) {
          var kv = pairs[k].split(':');
          if (kv.length === 2) {
            var attr = kv[0].trim(), kk = kv[1].trim();
            if (attr && kk) el2.setAttribute(attr, t(kk, el2.getAttribute(attr) || ''));
          }
        }
      }
    } catch (e) {}
  }

  // ── Dil değiştirici (nav'a enjekte edilir) ──────────────────────────
  function _makeSwitch() {
    var wrap = document.createElement('div');
    wrap.className = 'vdn-i18n-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Dil / Language');
    for (var i = 0; i < LANGS.length; i++) {
      (function (l) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'vdn-i18n-btn' + (l === _lang ? ' active' : '');
        b.setAttribute('data-lang', l);
        b.setAttribute('aria-label', l === 'tr' ? 'Türkçe' : 'English');
        b.textContent = l.toUpperCase();
        b.addEventListener('click', function () {
          var url = _routeFor(l);
          if (url) location.href = url + (location.search || '') + (location.hash || '');
        });
        wrap.appendChild(b);
      })(LANGS[i]);
    }
    return wrap;
  }

  function _syncSwitches() {
    try {
      var btns = document.querySelectorAll('.vdn-i18n-switch .vdn-i18n-btn');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute('data-lang') === _lang) btns[i].classList.add('active');
        else btns[i].classList.remove('active');
      }
    } catch (e) {}
  }

  function _injectStyle() {
    if (document.getElementById('vdn-i18n-style')) return;
    var css =
      '.vdn-i18n-switch{display:inline-flex;align-items:center;gap:2px;flex:0 0 auto;' +
        'border:1px solid var(--v4-border,rgba(255,255,255,0.10));border-radius:8px;padding:2px}' +
      '.vdn-i18n-switch--push{margin-left:auto}' +
      '.vdn-i18n-btn{font:inherit;cursor:pointer;background:transparent;border:none;' +
        'color:var(--v4-text-2,#7FA9C9);font-size:12px;font-weight:700;letter-spacing:.02em;' +
        'padding:4px 9px;border-radius:6px;line-height:1;transition:color .15s,background .15s}' +
      '.vdn-i18n-btn:hover{color:var(--v4-text,#EAF6FF)}' +
      '.vdn-i18n-btn.active{color:var(--v4-cyan,#00D1FF);background:rgba(0,209,255,0.10)}' +
      '.vdn-i18n-switch--drawer{margin:0 20px 14px;width:calc(100% - 40px);justify-content:center}';
    var tag = document.createElement('style');
    tag.id = 'vdn-i18n-style';
    tag.textContent = css;
    (document.head || document.documentElement).appendChild(tag);
  }

  var _topDone = false, _drawerDone = false;
  // Switcher'ın yerleşeceği "yuva": önce sağ küme (snug), yoksa sayfa header'ı (sağa it).
  //   index.html → .topbar-right · aic-header sayfaları → .aic-nav · diğerleri → .vd-page-header
  function _findSlot() {
    var cluster = document.querySelector('.topbar-right')
               || document.querySelector('.aic-header .aic-nav');
    if (cluster) return { el: cluster, push: false };
    var header = document.querySelector('.vd-page-header')
              || document.querySelector('.aic-header')
              || document.querySelector('.topbar');
    if (header) return { el: header, push: true };
    return null;
  }

  function _injectSwitches() {
    // 1) Üst-sağ (masaüstü; index'te mobilde de görünür)
    if (!_topDone) {
      var slot = _findSlot();
      if (slot && slot.el && !slot.el.querySelector('.vdn-i18n-switch')) {
        var sw = _makeSwitch();
        if (slot.push) sw.classList.add('vdn-i18n-switch--push');
        slot.el.appendChild(sw);
        _topDone = true;
      }
    }
    // 2) Mobil drawer (header sağ kümesi mobilde gizlenirse erişim buradan)
    if (!_drawerDone) {
      var dr = document.querySelector('.vdn-drawer');
      if (dr && !dr.querySelector('.vdn-i18n-switch')) {
        var sw2 = _makeSwitch();
        sw2.classList.add('vdn-i18n-switch--drawer');
        var hdr = dr.querySelector('.vdn-drawer-hdr');
        if (hdr) hdr.insertAdjacentElement('afterend', sw2); else dr.appendChild(sw2);
        _drawerDone = true;
      }
    }
    return _topDone && _drawerDone;
  }

  // Nav'da YALNIZ çevrilen etiketi (Performans) günceller — nav.js'e dokunmadan, data-key ile.
  function _translateNav(root) {
    try {
      root = root || document;
      if (!root.querySelectorAll) return;
      var anchors = root.querySelectorAll('[data-key="performans"]');
      var label = t('nav.performans');
      for (var i = 0; i < anchors.length; i++) {
        var a = anchors[i];
        var lbl = a.querySelector('.vdn-lbl');
        if (lbl) { lbl.textContent = label; continue; }
        for (var n = 0; n < a.childNodes.length; n++) {
          var node = a.childNodes[n];
          if (node.nodeType === 3 && node.textContent && node.textContent.trim()) { node.textContent = label; break; }
        }
      }
    } catch (e) {}
  }

  function _boot() {
    _applyHtmlLang();
    _injectStyle();
    applyStatic(document);     // statik [data-i18n] (footer vb.) — açılışta aktif dile çevir
    // nav.js DOMContentLoaded'da mount oluyor; yükleme sırası garanti değil → kısa retry ile bekle.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      _translateNav(document);
      if (_injectSwitches() || tries > 30) { _syncSwitches(); clearInterval(iv); }
    }, 120);
    _injectSwitches();
    _translateNav(document);
    _syncSwitches();
  }

  // <html lang>'i mümkün olan en erken anda ayarla (script çalışır çalışmaz)
  _applyHtmlLang();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();

  // Dışa açık API (B-2+ bileşenleri kullanacak)
  window.VDI18n = {
    getLang: getLang,
    setLang: setLang,
    toggle: toggle,
    t: t,
    applyStatic: applyStatic,
    LANGS: LANGS.slice()
  };

  // ── Global çeviri yardımcısı (B-3+ JS bileşenleri için) ──────────────
  // Kullanım:
  //   VDt('key')                       → çeviri (yoksa anahtarın kendisi)
  //   VDt('key', { n: 5 })             → {n} gibi yer tutucuları doldurur
  //   VDt('key', null, 'Türkçe yedek') → sözlükte yoksa yedek metin
  // Çağıran dosyalar i18n.js yüklenmeden önce çalışabileceğinden,
  // her zaman (window.VDt ? VDt(...) : yedek) kalıbıyla çağrılmalıdır.
  window.VDt = function (key, vars, fallback) {
    try {
      var opt = (vars && typeof vars === 'object') ? vars : fallback;
      return t(key, opt);
    } catch (e) {
      return (fallback != null) ? fallback : key;
    }
  };
})();
