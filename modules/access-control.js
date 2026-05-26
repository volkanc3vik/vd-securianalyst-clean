// ════════════════════════════════════════════════════════════════════
// ACCESS CONTROL (Mini-Aşama B.3-PREMIUM)
//
// Premium gating sistemi — free kullanıcıyı tek coin'e kilitler.
//
// State:
//   window.APP_ACCESS = {
//     mode: 'free' | 'premium',
//     lockedSymbol: 'BTCUSDT' (her zaman dolu),
//     source: 'telegram' | 'direct',
//     isPremium(),
//     canAccessSymbol(sym),
//   }
//
// 4 sembol değişim noktasını kontrol altına alır:
//   1. window.openCoin → wrap (retry mekanizması)
//   2. Sinyal grid kartları → capture-phase click listener
//   3. symInput Enter → capture-phase keydown listener
//   4. TI panel click → ti-click-handler.js'den çağrı (B.2)
//
// Güvenlik: localStorage'a yazılmaz (session-only).
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const DEFAULT_SYMBOL = 'BTCUSDT';
  const PREMIUM_PREVIEW_KEY = 'vd_premium_preview';

  // ── State ────────────────────────────────────────────────────────
  function _checkPremiumPreview() {
    try {
      return localStorage.getItem(PREMIUM_PREVIEW_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  window.APP_ACCESS = {
    mode: _checkPremiumPreview() ? 'premium' : 'free',
    lockedSymbol: DEFAULT_SYMBOL,
    source: 'direct',

    isPremium() {
      return this.mode === 'premium';
    },

    canAccessSymbol(sym) {
      if (this.isPremium()) return true;
      if (!sym) return false;
      const normalized = String(sym).toUpperCase();
      return normalized === this.lockedSymbol;
    },

    // Premium mode'a geç (debug veya gelecek auth için)
    setPremium() {
      this.mode = 'premium';
      try {
        window.dispatchEvent(new CustomEvent('vd:access:changed', {
          detail: { mode: 'premium' }
        }));
      } catch (e) {}
    },

    setFree() {
      this.mode = 'free';
      try {
        window.dispatchEvent(new CustomEvent('vd:access:changed', {
          detail: { mode: 'free' }
        }));
      } catch (e) {}
    },

    // Lock symbol set (site-funnel.js çağırır)
    setLockedSymbol(sym, source) {
      if (!sym) return;
      this.lockedSymbol = String(sym).toUpperCase();
      this.source = source || 'direct';
      try {
        window.dispatchEvent(new CustomEvent('vd:access:lock-changed', {
          detail: { lockedSymbol: this.lockedSymbol, source: this.source }
        }));
      } catch (e) {}
    },
  };

  // ── Debug log ────────────────────────────────────────────────────
  function _debug(...args) {
    if (window.VDPremiumDebug) console.debug('[AccessControl]', ...args);
  }

  // ── Sembol blokajı tepkisi (toast + modal) ───────────────────────
  function _blockSymbol(requestedSym, context) {
    _debug('blocked:', requestedSym, 'context:', context);
    // Önce toast (UX iyileştirmesi), sonra modal
    if (window.VDPremiumToast?.show) {
      window.VDPremiumToast.show();
    }
    // Toast'tan 350ms sonra modal aç (animasyon görünür olsun)
    setTimeout(() => {
      if (window.VDPremiumModal?.show) {
        window.VDPremiumModal.show({ requestedSym: requestedSym });
      }
    }, 350);
  }

  // ── openCoin wrap (retry mekanizması) ────────────────────────────
  let _wrapAttempts = 0;
  const MAX_WRAP_ATTEMPTS = 30;
  let _originalOpenCoin = null;

  function _wrapOpenCoin() {
    if (typeof window.openCoin !== 'function') {
      _wrapAttempts++;
      if (_wrapAttempts < MAX_WRAP_ATTEMPTS) {
        setTimeout(_wrapOpenCoin, 150);
      } else {
        _debug('openCoin not found, giving up wrap');
      }
      return;
    }

    if (_originalOpenCoin) return; // zaten wrap edilmiş

    _originalOpenCoin = window.openCoin;
    window.openCoin = function(sym) {
      if (!window.APP_ACCESS.canAccessSymbol(sym)) {
        _blockSymbol(sym, 'openCoin');
        return;
      }
      return _originalOpenCoin.apply(this, arguments);
    };
    _debug('openCoin wrapped');
  }

  // ── Sinyal grid capture-phase click intercept ────────────────────
  function _onGridCardClick(e) {
    // Sinyal kartının kendisi
    const card = e.target.closest('.opp');
    if (!card) return;

    // Loading state'inde tıklama engellenmez (sembol "—")
    if (card.classList.contains('loading')) return;

    // Buton tıklamaları geçer (Telegram, FuturesPanel vb.)
    const btn = e.target.closest('button');
    if (btn) return;

    // Sembolü çek
    const symEl = card.querySelector('.opp-sym');
    if (!symEl) return;
    const rawSym = (symEl.textContent || '').trim().toUpperCase();
    if (!rawSym || rawSym === '—') return;

    // Normalize: USDT suffix yoksa ekle
    const sym = rawSym.endsWith('USDT') || rawSym.endsWith('USDC') || rawSym.endsWith('BUSD')
      ? rawSym
      : rawSym + 'USDT';

    if (!window.APP_ACCESS.canAccessSymbol(sym)) {
      e.stopPropagation();
      e.preventDefault();
      _blockSymbol(sym, 'signalCard');
    }
  }

  function _interceptSignalGrids() {
    ['longGrid', 'shortGrid', 'jokerGrid'].forEach(id => {
      const grid = document.getElementById(id);
      if (!grid) {
        _debug('grid not found:', id);
        return;
      }
      // Capture phase: kartın kendi onclick listener'ından önce çalışır
      grid.addEventListener('click', _onGridCardClick, true);
      _debug('grid intercepted:', id);
    });
  }

  // ── symInput capture-phase keydown intercept ─────────────────────
  function _onSymInputKeyDown(e) {
    if (e.key !== 'Enter') return;
    const input = e.currentTarget;
    if (!input) return;

    const raw = (input.value || '').trim().toUpperCase();
    if (!raw) return;

    if (!window.APP_ACCESS.canAccessSymbol(raw)) {
      e.stopPropagation();
      e.preventDefault();
      _blockSymbol(raw, 'symInput');
      // Input'u eski haline döndür
      setTimeout(() => {
        input.value = window.APP_ACCESS.lockedSymbol;
      }, 50);
    }
  }

  function _interceptSymInput() {
    const input = document.getElementById('symInput');
    if (!input) {
      _debug('symInput not found');
      return;
    }
    input.addEventListener('keydown', _onSymInputKeyDown, true);
    _debug('symInput intercepted');
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    _debug('init', { mode: window.APP_ACCESS.mode, locked: window.APP_ACCESS.lockedSymbol });
    _wrapOpenCoin();
    _interceptSignalGrids();
    _interceptSymInput();
  }

  // DOMContentLoaded'da intercept et
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // ── Public API ────────────────────────────────────────────────────
  window.VDAccessControl = {
    blockSymbol: _blockSymbol,
    isReady: () => _originalOpenCoin !== null,
  };
})();
