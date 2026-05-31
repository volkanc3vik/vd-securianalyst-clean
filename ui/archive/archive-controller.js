// ════════════════════════════════════════════════════════════════════
// VDArchive · CONTROLLER
// Orkestratör: stats + filters + feed'i başlatır, filtre değişimini bağlar.
// EN SON yüklenir.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const NS = (window.VDArchive = window.VDArchive || {});

  function _onFilterChange(state) {
    NS.Feed.update(state);
  }

  function _openHashModal() {
    const m = location.hash.match(/id=([0-9a-fA-F-]+)/);
    if (m && m[1] && NS.Modal) NS.Modal.open(m[1]);
  }

  async function init() {
    if (!window.SupabaseDB) {
      console.warn('[VDArchive] SupabaseDB yüklü değil — arşiv okunamıyor.');
    }

    // Stats (bağımsız, paralel)
    if (NS.Stats) NS.Stats.render('aic-stats');

    // Filters → ilk state ile feed yükle
    if (NS.Filters) {
      await NS.Filters.render('aic-filters', _onFilterChange);
      const st = NS.Filters.getState();
      if (NS.Feed) NS.Feed.load('aic-feed', st);
    } else if (NS.Feed) {
      NS.Feed.load('aic-feed', { range: 'all', sinceISO: null });
    }

    // Deep-link: archive.html#id=<uuid>
    _openHashModal();
    window.addEventListener('hashchange', _openHashModal);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  NS.Controller = { init };
})();
