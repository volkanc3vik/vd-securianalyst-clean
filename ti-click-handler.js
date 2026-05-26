// ════════════════════════════════════════════════════════════════════
// FUTURES MODAL — Manuel Pozisyon Açma
// Canlı pozisyon büyüklüğü ve likidasyon önizlemesi.
// AbortController ile tüm event listener'lar tek seferde temizlenir.
// ════════════════════════════════════════════════════════════════════
window.FuturesModal = (() => {
  'use strict';

  let _root = null;
  let _abortCtrl = null;
  let _currentDir = 'LONG';
  let _currentMode = 'CROSS';
  let _currentSym = 'BTCUSDT';
  let _liveFetch = null;     // canlı fiyat çekme timer

  function _fmt(v, d = 2) {
    if (v === null || v === undefined || !Number.isFinite(+v)) return '—';
    return (+v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function _val(id) {
    const el = _root && _root.querySelector('#' + id);
    if (!el) return null;
    const v = el.value.trim();
    if (v === '') return null;
    const n = +v;
    return Number.isFinite(n) ? n : null;
  }

  function _setText(sel, text) {
    const el = _root && _root.querySelector(sel);
    if (el) el.textContent = text;
  }

  function _showError(msg) {
    const el = _root && _root.querySelector('#fmError');
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.style.display = 'block';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  // ── Canlı hesap (pozisyon, likidasyon önizleme) ──────────────────
  function _recalc() {
    const FC = window.FuturesCalc;
    const FL = window.FuturesLiquidation;
    const FS = window.FuturesState;

    const entry  = _val('fmEntry');
    const lev    = _val('fmLev');
    const margin = _val('fmMargin');

    // Pozisyon büyüklüğü
    const size = FC.positionSize(margin || 0, lev || 1);
    _setText('#fmPos', '$' + _fmt(size, 2));

    // Miktar (qty)
    if (entry && entry > 0) {
      const qty = FC.quantity(margin || 0, lev || 1, entry);
      _setText('#fmQty', _fmt(qty, qty >= 1 ? 4 : 6));
    } else {
      _setText('#fmQty', '—');
    }

    // Likidasyon önizleme (her iki yön için)
    if (entry && entry > 0 && lev && lev > 0 && margin && margin > 0) {
      const balance     = FS.getBalance();
      const activePos   = FS.getActivePositions();
      const usedMargin  = activePos.reduce((s, p) => s + (+p.margin || 0), 0);

      const liqLong = FL.compute({
        mode: _currentMode, dir: 'LONG', entry, leverage: lev, margin,
        walletBalance: balance, usedMargin,
      });
      const liqShort = FL.compute({
        mode: _currentMode, dir: 'SHORT', entry, leverage: lev, margin,
        walletBalance: balance, usedMargin,
      });

      const liqEl = _root.querySelector('#fmLiq');
      if (liqEl) {
        liqEl.innerHTML = `⚡ Likidasyon (${_currentMode}): ` +
          `<b style="color:var(--green)">LONG</b> ~$${_fmt(liqLong, 4)} ` +
          ` &nbsp;·&nbsp; ` +
          `<b style="color:var(--red)">SHORT</b> ~$${_fmt(liqShort, 4)}`;
      }
    } else {
      _setText('#fmLiq', '⚡ Likidasyon hesaplanıyor...');
    }

    // Kullanılabilir bakiye — edit modu açık değilse yenile
    const balance    = FS.getBalance();
    const activePos  = FS.getActivePositions();
    const usedMargin = activePos.reduce((s, p) => s + (+p.margin || 0), 0);
    const avail      = balance - usedMargin;
    const editWrap   = _root && _root.querySelector('#fmBalanceEditWrap');
    const editing    = editWrap && editWrap.style.display !== 'none';
    if (!editing) {
      _setText('#fmAvail', '$' + _fmt(avail, 2));
    }

    _showError(null);
  }

  // ── Yön değiştir ──────────────────────────────────────────────────
  function _setDir(dir) {
    _currentDir = (dir || 'LONG').toUpperCase();
    if (!_root) return;
    const longBtn  = _root.querySelector('#fmDirLong');
    const shortBtn = _root.querySelector('#fmDirShort');
    const modal    = _root.querySelector('.fm-modal');
    const cta      = _root.querySelector('#fmCta');

    longBtn  && longBtn.classList.toggle('active',  _currentDir === 'LONG');
    shortBtn && shortBtn.classList.toggle('active', _currentDir === 'SHORT');

    if (modal) {
      modal.classList.toggle('short', _currentDir === 'SHORT');
    }
    if (cta) {
      cta.classList.toggle('long',  _currentDir === 'LONG');
      cta.classList.toggle('short', _currentDir === 'SHORT');
      cta.textContent = _currentDir === 'LONG' ? '▲ LONG İŞLEMİ AÇ' : '▼ SHORT İŞLEMİ AÇ';
    }
    _recalc();
  }

  function _setMode(mode) {
    _currentMode = (mode || 'CROSS').toUpperCase();
    window.FuturesState.setMode(_currentMode);
    if (!_root) return;
    _root.querySelectorAll('.fm-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === _currentMode);
    });
    _recalc();
  }

  // ── Canlı fiyat çek (entry default doldurma) ──────────────────────
  function _fetchCurrentPrice(symFull) {
    // Önce WSEngine'den dene (zaten abone)
    try {
      if (typeof window.WSEngine !== 'undefined' && typeof window.WSEngine.getData === 'function') {
        const d = window.WSEngine.getData(symFull.toLowerCase());
        if (d && Number.isFinite(+d.lastPrice) && +d.lastPrice > 0) {
          return Promise.resolve(+d.lastPrice);
        }
      }
    } catch {}

    // REST fallback
    return fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${symFull.toUpperCase()}`)
      .then(r => r.json())
      .then(j => j && j.price ? +j.price : null)
      .catch(() => null);
  }

  // ── Açılış ────────────────────────────────────────────────────────
  function open(prefill = {}) {
    close(); // önce varsa kapat

    _currentMode = window.FuturesState.getMode() || 'CROSS';
    _currentDir  = (prefill.dir || 'LONG').toUpperCase();
    const symRaw = (prefill.sym || window.SYM || 'BTCUSDT').toUpperCase();
    _currentSym  = symRaw.endsWith('USDT') ? symRaw : symRaw + 'USDT';

    _abortCtrl = new AbortController();
    const sig = _abortCtrl.signal;

    _root = document.createElement('div');
    _root.className = 'fm-overlay';
    _root.setAttribute('role', 'dialog');
    _root.setAttribute('aria-modal', 'true');

    _root.innerHTML = `
      <div class="fm-modal ${_currentDir === 'SHORT' ? 'short' : ''}" id="fmModal">

        <div class="fm-head">
          <span class="fm-head-sym">${_currentSym.replace('USDT', '')}/USDT</span>
          <button class="fm-x" id="fmClose" aria-label="Kapat">✕</button>
        </div>

        <!-- LONG / SHORT Toggle -->
        <div class="fm-dir-toggle">
          <button class="fm-dir-btn long  ${_currentDir === 'LONG'  ? 'active' : ''}" id="fmDirLong">▲ LONG</button>
          <button class="fm-dir-btn short ${_currentDir === 'SHORT' ? 'active' : ''}" id="fmDirShort">▼ SHORT</button>
        </div>

        <!-- Mode + Balance -->
        <div class="fm-mode">
          <button class="fm-mode-btn ${_currentMode === 'CROSS'    ? 'active' : ''}" data-mode="CROSS">CROSS</button>
          <button class="fm-mode-btn ${_currentMode === 'ISOLATED' ? 'active' : ''}" data-mode="ISOLATED">ISOLATED</button>
          <span class="fm-balance-disp">
            Bakiye:
            <span class="fm-balance-view" id="fmBalanceView">
              <b id="fmAvail">$0.00</b>
              <button class="fm-balance-edit" id="fmBalanceEdit" type="button" title="Bakiyeyi düzenle" aria-label="Bakiyeyi düzenle">✎</button>
            </span>
            <span class="fm-balance-edit-wrap" id="fmBalanceEditWrap" style="display:none">
              <span class="fm-balance-prefix">$</span>
              <input type="number" inputmode="decimal" step="0.01" min="0" class="fm-balance-input" id="fmBalanceInput">
              <button class="fm-balance-ok" id="fmBalanceOk" type="button" title="Kaydet">✓</button>
              <button class="fm-balance-cancel" id="fmBalanceCancel" type="button" title="Vazgeç">×</button>
            </span>
          </span>
        </div>

        <!-- Form -->
        <div class="fm-form">

          <div class="fm-field">
            <label class="fm-field-label">GİRİŞ FİYATI</label>
            <input class="fm-input" id="fmEntry" type="number" step="any" placeholder="0.00" value="${prefill.price || ''}">
          </div>

          <div class="fm-field">
            <label class="fm-field-label">KALDIRAÇ</label>
            <input class="fm-input" id="fmLev" type="number" step="1" min="1" max="125" value="10">
          </div>

          <div class="fm-field">
            <label class="fm-field-label">MARGIN ($)</label>
            <input class="fm-input" id="fmMargin" type="number" step="any" min="0" value="100">
          </div>

          <div class="fm-field">
            <label class="fm-field-label">POZİSYON (OTOMATİK)</label>
            <div class="fm-readout" id="fmPos">$1,000.00</div>
          </div>

          <div class="fm-field">
            <label class="fm-field-label">MİKTAR (OTOMATİK)</label>
            <div class="fm-readout" id="fmQty">—</div>
          </div>

          <div class="fm-field">
            <label class="fm-field-label">STOP LOSS</label>
            <input class="fm-input sl" id="fmSl" type="number" step="any" placeholder="opsiyonel" value="${prefill.sl || ''}">
          </div>

          <div class="fm-field">
            <label class="fm-field-label">TAKE PROFIT 1</label>
            <input class="fm-input tp1" id="fmTp1" type="number" step="any" placeholder="opsiyonel" value="${prefill.tp1 || ''}">
          </div>

          <div class="fm-field">
            <label class="fm-field-label">TAKE PROFIT 2</label>
            <input class="fm-input tp2" id="fmTp2" type="number" step="any" placeholder="opsiyonel" value="${prefill.tp2 || ''}">
          </div>

          <div class="fm-field">
            <label class="fm-field-label">TAKE PROFIT 3</label>
            <input class="fm-input tp3" id="fmTp3" type="number" step="any" placeholder="opsiyonel" value="${prefill.tp3 || ''}">
          </div>

        </div>

        <div class="fm-liq" id="fmLiq">⚡ Likidasyon hesaplanıyor...</div>
        <div class="fm-error" id="fmError" style="display:none"></div>

        <button class="fm-cta ${_currentDir === 'LONG' ? 'long' : 'short'}" id="fmCta">
          ${_currentDir === 'LONG' ? '▲ LONG İŞLEMİ AÇ' : '▼ SHORT İŞLEMİ AÇ'}
        </button>
      </div>
    `;

    document.body.appendChild(_root);

    // Listener'lar (hepsi abort sinyaline bağlı)
    const $ = (sel) => _root.querySelector(sel);

    $('#fmClose').addEventListener('click', close, { signal: sig });
    _root.addEventListener('click', (e) => { if (e.target === _root) close(); }, { signal: sig });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal: sig });

    $('#fmDirLong').addEventListener('click',  () => _setDir('LONG'),  { signal: sig });
    $('#fmDirShort').addEventListener('click', () => _setDir('SHORT'), { signal: sig });

    _root.querySelectorAll('.fm-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => _setMode(btn.dataset.mode), { signal: sig });
    });

    ['fmEntry', 'fmLev', 'fmMargin'].forEach(id => {
      $('#' + id).addEventListener('input', _recalc, { signal: sig });
    });

    $('#fmCta').addEventListener('click', _submit, { signal: sig });

    // Bakiye inline edit
    _wireModalBalanceEdit(sig);

    // Entry boşsa canlı fiyat çek
    if (!prefill.price) {
      _fetchCurrentPrice(_currentSym).then(price => {
        if (!_root) return; // arada kapanmış olabilir
        const entryEl = $('#fmEntry');
        if (entryEl && !entryEl.value && Number.isFinite(price) && price > 0) {
          entryEl.value = price;
          _recalc();
        }
      });
    }

    _recalc();
    // Focus margin (entry zaten doluysa)
    setTimeout(() => {
      const focusEl = prefill.price ? $('#fmMargin') : $('#fmEntry');
      if (focusEl) focusEl.focus();
    }, 50);
  }

  // ── Modal Bakiye inline edit ──────────────────────────────────────
  function _wireModalBalanceEdit(sig) {
    const $ = (sel) => _root.querySelector(sel);
    const view      = $('#fmBalanceView');
    const wrap      = $('#fmBalanceEditWrap');
    const btnEdit   = $('#fmBalanceEdit');
    const btnOk     = $('#fmBalanceOk');
    const btnCancel = $('#fmBalanceCancel');
    const input     = $('#fmBalanceInput');
    if (!view || !wrap || !btnEdit || !btnOk || !btnCancel || !input) return;

    function openEdit() {
      const cur = window.FuturesState.getBalance();
      input.value = (+cur).toFixed(2);
      view.style.display = 'none';
      wrap.style.display = 'inline-flex';
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
        input.classList.add('error');
        _flashModalTooltip(input, 'Bakiye, aktif pozisyon marginin altına düşemez');
        return;
      }
      cancelEdit();
      _recalc(); // pozisyon/likidasyon hesabını tazele
    }

    btnEdit.addEventListener('click', openEdit, { signal: sig });
    btnOk.addEventListener('click', commitEdit, { signal: sig });
    btnCancel.addEventListener('click', cancelEdit, { signal: sig });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')        { e.preventDefault(); commitEdit(); }
      else if (e.key === 'Escape')  { e.preventDefault(); cancelEdit(); }
    }, { signal: sig });
    input.addEventListener('input', () => input.classList.remove('error'), { signal: sig });
  }

  function _flashModalTooltip(target, text) {
    const parent = target.parentElement;
    let tip = parent.querySelector('.fm-balance-tip');
    if (!tip) {
      tip = document.createElement('span');
      tip.className = 'fm-balance-tip';
      parent.appendChild(tip);
    }
    tip.textContent = text;
    tip.style.display = 'block';
    clearTimeout(tip._t);
    tip._t = setTimeout(() => { tip.style.display = 'none'; }, 2400);
  }

  // ── Gönder ────────────────────────────────────────────────────────
  function _submit() {
    const entry  = _val('fmEntry');
    const lev    = _val('fmLev');
    const margin = _val('fmMargin');
    const sl     = _val('fmSl');
    const tp1    = _val('fmTp1');
    const tp2    = _val('fmTp2');
    const tp3    = _val('fmTp3');

    if (!entry || entry <= 0)   return _showError('Giriş fiyatı zorunlu.');
    if (!lev   || lev <= 0)     return _showError('Kaldıraç zorunlu (1-125).');
    if (!margin || margin <= 0) return _showError('Margin zorunlu.');

    const result = window.FuturesController.openPosition({
      sym:       _currentSym,
      dir:       _currentDir,
      mode:      _currentMode,
      leverage:  lev,
      margin,
      entry,
      sl, tp1, tp2, tp3,
    });

    if (!result.ok) {
      _showError(result.error || 'İşlem açılamadı.');
      return;
    }

    // Başarılı — modal'ı kapat
    close();

    // Panel'e scroll
    setTimeout(() => {
      const mount = document.getElementById('futuresPanelMount');
      if (mount) mount.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 200);
  }

  // ── Kapat ─────────────────────────────────────────────────────────
  function close() {
    if (_abortCtrl) {
      try { _abortCtrl.abort(); } catch {}
      _abortCtrl = null;
    }
    if (_root && _root.parentNode) {
      _root.parentNode.removeChild(_root);
    }
    _root = null;
    if (_liveFetch) {
      clearInterval(_liveFetch);
      _liveFetch = null;
    }
  }

  function isOpen() {
    return _root !== null;
  }

  return { open, close, isOpen };
})();
