// ════════════════════════════════════════════════════════════════════
// VDArchive · FEED
// listArchive(opts) ile sayfalı liste. "Daha Fazla Yükle" (pagination,
// infinite scroll YOK). Kart tıklaması → Modal.open(id).
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  function _t(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  const NS = (window.VDArchive = window.VDArchive || {});
  const U = NS.util;
  const PAGE_SIZE = 12;

  let _containerId = null;
  let _filter = {};
  let _offset = 0;
  let _items = [];
  let _hasMore = false;
  let _loading = false;

  function _feedEl() { return document.getElementById(_containerId); }

  // PHASE 3: teaser ise linkteki sembol, değilse null (premium/admin/free → kısıt yok)
  function _teaserSym() {
    try { if (window.VDAccess && window.VDAccess.level && window.VDAccess.level() === 'teaser' && window.VDTeaser) return window.VDTeaser.symbol(); } catch (e) {}
    return null;
  }
  function _teaserCtaHTML() {
    return `
      <div class="aic-teaser-cta" role="button" tabindex="0" data-teaser-cta>
        <div class="aic-teaser-cta-ic">🔒</div>
        <div class="aic-teaser-cta-tx">
          <b>${_t('arc.viewWithPremium', null, 'Premium erişim ile diğer coin analizlerini görüntüleyin')}</b>
          <span>${_t('arc.previewOnly', null, "Önizleme yalnızca bu coin içindir. Tüm arşiv, Outcome ve AI içgörüleri Premium'da.")}</span>
        </div>
        <span class="aic-teaser-cta-btn">Premium</span>
      </div>`;
  }
  function _wireTeaserCta(el) {
    el.querySelectorAll('[data-teaser-cta]').forEach(c => {
      const go = () => { if (typeof window.openPremiumLogin === 'function') window.openPremiumLogin(); else window.location.href = 'index.html#premium'; };
      c.addEventListener('click', go);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  function _skeletons(n) {
    return Array.from({ length: n }).map(() => `<div class="aic-skel"></div>`).join('');
  }

  function _render() {
    const el = _feedEl();
    if (!el) return;

    if (_items.length === 0 && !_loading) {
      el.innerHTML = `
        <div class="aic-empty">
          <div class="icon">◎</div>
          <div>${_t('arc.noMatch', null, 'Bu filtrelerle eşleşen analiz bulunamadı.')}</div>
        </div>${_teaserSym() ? _teaserCtaHTML() : ''}`;
      _wireTeaserCta(el);
      _renderPagination();
      return;
    }

    el.innerHTML = _items.map(rec => NS.Card.render(rec)).join('') + (_teaserSym() ? _teaserCtaHTML() : '');

    // Kart + buton click → modal
    el.querySelectorAll('.aic-card').forEach(card => {
      const id = card.getAttribute('data-id');
      card.addEventListener('click', (e) => {
        if (e.target.closest('.aic-detail-btn')) return; // buton kendi handler'ı
        NS.Modal.open(id);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); NS.Modal.open(id); }
      });
    });
    el.querySelectorAll('.aic-detail-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); NS.Modal.open(btn.getAttribute('data-id')); });
    });
    _wireTeaserCta(el);

    _renderPagination();
  }

  function _renderPagination() {
    const pg = document.getElementById('aic-pagination');
    if (!pg) return;
    if (_hasMore) {
      pg.innerHTML = `<button class="aic-loadmore" id="aic-loadmore" type="button">${_t('arc.loadMore', null, 'Daha Fazla Yükle')}</button>`;
      const b = document.getElementById('aic-loadmore');
      b.addEventListener('click', () => loadMore());
    } else {
      pg.innerHTML = '';
    }
  }

  function _updateCount() {
    const n = _items.length;
    const suffix = _hasMore ? '+' : '';
    NS.Filters && NS.Filters.setCount(`${n}${suffix} ${_t('arc.showing', null, 'analiz gösteriliyor')}`);
  }

  async function _fetchPage(reset) {
    if (_loading) return;
    _loading = true;
    const el = _feedEl();

    if (reset) {
      _offset = 0; _items = [];
      if (el) el.innerHTML = _skeletons(4);
    }

    let rows = [];
    try {
      // PHASE 3: teaser oturumunda feed YALNIZ linkteki coin'e kısıtlanır
      const tSym = _teaserSym();
      rows = window.SupabaseDB ? await window.SupabaseDB.listArchive({
        sym:      tSym || _filter.sym || undefined,
        status:   _filter.status || undefined,
        sinceISO: _filter.sinceISO || undefined,
        limit:    PAGE_SIZE,
        offset:   _offset,
      }) : [];
    } catch (e) { rows = []; }
    rows = rows || [];

    _items = _items.concat(rows);
    _hasMore = rows.length === PAGE_SIZE;
    _offset += rows.length;
    _loading = false;

    _render();
    _updateCount();
  }

  function load(containerId, filter) {
    _containerId = containerId;
    _filter = filter || {};
    _fetchPage(true);
  }

  function update(filter) {
    _filter = filter || {};
    _fetchPage(true);
  }

  function loadMore() { _fetchPage(false); }

  NS.Feed = { load, update, loadMore };
})();
