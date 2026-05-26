// ════════════════════════════════════════════════════════════════════
// TI PANEL CLICK HANDLER (Mini-Aşama B.2)
//
// TI panel'inde .ti-best-sym ve .ti-watch-sym elementlerini
// tıklanabilir hale getirir. TI panel JS dosyalarına DOKUNMAZ —
// MutationObserver ile elementler eklendikçe listener bağlar.
//
// Tıklayınca:
//   - Sembol normalize edilir (USDT suffix ekle gerekirse)
//   - Geçerli sembol regex kontrolü
//   - Mevcut openCoin(sym) fonksiyonu çağrılır
//
// Idempotency: data-symbol-click-attached marker
//
// Public API:
//   VDTIClickHandler.mount()
//   VDTIClickHandler.unmount()
//   VDTIClickHandler.isAttached()
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const ATTACHED_MARKER = 'data-symbol-click-attached';
  const CLICKABLE_MARKER = 'data-clickable';
  const TARGET_SELECTOR = '.ti-best-sym, .ti-watch-sym';
  const CONTAINER_ID = 'tiPanelMount';

  let _observer = null;
  let _mounted = false;
  let _rafScheduled = false;

  function _debug(...args) {
    if (window.VDFunnelDebug) console.debug('[TI-Click]', ...args);
  }

  // ── Sembol normalize + validate ───────────────────────────────────
  function _normalizeSymbol(raw) {
    if (!raw) return null;
    const s = String(raw).toUpperCase().trim();
    // Sadece harf/rakam, max 12 karakter (BTCUSDT 7 karakter)
    if (!/^[A-Z0-9]{2,12}$/.test(s)) return null;
    // USDT suffix yoksa ekle
    if (s.endsWith('USDT') || s.endsWith('USDC') || s.endsWith('BUSD')) {
      return s;
    }
    return s + 'USDT';
  }

  // KESIN VALIDATION: openCoin'e gönderilecek son sembol
  function _isValidFinalSymbol(sym) {
    if (!sym) return false;
    return /^[A-Z0-9]{2,8}(USDT|USDC|BUSD)$/.test(sym);
  }

  // ── Click handler ────────────────────────────────────────────────
  function _onSymbolClick(e) {
    const el = e.currentTarget;
    if (!el) return;

    // Sembol metni — textContent kullan (XSS güvenli)
    const rawText = (el.textContent || '').trim();
    const sym = _normalizeSymbol(rawText);

    if (!_isValidFinalSymbol(sym)) {
      _debug('invalid symbol:', rawText);
      return;
    }

    // Mevcut openCoin fonksiyonu varsa onu kullan (en güvenli yol)
    if (typeof window.openCoin === 'function') {
      _debug('click → openCoin:', sym);
      try {
        window.openCoin(sym);
      } catch (err) {
        _debug('openCoin error:', err);
      }
      return;
    }

    // Fallback: manuel sembol değişimi (eğer openCoin yoksa)
    _debug('click → manual (openCoin yok):', sym);
    try {
      window.SYM = sym;
      const input = document.getElementById('symInput');
      if (input) input.value = sym;
      if (typeof window.loadCoin === 'function') {
        window.loadCoin(sym, window.INTV || '15m');
      }
      setTimeout(() => {
        const el = document.getElementById('mainPanel');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err) {
      _debug('manual fallback error:', err);
    }
  }

  // ── Element işle (idempotent) ─────────────────────────────────────
  function _processElement(el) {
    if (!el || el.getAttribute(ATTACHED_MARKER) === 'true') return;

    // İçeriği bir sembol mü? — değilse geç (gereksiz işlem)
    const txt = (el.textContent || '').trim();
    if (!txt || !_normalizeSymbol(txt)) return;

    el.setAttribute(ATTACHED_MARKER, 'true');
    el.setAttribute(CLICKABLE_MARKER, 'true');
    el.setAttribute('role', 'link');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${txt} analizine git`);
    el.setAttribute('title', `${txt} analizine git`);

    el.addEventListener('click', _onSymbolClick);
    // Keyboard accessibility
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        _onSymbolClick.call(el, { currentTarget: el });
      }
    });
  }

  // ── Tarama (scoped) ───────────────────────────────────────────────
  function _scanAndAttach(root) {
    const scope = root || document.getElementById(CONTAINER_ID) || document.body;
    if (!scope) return;
    const elements = scope.querySelectorAll(TARGET_SELECTOR);
    let attached = 0;
    elements.forEach(el => {
      if (el.getAttribute(ATTACHED_MARKER) !== 'true') {
        _processElement(el);
        attached++;
      }
    });
    if (attached > 0) _debug(`${attached} element attached`);
  }

  // ── MutationObserver callback (RAF batched) ──────────────────────
  function _onMutation() {
    if (_rafScheduled) return;
    _rafScheduled = true;
    requestAnimationFrame(() => {
      _rafScheduled = false;
      _scanAndAttach();
    });
  }

  // ── Mount ─────────────────────────────────────────────────────────
  function mount() {
    if (_mounted) return;
    const container = document.getElementById(CONTAINER_ID);
    if (!container) {
      _debug('TI panel container not found, will retry on DOM ready');
      // TI panel henüz render edilmemiş olabilir, body'yi observe et
      // ve container ortaya çıkınca scan başlat
      _observer = new MutationObserver(_onMutation);
      _observer.observe(document.body, { childList: true, subtree: true });
      _mounted = true;
      _scanAndAttach(); // ilk tarama
      return;
    }

    _observer = new MutationObserver(_onMutation);
    _observer.observe(container, { childList: true, subtree: true });
    _mounted = true;
    _scanAndAttach(container);
    _debug('mounted on', CONTAINER_ID);
  }

  function unmount() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    // Marker'ları temizle
    document.querySelectorAll(`[${ATTACHED_MARKER}="true"]`).forEach(el => {
      el.removeAttribute(ATTACHED_MARKER);
      el.removeAttribute(CLICKABLE_MARKER);
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
      el.removeAttribute('aria-label');
      el.removeAttribute('title');
    });
    _mounted = false;
    _debug('unmounted');
  }

  function isAttached() {
    return _mounted;
  }

  window.VDTIClickHandler = { mount, unmount, isAttached };
})();
