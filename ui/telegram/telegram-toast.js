// ════════════════════════════════════════════════════════════════════
// TELEGRAM TOAST
// Sağ alt köşede minimal kurumsal bildirim sistemi.
// Namespace: window.TelegramUI.Toast
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  window.TelegramUI = window.TelegramUI || {};

  const CONTAINER_ID = 'vd-tg-toast-container';
  const DEFAULT_DURATION = 3500;

  function _container() {
    let c = document.getElementById(CONTAINER_ID);
    if (!c) {
      c = document.createElement('div');
      c.id = CONTAINER_ID;
      c.className = 'vd-tg-toast-stack';
      document.body.appendChild(c);
    }
    return c;
  }

  function _show(type, msg, opts = {}) {
    const c = _container();
    const t = document.createElement('div');
    t.className = `vd-tg-toast vd-tg-toast-${type}`;
    t.setAttribute('role', 'status');

    const icon = type === 'success' ? '✓'
               : type === 'error'   ? '✕'
               : type === 'warning' ? '⏱'
                                    : 'ℹ';

    t.innerHTML = `
      <span class="vd-tg-toast-ico">${icon}</span>
      <span class="vd-tg-toast-msg"></span>
    `;
    t.querySelector('.vd-tg-toast-msg').textContent = String(msg || '');

    const duration = Number.isFinite(+opts.duration) ? +opts.duration : DEFAULT_DURATION;
    let timer;
    const close = () => {
      if (t._closing) return;
      t._closing = true;
      clearTimeout(timer);
      t.classList.add('vd-tg-toast-out');
      setTimeout(() => t.remove(), 200);
    };
    t.addEventListener('click', close);
    timer = setTimeout(close, duration);

    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('vd-tg-toast-in'));
    return { close };
  }

  window.TelegramUI.Toast = {
    success: (msg, opts) => _show('success', msg, opts),
    error:   (msg, opts) => _show('error',   msg, opts),
    warning: (msg, opts) => _show('warning', msg, opts),
    info:    (msg, opts) => _show('info',    msg, opts),
  };
})();
