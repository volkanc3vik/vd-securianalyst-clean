/* ============================================================
   VD SecuriAnalyst — RadarCore  (ui/terminal/radar-core.js)
   Phase A · Sadece görünüm. Motor/scanner/veri DEĞİŞMEZ.
   Mevcut tarama verisini OKUR (ti-state varsa), yoksa veri
   parametresi / iskelet kullanır. Hiçbir motoru çağırmaz/yazmaz.
   ============================================================ */
(function (w) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var TAU = Math.PI * 2;

  function pol(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  // confluence yüzdesine göre yay (üstte 12 yönünden saat yönü)
  function arcPath(cx, cy, r, startDeg, endDeg) {
    var s = pol(cx, cy, r, endDeg), e = pol(cx, cy, r, startDeg);
    var large = (endDeg - startDeg) <= 180 ? 0 : 1;
    return 'M ' + s[0].toFixed(2) + ' ' + s[1].toFixed(2) +
           ' A ' + r + ' ' + r + ' 0 ' + large + ' 0 ' + e[0].toFixed(2) + ' ' + e[1].toFixed(2);
  }

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>]/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }

  // ---- SVG üret ----
  function buildSVG(d) {
    var S = 320, c = S / 2;
    var pct = Math.max(0, Math.min(100, d.confluence == null ? 0 : d.confluence));
    var rMain = 118, rDot = 96, rOuter = 138;
    var sweepDeg = pct / 100 * 360;
    var dirCol = d.direction === 'SHORT' ? 'var(--tm-danger)' :
                 d.direction === 'LONG'  ? 'var(--tm-ok)' : 'var(--tm-accent)';
    var sym = esc(d.symbol || '—');
    var dir = esc(d.direction || '');
    var confTxt = (d.confluence == null ? '··' : pct) + '%';

    // sweep wedge (saat yönünde dönen ışık huzmesi)
    var w0 = pol(c, c, rOuter, 0), w1 = pol(c, c, rOuter, 38);
    var wedge = 'M ' + c + ' ' + c + ' L ' + w0[0].toFixed(1) + ' ' + w0[1].toFixed(1) +
                ' A ' + rOuter + ' ' + rOuter + ' 0 0 1 ' + w1[0].toFixed(1) + ' ' + w1[1].toFixed(1) + ' Z';

    // crosshair ticks
    function tick(deg) {
      var a = pol(c, c, rOuter + 6, deg), b = pol(c, c, rOuter + 16, deg);
      return '<line class="tick" x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) +
             '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) +
             '" stroke="var(--tm-accent)" stroke-width="2" opacity="0.6"/>';
    }

    return '' +
'<svg viewBox="0 0 ' + S + ' ' + S + '" xmlns="' + NS + '">' +
  '<defs>' +
    '<radialGradient id="rcGlow" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="rgba(0,229,255,0.18)"/>' +
      '<stop offset="70%" stop-color="rgba(0,229,255,0.04)"/>' +
      '<stop offset="100%" stop-color="transparent"/>' +
    '</radialGradient>' +
    '<linearGradient id="rcSweep" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="rgba(0,229,255,0)"/>' +
      '<stop offset="100%" stop-color="rgba(0,229,255,0.28)"/>' +
    '</linearGradient>' +
    '<filter id="rcBlur" x="-50%" y="-50%" width="200%" height="200%">' +
      '<feGaussianBlur stdDeviation="3"/></filter>' +
  '</defs>' +

  '<circle cx="' + c + '" cy="' + c + '" r="' + (rMain + 8) + '" fill="url(#rcGlow)"/>' +
  // dış noktalı halka
  '<circle cx="' + c + '" cy="' + c + '" r="' + rOuter + '" fill="none" stroke="var(--tm-line-soft)" ' +
    'stroke-width="1" stroke-dasharray="1 7" opacity="0.7"/>' +
  // iç ince halka
  '<circle cx="' + c + '" cy="' + c + '" r="' + rDot + '" fill="none" stroke="var(--tm-line-soft)" stroke-width="1"/>' +
  // crosshair
  tick(0) + tick(90) + tick(180) + tick(270) +
  // ana confluence yayı (pct kadar dolu)
  '<circle cx="' + c + '" cy="' + c + '" r="' + rMain + '" fill="none" stroke="rgba(0,229,255,0.12)" stroke-width="6"/>' +
  '<path d="' + arcPath(c, c, rMain, 0, Math.max(0.1, sweepDeg)) + '" fill="none" ' +
    'stroke="var(--tm-accent)" stroke-width="6" stroke-linecap="round" filter="url(#rcBlur)" opacity="0.55"/>' +
  '<path d="' + arcPath(c, c, rMain, 0, Math.max(0.1, sweepDeg)) + '" fill="none" ' +
    'stroke="var(--tm-accent)" stroke-width="4" stroke-linecap="round"/>' +
  // dönen huzme + uç nokta
  '<g class="sweep">' +
    '<path d="' + wedge + '" fill="url(#rcSweep)"/>' +
    '<circle cx="' + pol(c, c, rOuter, 38)[0].toFixed(1) + '" cy="' + pol(c, c, rOuter, 38)[1].toFixed(1) +
      '" r="4" fill="#fff"/>' +
  '</g>' +
  // yörünge noktaları
  '<g class="orbit"><circle cx="' + pol(c, c, rDot, 300)[0].toFixed(1) + '" cy="' +
      pol(c, c, rDot, 300)[1].toFixed(1) + '" r="4" fill="var(--tm-ok)"/></g>' +
  '<g class="orbit rev"><circle cx="' + pol(c, c, rMain - 28, 110)[0].toFixed(1) + '" cy="' +
      pol(c, c, rMain - 28, 110)[1].toFixed(1) + '" r="3" fill="var(--tm-accent)"/></g>' +
  // merkez metin
  '<text class="conf-num" x="' + c + '" y="' + (c - 2) + '" text-anchor="middle" dominant-baseline="middle">' + confTxt + '</text>' +
  '<text class="conf-lbl" x="' + c + '" y="' + (c + 26) + '" text-anchor="middle">CONFLUENCE</text>' +
  '<text class="conf-sym" x="' + c + '" y="' + (c + 50) + '" text-anchor="middle" fill="' + dirCol + '">' +
      sym + (dir ? '  ·  ' + dir : '') + '</text>' +
'</svg>';
  }

  // ---- mevcut veriyi OKU (motoru çağırmadan, varsa state'ten) ----
  function readData(passed) {
    if (passed) return passed;
    try {
      var st = (w.TIState && w.TIState.get && w.TIState.get()) ||
               (w.tiState) || (w.TI && w.TI.state) || null;
      if (st && st.best) {
        return {
          confluence: st.best.confidence != null ? st.best.confidence : st.best.score,
          symbol: st.best.symbol, direction: st.best.direction,
          scanned: st.scanned, total: st.total, engines: st.engines,
          rsi: st.best.rsi, latency: st.latencyMs, nextScan: st.nextScan
        };
      }
    } catch (e) { /* sessiz: motor sözleşmesi değişmez */ }
    return { confluence: null, symbol: '—', direction: '' }; // iskelet
  }

  var RadarCore = {
    /** el: mount düğümü, data: opsiyonel {confluence,symbol,direction,...} */
    mount: function (el, data) {
      if (typeof el === 'string') el = document.getElementById(el) || document.querySelector(el);
      if (!el) return;
      el.classList.add('tm-radar');
      el.innerHTML = buildSVG(readData(data));
      el.__rcData = data || null;
      return el;
    },
    update: function (el, data) {
      if (typeof el === 'string') el = document.getElementById(el) || document.querySelector(el);
      if (!el) return;
      el.innerHTML = buildSVG(readData(data || el.__rcData));
    },
    svg: function (data) { return buildSVG(readData(data)); }
  };

  w.VDRadarCore = RadarCore;
})(window);
 
