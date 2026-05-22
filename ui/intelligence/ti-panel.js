// ════════════════════════════════════════════════════════════════════
// TI PANEL — Ana container
// State değişiminde RAF throttle ile render.
// Tek timer: "x seconds ago" relative-time için (30sn'de bir).
// ════════════════════════════════════════════════════════════════════
window.TIPanel = (() => {
  'use strict';

  let _mount         = null;
  let _unsubState    = null;
  let _renderScheduled = false;
  let _relTimer      = null;
  let _lastCommitTs  = 0;

  function _relativeTime(ts) {
    if (!ts) return 'awaiting data';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5)    return 'just now';
    if (sec < 60)   return sec + 's ago';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    return Math.floor(sec / 3600) + 'h ago';
  }

  function _renderSources(sources) {
    if (!sources) return '';
    const items = [
      { key: 'binance',   label: 'Binance'   },
      { key: 'coinglass', label: 'CoinGlass' },
      { key: 'ws',        label: 'WS Live'   },
    ];
    return `
      <div class="ti-sources">
        ${items.map(it => `
          <span class="ti-source-dot ${sources[it.key] ? 'active' : ''}">
            <i></i>${it.label}
          </span>
        `).join('')}
      </div>
    `;
  }

  function _buildShell() {
    if (!_mount) return;
    _mount.innerHTML = `
      <div class="ti-panel" id="tiPanelRoot">
        <div class="ti-header">
          <span class="ti-header-pulse"></span>
          <span class="ti-header-title">◈ Market Intelligence</span>
          <span class="ti-header-meta" id="tiHeaderMeta">awaiting data</span>
        </div>
        <div class="ti-grid" id="tiGrid">
          <div class="ti-empty">
            <div class="ti-empty-title">Intelligence engine initializing</div>
            <div>Waiting for first scan cycle to complete...</div>
          </div>
        </div>
      </div>
    `;
  }

  function _render() {
    _renderScheduled = false;
    if (!_mount) return;

    const State = window.TIState;
    if (!State) return;
    const snap = State.get();
    _lastCommitTs = snap.ts || 0;

    const meta = _mount.querySelector('#tiHeaderMeta');
    if (meta) meta.textContent = _relativeTime(_lastCommitTs);

    const grid = _mount.querySelector('#tiGrid');
    if (!grid) return;

    if (!snap.ready) {
      grid.innerHTML = `
        <div class="ti-empty">
          <div class="ti-empty-title">Intelligence engine initializing</div>
          <div>Waiting for first scan cycle to complete...</div>
        </div>
      `;
      return;
    }

    // Render sırası
    const regimeRow = `
      <div class="ti-row-2">
        ${window.TIRegimeCard.renderRegime(snap.regime)}
        ${window.TIRegimeCard.renderMMBias(snap.mmBias)}
      </div>
    `;

    const majorsRow = window.TIMajorsCard.render(snap.btc, snap.eth);
    const bestRow   = window.TIBestSetupCard.render(snap.bestSetup);
    const watchRow  = window.TIWatchlistCard.render(snap.watchlist);
    const warnRow   = window.TIWarningsCard.render(snap.warnings);

    grid.innerHTML = `
      ${regimeRow}
      ${majorsRow}
      ${bestRow}
      ${watchRow}
      ${warnRow}
      ${_renderSources(snap.dataSources)}
    `;
  }

  function _scheduleRender() {
    if (_renderScheduled) return;
    _renderScheduled = true;
    requestAnimationFrame(_render);
  }

  function _onStateChange() {
    _scheduleRender();
  }

  function _tickRelativeTime() {
    if (!_mount) return;
    const meta = _mount.querySelector('#tiHeaderMeta');
    if (meta && _lastCommitTs) meta.textContent = _relativeTime(_lastCommitTs);
  }

  function mount(selector) {
    _mount = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!_mount) {
      console.warn('[TIPanel] Mount node bulunamadı:', selector);
      return false;
    }

    _buildShell();

    if (_unsubState) _unsubState();
    _unsubState = window.TIState.subscribe(_onStateChange);

    // Tek timer — relative time
    if (_relTimer) clearInterval(_relTimer);
    _relTimer = setInterval(_tickRelativeTime, 30 * 1000);

    // Mevcut state varsa hemen render
    _scheduleRender();

    return true;
  }

  function unmount() {
    if (_unsubState) { _unsubState(); _unsubState = null; }
    if (_relTimer)   { clearInterval(_relTimer); _relTimer = null; }
    if (_mount) _mount.innerHTML = '';
    _mount = null;
  }

  return { mount, unmount, render: _render };
})();
