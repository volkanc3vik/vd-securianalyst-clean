// ════════════════════════════════════════════════════════════════════
// FUTURES PANEL — Ana container
// "+ Manuel Pozisyon Ekle" butonu, aktif pozisyon kart listesi, sayaç.
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
          <span class="fp-balance">
            Bakiye:
            <span class="fp-balance-view" id="fpBalanceView">
              <b id="fpBalance">$0.00</b>
              <button class="fp-balance-edit" id="fpBalanceEdit" title="Bakiyeyi düzenle" aria-label="Bakiyeyi düzenle">✎</button>
            </span>
            <span class="fp-balance-edit-wrap" id="fpBalanceEditWrap" style="display:none">
              <span class="fp-balance-prefix">$</span>
              <input type="number" inputmode="decimal" step="0.01" min="0" class="fp-balance-input" id="fpBalanceInput">
              <button class="fp-balance-ok" id="fpBalanceOk" title="Kaydet">✓</button>
              <button class="fp-balance-cancel" id="fpBalanceCancel" title="Vazgeç">×</button>
            </span>
          </span>
          <button class="fp-btn-open" id="fpOpenBtn">+ Manuel Pozisyon Ekle</button>
        </div>
        <div id="fpList"></div>
      </div>
    `;
    _mount.querySelector('#fpOpenBtn').addEventListener('click', () => {
      window.FuturesModal.open({});
    });

    // Bakiye edit handler'ları
    _wireBalanceEdit();
  }

  // ── Bakiye düzenleme (inline) ─────────────────────────────────────
  function _wireBalanceEdit() {
    const view       = _mount.querySelector('#fpBalanceView');
    const wrap       = _mount.querySelector('#fpBalanceEditWrap');
    const btnEdit    = _mount.querySelector('#fpBalanceEdit');
    const btnOk      = _mount.querySelector('#fpBalanceOk');
    const btnCancel  = _mount.querySelector('#fpBalanceCancel');
    const input      = _mount.querySelector('#fpBalanceInput');
    if (!view || !wrap || !btnEdit || !btnOk || !btnCancel || !input) return;

    function openEdit() {
      const cur = window.FuturesState.getBalance();
      input.value = (+cur).toFixed(2);
      view.style.display = 'none';
      wrap.style.display = 'inline-flex';
      // input'a focus + içerik seç
      setTimeout(() => { input.focus(); input.select(); }, 0);
    }

    function cancelEdit() {
      wrap.style.display = 'none';
      view.style.display = 'inline-flex';
      input.classList.remove('error');
    }

    function commitEdit() {
      const v = parseFloat(input.value);
      if (!Number.isFinite(v) || v < 0) {
        input.classList.add('error');
        return;
      }
      const ok = window.FuturesState.setBalance(v);
      if (!ok) {
        // setBalance reddetti — büyük olasılıkla kullanılan margin'in altına düşürüldü
        input.classList.add('error');
        _flashTooltip(input, 'Bakiye, aktif pozisyon marginin altına düşemez');
        return;
      }
      cancelEdit();
    }

    btnEdit.addEventListener('click', openEdit);
    btnOk.addEventListener('click', commitEdit);
    btnCancel.addEventListener('click', cancelEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')        { e.preventDefault(); commitEdit(); }
      else if (e.key === 'Escape')  { e.preventDefault(); cancelEdit(); }
    });
    input.addEventListener('input', () => input.classList.remove('error'));
  }

  function _flashTooltip(target, text) {
    let tip = target.parentElement.querySelector('.fp-balance-tip');
    if (!tip) {
      tip = document.createElement('span');
      tip.className = 'fp-balance-tip';
      target.parentElement.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';
    clearTimeout(tip._t);
    tip._t = setTimeout(() => { tip.style.display = 'none'; }, 2200);
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
      // Edit modu açık değilse görüntüyü güncelle
      const wrap = _mount.querySelector('#fpBalanceEditWrap');
      const editing = wrap && wrap.style.display !== 'none';
      if (!editing) {
        balanceEl.textContent = '$' + balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }

    // Liste
    const list = _mount.querySelector('#fpList');
    if (!list) return;

    if (positions.length === 0) {
      list.innerHTML = `
        <div class="fp-empty">
          <div class="fp-empty-icon">📊</div>
          <div class="fp-empty-title">Aktif işlem yok</div>
          <div class="fp-empty-sub">Yukarıdaki <b style="color:var(--cyan)">+ Manuel Pozisyon Ekle</b> butonuna veya analiz kartındaki <b style="color:var(--cyan)">⚡ Pozisyon Ekle</b> butonuna bas.</div>
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
