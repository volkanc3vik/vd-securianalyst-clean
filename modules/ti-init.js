// ════════════════════════════════════════════════════════════════════
// TI INIT — Bootstrap
// Controller'ı başlat, panel'i mount et.
// Bağımlılık kontrolü yapar; eksik modül varsa erken çıkar.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function _init() {
    const deps = [
      'TIState', 'TIRegime', 'TIMMBias', 'TISetupScorer', 'TIMaturity',
      'TINarrator', 'TIFeed', 'TIController',
      'TIPanel', 'TIRegimeCard', 'TIMajorsCard',
      'TIBestSetupCard', 'TIWatchlistCard', 'TIWarningsCard',
    ];
    const missing = deps.filter(d => typeof window[d] === 'undefined');
    if (missing.length) {
      console.warn('[TIInit] Eksik modül(ler):', missing);
      return;
    }

    // Controller — scan event'i dinler
    window.TIController.start();

    // Panel mount
    const ok = window.TIPanel.mount('#tiPanelMount');
    if (!ok) {
      console.warn('[TIInit] #tiPanelMount bulunamadı.');
      return;
    }

    // İlk tarama gelmemiş olabilir — bir kez refresh dene (cache varsa)
    setTimeout(() => {
      try { window.TIController.refresh(); } catch {}
    }, 1500);

    console.log('[TIInit] Trading Intelligence hazır.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init, { once: true });
  } else {
    setTimeout(_init, 100);
  }
})();
