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

  // ── SÖZLÜKLER — 170.B-1'de BİLEREK BOŞ (henüz çeviri yok). B-2+ doldurulacak.
  var DICT = { tr: {}, en: {} };

  function _norm(l) {
    l = String(l || '').toLowerCase().slice(0, 2);
    return LANGS.indexOf(l) >= 0 ? l : DEFAULT;
  }
  function _stored() { try { return localStorage.getItem(LS_KEY); } catch (e) { return null; } }

  var _lang = _norm(_stored() || DEFAULT);

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
    applyStatic(document);   // statik [data-i18n] düğümleri (şimdilik yok → no-op)
    try { window.dispatchEvent(new CustomEvent('vd:lang:change', { detail: { lang: _lang } })); } catch (e) {}
    return _lang;
  }
  function toggle() { return setLang(_lang === 'tr' ? 'en' : 'tr'); }

  // Sözlük araması: önce aktif dil, yedek verildiyse yedek, yoksa TR, en son anahtar.
  function t(key, fallback) {
    var d = DICT[_lang] || {};
    if (Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    if (fallback != null) return fallback;
    var dtr = DICT.tr || {};
    if (Object.prototype.hasOwnProperty.call(dtr, key)) return dtr[key];
    return key;
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
        b.addEventListener('click', function () { setLang(l); });
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
      '.vdn-i18n-switch{display:inline-flex;align-items:center;gap:2px;margin-left:auto;' +
        'border:1px solid var(--v4-border,rgba(255,255,255,0.10));border-radius:8px;padding:2px}' +
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
  function _injectSwitches() {
    if (!_topDone) {
      var top = document.querySelector('.vdn-topnav');
      if (top && !top.querySelector('.vdn-i18n-switch')) { top.appendChild(_makeSwitch()); _topDone = true; }
    }
    if (!_drawerDone) {
      var dr = document.querySelector('.vdn-drawer');
      if (dr && !dr.querySelector('.vdn-i18n-switch')) {
        var sw = _makeSwitch();
        sw.classList.add('vdn-i18n-switch--drawer');
        var hdr = dr.querySelector('.vdn-drawer-hdr');
        if (hdr) hdr.insertAdjacentElement('afterend', sw); else dr.appendChild(sw);
        _drawerDone = true;
      }
    }
    return _topDone && _drawerDone;
  }

  function _boot() {
    _applyHtmlLang();
    _injectStyle();
    // nav.js DOMContentLoaded'da mount oluyor; yükleme sırası garanti değil → kısa retry ile bekle.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (_injectSwitches() || tries > 30) { _syncSwitches(); clearInterval(iv); }
    }, 120);
    _injectSwitches();
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
})();
