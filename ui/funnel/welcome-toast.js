// ════════════════════════════════════════════════════════════════════
// WELCOME TOAST (Mini-Aşama B.2)
// Telegram referrer ile gelen kullanıcıyı karşılayan sağ üst toast.
// Cyan border ile mevcut Telegram toast'tan ayrı stil.
//
// Public API:
//   VDWelcomeToast.show({ symbol, source, duration })
//   VDWelcomeToast.hide()
//
// Güvenlik: textContent kullanılır, innerHTML YOK (XSS koruması).
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const TOAST_ID = 'vd-welcome-toast';
  const DEFAULT_DURATION = 4500;

  let _hideTimer = null;
  let _removeTimer = null;

  function _normalizeSymForDisplay(sym) {
    if (!sym) return '';
    const s = String(sym).toUpperCase().trim();
    // BTCUSDT → BTC (display için sadece base)
    if (s.endsWith('USDT')) return s.slice(0, -4);
    if (s.endsWith('USDC')) return s.slice(0, -4);
    if (s.endsWith('BUSD')) return s.slice(0, -4);
    return s;
  }

  function _build({ symbol, source }) {
    const symBase = _normalizeSymForDisplay(symbol);
    const sourceLabel = source === 'telegram' || source === 'tg' ? "Telegram'dan" : '';

    const wrap = document.createElement('div');
    wrap.id = TOAST_ID;
    wrap.className = 'vd-welcome-toast';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');

    // ── Title (textContent, XSS koruması) ──
    const titleEl = document.createElement('div');
    titleEl.className = 'vd-welcome-toast-title';
    // İkonu safe HTML olarak ayrı span'de tut, sembol için textContent
    const titleIcon = document.createElement('span');
    titleIcon.textContent = '📊';
    const titleText = document.createElement('span');
    titleText.textContent = sourceLabel ? `${sourceLabel} hoş geldiniz` : 'Hoş geldiniz';
    titleEl.appendChild(titleIcon);
    titleEl.appendChild(titleText);

    // ── Body (textContent — XSS-safe) ──
    const bodyEl = document.createElement('div');
    bodyEl.className = 'vd-welcome-toast-body';
    if (symBase) {
      bodyEl.textContent = `${symBase} analizi yüklendi · İncelemeye başlayın`;
    } else {
      bodyEl.textContent = 'Analiz platformu yüklendi';
    }

    // ── Close button ──
    const closeBtn = document.createElement('button');
    closeBtn.className = 'vd-welcome-toast-close';
    closeBtn.setAttribute('aria-label', 'Kapat');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hide();
    });

    wrap.appendChild(titleEl);
    wrap.appendChild(bodyEl);
    wrap.appendChild(closeBtn);

    // Toast'a tıklanırsa da kapansın
    wrap.addEventListener('click', () => hide());

    return wrap;
  }

  function show(opts) {
    opts = opts || {};
    // Mevcut toast varsa önce temizle
    hide(true);

    const toast = _build({
      symbol: opts.symbol || '',
      source: opts.source || 'telegram',
    });
    document.body.appendChild(toast);

    // Çift RAF — slide-in animasyon tetiklensin
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('vd-welcome-toast-visible'));
    });

    // Otomatik kapanma
    const duration = +opts.duration || DEFAULT_DURATION;
    _hideTimer = setTimeout(hide, duration);
  }

  function hide(immediate) {
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    if (_removeTimer) { clearTimeout(_removeTimer); _removeTimer = null; }

    const toast = document.getElementById(TOAST_ID);
    if (!toast) return;

    if (immediate) {
      toast.remove();
      return;
    }

    toast.classList.add('vd-welcome-toast-hide');
    _removeTimer = setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 280);
  }

  window.VDWelcomeToast = { show, hide };
})();
