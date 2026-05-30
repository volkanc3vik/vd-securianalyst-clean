// ════════════════════════════════════════════════════════════════════
// modules/teaser-access.js
// PREMIUM ACCESS LAYER FAZ 1 — Telegram Teaser Access
//
// Telegram linkinden gelen kullanıcıya, linkteki TEK coin için 5 dk'lık
// geçici tam görüntüleme verir. Süre dolunca premium gate gösterir.
//   Link:  ?symbol=HYPEUSDT&source=telegram&teaser=1   (geriye uyum: sym/ref)
//   Store: teaser_access_v1 = {symbol, source, started_at, expires_at}
//
// • Yalnız linkteki sembol için geçerli (tüm siteyi açmaz).
// • Admin / Performance / AI Learning ASLA açılmaz (isAdmin set edilmez).
// • Tekrar açılışta süre KORUNUR (sıfırlanmaz); dolduysa UZAMAZ.
// • Admin/premium kullanıcıda teaser devre dışı (zaten tam erişim).
// window.VDTeaser
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDTeaser) return;
  const TAG = '[Teaser]';
  const KEY = 'teaser_access_v1';
  const DURATION_MS = 5 * 60 * 1000; // 5 dakika
  const GATE_ID = 'vd-teaser-gate';
  const BADGE_ID = 'vd-teaser-badge';

  let _state = null;     // {symbol, source, started_at, expires_at}
  let _tick = null;

  // ── Yardımcılar ──
  function _normSym(raw) {
    if (!raw) return null;
    let s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!s) return null;
    if (!/USDT$|USDC$|BUSD$/.test(s)) s += 'USDT';
    return /^[A-Z0-9]{4,18}$/.test(s) ? s : null;
  }
  function _params() {
    try {
      const p = new URLSearchParams(window.location.search);
      const sym = _normSym(p.get('symbol') || p.get('sym'));
      const source = (p.get('source') || p.get('ref') || '').toLowerCase().replace(/[^a-z0-9_\-]/g, '').slice(0, 20) || null;
      const teaser = p.get('teaser') === '1' || /tg|telegram/.test(source || '');
      return { sym, source, teaser };
    } catch (e) { return { sym: null, source: null, teaser: false }; }
  }
  function _load() {
    try { const raw = localStorage.getItem(KEY); if (!raw) return null; const d = JSON.parse(raw); return (d && d.symbol && d.expires_at) ? d : null; } catch (e) { return null; }
  }
  function _save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  function _isAdminOrPremium() {
    try { if (window.VDAccess) return window.VDAccess.isAdmin() || window.APP_ACCESS && window.APP_ACCESS.isPremium && window.APP_ACCESS.isPremium(); } catch (e) {}
    try {
      const raw = localStorage.getItem('aap_access_v1'); if (raw && JSON.parse(raw).isAdmin) return true;
      if (window.APP_ACCESS && window.APP_ACCESS.isPremium && window.APP_ACCESS.isPremium()) return true;
    } catch (e) {}
    return false;
  }

  // ── Public state ──
  function isActive() { return !!(_state && Date.now() < _state.expires_at); }
  function isExpired() { return !!(_state && Date.now() >= _state.expires_at); }
  function symbol() { return _state ? _state.symbol : null; }
  function remainingMs() { return _state ? Math.max(0, _state.expires_at - Date.now()) : 0; }

  // ── Aktif teaser → dashboard'da o sembole erişim ──
  function _applyActive() {
    try {
      if (window.APP_ACCESS && window.APP_ACCESS.setLockedSymbol) {
        window.APP_ACCESS.setLockedSymbol(_state.symbol, 'telegram'); // free → bu coin görünür
      }
    } catch (e) {}
    _showBadge();
    _scheduleExpiry();
  }

  function _scheduleExpiry() {
    if (_tick) clearInterval(_tick);
    _tick = setInterval(() => {
      _updateBadge();
      if (isExpired()) { clearInterval(_tick); _tick = null; _expire(); }
    }, 1000);
  }

  function _expire() {
    _hideBadge();
    // Sembol erişimini varsayılana çek (güvence)
    try { if (window.APP_ACCESS && window.APP_ACCESS.setLockedSymbol) window.APP_ACCESS.setLockedSymbol('BTCUSDT', 'direct'); } catch (e) {}
    _showGate();
  }

  // ── Countdown rozeti ──
  function _fmt(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function _showBadge() {
    if (document.getElementById(BADGE_ID)) { _updateBadge(); return; }
    const el = document.createElement('div');
    el.id = BADGE_ID; el.className = 'vd-teaser-badge';
    el.innerHTML = `<span class="vd-teaser-badge-dot"></span><span class="vd-teaser-badge-txt">Önizleme · <b data-teaser-cd>5:00</b></span>`;
    document.body.appendChild(el);
    _updateBadge();
  }
  function _updateBadge() {
    const cd = document.querySelector('[data-teaser-cd]');
    if (cd) cd.textContent = _fmt(remainingMs());
  }
  function _hideBadge() { const el = document.getElementById(BADGE_ID); if (el) el.remove(); }

  // ── Premium gate (süre dolunca) ──
  function _showGate() {
    if (document.getElementById(GATE_ID)) return;
    const onIndex = /index\.html$|\/$/.test(window.location.pathname) || !!window.openPremiumLogin;
    const gate = document.createElement('div');
    gate.id = GATE_ID; gate.className = 'vd-teaser-gate';
    gate.innerHTML = `
      <div class="vd-teaser-gate-card" role="dialog" aria-modal="true">
        <div class="vd-teaser-gate-icon">🔒</div>
        <div class="vd-teaser-gate-title">Önizleme süresi doldu</div>
        <div class="vd-teaser-gate-msg">Ücretsiz önizleme süreniz doldu. Analizin tamamına ve tüm platform verilerine erişmek için Premium erişim kodu gereklidir.</div>
        <button class="vd-teaser-gate-btn" data-teaser-premium type="button">Premium Erişim Kodu Gir</button>
        <a class="vd-teaser-gate-home" href="index.html">Ana sayfaya dön</a>
      </div>`;
    document.body.appendChild(gate);
    requestAnimationFrame(() => gate.classList.add('vd-teaser-gate-show'));
    const btn = gate.querySelector('[data-teaser-premium]');
    if (btn) btn.addEventListener('click', () => {
      if (onIndex && typeof window.openPremiumLogin === 'function') { _hideGate(); window.openPremiumLogin(); }
      else window.location.href = 'index.html#premium';
    });
  }
  function _hideGate() { const g = document.getElementById(GATE_ID); if (g) { g.classList.remove('vd-teaser-gate-show'); setTimeout(() => g.remove(), 200); } }

  // ── Init ──
  function init() {
    // Admin/premium → teaser tamamen devre dışı (zaten tam erişim)
    if (_isAdminOrPremium()) { console.log(TAG, 'admin/premium — teaser atlandı.'); return; }

    const { sym, source, teaser } = _params();
    _state = _load();

    if (teaser && sym) {
      if (_state && _state.symbol === sym) {
        // Aynı sembol → mevcut süreyi KORU (sıfırlama yok, dolduysa uzatma yok)
      } else {
        // Yeni sembol / ilk kez → yeni teaser başlat
        const now = Date.now();
        _state = { symbol: sym, source: source || 'telegram', started_at: now, expires_at: now + DURATION_MS };
        _save(_state);
        console.log(TAG, 'başlatıldı:', sym, '(' + (source || 'telegram') + ') · 5 dk');
      }
    }

    if (!_state) { return; } // teaser yok → normal ziyaretçi (mevcut sistem aynen)

    if (isActive()) { _applyActive(); }
    else if (isExpired()) { _showGate(); }
  }

  window.VDTeaser = { isActive, isExpired, symbol, remainingMs, init,
    // test/debug
    _state: () => _state, _params, _normSym };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
