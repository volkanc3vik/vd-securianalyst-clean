// ════════════════════════════════════════════════════════════════════
// FUTURES PANEL — Ana container
// "+ Manuel İşlem Aç" butonu, aktif pozisyon kart listesi, sayaç.
// Render strateji: state değişiminde full re-render; her saniye sadece
// duration tick. PNL/mark price değişiminde RAF ile throttled tam render.
// ════════════════════════════════════════════════════════════════════
window.FuturesPanel = (() => {
  'use strict';

  let _mount = null;
  let _unsubState = null;
  let _durationTimer = null;
  let _renderScheduled = false;
  let _hitListenerAttached = false;

  // ── DOM ────────────────────────────────────────────────────────────
  function _buildShell() {
    if (!_mount) return;
    _mount.innerHTML = `
      <div class="fp-container">
        <div class="fp-header">
          <span class="fp-title">📊 FUTURES İŞLEM TAKİBİ</span>
          <span class="fp-count zero" id="fpCount">0 AKTİF</span>
          <span class="fp-balance">Bakiye: <b id="fpBalance">$0.00</b></span>
          <button class="fp-btn-open" id="fpOpenBtn">+ Manuel İşlem Aç</button>
        </div>
        <div id="fpList"></div>
      </div>
    `;
    _mount.querySelector('#fpOpenBtn').addEventListener('click', () => {
      window.FuturesModal.open({});
    });
  }

  // ── Render ────────────────────────────────────────────────────────
  function _render() {
    _renderScheduled = false;
    if (!_mount) return;

    const FS = window.FuturesState;
    const positions = FS.getActivePositions();
    const balance   = FS.getBalance();

    // Bakiye + sayaç
    const countEl   = _mount.querySelector('#fpCount');
    const balanceEl = _mount.querySelector('#fpBalance');
    if (countEl) {
      countEl.textContent = positions.length + ' AKTİF';
      countEl.classList.toggle('zero', positions.length === 0);
    }
    if (balanceEl) {
      balanceEl.textContent = '$' + balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Liste
    const list = _mount.querySelector('#fpList');
    if (!list) return;

    if (positions.length === 0) {
      list.innerHTML = `
        <div class="fp-empty">
          <div class="fp-empty-icon">📊</div>
          <div class="fp-empty-title">Aktif işlem yok</div>
          <div class="fp-empty-sub">Yukarıdaki <b style="color:var(--cyan)">+ Manuel İşlem Aç</b> butonuna veya sinyal kartındaki <b style="color:var(--cyan)">⚡ İşlem Aç</b> butonuna bas.</div>
        </div>
      `;
      return;
    }

    list.innerHTML = positions.map(p => window.FuturesCard.render(p)).join('');

    // Kapat butonlarına listener bağla
    list.querySelectorAll('[data-close-id]').forEach(btn => {
      btn.addEventListener('click', () => _onCloseClick(btn.dataset.closeId));
    });
  }

  function _scheduleRender() {
    if (_renderScheduled) return;
    _renderScheduled = true;
    requestAnimationFrame(_render);
  }

  function _onCloseClick(id) {
    const p = window.FuturesState.getPositionById(id);
    if (!p) return;
    const pnlStr = (p.pnl >= 0 ? '+' : '') + (+p.pnl || 0).toFixed(2);
    if (!confirm(`${p.sym} ${p.dir} işlemini kapatmak istiyor musun?\nGüncel PNL: $${pnlStr}`)) return;
    window.FuturesController.closePosition(id, p.markPrice, 'MANUAL');
  }

  // ── State değişikliklerini dinle ──────────────────────────────────
  function _onStateChange(eventName, payload) {
    // Pozisyon ekleme/kapatma → full render
    // Pozisyon güncelleme (tick) → throttled render
    if (eventName === 'position:updated') {
      _scheduleRender();
    } else {
      _render();
    }
  }

  // ── Hit event'leri (TP/SL) — kart pulse + toast ───────────────────
  function _onHitEvent(e) {
    const { id, level } = e.detail || {};
    if (!id || !_mount) return;
    const card = _mount.querySelector(`.fp-card[data-id="${id}"]`);
    if (!card) return;

    // Geçici pulse (CSS keyframe zaten level marker'da var; karta da glow)
    card.style.transition = 'box-shadow .4s';
    const isStop = level === 'SL';
    card.style.boxShadow = isStop
      ? '0 0 30px rgba(255, 61, 107, .6)'
      : '0 0 30px rgba(0, 229, 160, .6)';
    setTimeout(() => { card.style.boxShadow = ''; }, 1500);
  }

  // ── Init / Bağlantı ───────────────────────────────────────────────
  function mount(selector) {
    _mount = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!_mount) {
      console.warn('[FuturesPanel] Mount node bulunamadı:', selector);
      return false;
    }

    _buildShell();
    _render();

    // State değişikliklerini dinle
    if (_unsubState) _unsubState();
    _unsubState = window.FuturesState.subscribe(_onStateChange);

    // Duration tick (her saniye, sadece label güncelle)
    if (_durationTimer) clearInterval(_durationTimer);
    _durationTimer = setInterval(() => {
      if (!_mount) return;
      const list = _mount.querySelector('#fpList');
      if (list) window.FuturesCard.tickDuration(list);
    }, 1000);

    // Hit event listener (tek seferlik)
    if (!_hitListenerAttached) {
      document.addEventListener('futures:hit', _onHitEvent);
      _hitListenerAttached = true;
    }

    return true;
  }

  function unmount() {
    if (_unsubState) { _unsubState(); _unsubState = null; }
    if (_durationTimer) { clearInterval(_durationTimer); _durationTimer = null; }
    if (_hitListenerAttached) {
      document.removeEventListener('futures:hit', _onHitEvent);
      _hitListenerAttached = false;
    }
    if (_mount) _mount.innerHTML = '';
    _mount = null;
  }

  // ── Public API — geriye uyumluluk için openModal direkt expose ────
  /**
   * Sinyal kartından çağrılan giriş noktası.
   * app.js:805 → FuturesPanel.openModal({...})
   */
  function openModal(prefill) {
    if (typeof window.FuturesModal === 'undefined') {
      console.warn('[FuturesPanel] FuturesModal henüz yüklenmedi.');
      return;
    }
    window.FuturesModal.open(prefill || {});
  }

  return { mount, unmount, openModal, render: _render };
})();
