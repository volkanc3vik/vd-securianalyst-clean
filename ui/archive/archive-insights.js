// ════════════════════════════════════════════════════════════════════
// ui/archive/archive-insights.js
// OUTCOME FAZ 4 — AI Learning Insights kartı (ADMIN-ONLY)
// İstatistiksel öğrenme sonuçlarını gösterir. window.VDInsights motorunu kullanır.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NS = (window.VDArchive = window.VDArchive || {});
  const U = () => NS.util || {};
  const esc = (s) => (U().esc ? U().esc(s) : String(s == null ? '' : s));
  const CID = 'aic-insights';

  function _isAdmin() {
    try {
      if (NS.Admin && typeof NS.Admin.isAdmin === 'function') return NS.Admin.isAdmin();
      const raw = localStorage.getItem('aap_access_v1');
      return !!(raw && JSON.parse(raw).isAdmin);
    } catch (e) { return false; }
  }

  function _rateClass(r) { return r >= 70 ? 'hi' : r >= 50 ? 'mid' : 'lo'; }

  function _rowHTML(r) {
    return `
      <div class="aic-ins-row">
        <div class="aic-ins-top">
          <span class="aic-ins-label">${esc(r.label)}</span>
          <span class="aic-ins-rate aic-ins-${_rateClass(r.rate)}">%${r.rate}</span>
        </div>
        <div class="aic-ins-bar"><span class="aic-ins-fill aic-ins-${_rateClass(r.rate)}" style="width:${Math.max(3, r.rate)}%"></span></div>
        <div class="aic-ins-meta">${r.n} örnek · ✓${r.validated} doğrulandı · ~${r.partial} kısmi · ✗${r.rejected} doğrulanmadı</div>
      </div>`;
  }

  function _render(host, data) {
    const total = data.total;
    if (total < 8) {
      host.innerHTML = `
        <div class="aic-ins-card">
          <div class="aic-ins-hdr">🧠 AI Learning Insights <span class="aic-ins-tag">yalnızca admin · istatistiksel</span></div>
          <div class="aic-ins-empty">Yeterli veri birikmedi. Anlamlı örüntü için en az ~8 incelenmiş analiz gerekir (şu an ${total}). Sonuç hesapladıkça öğrenme zenginleşecek.</div>
        </div>`;
      return;
    }
    // Kombinasyonları öne çıkar; az ise tekli + kombinasyon karışık
    const pool = (data.combos && data.combos.length >= 3) ? data.combos : data.rows;
    const strong = pool.slice(0, 6);
    const weak = pool.slice().sort((a, b) => a.rate - b.rate).filter(r => !strong.slice(0, 4).some(s => s.key === r.key)).slice(0, 2);

    host.innerHTML = `
      <div class="aic-ins-card">
        <div class="aic-ins-hdr">🧠 AI Learning Insights <span class="aic-ins-tag">yalnızca admin · istatistiksel</span></div>
        <div class="aic-ins-sub">Son ${total} incelenmiş analiz · doğrulama oranı = (doğrulandı + ½·kısmi) ÷ toplam</div>
        <div class="aic-ins-secttl">En güçlü setup'lar</div>
        ${strong.map(_rowHTML).join('') || '<div class="aic-ins-empty">Yeterli örnekli kombinasyon yok.</div>'}
        ${weak.length ? `<div class="aic-ins-secttl">Dikkat edilecek (düşük oran)</div>${weak.map(_rowHTML).join('')}` : ''}
        <div class="aic-ins-note">⚠ Retrospektif istatistiktir; geçmiş analizlerin tutarlılığını gösterir, gelecek getiri/başarı garantisi değildir.</div>
      </div>`;
  }

  async function mount() {
    const host = document.getElementById(CID);
    if (!host) return;
    if (!_isAdmin()) { host.hidden = true; return; }
    host.hidden = false;
    host.innerHTML = `<div class="aic-ins-card"><div class="aic-ins-hdr">🧠 AI Learning Insights</div><div class="aic-ins-empty">Yükleniyor…</div></div>`;
    try {
      const recs = await window.VDInsights.load();
      _render(host, window.VDInsights.computeInsights(recs));
    } catch (e) {
      host.innerHTML = `<div class="aic-ins-card"><div class="aic-ins-hdr">🧠 AI Learning Insights</div><div class="aic-ins-empty">İçgörüler yüklenemedi.</div></div>`;
    }
  }

  function refresh() { return mount(); }

  NS.Insights = { mount, refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  // Bir inceleme kaydedildiğinde içgörüleri tazele (yeni veri)
  window.addEventListener('vd:archive:reviewed', () => { try { window.VDInsights.load(true).then(() => refresh()); } catch (e) {} });
})();
