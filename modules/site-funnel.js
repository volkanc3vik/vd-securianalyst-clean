// ════════════════════════════════════════════════════════════════════
// SITE FUNNEL (Mini-Aşama B.2)
//
// Telegram'dan gelen kullanıcı için URL parametresi yorumlaması:
//   ?sym=BTC[USDT]   → openCoin ile coin değişimi
//   ?ref=tg          → "Telegram'dan hoş geldiniz" toast
//   ?utm_source=...  → analytics (localStorage)
//
// Güvenlik:
//   - URL params KESİN regex validation
//   - textContent ile DOM'a basılır (XSS koruması)
//   - history.replaceState ile URL temizlenir
//
// Public API:
//   VDSiteFunnel.init()
//   VDSiteFunnel.getReferrer()
//   VDSiteFunnel.getInitialSymbol()
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  let _initialSymbol = null;
  let _referrer = null;
  let _utmSource = null;
  let _initialized = false;

  function _debug(...args) {
    if (window.VDFunnelDebug) console.debug('[Funnel]', ...args);
  }

  // ── KESIN VALIDATION ─────────────────────────────────────────────
  // sym: 2-12 karakter, sadece harf+rakam, opsiyonel USDT/USDC/BUSD suffix
  function _isValidRawSymbol(s) {
    if (!s || typeof s !== 'string') return false;
    return /^[A-Za-z0-9]{2,12}$/.test(s);
  }

  function _normalizeSymbol(raw) {
    if (!_isValidRawSymbol(raw)) return null;
    const s = String(raw).toUpperCase().trim();
    if (s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('BUSD')) {
      return s;
    }
    return s + 'USDT';
  }

  // ref: sadece 2-12 karakter, harf
  function _isValidRef(s) {
    if (!s || typeof s !== 'string') return false;
    return /^[a-z]{2,12}$/.test(s);
  }

  // utm_source: sadece harf, rakam, alt çizgi, tire
  function _isValidUtm(s) {
    if (!s || typeof s !== 'string') return false;
    return /^[a-zA-Z0-9_\-]{2,30}$/.test(s);
  }

  // ── URL Parse ────────────────────────────────────────────────────
  function _parseParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const symRaw = params.get('sym');
      const refRaw = params.get('ref');
      const utmRaw = params.get('utm_source');

      const sym = symRaw ? _normalizeSymbol(symRaw) : null;
      const ref = (refRaw && _isValidRef(refRaw)) ? refRaw.toLowerCase() : null;
      const utm = (utmRaw && _isValidUtm(utmRaw)) ? utmRaw : null;

      return { sym, ref, utm, hasParams: !!(symRaw || refRaw || utmRaw) };
    } catch (e) {
      _debug('parse error:', e);
      return { sym: null, ref: null, utm: null, hasParams: false };
    }
  }

  // ── Sembol değişimi (mevcut openCoin'i kullan) ───────────────────
  function _applySymbol(sym) {
    if (!sym) return false;
    // openCoin tanımlı mı bekle — retry mekanizması
    const tryApply = (attempt) => {
      if (typeof window.openCoin === 'function') {
        try {
          _debug('applying symbol via openCoin:', sym);
          window.openCoin(sym);
        } catch (err) {
          _debug('openCoin error:', err);
        }
        return;
      }
      // Fallback: loadCoin
      if (typeof window.loadCoin === 'function') {
        try {
          _debug('applying symbol via loadCoin (openCoin yok):', sym);
          window.SYM = sym;
          const input = document.getElementById('symInput');
          if (input) input.value = sym;
          window.loadCoin(sym, window.INTV || '15m');
        } catch (err) {
          _debug('loadCoin error:', err);
        }
        return;
      }
      // Henüz hazır değil — birkaç kez dene
      if (attempt < 5) {
        setTimeout(() => tryApply(attempt + 1), 300);
      } else {
        _debug('giveup: openCoin/loadCoin not found after retries');
      }
    };
    tryApply(0);
    return true;
  }

  // ── URL temizleme ────────────────────────────────────────────────
  function _cleanUrl() {
    try {
      if (window.history && window.history.replaceState) {
        const clean = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, clean);
        _debug('URL cleaned');
      }
    } catch (e) {
      _debug('cleanUrl error:', e);
    }
  }

  // ── Welcome toast ────────────────────────────────────────────────
  function _showWelcomeToast(sym) {
    if (!window.VDWelcomeToast?.show) {
      _debug('VDWelcomeToast not available');
      return;
    }
    // loadCoin tamamlansın → 1.5sn bekle
    setTimeout(() => {
      try {
        window.VDWelcomeToast.show({
          symbol: sym || '',
          source: 'telegram',
          duration: 5000,
        });
      } catch (e) {
        _debug('toast show error:', e);
      }
    }, 1500);
  }

  // ── Analytics persist ────────────────────────────────────────────
  function _persistReferrer(ref, utm) {
    try {
      if (ref) {
        localStorage.setItem('vd_referrer', ref);
      }
      if (utm) {
        localStorage.setItem('vd_utm_source', utm);
      }
      localStorage.setItem('vd_first_visit_at', String(Date.now()));
    } catch (e) { /* localStorage devre dışı olabilir */ }
  }

  // ── Public init ──────────────────────────────────────────────────
  function init() {
    if (_initialized) return;
    _initialized = true;

    const { sym, ref, utm, hasParams } = _parseParams();
    _initialSymbol = sym;
    _referrer = ref;
    _utmSource = utm;

    // Premium gating — lockedSymbol set (her durumda)
    // URL'de sym varsa o, yoksa default BTCUSDT
    if (window.APP_ACCESS && window.APP_ACCESS.setLockedSymbol) {
      const lockSym = sym || 'BTCUSDT';
      const lockSource = (ref === 'tg' || ref === 'telegram') ? 'telegram' : 'direct';
      window.APP_ACCESS.setLockedSymbol(lockSym, lockSource);
      _debug('APP_ACCESS locked to:', lockSym, '(source:', lockSource, ')');
    }

    if (!hasParams) {
      _debug('no funnel params');
      return;
    }

    _debug('parsed:', { sym, ref, utm });

    // 1) Persist analytics
    if (ref || utm) {
      _persistReferrer(ref, utm);
    }

    // 2) Sembol değişimi (varsa)
    if (sym) {
      // 500ms bekle — index.html'deki DOMContentLoaded listener'ları çalışsın
      setTimeout(() => _applySymbol(sym), 500);
    }

    // 3) Hoş geldin toast (sadece ref=tg ise)
    if (ref === 'tg' || ref === 'telegram') {
      _showWelcomeToast(sym);
    }

    // 4) URL temizle (toast gösterimi sonrası)
    setTimeout(_cleanUrl, 2000);
  }

  function getReferrer() {
    if (_referrer) return _referrer;
    try {
      return localStorage.getItem('vd_referrer');
    } catch (e) {
      return null;
    }
  }

  function getInitialSymbol() {
    return _initialSymbol;
  }

  window.VDSiteFunnel = { init, getReferrer, getInitialSymbol };
})();
