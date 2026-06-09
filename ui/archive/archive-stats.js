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
  }

  NS.Stats = { render };
})();
