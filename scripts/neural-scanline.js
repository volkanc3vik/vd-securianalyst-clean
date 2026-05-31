/* ============================================================
   VD SecuriAnalyst — NEURAL kayan-isik enjektoru  (v62)
   Render-only: panellere yalnizca dekoratif .nx-scan span ekler.
   Motor / veri / event mantigina DOKUNMAZ. Idempotent.
   ============================================================ */
(function () {
  'use strict';

  var PANEL_SEL = [
    '.panel', '.glass', '.market-overview', '.joker-section',
    '.signal-card', '.intel-panel', '.intel-card', '.regime-card',
    '.ti-terminal', '.dash-card', '.mc'
  ].join(',');

  function variantFor(el) {
    var c = (el.className || '') + ' ' + (el.getAttribute('data-dir') || '');
    if (/joker/i.test(c)) return 'nx-scan-am';
    if (/(^|[^a-z])short|is-short|data-dir="?short/i.test(c) ||
        el.querySelector && el.querySelector('.sc-dir-short, [data-dir="short"]')) return 'nx-scan-rd';
    if (/(^|[^a-z])long|is-long|joker-long/i.test(c) ||
        el.querySelector && el.querySelector('.sc-dir-long, [data-dir="long"]')) return 'nx-scan-gn';
    return '';
  }

  function decorate(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll(PANEL_SEL);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-nx-scan') === '1') continue;     // idempotent
      el.setAttribute('data-nx-scan', '1');
      var cs = window.getComputedStyle(el);
      if (cs.position === 'static') el.style.position = 'relative';
      var span = document.createElement('span');
      span.className = 'nx-scan ' + variantFor(el);
      // her panele hafif faz farki -> dalga gibi aksin
      span.style.animationDelay = (-(i % 6) * 0.7) + 's';
      el.appendChild(span);
    }
  }

  function init() {
    decorate(document);
    // Scanner/Intelligence kartlari dinamik render edildigi icin gozlemle
    try {
      var mo = new MutationObserver(function (muts) {
        for (var j = 0; j < muts.length; j++) {
          if (muts[j].addedNodes && muts[j].addedNodes.length) { decorate(document); break; }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* sessizce gec */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
