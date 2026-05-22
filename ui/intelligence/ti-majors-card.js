// ════════════════════════════════════════════════════════════════════
// TI MAJORS CARD — BTC ve ETH analizi
// ════════════════════════════════════════════════════════════════════
window.TIMajorsCard = (() => {
  'use strict';

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _dirClass(d) {
    if (d === 'UP')   return 'up';
    if (d === 'DOWN') return 'down';
    return 'flat';
  }

  function _dirIcon(d) {
    if (d === 'UP')   return '▲ Trending up';
    if (d === 'DOWN') return '▼ Trending down';
    return '◇ Sideways';
  }

  function _renderCoin(sym, analysis) {
    if (!analysis) {
      return `
        <div class="ti-card">
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>${_esc(sym)}</div>
          <div class="ti-empty">No data available.</div>
        </div>
      `;
    }

    const momClass  = 'mom-' + (analysis.momentum || 'building').toLowerCase();
    const riskClass = 'risk-' + (analysis.risk || 'moderate').toLowerCase();
    const dirCls    = _dirClass(analysis.dir);
    const dirTxt    = _dirIcon(analysis.dir);

    const vsLine = analysis.vsBTC
      ? `<div class="ti-major-vs">${_esc(analysis.vsBTC)}</div>`
      : '';

    return `
      <div class="ti-card">
        <div class="ti-card-label">
          <span class="ti-card-label-dot"></span>
          ${_esc(sym)}
        </div>
        <div class="ti-major">
          <div class="ti-major-top">
            <span class="ti-major-sym">${_esc(sym)}</span>
            <span class="ti-major-dir ${dirCls}">${_esc(dirTxt)}</span>
          </div>
          <div class="ti-major-structure">${_esc(analysis.structure || '')}</div>
          <div class="ti-major-summary">${_esc(analysis.summary || '')}</div>
          <div class="ti-major-stats">
            <span class="ti-major-stat">Momentum: <b class="${momClass}">${_esc(analysis.momentum || '—')}</b></span>
            <span class="ti-major-stat">Risk: <b class="${riskClass}">${_esc(analysis.risk || '—')}</b></span>
          </div>
          ${vsLine}
        </div>
      </div>
    `;
  }

  function render(btcAnalysis, ethAnalysis) {
    return `
      <div class="ti-row-2">
        ${_renderCoin('BTC', btcAnalysis)}
        ${_renderCoin('ETH', ethAnalysis)}
      </div>
    `;
  }

  return { render };
})();
