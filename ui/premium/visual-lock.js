// ════════════════════════════════════════════════════════════════════
// VISUAL LOCK (Mini-Aşama B.3-PREMIUM)
//
// MutationObserver tabanlı görsel kilit uygulayıcı:
//   - Sinyal grid kartları (longGrid, shortGrid, jokerGrid)
//   - TI Watchlist satırları (.ti-watch-sym)
//   - TI Best Setup kartı (.ti-best-sym)
//
// Davranış:
//   - free + lockedSymbol'den FARKLI sembolde olan elementlere blur + lock
//   - free + lockedSymbol === sembol → normal görünüm
//   - premium → tüm kilitler kalkar
//
// İdempotent: data-vd-locked marker
// Mevcut DOM yapısına dokunmadan (sadece attribute ekler/kaldırır)
// CSS class'ları stillemeyi yapar.
//
// Public API:
//   VDVisualLock.mount()
//   VDVisualLock.unmount()
//   VDVisualLock.refresh()
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const LOCKED_MARKER = 'data-vd-locked';
  const PROCESSED_MARKER = 'data-vd-lock-processed';

  let _observers = [];
  let _mounted = false;
  let _rafScheduled = false;

  function _debug(...args) {
    if (window.VDPremiumDebug) console.debug('[VisualLock]', ...args);
  }

  // ── Sembolü normalize et (USDT suffix) ───────────────────────────
  function _normalizeSym(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.length < 2 || s.length > 12) return null;
    if (s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('BUSD')) return s;
    return s + 'USDT';
  }

  // ── Sinyal kartı için sembol oku ─────────────────────────────────
  function _readCardSymbol(card) {
    if (!card) return null;
    const symEl = card.querySelector('.opp-sym');
    if (!symEl) return null;
    const raw = (symEl.textContent || '').trim();
    if (!raw || raw === '—') return null;
    return _normalizeSym(raw);
  }

  // ── Lock overlay oluştur (kart üzerine) ──────────────────────────
  function _createCardOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'vd-lock-overlay';

    const inner = document.createElement('div');
    inner.className = 'vd-lock-overlay-inner';

    const icon = document.createElement('span');
    icon.className = 'vd-lock-overlay-icon';
    icon.textContent = '🔒';

    const text = document.createElement('div');
    text.className = 'vd-lock-overlay-text';
    text.textContent = "Premium'a Geç";

    inner.appendChild(icon);
    inner.appendChild(text);
    overlay.appendChild(inner);

    // Overlay tıklanırsa modal aç
    overlay.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      if (window.VDPremiumToast?.show) window.VDPremiumToast.show();
      setTimeout(() => {
        if (window.VDPremiumModal?.show) window.VDPremiumModal.show();
      }, 350);
    });

    return overlay;
  }

  // ── Kart kilidi uygula/kaldır ────────────────────────────────────
  function _applyCardLock(card, shouldLock) {
    if (!card) return;
    const isLocked = card.getAttribute(LOCKED_MARKER) === 'true';

    if (shouldLock && !isLocked) {
      card.setAttribute(LOCKED_MARKER, 'true');
      const overlay = _createCardOverlay();
      overlay.dataset.vdOverlay = 'true';
      // İçeriği wrap et değil — overlay üstüne ekle (position relative kart için CSS'te)
      card.appendChild(overlay);
    } else if (!shouldLock && isLocked) {
      card.removeAttribute(LOCKED_MARKER);
      const overlay = card.querySelector('[data-vd-overlay="true"]');
      if (overlay) overlay.remove();
    }
  }

  // ── TI sembol (watchlist + best setup) için kilit ────────────────
  function _applyTISymLock(el, shouldLock) {
    if (!el) return;
    const isLocked = el.getAttribute(LOCKED_MARKER) === 'true';

    if (shouldLock && !isLocked) {
      el.setAttribute(LOCKED_MARKER, 'true');
      el.setAttribute('title', 'Premium kullanıcılar erişebilir');
      el.setAttribute('aria-label', 'Premium kilitli');
      // B.2'deki data-clickable işaretini kaldır (artık tıklanmasın)
      el.removeAttribute('data-clickable');
      // Lock ikonu inline ekle (önüne)
      if (!el.querySelector('.vd-lock-inline-icon')) {
        const lockIcon = document.createElement('span');
        lockIcon.className = 'vd-lock-inline-icon';
        lockIcon.textContent = '🔒';
        el.insertBefore(lockIcon, el.firstChild);
      }
    } else if (!shouldLock && isLocked) {
      el.removeAttribute(LOCKED_MARKER);
      el.removeAttribute('title');
      el.removeAttribute('aria-label');
      // B.2'deki tıklanabilirliği geri getir
      el.setAttribute('data-clickable', 'true');
      const lockIcon = el.querySelector('.vd-lock-inline-icon');
      if (lockIcon) lockIcon.remove();
    }
  }

  // ── Tarama: sinyal grid kartları ─────────────────────────────────
  function _scanSignalGrids() {
    if (!window.APP_ACCESS) return;
    const isPremium = window.APP_ACCESS.isPremium();
    const locked = window.APP_ACCESS.lockedSymbol;

    ['longGrid', 'shortGrid', 'jokerGrid'].forEach(id => {
      const grid = document.getElementById(id);
      if (!grid) return;
      const cards = grid.querySelectorAll('.opp');
      cards.forEach(card => {
        // Loading kartları (sembol yok) — atla
        if (card.classList.contains('loading')) {
          // Loading kartına ulaşan kilit varsa kaldır
          if (card.getAttribute(LOCKED_MARKER) === 'true') {
            _applyCardLock(card, false);
          }
          return;
        }

        if (isPremium) {
          _applyCardLock(card, false);
          return;
        }

        const sym = _readCardSymbol(card);
        const shouldLock = !sym || sym !== locked;
        _applyCardLock(card, shouldLock);
      });
    });
  }

  // ── Tarama: TI panel sembolleri (watchlist + best setup) ─────────
  function _scanTISymbols() {
    if (!window.APP_ACCESS) return;
    const isPremium = window.APP_ACCESS.isPremium();
    const locked = window.APP_ACCESS.lockedSymbol;

    const tiPanel = document.getElementById('tiPanelMount');
    if (!tiPanel) return;

    const symEls = tiPanel.querySelectorAll('.ti-watch-sym, .ti-best-sym');
    symEls.forEach(el => {
      if (isPremium) {
        _applyTISymLock(el, false);
        return;
      }

      // Lock ikonu varsa onun textContent'i sembol değil — orijinal sembolü bul
      // Önce inline icon'u çıkar geçici olarak
      let raw = (el.textContent || '').trim();
      // Eğer lock ikonu içeriyorsa kaldır
      if (raw.startsWith('🔒')) raw = raw.replace(/^🔒\s*/, '');
      const sym = _normalizeSym(raw);
      const shouldLock = !sym || sym !== locked;
      _applyTISymLock(el, shouldLock);
    });
  }

  // ── Combined scan ────────────────────────────────────────────────
  function _scan() {
    try {
      _scanSignalGrids();
      _scanTISymbols();
    } catch (e) {
      _debug('scan error:', e);
    }
  }

  function _scheduleScan() {
    if (_rafScheduled) return;
    _rafScheduled = true;
    requestAnimationFrame(() => {
      _rafScheduled = false;
      _scan();
    });
  }

  // ── Observers ────────────────────────────────────────────────────
  function _setupObservers() {
    // 1. Sinyal grid'leri
    ['longGrid', 'shortGrid', 'jokerGrid'].forEach(id => {
      const grid = document.getElementById(id);
      if (!grid) {
        _debug('grid not found at setup:', id);
        return;
      }
      const obs = new MutationObserver(_scheduleScan);
      // subtree:true — kart içeriği (sembol text node'u) değişebilir
      obs.observe(grid, { childList: true, subtree: true, characterData: true });
      _observers.push(obs);
    });

    // 2. TI panel
    const tiPanel = document.getElementById('tiPanelMount');
    if (tiPanel) {
      const obs = new MutationObserver(_scheduleScan);
      obs.observe(tiPanel, { childList: true, subtree: true, characterData: true });
      _observers.push(obs);
    } else {
      // TI panel henüz yok — body'yi gözle ki ortaya çıkınca yakalansın
      const bodyObs = new MutationObserver(_scheduleScan);
      bodyObs.observe(document.body, { childList: true, subtree: false });
      _observers.push(bodyObs);
    }
  }

  // ── Access mode değişikliği dinle ────────────────────────────────
  function _onAccessChanged() {
    _debug('access changed, rescanning');
    _scan();
  }

  // ── Mount ─────────────────────────────────────────────────────────
  function mount() {
    if (_mounted) return;
    _mounted = true;
    _setupObservers();
    _scan();

    // Premium mode değişirse rescan
    window.addEventListener('vd:access:changed', _onAccessChanged);
    window.addEventListener('vd:access:lock-changed', _onAccessChanged);
    _debug('mounted');
  }

  function unmount() {
    _observers.forEach(obs => obs.disconnect());
    _observers = [];
    window.removeEventListener('vd:access:changed', _onAccessChanged);
    window.removeEventListener('vd:access:lock-changed', _onAccessChanged);

    // Tüm kilitleri kaldır
    document.querySelectorAll(`[${LOCKED_MARKER}="true"]`).forEach(el => {
      if (el.classList.contains('opp')) {
        _applyCardLock(el, false);
      } else {
        _applyTISymLock(el, false);
      }
    });
    _mounted = false;
    _debug('unmounted');
  }

  function refresh() {
    _scan();
  }

  window.VDVisualLock = { mount, unmount, refresh };
})();
