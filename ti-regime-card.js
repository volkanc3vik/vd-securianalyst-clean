// ════════════════════════════════════════════════════════════════════
// TI REGIME CARD — Market Regime + MM Bias üst sıra
// Sunum katmanı; state mutate etmez.
// ════════════════════════════════════════════════════════════════════
window.TIRegimeCard = (() => {
  'use strict';

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderRegime(regime) {
    if (!regime) {
      return `
        <div class="ti-card">
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>MARKET REGIME</div>
          <div class="ti-empty">Awaiting scan data...</div>
        </div>
      `;
    }

    const color = regime.color || 'yellow';
    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>MARKET REGIME</div>
        <div class="ti-regime">
          <span class="ti-regime-badge ${_esc(color)}">
            <span class="ti-regime-badge-dot"></span>
            ${_esc(regime.label || regime.code || 'Unknown')}
          </span>
          <div class="ti-regime-summary">${_esc(regime.summary || '')}</div>
        </div>
      </div>
    `;
  }

  function renderMMBias(mmBias) {
    if (!mmBias || !mmBias.headline) {
      return `
        <div class="ti-card">
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>MARKET MAKER BIAS</div>
          <div class="ti-empty">No clear positioning yet.</div>
        </div>
      `;
    }

    const details = Array.isArray(mmBias.detail) && mmBias.detail.length
      ? `<ul class="ti-mm-detail">${mmBias.detail.map(d => `<li>${_esc(d)}</li>`).join('')}</ul>`
      : '';

    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>MARKET MAKER BIAS</div>
        <div class="ti-mm-headline">${_esc(mmBias.headline)}</div>
        ${details}
      </div>
    `;
  }

  return { renderRegime, renderMMBias };
})();
