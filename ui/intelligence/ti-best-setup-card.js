// ════════════════════════════════════════════════════════════════════
// TI BEST SETUP CARD — Hero
// Score + Tier + Maturity Bar + Confirmed Chips + "What Needs to Happen"
// ════════════════════════════════════════════════════════════════════
window.TIBestSetupCard = (() => {
  'use strict';

  function _esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _autoDecimals(price) {
    const p = Math.abs(+price);
    if (!Number.isFinite(p) || p === 0) return 2;
    if (p >= 1000) return 2;
    if (p >= 10)   return 3;
    if (p >= 1)    return 4;
    if (p >= 0.01) return 5;
    return 7;
  }

  function _fmtPrice(v) {
    if (v == null || !Number.isFinite(+v)) return '—';
    const d = _autoDecimals(v);
    return (+v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function render(setup, scanStats) {
    if (!setup) {
      const tierLine = scanStats?.tierCounts ? _scanStatsLine(scanStats) : '';
      return `
        <div class="ti-card">
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>EN OLGUN SETUP</div>
          <div class="ti-empty">
            <div class="ti-empty-title">Bu döngüde kaliteli teknik görünüm bulunmadı</div>
            <div>Hiçbir coin kalite eşiğini geçmedi. Piyasa izleniyor.</div>
            ${tierLine}
          </div>
        </div>
      `;
    }

    const tier      = setup.tier || {};
    const tierCls   = 'tier-' + (tier.code || 'valid').toLowerCase();
    const dirCls    = (setup.dir || 'LONG').toLowerCase();
    const dirIcon   = setup.dir === 'LONG' ? '▲ LONG' : '▼ SHORT';
    const score     = +setup.score || 0;
    const matPct    = setup.maturity?.percent || 0;
    const confirmed = setup.maturity?.confirmed || [];
    const missing   = setup.maturity?.missing   || [];
    const rationale = setup.rationale || null;
    const risk      = setup.risk || null;

    const confirmChips = confirmed.length
      ? `<div class="ti-conf-grid">${confirmed.map(c => `<span class="ti-conf-chip">${_esc(c)}</span>`).join('')}</div>`
      : '';

    const rationaleBlock = rationale ? `
      <div class="ti-rationale">
        <div class="ti-rationale-label">Neden Güçlü</div>
        <div class="ti-rationale-text">${_esc(rationale)}</div>
      </div>
    ` : '';

    const needsBlock = missing.length
      ? `
        <div class="ti-needs">
          <div class="ti-needs-label">Sıradaki Gerekenler</div>
          <ul class="ti-needs-list">
            ${missing.map(m => `<li>${_esc(m)}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

    // Confidence + Risk satırları (B opsiyonu — clean institutional)
    const riskLevel = risk?.level || '—';
    const riskCls = 'risk-' + (riskLevel || 'orta').toLowerCase();
    const metricsRow = `
      <div class="ti-metrics-row">
        <div class="ti-metric">
          <span class="ti-metric-label">Görünüm Değerlendirmesi</span>
          <span class="ti-metric-val ti-metric-confidence">${score}</span>
        </div>
        <div class="ti-metric">
          <span class="ti-metric-label">Risk Seviyesi</span>
          <span class="ti-metric-val ti-metric-risk ${riskCls}">${_esc(riskLevel)}</span>
        </div>
      </div>
    `;

    // Setup levels
    const levelsHtml = (setup.entry || setup.sl || setup.tp1) ? `
      <div class="ti-best-levels">
        ${setup.entry ? `<div class="ti-best-level"><span class="ti-best-level-label">Referans</span><span class="ti-best-level-val entry">${_fmtPrice(setup.entry)}</span></div>` : ''}
        ${setup.sl    ? `<div class="ti-best-level"><span class="ti-best-level-label">Risk Limiti</span><span class="ti-best-level-val sl">${_fmtPrice(setup.sl)}</span></div>` : ''}
        ${setup.tp1   ? `<div class="ti-best-level"><span class="ti-best-level-label">Hedef Bölge 1</span><span class="ti-best-level-val tp1">${_fmtPrice(setup.tp1)}</span></div>` : ''}
        ${setup.tp2   ? `<div class="ti-best-level"><span class="ti-best-level-label">Hedef Bölge 2</span><span class="ti-best-level-val tp2">${_fmtPrice(setup.tp2)}</span></div>` : ''}
      </div>
    ` : '';

    return `
      <div class="ti-card" style="padding:0;background:transparent;border:none">
        <div class="ti-card-label" style="padding:0 4px"><span class="ti-card-label-dot"></span>EN OLGUN SETUP</div>
        <div class="ti-best ${tierCls}">
          <div class="ti-best-head">
            <span class="ti-best-sym">${_esc(setup.sym || '—')}</span>
            <span class="ti-best-dir ${dirCls}">${dirIcon}</span>
            <span class="ti-best-tier">${_esc(tier.label || '')}</span>
          </div>

          ${metricsRow}

          <div class="ti-mat-wrap">
            <div class="ti-mat-label">
              <span>Teknik Görünüm Olgunluğu</span>
              <b>${matPct}%</b>
            </div>
            <div class="ti-mat-bar">
              <div class="ti-mat-fill" style="width:${Math.max(0, Math.min(100, matPct))}%"></div>
            </div>
          </div>

          ${rationaleBlock}
          ${confirmChips}
          ${needsBlock}
          ${levelsHtml}
        </div>
      </div>
    `;
  }

  function _scanStatsLine(scanStats) {
    if (!scanStats || !scanStats.tierCounts) return '';
    const c = scanStats.tierCounts;
    const parts = [];
    if (c.STRONG)  parts.push(`${c.STRONG} Güçlü`);
    if (c.VALID)   parts.push(`${c.VALID} Geçerli`);
    if (c.WEAK)    parts.push(`${c.WEAK} Zayıf`);
    if (c.AVOID)   parts.push(`${c.AVOID} Kaçın`);
    if (parts.length === 0) return '';
    return `<div style="font-size:10px;color:var(--text3);margin-top:8px;letter-spacing:.5px">
      Tarama: ${scanStats.scored || 0} coin değerlendirildi · ${parts.join(' · ')}
    </div>`;
  }

  return { render };
})();
