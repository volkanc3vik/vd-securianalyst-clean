// ════════════════════════════════════════════════════════════════════
// VDArchive · STATISTICS
// getArchiveStats() RPC → 6 kart. Düşük örneklemde oran "—" gösterir.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  const NS = (window.VDArchive = window.VDArchive || {});
  const U = NS.util;
  const MIN_SAMPLE = 5; // bu altında oran gösterme (yanıltıcı %100 önleme)

  function _card(label, value, sub, accent, sm) {
    return `
      <div class="aic-stat" style="--accent:${accent || 'var(--v4-cyan)'}">
        <div class="aic-stat-label">${U.esc(label)}</div>
        <div class="aic-stat-value ${sm ? 'sm' : ''}">${value}</div>
        ${sub ? `<div class="aic-stat-sub">${sub}</div>` : ''}
      </div>`;
  }

  function _fmtShortDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  }

  async function render(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Array.from({ length: 6 }).map(() => `<div class="aic-stat"><div class="aic-skel" style="height:78px"></div></div>`).join('');

    let s = null;
    try { s = window.SupabaseDB ? await window.SupabaseDB.getArchiveStats() : null; } catch (e) { s = null; }
    if (!s) {
      el.innerHTML = `<div class="aic-stat" style="grid-column:1/-1"><div class="aic-stat-label">${_t('arc.statistics', null, 'İstatistik')}</div><div class="aic-stat-value sm">${_t('arc.loadFail', null, 'Yüklenemedi')}</div></div>`;
      return;
    }

    const reviewed = +s.total_reviewed || 0;
    const enoughSample = reviewed >= MIN_SAMPLE;
    const vPct = (s.validated_pct != null && enoughSample) ? `${s.validated_pct}%` : '—';
    const pPct = (s.partial_pct != null && enoughSample) ? `${s.partial_pct}%` : '—';
    const sampleSub = enoughSample
      ? `${s.validated || 0} / ${reviewed} analiz`
      : 'Yeterli veri yok';

    el.innerHTML = [
      _card('Toplam Analiz', (s.total_all != null ? s.total_all : '—'), _t('arc.allRecords', null, 'Tüm kayıtlar'), 'var(--v4-cyan)'),
      _card(_t('arc.validatedWord', null, 'Doğrulanan'),     vPct, sampleSub, 'var(--v4-success)'),
      _card(_t('arc.partlyValidShort', null, 'Kısmen Doğr.'),   pPct, `${s.partial || 0} analiz`, 'var(--v4-warn)'),
      _card('Bekleyen',       (s.pending != null ? s.pending : '—'), _t('arc.underReview', null, 'İncelemede'), 'var(--v4-text-2)'),
      _card(_t('arc.mostAnalyzed', null, 'En Çok Analiz'),  (s.top_sym ? U.esc(s.top_sym) : '—'), 'coin', 'var(--v4-text)', true),
      _card(_t('arc.recentValidated', null, 'Son Doğrulanan'), _fmtShortDate(s.last_validated_at), 'tarih', 'var(--v4-text-2)', true),
    ].join('');

    // ── V3: Checkpoint Performance paneli (üst panele DOKUNMADAN, altına) ──
    try {
      const cp = s.checkpointPerf;
      if (cp && (cp.h1 || cp.h24)) {
        const box = (lbl, d) => {
          if (!d) return '';
          const cr = d.confirmRate != null ? '%' + d.confirmRate : '—';
          return '<div class="aic-cp-box">' +
            '<div class="aic-cp-h">' + lbl + '</div>' +
            '<div class="aic-cp-main">' + cr + '</div>' +
            '<div class="aic-cp-sub">' + _t('arc.cpConfirm', null, 'Doğrulama') + '</div>' +
            '<div class="aic-cp-rows">' +
              '<span style="color:#d8b45a">' + _t('arc.cpPartial', null, 'Kısmi') + ' %' + (d.partialRate != null ? d.partialRate : 0) + '</span>' +
              '<span style="color:#f08585">' + _t('arc.cpReject', null, 'Red') + ' %' + (d.rejectRate != null ? d.rejectRate : 0) + '</span>' +
              '<span style="color:#5b7a94">' + _t('arc.cpPending', null, 'Bekleyen') + ' ' + d.pending + '</span>' +
            '</div></div>';
        };
        el.insertAdjacentHTML('afterend',
          '<div class="aic-cp" id="aicCpPerf">' +
            '<div class="aic-cp-title">⏱ ' + _t('arc.cpTitle', null, 'Checkpoint Performance') + ' <span class="aic-cp-tag">' + _t('arc.cpTag', null, 'ufuk başına doğrulama') + '</span></div>' +
            '<div class="aic-cp-grid">' + box('1H', cp.h1) + box('4H', cp.h4) + box('12H', cp.h12) + box('24H', cp.h24) + '</div>' +
          '</div>');
        if (!document.getElementById('aicCpStyle')) {
          const st = document.createElement('style'); st.id = 'aicCpStyle';
          st.textContent =
            '.aic-cp{margin:14px 0 4px}' +
            '.aic-cp-title{font-size:12px;font-weight:800;letter-spacing:.05em;color:var(--v4-cyan,#00d4ff);margin-bottom:8px}' +
            '.aic-cp-tag{font-size:9px;color:var(--v4-text-3,#5b7a94);font-weight:600;margin-left:6px}' +
            '.aic-cp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}' +
            '.aic-cp-box{background:rgba(0,212,255,.04);border:1px solid rgba(0,212,255,.16);border-radius:10px;padding:10px 12px;text-align:center}' +
            '.aic-cp-h{font-size:11px;font-weight:800;color:var(--v4-text-2,#7fa9c9);letter-spacing:.08em}' +
            '.aic-cp-main{font-size:22px;font-weight:800;font-family:ui-monospace,Menlo,monospace;color:#36d399;margin:4px 0 1px}' +
            '.aic-cp-sub{font-size:8.5px;color:var(--v4-text-3,#5b7a94);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}' +
            '.aic-cp-rows{display:flex;justify-content:center;gap:8px;font-size:9.5px;flex-wrap:wrap}';
          document.head.appendChild(st);
        }
      }
    } catch (e) {}
  }

  NS.Stats = { render };
})();
