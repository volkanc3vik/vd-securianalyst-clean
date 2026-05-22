// ════════════════════════════════════════════════════════════════════
// TI WATCHLIST CARD — Best Setup hariç 2 alternatif
// Sadece VALID ve üstü — rastgele coin yok.
// ════════════════════════════════════════════════════════════════════
window.TIWatchlistCard = (() => {
  'use strict';

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(watchlist) {
    if (!Array.isArray(watchlist) || watchlist.length === 0) {
      return ''; // boşsa hiç render etme — gürültü yok
    }

    const rows = watchlist.map(s => {
      const tier   = s.tier || {};
      const tierCd = tier.code || 'VALID';
      const dirCls = (s.dir || 'LONG').toLowerCase();
      const dirTxt = s.dir === 'LONG' ? 'LONG' : 'SHORT';
      const matPct = s.maturity?.percent || 0;
      return `
        <div class="ti-watch-row">
          <span class="ti-watch-sym">${_esc(s.sym || '—')}</span>
          <span class="ti-watch-dir ${dirCls}">${_esc(dirTxt)}</span>
          <span class="ti-watch-tier">${_esc(tierCd)}</span>
          <span class="ti-watch-score">${+s.score || 0}</span>
          <span class="ti-watch-mat">Mat ${matPct}%</span>
        </div>
      `;
    }).join('');

    return `
      <div class="ti-card">
        <div class="ti-card-label"><span class="ti-card-label-dot"></span>WATCHLIST</div>
        <div class="ti-watch">${rows}</div>
      </div>
    `;
  }

  return { render };
})();
