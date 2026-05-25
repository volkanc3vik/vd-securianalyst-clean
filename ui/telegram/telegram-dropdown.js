// ════════════════════════════════════════════════════════════════════
// TELEGRAM UI · DROPDOWN
// Kanal seçim mini menü: Free / VIP / İptal
//
// Davranış:
//   - Butonun altında açılır
//   - Aşağıda yer yoksa otomatik üste flip eder
//   - Outside click ile kapanır
//   - ESC ile kapanır
//   - Seçim yapılınca TelegramController.sendCardSignal çağırılır
//   - Loading state buton üzerinde gösterilir
//   - Sonuç toast'la bildirilir
//
// Namespace: window.TelegramUI.Dropdown
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  window.TelegramUI = window.TelegramUI || {};
  const NS = window.TelegramUI;

  const DD_ID = 'vd-tg-dropdown';
  let _outsideClickHandler = null;
  let _escHandler = null;
  let _activeButton = null;

  function _debug(...args) {
    if (NS.debug) console.debug('[TG-UI:Dropdown]', ...args);
  }

  function open(buttonEl, sym, dir) {
    close(); // var olan'ı kapat

    if (!buttonEl) return;

    const dd = document.createElement('div');
    dd.id = DD_ID;
    dd.className = 'vd-tg-dropdown';
    dd.setAttribute('role', 'menu');

    // Cooldown durumu kontrol et (artık sadece free kanal var, ama backend
    // 'vip' channel kabul ediyor — bu yüzden cooldown state'i koruyoruz)
    const Dispatcher = window.TelegramDispatcher;
    const onCooldown = Dispatcher?.isOnCooldown?.(sym, dir, 'free') || false;
    const remainMin  = onCooldown ? Math.ceil(Dispatcher.getCooldownRemaining(sym, dir, 'free') / 60) : 0;

    dd.innerHTML = `
      <div class="vd-tg-dd-header">${_esc(sym)} · ${_esc(dir)}</div>
      <button class="vd-tg-dd-item" data-channel="free" ${onCooldown ? 'disabled' : ''}
              title="${onCooldown ? remainMin + ' dk kaldı' : 'Telegram\'da paylaş'}">
        <span class="vd-tg-dd-ico">📢</span>
        <span class="vd-tg-dd-label">Telegram'da Paylaş</span>
        ${onCooldown ? `<span class="vd-tg-dd-cd">${remainMin}dk</span>` : ''}
      </button>
      <div class="vd-tg-dd-divider"></div>
      <button class="vd-tg-dd-item vd-tg-dd-cancel" data-channel="cancel">
        <span class="vd-tg-dd-ico">✕</span>
        <span class="vd-tg-dd-label">İptal</span>
      </button>
    `;

    document.body.appendChild(dd);
    _positionDropdown(dd, buttonEl);
    _activeButton = buttonEl;

    // Item click handler
    dd.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-channel]');
      if (!btn || btn.disabled) return;
      const channel = btn.dataset.channel;
      if (channel === 'cancel') {
        close();
        return;
      }
      _send(sym, dir, channel);
    });

    // Outside click
    _outsideClickHandler = (e) => {
      if (dd.contains(e.target) || buttonEl.contains(e.target)) return;
      close();
    };
    document.addEventListener('click', _outsideClickHandler, true);

    // ESC
    _escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', _escHandler);

    _debug('opened', sym, dir);
  }

  function close() {
    const dd = document.getElementById(DD_ID);
    if (dd) dd.remove();
    if (_outsideClickHandler) {
      document.removeEventListener('click', _outsideClickHandler, true);
      _outsideClickHandler = null;
    }
    if (_escHandler) {
      document.removeEventListener('keydown', _escHandler);
      _escHandler = null;
    }
    _activeButton = null;
  }

  // ── Pozisyon: butonun altı, taşıyorsa üste flip ────────────────
  function _positionDropdown(dd, btn) {
    const r = btn.getBoundingClientRect();
    const ddH = dd.offsetHeight || 180;  // tahmini
    const ddW = dd.offsetWidth  || 200;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;

    // Vertical: aşağıda yer var mı?
    const spaceBelow = viewportH - r.bottom;
    const spaceAbove = r.top;
    const placeBelow = spaceBelow >= ddH || spaceBelow >= spaceAbove;

    let top = placeBelow ? (r.bottom + 6) : (r.top - ddH - 6);
    top = Math.max(8, Math.min(viewportH - ddH - 8, top));

    // Horizontal: butonun soluna hizala, ama ekran sağına taşmasın
    let left = r.left;
    if (left + ddW > viewportW - 8) {
      left = viewportW - ddW - 8;
    }
    left = Math.max(8, left);

    dd.style.position = 'fixed';
    dd.style.top = top + 'px';
    dd.style.left = left + 'px';
  }

  // ── Gönderim ────────────────────────────────────────────────────
  async function _send(sym, dir, channel) {
    close();

    const Controller = window.TelegramController;
    if (!Controller || typeof Controller.sendCardSignal !== 'function') {
      NS.Toast?.error('Controller yüklenmedi');
      return;
    }

    // Buton üzerinde loading state
    let btn = _findCardButton(sym, dir);
    let originalHTML = null;
    if (btn) {
      originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="vd-tg-card-btn-ico">⏳</span><span class="vd-tg-card-btn-label">Yayınlanıyor...</span>`;
    }

    try {
      const result = await Controller.sendCardSignal(sym, dir, channel);

      if (result?.ok) {
        const symBase = sym.replace(/USDT$/, '');
        NS.Toast?.success(`${symBase} analizi Telegram'da yayınlandı`);
        _debug('published', sym, dir, channel, 'msgId=', result.messageId);
      } else if (result?.error === 'on_cooldown') {
        const remainMin = result.cooldownRemaining ? Math.ceil(result.cooldownRemaining / 60) : '?';
        NS.Toast?.warning(`Bekleme süresi aktif — kalan: ${remainMin} dk`);
      } else {
        const userMsg = NS.errorMessage?.(result?.error) || 'Yayınlanamadı';
        const detail = result?.detail ? ` (${result.detail})` : '';
        NS.Toast?.error(`Yayınlanamadı: ${userMsg}${detail}`);
        _debug('publish failed', result);
      }
    } catch (e) {
      NS.Toast?.error('Beklenmedik hata');
      _debug('exception', e);
    } finally {
      // Loading state'i kaldır
      if (btn && originalHTML !== null) {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
      }
    }
  }

  function _findCardButton(sym, dir) {
    return document.querySelector(`.vd-tg-card-btn[data-sym="${sym}"][data-dir="${dir}"]`);
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.TelegramUI.Dropdown = { open, close };
})();
