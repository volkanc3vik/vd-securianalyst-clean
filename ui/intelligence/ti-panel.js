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
    if (!ts) return 'veri bekleniyor';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5)    return 'şimdi';
    if (sec < 60)   return sec + 'sn önce';
    if (sec < 3600) return Math.floor(sec / 60) + 'dk önce';
    return Math.floor(sec / 3600) + 'sa önce';
  }

  function _renderSources(sources) {
    if (!sources) return '';
    // CoinGlass artık üç-durumlu string: OFF / PARTIAL / FULL
    const cgStatus = sources.coinglass;
    const cgLabel  = cgStatus === 'FULL'    ? 'CoinGlass: Aktif'
                   : cgStatus === 'PARTIAL' ? 'CoinGlass: Kısıtlı'
                                            : 'CoinGlass: Yok';
    const cgCls    = cgStatus === 'FULL'    ? 'active'
                   : cgStatus === 'PARTIAL' ? 'partial'
                                            : '';

    return `
      <div class="ti-sources">
        <span class="ti-source-dot ${sources.binance ? 'active' : ''}">
          <i></i>Binance
        </span>
        <span class="ti-source-dot ${cgCls}">
          <i></i>${cgLabel}
        </span>
        <span class="ti-source-dot ${sources.ws ? 'active' : ''}">
          <i></i>Canlı WS
        </span>
      </div>
    `;
  }

  function _renderVolObs(volObs) {
    if (!volObs) return '';
    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>VOLATİLİTE GÖZLEMİ</div>
        <div class="ti-mm-headline">${volObs.label}</div>
        <div class="ti-mm-detail" style="margin-top:4px">${volObs.tone}</div>
      </div>
    `;
  }

  function _renderPressure(pressure) {
    if (!pressure || !pressure.signals || pressure.signals.length === 0) return '';
    const intensity = pressure.intensity || 0;
    const intCls = intensity >= 60 ? 'high' : intensity >= 30 ? 'med' : 'low';

    return `
      <div class="ti-card">
        <div class="ti-card-label">
          <span class="ti-card-label-dot"></span>
          PİYASA BASKISI
          <span class="ti-pressure-intensity ${intCls}">${intensity}</span>
        </div>
        ${pressure.headline ? `<div class="ti-mm-headline">${_esc(pressure.headline)}</div>` : ''}
        <ul class="ti-pressure-list">
          ${pressure.signals.map(s => `
            <li class="ti-pressure-row sev-${_esc(s.severity || 'info')}">
              <span class="ti-pressure-label">${_esc(s.label)}</span>
              <span class="ti-pressure-detail">${_esc(s.detail || '')}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  function _renderActivityFeed(events) {
    if (!Array.isArray(events) || events.length === 0) return '';
    const rows = events.slice(0, 8).map(ev => {
      const sev = ev.severity || 'info';
      const cat = ev.category || 'system';
      return `
        <li class="ti-activity-row sev-${_esc(sev)}">
          <span class="ti-activity-ts">${_relativeTime(ev.ts)}</span>
          <span class="ti-activity-cat ti-cat-${_esc(cat)}">${_esc(_catTR(cat))}</span>
          <span class="ti-activity-msg">${_esc(ev.msg)}</span>
        </li>
      `;
    }).join('');

    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>AKTİVİTE AKIŞI</div>
        <ul class="ti-activity-list">${rows}</ul>
      </div>
    `;
  }

  function _catTR(cat) {
    switch (cat) {
      case 'system':      return 'SİS';
      case 'regime':      return 'REJ';
      case 'volatility':  return 'VOL';
      case 'setup':       return 'STP';
      case 'pressure':    return 'BSK';
      case 'btc':         return 'BTC';
      case 'eth':         return 'ETH';
      case 'market':      return 'PYS';
      default:            return cat.toUpperCase().slice(0, 3);
    }
  }

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _buildShell() {
    if (!_mount) return;
    _mount.innerHTML = `
      <div class="ti-panel" id="tiPanelRoot">
        <div class="ti-header">
          <span class="ti-header-pulse"></span>
          <span class="ti-header-title">◈ Piyasa İstihbarat Terminali</span>
          <span class="ti-header-meta" id="tiHeaderMeta">veri bekleniyor</span>
        </div>
        <div class="ti-grid" id="tiGrid">
          <div class="ti-empty">
            <div class="ti-empty-title">İstihbarat motoru başlatılıyor</div>
            <div>İlk tarama döngüsünün tamamlanması bekleniyor...</div>
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
          <div class="ti-empty-title">İstihbarat motoru başlatılıyor</div>
          <div>İlk tarama döngüsünün tamamlanması bekleniyor...</div>
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

    const majorsRow   = window.TIMajorsCard.render(snap.btc, snap.eth);
    const pressureRow = _renderPressure(snap.marketPressure);
    const bestRow     = window.TIBestSetupCard.render(snap.bestSetup, snap.scanStats);
    const watchRow    = window.TIWatchlistCard.render(snap.watchlist);
    const warnRow     = window.TIWarningsCard.render(snap.warnings);
    const volRow      = _renderVolObs(snap.volatilityObs);
    const activityRow = _renderActivityFeed(snap.activityFeed);

    // Partial badge
    if (snap.partial) {
      const meta = _mount.querySelector('#tiHeaderMeta');
      if (meta) meta.innerHTML = '<span class="ti-partial-badge">PARTIAL</span> ' + _relativeTime(_lastCommitTs);
    }

    // ── RADAR HERO (yeni terminal UI) — veri snap'ten OKUNUR, motor/mount DEĞİŞMEZ ──
    const _bs = snap.bestSetup || {};
    const _ss = snap.scanStats || {};
    const _dirShort = _bs.dir === 'SHORT';
    const _radarHero = window.VDRadarCore ? `
      <div class="tm-intel" style="margin-bottom:18px">
        <div class="tm-radar">${window.VDRadarCore.svg({
          confluence: (_bs.score != null ? +_bs.score : (_bs.maturity && _bs.maturity.percent)),
          symbol: _bs.sym || '—', direction: _bs.dir || '',
          scanned: _ss.scored, total: _ss.total, engines: _ss.engines })}</div>
        <div class="tm-intel-read">
          <div class="row"><span class="tm-badge ok">● TARAMA AKTİF</span></div>
          <div class="row" style="margin-top:8px"><span class="tm-k">LİDER SETUP</span></div>
          <div class="row"><span class="tm-intel-lead">${_esc(_bs.sym || '—')}</span> <span class="tm-num ${_dirShort ? 'tm-dn' : 'tm-up'}" style="font-weight:700;font-size:15px">${_dirShort ? '▼ SHORT' : '▲ LONG'}</span></div>
          <div class="tm-readline">
            ${_ss.scored != null ? `<div class="cell"><span class="tm-k">TARANAN</span><span class="tm-v tm-ac">${_ss.scored}</span></div>` : ''}
            ${_ss.engines != null ? `<div class="cell"><span class="tm-k">MOTOR</span><span class="tm-v tm-ac">${_ss.engines}</span></div>` : ''}
            ${_bs.score != null ? `<div class="cell"><span class="tm-k">SKOR</span><span class="tm-v tm-ac">${_bs.score}</span></div>` : ''}
          </div>
        </div>
      </div>` : '';

    grid.innerHTML = `
      ${_radarHero}
      ${regimeRow}
      ${majorsRow}
      ${pressureRow}
      ${bestRow}
      ${watchRow}
      ${volRow}
      ${warnRow}
      ${activityRow}
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
 
