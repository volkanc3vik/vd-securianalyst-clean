// ════════════════════════════════════════════════════════════════════
// TELEGRAM UI · ADMIN MODE
// Sağ üst köşede "🔒 Admin" butonu, inline popup ile key girişi.
//
// Davranış:
//   - Tıklayınca buton altında küçük popup açılır (modal değil)
//   - Key girilir → TelegramDispatcher.setAdminKey(key) → admin aktif
//   - Buton 🔒 → 🔓 değişir (yeşil ton)
//   - Yeniden tıklayınca "çıkış" seçeneği görünür → clearAdminKey()
//   - Session-only: F5'te uçar (TelegramDispatcher session-only)
//   - localStorage/sessionStorage YOK
//
// State değişimleri 'vd:telegram:admin' custom event ile yayınlanır,
// telegram-button.js bunu dinler ve butonları enjekte eder/kaldırır.
//
// Namespace: window.TelegramUI.AdminMode
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  window.TelegramUI = window.TelegramUI || {};
  const NS = window.TelegramUI;

  const BTN_ID    = 'vd-tg-admin-btn';
  const POPUP_ID  = 'vd-tg-admin-popup';
  let _active = false;
  let _mounted = false;
  let _popupOpen = false;
  // Cleanup için event removal helper'ları
  let _outsideClickHandler = null;
  let _escHandler = null;

  function _debug(...args) {
    if (NS.debug) console.debug('[TG-UI:Admin]', ...args);
  }

  function isActive() {
    return _active;
  }

  function _emit() {
    try {
      window.dispatchEvent(new CustomEvent('vd:telegram:admin', {
        detail: { active: _active }
      }));
    } catch (e) { /* yut */ }
  }

  // ── Buton mount ─────────────────────────────────────────────────
  function _mount() {
    if (_mounted) return;
    // Header'da uygun bir noktayı bul, yoksa body'ye sabit pozisyon
    const host = _findHost();
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.className = 'vd-tg-admin-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Admin modu');
    btn.innerHTML = `
      <span class="vd-tg-admin-btn-ico">🔒</span>
      <span class="vd-tg-admin-btn-label">Admin</span>
    `;
    btn.addEventListener('click', _togglePopup);
    host.appendChild(btn);
    _mounted = true;
    _debug('mounted on', host.tagName, host.id || host.className);
  }

  function _findHost() {
    // Mevcut header / topbar varsa oraya ekle
    const candidates = [
      '#topbar', '#header', '.topbar', '.header',
      '#nav', '.nav', '.app-header'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    // Yoksa body'ye fixed-pozisyonlu wrapper
    let wrap = document.getElementById('vd-tg-admin-host');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'vd-tg-admin-host';
      wrap.className = 'vd-tg-admin-host-fixed';
      document.body.appendChild(wrap);
    }
    return wrap;
  }

  // ── Popup ───────────────────────────────────────────────────────
  function _togglePopup() {
    if (_popupOpen) _closePopup();
    else _openPopup();
  }

  function _openPopup() {
    _closePopup(); // her ihtimale karşı temizle

    const btn = document.getElementById(BTN_ID);
    if (!btn) return;

    const popup = document.createElement('div');
    popup.id = POPUP_ID;
    popup.className = 'vd-tg-admin-popup';
    popup.setAttribute('role', 'dialog');

    if (_active) {
      // Çıkış modu
      popup.innerHTML = `
        <div class="vd-tg-admin-popup-title">Admin modu aktif</div>
        <div class="vd-tg-admin-popup-info">Telegram gönderimi açık.</div>
        <div class="vd-tg-admin-popup-actions">
          <button class="vd-tg-admin-popup-btn-secondary" data-action="cancel">Kapat</button>
          <button class="vd-tg-admin-popup-btn-danger" data-action="logout">Çıkış</button>
        </div>
      `;
    } else {
      // Giriş modu
      popup.innerHTML = `
        <div class="vd-tg-admin-popup-title">Admin kodu</div>
        <input type="password" class="vd-tg-admin-popup-input" placeholder="••••••••"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
        <div class="vd-tg-admin-popup-actions">
          <button class="vd-tg-admin-popup-btn-secondary" data-action="cancel">Vazgeç</button>
          <button class="vd-tg-admin-popup-btn-primary" data-action="submit">Giriş</button>
        </div>
      `;
    }

    btn.parentElement.appendChild(popup);
    // Popup pozisyonu — butonun altına
    _positionPopup(popup, btn);
    _popupOpen = true;

    // Action handlers
    popup.addEventListener('click', _onPopupClick);

    // Input enter ile submit
    const input = popup.querySelector('.vd-tg-admin-popup-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          _submitKey();
        }
      });
      setTimeout(() => input.focus(), 30);
    }

    // Outside click → kapat (capture phase)
    _outsideClickHandler = (e) => {
      if (popup.contains(e.target) || btn.contains(e.target)) return;
      _closePopup();
    };
    document.addEventListener('click', _outsideClickHandler, true);

    // ESC ile kapat
    _escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        _closePopup();
      }
    };
    document.addEventListener('keydown', _escHandler);

    _debug('popup opened, active=', _active);
  }

  function _positionPopup(popup, btn) {
    // Default: butonun altına yerleştir. Ekran dışına taşarsa CSS hallediyor (right:0)
    const r = btn.getBoundingClientRect();
    popup.style.top = (btn.offsetHeight + 6) + 'px';
    popup.style.right = '0px';
  }

  function _onPopupClick(e) {
    const action = e.target.dataset?.action;
    if (!action) return;
    e.preventDefault();
    if (action === 'cancel') _closePopup();
    else if (action === 'submit') _submitKey();
    else if (action === 'logout') _logout();
  }

  function _submitKey() {
    const popup = document.getElementById(POPUP_ID);
    if (!popup) return;
    const input = popup.querySelector('.vd-tg-admin-popup-input');
    if (!input) return;
    const key = input.value.trim();
    if (!key) {
      input.classList.add('vd-tg-admin-popup-input-error');
      setTimeout(() => input.classList.remove('vd-tg-admin-popup-input-error'), 600);
      return;
    }
    // Dispatcher'a set et
    if (!window.TelegramDispatcher || typeof window.TelegramDispatcher.setAdminKey !== 'function') {
      _closePopup();
      NS.Toast?.error('Sistem hatası: dispatcher yok');
      return;
    }
    const ok = window.TelegramDispatcher.setAdminKey(key);
    if (!ok) {
      input.classList.add('vd-tg-admin-popup-input-error');
      setTimeout(() => input.classList.remove('vd-tg-admin-popup-input-error'), 600);
      return;
    }
    _active = true;
    _updateButton();
    _closePopup();
    NS.Toast?.success('Admin modu aktif');
    _emit();
    _debug('admin activated');
  }

  function _logout() {
    if (window.TelegramDispatcher?.clearAdminKey) {
      window.TelegramDispatcher.clearAdminKey();
    }
    _active = false;
    _updateButton();
    _closePopup();
    NS.Toast?.info('Admin modu kapatıldı');
    _emit();
    _debug('admin deactivated');
  }

  function _closePopup() {
    const popup = document.getElementById(POPUP_ID);
    if (popup) {
      popup.removeEventListener('click', _onPopupClick);
      popup.remove();
    }
    if (_outsideClickHandler) {
      document.removeEventListener('click', _outsideClickHandler, true);
      _outsideClickHandler = null;
    }
    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler);
      _escHandler = null;
    }
    _popupOpen = false;
  }

  function _updateButton() {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const ico = btn.querySelector('.vd-tg-admin-btn-ico');
    if (ico) ico.textContent = _active ? '🔓' : '🔒';
    btn.classList.toggle('active', _active);
  }

  // ── Init ────────────────────────────────────────────────────────
  function init() {
    if (_mounted) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _mount, { once: true });
    } else {
      _mount();
    }
  }

  window.TelegramUI.AdminMode = { init, isActive };
})();
