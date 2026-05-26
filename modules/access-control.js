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
  const ACCESS_CODE_KEY = 'aap_access_v1';

  // ── State ────────────────────────────────────────────────────────
  function _checkPremiumPreview() {
    try {
      return localStorage.getItem(PREMIUM_PREVIEW_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  // Admin mode kontrolü — admin aktifse otomatik premium
  function _checkAdminActive() {
    try {
      // 1) Direkt API kontrolü
      if (window.TelegramUI?.AdminMode?.isActive?.()) return true;
      // 2) Dispatcher'da admin key var mı
      if (window.TelegramDispatcher?.hasAdminKey?.()) return true;
    } catch (e) {}
    return false;
  }

  // Access code login kontrolü — mevcut Supabase access code sistemi
  // localStorage['aap_access_v1'] = { isAdmin: bool, bitis: timestamp_ms, ... }
  function _checkAccessCode() {
    try {
      const raw = localStorage.getItem(ACCESS_CODE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (typeof d !== 'object' || d === null) return false;
      // isAdmin true ise (kod sistemi içindeki admin) — sınırsız erişim
      if (d.isAdmin === true) return true;
      // bitis (expiresAt) ileri tarihte ise geçerli
      if (typeof d.bitis === 'number' && d.bitis > Date.now()) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  // İlk mode hesaplama: preview > admin > access_code öncelik sırasıyla
  function _computeInitialState() {
    if (_checkPremiumPreview()) return { mode: 'premium', source: 'preview' };
    if (_checkAdminActive()) return { mode: 'premium', source: 'admin' };
    if (_checkAccessCode()) return { mode: 'premium', source: 'access_code' };
    return { mode: 'free', source: null };
  }

  const _initial = _computeInitialState();

  window.APP_ACCESS = {
    mode: _initial.mode,
    lockedSymbol: DEFAULT_SYMBOL,
    source: 'direct',
    // Premium kaynağı (debug için): 'admin' | 'preview' | 'access_code' | 'auth' | null
    premiumSource: _initial.source,

    isPremium() {
      return this.mode === 'premium';
    },

    canAccessSymbol(sym) {
      if (this.isPremium()) return true;
      if (!sym) return false;
      const normalized = String(sym).toUpperCase();
      return normalized === this.lockedSymbol;
    },

    // ── Merkezi state-resolver ─────────────────────────────────────
    // Tüm premium kaynaklarını tarar, mode'u günceller, event yayınlar.
    // Öncelik sırası: preview > admin > access_code
    // Not: 'manual' source ile setPremium yapılmışsa bu override'a dokunmaz
    //       (debug/test amaçlı manuel premium kalıcı kalır)
    refreshAccessState() {
      // Manuel override koruması
      if (this.premiumSource === 'manual') {
        if (window.VDPremiumDebug) {
          console.debug('[AccessControl] refreshAccessState: manual override active, skipping');
        }
        return false;
      }

      const next = _computeInitialState();
      const changed = (this.mode !== next.mode) || (this.premiumSource !== next.source);
      if (!changed) return false;

      const prevMode = this.mode;
      this.mode = next.mode;
      this.premiumSource = next.source;

      try {
        window.dispatchEvent(new CustomEvent('vd:access:changed', {
          detail: { mode: next.mode, source: next.source, prevMode: prevMode }
        }));
      } catch (e) {}

      if (window.VDPremiumDebug) {
        console.debug('[AccessControl] refreshAccessState:', prevMode, '→', next.mode, '(', next.source, ')');
      }
      return true;
    },

    // Premium mode'a geç (debug veya gelecek auth için)
    setPremium(source) {
      this.mode = 'premium';
      this.premiumSource = source || 'manual';
      try {
        window.dispatchEvent(new CustomEvent('vd:access:changed', {
          detail: { mode: 'premium', source: this.premiumSource }
        }));
      } catch (e) {}
    },

    setFree() {
      this.mode = 'free';
      this.premiumSource = null;
      try {
        window.dispatchEvent(new CustomEvent('vd:access:changed', {
          detail: { mode: 'free' }
        }));
      } catch (e) {}
    },

    // Login akışı manuel çağırabilir (Supabase login sonrası ileride entegre edilebilir)
    notifyAccessCodeLogin() {
      return this.refreshAccessState();
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

  // ── Admin mode değişikliği dinle (otomatik premium toggle) ───────
  function _setupAdminListener() {
    window.addEventListener('vd:telegram:admin', function() {
      // Merkezi resolver ile tüm kaynakları yeniden değerlendir
      window.APP_ACCESS.refreshAccessState();
    });
    _debug('admin listener attached');
  }

  // ── localStorage değişiklik dinle (cross-tab + same-tab cover) ──
  // 'storage' event sadece DİĞER tab'lardaki değişiklikleri yakalar.
  // Same-tab değişiklikleri polling ile yakalanır.
  function _setupStorageListener() {
    window.addEventListener('storage', function(e) {
      if (!e || !e.key) return;
      // Sadece access ile ilgili anahtarlar
      if (e.key === 'aap_access_v1' || e.key === 'vd_premium_preview') {
        window.APP_ACCESS.refreshAccessState();
        _debug('storage event:', e.key);
      }
    });
    _debug('storage listener attached');
  }

  // ── İlk 10 saniye polling — login akışı async olabilir ──────────
  // Mevcut Supabase login akışı `aap_access_v1`'i set ettikten sonra
  // sayfayı reload edebilir veya etmeyebilir. Polling ile yakalarız.
  // Premium aktive olunca polling erken durur.
  function _startInitialPolling() {
    let ticks = 0;
    const MAX_TICKS = 10;
    const INTERVAL = 1000;

    const id = setInterval(() => {
      ticks++;
      const changed = window.APP_ACCESS.refreshAccessState();
      // Premium aktif oldu veya max'a ulaştık → durdur
      if (ticks >= MAX_TICKS || window.APP_ACCESS.isPremium()) {
        clearInterval(id);
        _debug('polling stopped:', { ticks, premium: window.APP_ACCESS.isPremium() });
      }
    }, INTERVAL);
  }

  // ── İlk yüklemede admin state'i doğrula (timing güvencesi) ───────
  // access-control.js, telegram-ui scripts'ten önce yüklenebilir.
  // Birkaç gecikmeli kontrol ile admin state'i yakala.
  function _verifyInitialAdminState(attempts) {
    attempts = attempts || 0;
    if (attempts > 20) return; // ~3sn sonra vazgeç

    window.APP_ACCESS.refreshAccessState();

    // Telegram scripts yüklenmediyse beklemeye devam
    if (!window.TelegramUI?.AdminMode && !window.TelegramDispatcher) {
      setTimeout(() => _verifyInitialAdminState(attempts + 1), 150);
    }
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    _debug('init', {
      mode: window.APP_ACCESS.mode,
      locked: window.APP_ACCESS.lockedSymbol,
      premiumSource: window.APP_ACCESS.premiumSource,
    });
    _wrapOpenCoin();
    _interceptSignalGrids();
    _interceptSymInput();
    _setupAdminListener();
    _setupStorageListener();
    _verifyInitialAdminState();
    _startInitialPolling();
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
