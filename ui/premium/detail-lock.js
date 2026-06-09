// ════════════════════════════════════════════════════════════════════
// DETAIL LOCK (Premium — Giriş/TP/SL fiyat haritası kilidi)
//
// Detaylı fiyat seviyelerini (entry-grid + verdict) free kullanıcıdan
// blur + dark overlay + premium CTA ile gizler.
//
// Davranış:
//   - free + lockedSymbol'den FARKLI sembol → blur + overlay
//   - free + lockedSymbol === aktif sembol → normal
//   - premium → tüm kilitler kalkar
//
// Hedefler:
//   .entry-grid   (GİRİŞ / STOP LOSS / TP1-3 / R/R kutucukları)
//   #verdict      (yön eğilimi + fiyat seviyeleri özeti)
//
// Render-only: hesaplama / grafik engine'ine dokunmaz.
// İdempotent: data-vd-detail-locked marker + tek overlay.
// loadCoin her render'da içerik güncellediği için access + sembol
// değişiminde re-apply edilir (vd:access:changed + periyodik guard).
//
// Public API:
//   VDDetailLock.mount()
//   VDDetailLock.refresh()
//   VDDetailLock.unmount()
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}

  const LOCK_ATTR = 'data-vd-detail-locked';
  const WRAP_CLASS = 'vd-detail-lock-wrap';
  const OVERLAY_CLASS = 'vd-detail-lock-overlay';
  const TARGET_SELECTORS = ['.entry-grid', '#verdict'];

  let _mounted = false;
  let _accessHandler = null;
  let _pollTimer = null;

  function _debug(...args) {
    if (window.VDPremiumDebug) console.debug('[DetailLock]', ...args);
  }

  // ── Detay görünür mü? (index.html _canSeeDetails ile aynı mantık) ──
  function _canSeeDetails() {
    try {
      if (typeof window._canSeeDetails === 'function') return window._canSeeDetails();
      const A = window.APP_ACCESS;
      if (!A) return true;
      if (A.isPremium && A.isPremium()) return true;
      return A.canAccessSymbol ? A.canAccessSymbol(window.SYM) : true;
    } catch (e) {
      return true;
    }
  }

  // ── Overlay oluştur ──────────────────────────────────────────────
  function _createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = OVERLAY_CLASS;
    overlay.dataset.vdOverlay = 'true';

    const icon = document.createElement('div');
    icon.className = 'vd-detail-lock-icon';
    icon.textContent = '🔒';

    const text = document.createElement('div');
    text.className = 'vd-detail-lock-text';
    text.textContent = _t('prm.priceMapPremium', null, 'Detaylı fiyat haritası premium kullanıcılar içindir');

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'vd-detail-lock-cta';
    cta.textContent = '🚀 '+_t('prm.goPremium', null, "Premium\'a Geç")+'';
    cta.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (window.VDPremiumToast?.show) window.VDPremiumToast.show();
      setTimeout(() => {
        if (window.VDPremiumModal?.show) window.VDPremiumModal.show();
      }, 350);
    });

    overlay.appendChild(icon);
    overlay.appendChild(text);
    overlay.appendChild(cta);
    return overlay;
  }

  // ── Tek bir hedefe kilit uygula / kaldır ─────────────────────────
  function _applyToTarget(el, shouldLock) {
    if (!el) return;

    // position context — wrap class ekle (inline style'a dokunmadan)
    if (!el.classList.contains(WRAP_CLASS)) {
      el.classList.add(WRAP_CLASS);
    }

    const isLocked = el.getAttribute(LOCK_ATTR) === 'true';

    if (shouldLock && !isLocked) {
      el.setAttribute(LOCK_ATTR, 'true');
      // Var olan overlay varsa tekrar ekleme
      if (!el.querySelector('.' + OVERLAY_CLASS)) {
        el.appendChild(_createOverlay());
      }
      _debug('locked:', el.id || el.className);
    } else if (!shouldLock && isLocked) {
      el.removeAttribute(LOCK_ATTR);
      const ov = el.querySelector('.' + OVERLAY_CLASS);
      if (ov) ov.remove();
      _debug('unlocked:', el.id || el.className);
    }
  }

  // ── Tüm hedefleri tara ───────────────────────────────────────────
  function refresh() {
    if (!_mounted) return;
    const shouldLock = !_canSeeDetails();
    TARGET_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => _applyToTarget(el, shouldLock));
    });
  }

  // ── Mount ────────────────────────────────────────────────────────
  function mount() {
    if (_mounted) return;
    _mounted = true;

    // İlk uygulama
    refresh();

    // Access değişimini dinle (premium aktivasyon / logout / sembol kilidi)
    _accessHandler = () => refresh();
    window.addEventListener('vd:access:changed', _accessHandler);
    window.addEventListener('vd:access:lock-changed', _accessHandler);

    // loadCoin her render'da entry-grid içeriğini günceller ama
    // wrap/overlay DOM'da kalır (içerik child'ları değişir, overlay korunur).
    // Yine de sembol değişiminde durum güncellensin diye hafif poll.
    _pollTimer = setInterval(refresh, 2000);

    _debug('mounted');
  }

  function unmount() {
    if (!_mounted) return;
    _mounted = false;
    if (_accessHandler) {
      window.removeEventListener('vd:access:changed', _accessHandler);
      window.removeEventListener('vd:access:lock-changed', _accessHandler);
      _accessHandler = null;
    }
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    // Kilitleri kaldır
    TARGET_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => _applyToTarget(el, false));
    });
    _debug('unmounted');
  }

  window.VDDetailLock = { mount, refresh, unmount };
})();
