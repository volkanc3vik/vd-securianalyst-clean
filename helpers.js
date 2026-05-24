// ════════════════════════════════════════════════════════════════════
// FUTURES INIT — Bootstrap
// DOM hazır olunca paneli mount eder ve aktif pozisyonların WS
// aboneliklerini geri kurar.
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  function _init() {
    // Tüm bağımlılıkların yüklendiğinden emin ol
    const deps = [
      'FuturesState', 'FuturesCalc', 'FuturesLiquidation', 'FuturesPnl',
      'FuturesController', 'FuturesModal', 'FuturesCard', 'FuturesPanel',
    ];
    const missing = deps.filter(d => typeof window[d] === 'undefined');
    if (missing.length) {
      console.warn('[FuturesInit] Eksik modül(ler):', missing);
      return;
    }

    // Panel'i mount et
    const mounted = window.FuturesPanel.mount('#futuresPanelMount');
    if (!mounted) {
      console.warn('[FuturesInit] #futuresPanelMount bulunamadı, panel mount edilmedi.');
      return;
    }

    // WSEngine henüz tanımlı değilse, hazır olunca rehydrate et
    function rehydrateWhenReady(retry = 0) {
      if (typeof window.WSEngine !== 'undefined') {
        try { window.FuturesController.rehydrate(); } catch (e) {
          console.warn('[FuturesInit] rehydrate hata:', e);
        }
        return;
      }
      if (retry > 30) return; // ~15s
      setTimeout(() => rehydrateWhenReady(retry + 1), 500);
    }
    rehydrateWhenReady();

    // Eski kapanmış pozisyonları periyodik temizle
    setInterval(() => {
      try { window.FuturesState.pruneClosed(50); } catch {}
    }, 5 * 60 * 1000);

    console.log('[FuturesInit] Futures paneli hazır.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init, { once: true });
  } else {
    // Script defer yok; DOMContentLoaded geçmiş olabilir
    // Kısa bekle, diğer scriptlerin yüklenmesi için
    setTimeout(_init, 100);
  }
})();
