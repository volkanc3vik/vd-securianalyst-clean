// ════════════════════════════════════════════════════════════════════
// VDArchive · CARD + shared UTIL
// İLK yüklenen archive script'idir — namespace ve util'i tanımlar.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NS = (window.VDArchive = window.VDArchive || {});

  // ── Shared util ───────────────────────────────────────────────────
  const STATUS = {
    validated:            { label: 'Doğrulandı',         color: 'var(--v4-success)' },
    partially_validated:  { label: 'Kısmen Doğrulandı',  color: 'var(--v4-warn)' },
    not_validated:        { label: 'Doğrulanmadı',       color: 'var(--v4-danger)' },
    pending:              { label: 'Beklemede',          color: 'var(--v4-text-2)' },
  };
  const DIRECTION = {
    bullish: 'Yükseliş (Bullish)',
    bearish: 'Düşüş (Bearish)',
    neutral: 'Nötr (Neutral)',
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function statusMeta(s) { return STATUS[s] || { label: (s || '—'), color: 'var(--v4-text-2)' }; }
  function directionLabel(d) { return DIRECTION[d] || '—'; }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('tr-TR',
        { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return String(iso); }
  }
  function fmtPrice(n) {
    if (n == null || n === '' || isNaN(+n)) return '—';
    const v = +n;
    const dec = v >= 100 ? 2 : (v >= 1 ? 3 : 5);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtPct(n) {
    if (n == null || n === '' || isNaN(+n)) return '—';
    const v = +n;
    return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  function pctClass(n) {
    if (n == null || isNaN(+n)) return '';
    return +n > 0 ? 'pos' : (+n < 0 ? 'neg' : '');
  }

  NS.util = { esc, statusMeta, directionLabel, fmtDate, fmtPrice, fmtPct, pctClass };

  // ── Card render (saf fonksiyon) ───────────────────────────────────
  // rec → analysis_archive satırı. HTML string döner.
  function render(rec) {
    const m = statusMeta(rec.review_status);
    const tf = rec.timeframe ? `<span class="aic-tf-pill">${esc(rec.timeframe)}</span>` : '';
    const moveVal = rec.end_move_pct;
    const moveHtml = (moveVal != null && !isNaN(+moveVal))
      ? `<span class="aic-card-move">Gerçekleşen hareket: <b>${esc(fmtPct(moveVal))}</b></span>`
      : `<span class="aic-card-move"></span>`;

    return `
      <article class="aic-card" style="--status-color:${m.color}" data-id="${esc(rec.id)}" role="button" tabindex="0" aria-label="${esc(rec.sym)} analiz detayı">
        <div class="aic-card-top">
          <span class="aic-card-sym">${esc(rec.sym)}</span>
          ${tf}
          <span class="aic-badge" style="--status-color:${m.color}"><span class="dot"></span>${esc(m.label)}</span>
          <span class="aic-card-date">${esc(fmtDate(rec.created_at))}</span>
        </div>
        <p class="aic-card-summary">${esc(rec.analysis_summary || rec.analysis_text || '—')}</p>
        <div class="aic-card-bottom">
          ${moveHtml}
          <button class="aic-detail-btn" data-id="${esc(rec.id)}" type="button">Detayı Gör →</button>
        </div>
      </article>`;
  }

  NS.Card = { render };
})();
