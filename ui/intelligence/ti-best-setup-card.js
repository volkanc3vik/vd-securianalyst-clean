// ════════════════════════════════════════════════════════════════════
// TI BEST SETUP CARD — Hero
// Score + Tier + Maturity Bar + Confirmed Chips + "What Needs to Happen"
// ════════════════════════════════════════════════════════════════════
window.TIBestSetupCard = (() => {
  'use strict';

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }
  function _tier(code) { var c = String(code || '').toUpperCase(); return _t('tier.' + c, null, c); }
  function _risk(lv) {
    if (!lv) return '—';
    var m = { 'low': 'Low', 'düşük': 'Low', 'orta': 'Moderate', 'moderate': 'Moderate', 'yüksek': 'High', 'high': 'High' };
    var key = m[String(lv).toLowerCase()];
    return key ? _t('risk.' + key, null, lv) : String(lv);
  }

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
          <div class="ti-card-label"><span class="ti-card-label-dot"></span>${_t('ti.bestSetupLabel', null, 'EN OLGUN SETUP')}</div>
          <div class="ti-empty">
            <div class="ti-empty-title">${_t('ti.bestEmptyTitle', null, 'Bu döngüde kaliteli teknik görünüm bulunmadı')}</div>
            <div>${_t('ti.bestEmptyDesc', null, 'Hiçbir coin kalite eşiğini geçmedi. Piyasa izleniyor.')}</div>
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
        <div class="ti-rationale-label">${_t('ti.whyStrong', null, 'Neden Güçlü')}</div>
        <div class="ti-rationale-text">${_esc(rationale)}</div>
      </div>
    ` : '';

    const needsBlock = missing.length
      ? `
        <div class="ti-needs">
          <div class="ti-needs-label">${_t('ti.whatNeeds', null, 'Sıradaki Gerekenler')}</div>
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
          <span class="ti-metric-label">${_t('ti.outlookEval', null, 'Görünüm Değerlendirmesi')}</span>
          <span class="ti-metric-val ti-metric-confidence">${score}</span>
        </div>
        <div class="ti-metric">
          <span class="ti-metric-label">${_t('ti.riskLevel', null, 'Risk Seviyesi')}</span>
          <span class="ti-metric-val ti-metric-risk ${riskCls}">${_esc(_risk(riskLevel))}</span>
        </div>
      </div>
    `;

    // Setup levels
    const levelsHtml = (setup.entry || setup.sl || setup.tp1) ? `
      <div class="ti-best-levels">
        ${setup.entry ? `<div class="ti-best-level"><span class="ti-best-level-label">${_t('ti.lvlReference', null, 'Referans')}</span><span class="ti-best-level-val entry">${_fmtPrice(setup.entry)}</span></div>` : ''}
        ${setup.sl    ? `<div class="ti-best-level"><span class="ti-best-level-label">${_t('ti.lvlRiskLimit', null, 'Risk Limiti')}</span><span class="ti-best-level-val sl">${_fmtPrice(setup.sl)}</span></div>` : ''}
        ${setup.tp1   ? `<div class="ti-best-level"><span class="ti-best-level-label">${_t('ti.lvlTarget1', null, 'Hedef Bölge 1')}</span><span class="ti-best-level-val tp1">${_fmtPrice(setup.tp1)}</span></div>` : ''}
        ${setup.tp2   ? `<div class="ti-best-level"><span class="ti-best-level-label">${_t('ti.lvlTarget2', null, 'Hedef Bölge 2')}</span><span class="ti-best-level-val tp2">${_fmtPrice(setup.tp2)}</span></div>` : ''}
      </div>
    ` : '';

    return `
      <div class="ti-card" style="padding:0;background:transparent;border:none">
        <div class="ti-card-label" style="padding:0 4px"><span class="ti-card-label-dot"></span>${_t('ti.bestSetupLabel', null, 'EN OLGUN SETUP')}</div>
        <div class="ti-best ${tierCls}">
          <div class="ti-best-head">
            <span class="ti-best-sym">${_esc(setup.sym || '—')}</span>
            <span class="ti-best-dir ${dirCls}">${dirIcon}</span>
            <span class="ti-best-tier">${_esc(tier.code ? _tier(tier.code) : (tier.label || ''))}</span>
          </div>

          ${metricsRow}

          <div class="ti-mat-wrap">
            <div class="ti-mat-label">
              <span>${_t('ti.maturityLabel', null, 'Teknik Görünüm Olgunluğu')}</span>
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
    if (c.STRONG)  parts.push(`${c.STRONG} ${_t('ti.scanStrong', null, 'Güçlü')}`);
    if (c.VALID)   parts.push(`${c.VALID} ${_t('ti.scanValid', null, 'Geçerli')}`);
    if (c.WEAK)    parts.push(`${c.WEAK} ${_t('ti.scanWeak', null, 'Zayıf')}`);
    if (c.AVOID)   parts.push(`${c.AVOID} ${_t('ti.scanAvoid', null, 'Kaçın')}`);
    if (parts.length === 0) return '';
    return `<div style="font-size:10px;color:var(--text3);margin-top:8px;letter-spacing:.5px">
      ${_t('ti.scanPrefix', { n: scanStats.scored || 0 }, 'Tarama: ' + (scanStats.scored || 0) + ' coin değerlendirildi')} · ${parts.join(' · ')}
    </div>`;
  }

  return { render };
})();
