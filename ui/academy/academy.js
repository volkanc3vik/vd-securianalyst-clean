// ════════════════════════════════════════════════════════════════════
// ui/academy/academy.js  — VD Academy render + filtre + arama + access gate
//
// Access (VDAccess.level):
//   admin   → her şey
//   premium → ileri dersler + tüm detay bölümleri (grafikte/trader/hata/timeline)
//   free    → tüm kartlar görünür; kısa açıklama okunur; detaylar PREMIUM kilitli
//   teaser  → yalnız kısa açıklama (detay kilitli; ileri dersler kilit rozetli)
//
// Render-only. Scanner/Timeline/Archive/Access/Funnel'a DOKUNMAZ.
// window.VDAcademy
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const D = () => window.VDAcademyData || { categories: [], lessons: [] };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  const LEVEL = { temel:{ label:'Temel', cls:'lvl-temel' }, orta:{ label:'Orta', cls:'lvl-orta' }, ileri:{ label:'İleri', cls:'lvl-ileri' } };

  let _filter = 'all';   // kategori
  let _query = '';

  function _access() {
    try { if (window.VDAccess && window.VDAccess.level) return window.VDAccess.level(); } catch (e) {}
    return 'free';
  }
  function _isPremium() { const a = _access(); return a === 'premium' || a === 'admin'; }

  // ── Kart ──
  function _card(les) {
    const lv = LEVEL[les.level] || LEVEL.temel;
    const premium = _isPremium();
    const tags = (les.events || []).map(t => `<span class="ac-evtag">🔗 ${esc(t)}</span>`).join('');

    const detail = premium ? `
      <div class="ac-detail">
        <div class="ac-d-row"><div class="ac-d-lbl">📈 Grafikte nasıl görünür?</div><div class="ac-d-val">${esc(les.chart)}</div></div>
        <div class="ac-d-row"><div class="ac-d-lbl">🎯 Trader için ne anlama gelir?</div><div class="ac-d-val">${esc(les.trader)}</div></div>
        <div class="ac-d-row ac-d-warn"><div class="ac-d-lbl">⚠️ Riskli yorumlama hatası</div><div class="ac-d-val">${esc(les.mistake)}</div></div>
        ${tags ? `<div class="ac-d-row"><div class="ac-d-lbl">🔗 İlgili Timeline olayları</div><div class="ac-evtags">${tags}</div></div>` : ''}
      </div>`
      : `
      <div class="ac-lock">
        <div class="ac-lock-ic">🔒</div>
        <div class="ac-lock-tx">Grafikte görünüm · trader için anlamı · risk notu ve canlı Timeline örnekleri <b>Premium</b> üyeler içindir.</div>
        <button class="ac-lock-btn" type="button" data-ac-premium>🚀 Premium'a Geç</button>
      </div>`;

    return `
      <article class="ac-card" data-cat="${esc(les.cat)}" data-level="${esc(les.level)}" data-id="${esc(les.id)}">
        <div class="ac-card-head">
          <div class="ac-badges">
            <span class="ac-lvl ${lv.cls}">${lv.label}</span>
            ${les.level === 'ileri' && !premium ? '<span class="ac-prem-badge">Premium</span>' : ''}
          </div>
          <h3 class="ac-title">${esc(les.title)}</h3>
          <div class="ac-short">${esc(les.short)}</div>
        </div>
        ${detail}
      </article>`;
  }

  // ── Filtre + arama ──
  function _visible(les) {
    if (_filter !== 'all' && les.cat !== _filter) return false;
    if (_query) {
      const q = _query.toLowerCase();
      const hay = (les.title + ' ' + les.short + ' ' + (les.events || []).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function _renderGrid() {
    const grid = document.getElementById('acGrid'); if (!grid) return;
    const list = D().lessons.filter(_visible);
    grid.innerHTML = list.length
      ? list.map(_card).join('')
      : '<div class="ac-empty">Aramanıza uygun ders bulunamadı.</div>';
    const cnt = document.getElementById('acCount'); if (cnt) cnt.textContent = list.length + ' ders';
  }

  function _renderFilters() {
    const wrap = document.getElementById('acFilters'); if (!wrap) return;
    const cats = D().categories;
    const btn = (id, label, icon) => `<button class="ac-filter${_filter === id ? ' active' : ''}" data-cat="${id}" type="button">${icon ? icon + ' ' : ''}${esc(label)}</button>`;
    wrap.innerHTML = btn('all', 'Tümü', '◈') + cats.map(c => btn(c.id, c.label, c.icon)).join('');
  }

  function _wire() {
    document.getElementById('acFilters')?.addEventListener('click', e => {
      const b = e.target.closest('.ac-filter'); if (!b) return;
      _filter = b.dataset.cat; _renderFilters(); _renderGrid();
    });
    const search = document.getElementById('acSearch');
    if (search) search.addEventListener('input', () => { _query = search.value.trim(); _renderGrid(); });
    // Premium CTA → satış funnel (varsa) / yoksa dashboard premium
    document.getElementById('acGrid')?.addEventListener('click', e => {
      if (e.target.closest('[data-ac-premium]')) {
        if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin();
        else location.href = 'index.html#premium';
      }
    });
    // erişim değişiminde yeniden çiz (kilitler güncellensin)
    window.addEventListener('vd:access:changed', () => { _renderGrid(); });
  }

  function init() {
    _renderFilters();
    _renderGrid();
    _wire();
    // erişim rozetini göster
    const lvl = document.getElementById('acAccess');
    if (lvl) {
      const a = _access();
      const map = { admin:'◈ Admin — tam erişim', premium:'◈ Premium — tam erişim', teaser:'◈ Önizleme', free:'◈ Free — temel erişim' };
      lvl.textContent = map[a] || map.free;
      lvl.className = 'ac-access ac-access-' + a;
    }
  }

  window.VDAcademy = { init, _renderGrid };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
