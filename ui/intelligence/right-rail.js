// ════════════════════════════════════════════════════════════════════
// BUILD 153 — SAĞ RAIL: AI Piyasa Bias + En İyi 3 Fırsat
// SALT-OKUNUR: yalnız window.VDEarlyRadar.summary() çıktısını sunar.
// Scanner / skorlama / motorlara HİÇBİR dokunma yok. Yalnız dashboard +
// geniş ekran (CSS ile). Bu dosyanın <link>'ini silmek eski haline döndürür.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDRightRail) return;

  function _t(k, v, f) { return (window.VDt) ? window.VDt(k, v, f) : (f != null ? f : k); }

  function byId(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function lvl() { try { if (window.VDAccess && VDAccess.level) return VDAccess.level(); } catch (e) {} return 'free'; }
  function canSee() { var l = lvl(); return l === 'premium' || l === 'elite' || l === 'admin'; }

  function fmtPrice(p) {
    p = +p; if (!isFinite(p)) return '—';
    if (p >= 1000) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (p >= 1) return '$' + p.toFixed(2);
    if (p >= 0.01) return '$' + p.toFixed(4);
    return '$' + p.toFixed(6);
  }
  function chgHtml(c) {
    c = +c; if (!isFinite(c)) return '';
    var up = c >= 0;
    return '<span class="rl-chg ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ +' : '▼ ') + c.toFixed(2) + '%</span>';
  }
  function dirMeta(d) {
    d = (d || '').toUpperCase();
    if (d === 'LONG') return { txt: 'LONG', yon: _t('rr.yonUp', null, 'Yükseliş'), col: '#00FFA3' };
    if (d === 'SHORT') return { txt: 'SHORT', yon: _t('rr.yonDown', null, 'Düşüş'), col: '#FF3B6B' };
    return { txt: _t('rr.watch', null, 'İZLE'), yon: _t('rr.yonNeutral', null, 'Nötr'), col: '#7FA9C9' };
  }
  function stageWord(s) { return s === 'CONFIRMED' ? _t('rr.stageConfirmed', null, 'Teyitli') : (s === 'ARMED' ? _t('rr.stageArmed', null, 'Hazır') : _t('rr.stageWatch', null, 'İzleme')); }

  // ── AI Piyasa Bias göstergesi (SVG) ──
  function gaugeSVG(lp, sp) {
    var R = 54, C = 2 * Math.PI * R;
    var longLen = (lp / 100) * C, shortLen = (sp / 100) * C;
    var dom = lp >= sp ? 'LONG' : 'SHORT', domPct = lp >= sp ? lp : sp;
    var domCol = lp >= sp ? '#00D1FF' : '#FF3B6B';
    return ''
      + '<svg viewBox="0 0 140 140" class="rl-gauge" aria-hidden="true">'
      + '<circle cx="70" cy="70" r="64" fill="none" stroke="rgba(0,209,255,.06)" stroke-width="1"/>'
      + '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="11"/>'
      + '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="#00D1FF" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + longLen + ' ' + C + '" transform="rotate(-90 70 70)"/>'
      + '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="#FF3B6B" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + shortLen + ' ' + C + '" stroke-dashoffset="' + (-longLen) + '" transform="rotate(-90 70 70)"/>'
      + '<circle cx="70" cy="70" r="35" fill="rgba(2,5,13,.65)" stroke="rgba(0,209,255,.22)" stroke-width="1"/>'
      + '<text x="70" y="66" text-anchor="middle" class="rl-g-pct" style="fill:' + domCol + '">' + domPct + '%</text>'
      + '<text x="70" y="83" text-anchor="middle" class="rl-g-dom">' + dom + '</text>'
      + '</svg>';
  }

  function biasCard(s) {
    var b = s.bias || { lp: 0, sp: 0, L: 0, S: 0, tot: 0 };
    var conf = 0, top = (s.top || []);
    if (top.length) {
      var sum = 0, n = 0;
      top.forEach(function (r) { var sc = r && r.s && r.s.score; if (typeof sc === 'number') { sum += sc; n++; } });
      conf = n ? Math.round(sum / n) : 0;
    }
    return ''
      + '<div class="rl-card">'
      + '<div class="rl-h"><span class="rl-h-ic">◈</span><span class="rl-h-t">' + _t('rr.biasTitle', null, 'AI PİYASA BIAS') + '</span></div>'
      + '<div class="rl-bias">'
      + '<div class="rl-side rl-long"><div class="rl-side-t">LONG</div><div class="rl-side-p">' + b.lp + '%</div><div class="rl-side-s">' + _t('rr.longTrend', null, 'Yükseliş Eğilimi') + '</div></div>'
      + gaugeSVG(b.lp, b.sp)
      + '<div class="rl-side rl-short"><div class="rl-side-t">SHORT</div><div class="rl-side-p">' + b.sp + '%</div><div class="rl-side-s">' + _t('rr.shortTrend', null, 'Düşüş Eğilimi') + '</div></div>'
      + '</div>'
      + '<div class="rl-conf"><span>◈ ' + _t('rr.confScore', null, 'AI Güven Skoru:') + ' <b>' + conf + '</b>/100</span><button class="rl-btn" data-rl="bias">' + _t('rr.biasOpen', null, 'Bias Analizini Aç →') + '</button></div>'
      + '<div class="rl-micro">' + _t('rr.biasMicro', null, 'Yön dağılımı gözlemi (LONG/SHORT setup sayımı) · yatırım tavsiyesi değildir.') + '</div>'
      + '</div>';
  }

  function oppRow(r) {
    var sym = esc((r.sym || '').replace('USDT', ''));
    var dm = dirMeta(r.dir);
    var score = (r.s && r.s.score != null) ? r.s.score : '—';
    var scoreCol = (typeof score === 'number' && score >= 90) ? '#FFC247' : ((typeof score === 'number' && score >= 75) ? '#00FFA3' : '#7FA9C9');
    return ''
      + '<div class="rl-opp" data-sym="' + sym + '">'
      + '<div class="rl-opp-l"><div class="rl-logo" style="box-shadow:0 0 0 1.5px ' + dm.col + '55">' + sym.slice(0, 3) + '</div>'
      + '<div><div class="rl-opp-sym">' + sym + '<span class="rl-opp-q">/USDT</span> <span class="rl-dir" style="color:' + dm.col + ';background:' + dm.col + '1a;border-color:' + dm.col + '55">' + dm.txt + '</span></div>'
      + '<div class="rl-opp-px">' + fmtPrice(r.price) + ' ' + chgHtml(r.chg) + '</div>'
      + '<div class="rl-opp-tags"><span class="rl-tag">◆ ' + stageWord(r.stage) + ' ' + _t('rr.oppWord', null, 'Fırsat') + '</span><span class="rl-yon">' + _t('rr.dirLabel', null, 'Yön: ') + dm.yon + '</span></div>'
      + '</div></div>'
      + '<div class="rl-opp-r"><div class="rl-skor-l">' + _t('rr.skor', null, 'Skor') + '</div><div class="rl-skor"><b style="color:' + scoreCol + '">' + score + '</b><span>/100</span></div></div>'
      + '</div>';
  }

  function oppCard(s) {
    var top = (s.top || []).slice(0, 3);
    var totalAll = s.counts ? (s.counts.gold + s.counts.orange + s.counts.gray) : top.length;
    var more = Math.max(0, totalAll - top.length);
    var body = top.length ? top.map(oppRow).join('') : '<div class="rl-empty">' + _t('rr.empty', null, 'Bu taramada uygun yapı yok — sonraki taramada güncellenecek.') + '</div>';
    return ''
      + '<div class="rl-card">'
      + '<div class="rl-h"><span class="rl-h-ic">⚡</span><span class="rl-h-t">' + _t('rr.oppTitle', null, 'EN İYİ 3 FIRSAT') + '</span><button class="rl-link" data-rl="radar">' + _t('rr.radarOpen', null, 'Tüm Radarı Aç →') + '</button></div>'
      + body
      + (more > 0 ? '<div class="rl-more" data-rl="radar">' + _t('rr.moreOpp', { n: more }, '+ ' + more + ' fırsat daha mevcut →') + '</div>' : '')
      + '</div>';
  }

  function lockedCard() {
    return ''
      + '<div class="rl-card rl-locked">'
      + '<div class="rl-h"><span class="rl-h-ic">🔒</span><span class="rl-h-t">' + _t('rr.lockedTitle', null, 'AI PİYASA BIAS · FIRSATLAR') + '</span></div>'
      + '<p class="rl-lk-tx">' + _t('rr.lockedText', null, 'Yön dağılımı ve en olgun fırsatlar <b>Premium ve Elite</b> üyelere açıktır.') + '</p>'
      + '<a class="rl-btn rl-btn-g" href="/legal/premium.html">' + _t('rr.getAccess', null, 'Erişim Al →') + '</a>'
      + '</div>';
  }

  function render() {
    var rail = byId('vdRail'); if (!rail) return;
    if (!canSee()) { rail.innerHTML = lockedCard(); bind(rail); return; }
    var s = {};
    try { if (window.VDEarlyRadar && VDEarlyRadar.summary) s = VDEarlyRadar.summary(); } catch (e) { s = {}; }
    // LIVE FEED mount container'ı oppCard'dan sonra korunur (innerHTML ezse de yeniden eklenir)
    rail.innerHTML = biasCard(s) + oppCard(s) + '<div id="vdLfMount"></div>';
    bind(rail);
    // Render sonrası LIVE FEED'i mount noktasına yerleştir/yeniden bağla
    try { if (window.VDLiveFeed && VDLiveFeed.remount) VDLiveFeed.remount(); } catch (e) {}
  }

  function openRadar() { try { if (window.VDRadarWorkspace && VDRadarWorkspace.open) VDRadarWorkspace.open(); } catch (e) {} }
  function bind(rail) {
    rail.querySelectorAll('[data-rl]').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.getAttribute('data-rl');
        if (k === 'bias' || k === 'radar') openRadar();
      });
    });
    rail.querySelectorAll('.rl-opp[data-sym]').forEach(function (el) {
      el.addEventListener('click', openRadar);
    });
  }

  function ensure() {
    if (byId('vdRail')) return;
    if (!document.querySelector('.ticker-wrap')) return; // yalnız dashboard
    var rail = document.createElement('aside');
    rail.id = 'vdRail'; rail.className = 'vd-rail';
    rail.setAttribute('aria-label', _t('rr.ariaLabel', null, 'Piyasa bias ve fırsatlar'));
    document.body.appendChild(rail);
  }

  function boot() { ensure(); render(); }

  window.addEventListener('vd:scan:complete', function () { setTimeout(render, 350); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  else setTimeout(boot, 900);
  setTimeout(boot, 2200);
  setInterval(render, 6000);

  window.VDRightRail = { render: render };
})();
