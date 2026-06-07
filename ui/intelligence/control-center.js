// ════════════════════════════════════════════════════════════════════
// DASHBOARD CONTROL CENTER (build 134) — "Dashboard Purification"
//
// FELSEFE: Dashboard = Kontrol Merkezi · Workspace = İş Yapılan Yer
//
// Dashboard'da KALAN: Market State (üst başlık) + Opportunity Radar özeti
//   + 6 Workspace Kartı (+ mevcut Event/bildirim).
// Dashboard'dan GİZLENEN (workspace içine): tüm analiz yığını
//   = #futuresPanelMount + .search-card + #mainPanel (Grafik, SMC, Risk,
//     Entry, OI/Funding, indikatörler, AI panel...). Hepsi #mainPanel içinde.
//
// GRAFİK GÜVENLİĞİ: #mainPanel'i SAYFA AÇILINCA görünür bırakırız (TradingView
//   + LWC gerçek boyutta çizilir), kısa bir splash bunu maskeler; ~3.5sn sonra
//   yığını gizleriz. Futures Lab açılınca yığını GÖSTER + resize → grafik refit.
//   Böylece "0 boyutta init" (boş grafik) riski yoktur.
//
// DOKUNMAZ: scanner, risk/confidence, telegram, archive write, premium,
//   verify-code, SQL. Yeni API/veri yok. Sadece görünürlük + sunum.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VDControlCenter) return;
  var mode = 'boot';            // boot | dashboard | futures
  var _orig = new Map();

  function byId(id) { return document.getElementById(id); }
  function each(sel, fn) { try { document.querySelectorAll(sel).forEach(fn); } catch (e) {} }
  function hide(el) { if (!el) return; if (!_orig.has(el)) _orig.set(el, el.style.display); el.style.display = 'none'; }
  function show(el) { if (!el) return; var o = _orig.has(el) ? _orig.get(el) : ''; el.style.display = (o === 'none' ? '' : o); }
  function isElite() { try { return !!(window.VDAccess && ((VDAccess.isElite && VDAccess.isElite()) || (VDAccess.isAdmin && VDAccess.isAdmin()))); } catch (e) { return false; } }
  function fireResize() { [50, 300, 650, 1200].forEach(function (d) { setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, d); }); }

  // — gizlenecek/geri gelecek kümeler —
  var STACK = ['#futuresPanelMount', '.search-card', '#mainPanel'];
  var DASH_MID = ['.market-overview', '#regimeBar', '.scan-card', '#setupTracker', '#earlyRadar'];
  function moHeading() { var mo = document.querySelector('.market-overview'); if (mo) { var h = mo.previousElementSibling; if (h && /^H[1-3]$/.test(h.tagName)) return h; } return null; }
  function driversWrap() { var md = byId('marketDrivers'); return md ? md.parentElement : null; }

  // ---------- MODLAR ----------
  function enterDashboard() {
    STACK.forEach(function (s) { each(s, hide); });
    ['#aiWsLauncher', '#fxWsLauncher', '.vd-analysis-divider'].forEach(function (s) { each(s, hide); });
    DASH_MID.forEach(function (s) { each(s, show); });
    show(moHeading()); show(driversWrap()); show(byId('ccGrid'));
    var bar = byId('ccFxBar'); if (bar) bar.style.display = 'none';
    document.body.classList.remove('cc-fx');
    mode = 'dashboard';
  }
  function enterFutures() {
    STACK.forEach(function (s) { each(s, show); });
    each('#fxWsLauncher', hide); each('.vd-analysis-divider', hide);
    DASH_MID.forEach(function (s) { each(s, hide); });
    hide(moHeading()); hide(driversWrap()); hide(byId('ccGrid'));
    var bar = byId('ccFxBar'); if (bar) bar.style.display = 'flex';
    document.body.classList.add('cc-fx');
    try { window.scrollTo(0, 0); } catch (e) {}
    fireResize();
    mode = 'futures';
  }
  function backToDashboard() { enterDashboard(); fireResize(); }

  // — Coin Detail: radar kartından gelince tam ekran coin workspace —
  var _fromRadar = false;
  function setFx(title, backLabel) { var t = byId('ccFxTitle'); if (t) t.textContent = title; var b = byId('ccFxBack'); if (b) b.textContent = backLabel; }
  function setFxDir(dir, score) {
    var el = byId('ccFxDir'); if (!el) return;
    var d = (dir || '').toUpperCase(), sc = parseInt(score, 10);
    if (d !== 'LONG' && d !== 'SHORT') { el.textContent = ''; el.style.cssText = ''; return; }
    var col = d === 'LONG' ? '#36d399' : '#f87272';
    var emo = d === 'LONG' ? '\ud83d\udfe2' : '\ud83d\udd34';
    var label = ((!isNaN(sc) && sc >= 80) ? 'G\u00dc\u00c7L\u00dc ' : '') + d + ' E\u011e\u0130L\u0130M\u0130';
    el.textContent = emo + ' ' + label + (!isNaN(sc) ? ' \u00b7 skor ' + sc : '');
    el.style.color = col; el.style.borderColor = col + '66'; el.style.background = col + '1a';
  }
  function openFuturesLab() { _fromRadar = false; enterFutures(); setFx('\u25c8 Futures Lab', '\u2190 Geri D\u00f6n'); setFxDir(''); }
  function openCoinDetail(sym, dir, score) { _fromRadar = true; enterFutures(); setFx('\u25c8 ' + ((sym || '').replace('USDT', '')) + ' \u2014 Coin Detail', '\u2190 Radara D\u00f6n'); setFxDir(dir, score); }
  function fxBack() { var r = _fromRadar; _fromRadar = false; backToDashboard(); if (r && window.VDRadarWorkspace && VDRadarWorkspace.open) { setTimeout(function () { VDRadarWorkspace.open(); }, 60); } }

  // ---------- STİL ----------
  var STYLE = ''
    + '.cc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:16px 12px 0}'
    + '.cc-card{position:relative;background:#111722;border:1px solid #1e2836;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;overflow:hidden;transition:border-color .15s,transform .15s}'
    + '.cc-card:hover{border-color:color-mix(in srgb,var(--c) 55%,#1e2836);transform:translateY(-2px)}'
    + '.cc-card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--c)}'
    + '.cc-top{display:flex;align-items:center;gap:10px}'
    + '.cc-ic{width:34px;height:34px;border-radius:10px;background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--c);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}'
    + '.cc-t{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.cc-d{font-size:11px;color:#8b98ac;line-height:1.55;min-height:32px}'
    + '.cc-stat{font-size:11px;font-weight:700;color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);border-radius:8px;padding:5px 9px;align-self:flex-start}'
    + '.cc-btn{margin-top:auto;font-size:12.5px;font-weight:800;color:#04101f;background:var(--c);border:none;border-radius:10px;padding:10px;cursor:pointer;width:100%}'
    + '.cc-btn:hover{filter:brightness(1.08)}'
    + '.cc-card.cc-locked{opacity:.92}'
    + '.cc-card.cc-locked .cc-btn{background:#1b2433;color:#cbd5e6;border:1px solid #2b3a52}'
    + '.cc-lockstat{font-size:11px;font-weight:700;color:#b39dfa;background:rgba(179,157,250,.12);border-radius:8px;padding:5px 9px;align-self:flex-start}'
    + '.cc-fxbar{position:fixed;top:0;left:0;right:0;background:rgba(10,14,23,.97);border-bottom:1px solid #1e2836;display:none;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 16px;z-index:9100}'
    + '.cc-fxback{font-size:13px;font-weight:700;color:#e6edf6;background:#111722;border:1px solid #1e2836;border-radius:9px;padding:8px 14px;cursor:pointer}'
    + '.cc-fxback:hover{border-color:#2b3a52}'
    + '.cc-fxtitle{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.cc-fxnote{margin-left:auto;font-size:10px;color:#8b98ac}'
    + '.cc-fxdir{font-size:12px;font-weight:900;letter-spacing:.04em;border:1px solid transparent;border-radius:8px;padding:4px 11px}'
    + 'body.cc-fx{padding-top:52px}'
    + '#ccSplash{position:fixed;inset:0;background:#0a0e17;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;transition:opacity .4s}'
    + '#ccSplash .ring{width:42px;height:42px;border:3px solid #1e2836;border-top-color:#38bdf8;border-radius:50%;animation:ccspin 1s linear infinite}'
    + '#ccSplash .lbl{font-size:13px;font-weight:700;color:#8b98ac;letter-spacing:.04em}'
    + '@keyframes ccspin{to{transform:rotate(360deg)}}';

  function injectStyle() {
    if (byId('vd-cc-style')) return;
    var st = document.createElement('style'); st.id = 'vd-cc-style'; st.textContent = STYLE;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------- KARTLAR ----------
  function cardsHtml() {
    var elite = isElite();
    var defs = [
      { k: 'radar', c: '#f5b301', ic: '\u25c8', t: 'Opportunity Radar', d: 'Alt\u0131n \u00b7 Turuncu \u00b7 Gri katman \u2014 9 kart, 3 a\u015fama. En olgun yap\u0131lar.', stat: '3 katman \u00b7 9 kart', btn: 'Radar\u0131 A\u00e7 \u2192' },
      { k: 'ai', c: '#3b9eff', ic: '\u25c8', t: 'AI Intelligence', d: 'AI Reasoning \u00b7 A\u011f\u0131rl\u0131kl\u0131 Confirmation \u00b7 ECE 2.0 \u00b7 Narrative.', stat: 'Karar Motoru', btn: 'AI Workspace \u2192' },
      { k: 'futures', c: '#ff8a3d', ic: '\u25c8', t: 'Futures Lab', d: 'Canl\u0131 Grafik \u00b7 SMC \u00b7 Risk Engine \u00b7 Entry Engine \u00b7 OI / Funding.', stat: 'Tam ekran analiz', btn: 'Lab\u0027\u0131 A\u00e7 \u2192' },
      { k: 'perf', c: '#36d399', ic: '\u25c8', t: 'Performance', d: 'Win Rate \u00b7 Coin Leaderboard \u00b7 Sinyal Ge\u00e7mi\u015fi \u00b7 AI Learning.', stat: 'Do\u011frulanm\u0131\u015f sonu\u00e7lar', btn: 'A\u00e7 \u2192', statId: 'ccStat-perf' },
      { k: 'elite', c: '#b39dfa', ic: '\u25c8', t: 'Elite Intelligence', d: 'Do\u011frulanm\u0131\u015f sonu\u00e7 istihbarat\u0131 \u00b7 katman baz\u0131nda tutarl\u0131l\u0131k \u00b7 \u00f6\u011frenme e\u011frisi.', locked: !elite },
      { k: 'archive', c: '#8b98ac', ic: '\u25c8', t: 'Archive', d: 'Ge\u00e7mi\u015f analiz ar\u015fivi \u00b7 sonu\u00e7 takibi \u00b7 tutarl\u0131l\u0131k kayd\u0131.', stat: 'Sonu\u00e7 ar\u015fivi', btn: 'Ar\u015fivi A\u00e7 \u2192' }
    ];
    return defs.map(function (x) {
      var statEl, btn;
      if (x.k === 'elite' && x.locked) {
        statEl = '<div class="cc-lockstat">\ud83d\udd12 Kilitli \u2014 Elite Pass</div>';
        btn = '<button class="cc-btn" data-act="elite-locked">Elite Pass Al \u2192</button>';
        return '<div class="cc-card cc-locked" style="--c:' + x.c + '"><div class="cc-top"><span class="cc-ic">' + x.ic + '</span><span class="cc-t">' + x.t + '</span></div><div class="cc-d">' + x.d + '</div>' + statEl + btn + '</div>';
      }
      var sid = x.statId ? ' id="' + x.statId + '"' : '';
      statEl = '<div class="cc-stat"' + sid + '>' + (x.stat || '') + '</div>';
      var label = x.btn || ('A\u00e7 \u2192');
      if (x.k === 'elite') label = 'Elite Intelligence \u2192';
      btn = '<button class="cc-btn" data-act="' + x.k + '">' + label + '</button>';
      return '<div class="cc-card" style="--c:' + x.c + '"><div class="cc-top"><span class="cc-ic">' + x.ic + '</span><span class="cc-t">' + x.t + '</span></div><div class="cc-d">' + x.d + '</div>' + statEl + btn + '</div>';
    }).join('');
  }

  function act(k) {
    try {
      if (k === 'radar') { if (window.VDRadarWorkspace && VDRadarWorkspace.open) VDRadarWorkspace.open(); else { var b = byId('erOpenWs'); if (b) b.click(); } }
      else if (k === 'ai') { if (window.VDAiWorkspace && VDAiWorkspace.open) VDAiWorkspace.open(); }
      else if (k === 'futures') { openFuturesLab(); }
      else if (k === 'perf') { if (window.VDPerfWorkspace && VDPerfWorkspace.open) VDPerfWorkspace.open(); }
      else if (k === 'elite') { location.href = 'intelligence-center.html'; }
      else if (k === 'elite-locked') { location.href = 'legal/premium.html'; }
      else if (k === 'archive') { location.href = 'archive.html'; }
    } catch (e) {}
  }

  function refreshStats() {
    var w = byId('wrGaugePct'), s = byId('ccStat-perf');
    if (w && s) { var t = (w.textContent || '').trim(); s.textContent = (t && t !== '\u2014%' && t !== '\u2014') ? ('Win Rate ' + t) : 'Do\u011frulanm\u0131\u015f sonu\u00e7lar'; }
  }

  // ---------- KURULUM ----------
  function build() {
    var radar = byId('earlyRadar');
    if (!radar || byId('ccGrid')) return;
    injectStyle();

    // Splash (render-then-hide flash'\u0131n\u0131 maskeler)
    if (!byId('ccSplash')) {
      var sp = document.createElement('div'); sp.id = 'ccSplash';
      sp.innerHTML = '<div class="ring"></div><div class="lbl">Kontrol Merkezi haz\u0131rlan\u0131yor\u2026</div>';
      document.body.appendChild(sp);
    }

    // 6 kart grid \u2014 radar \u00f6zetinin hemen alt\u0131na
    var grid = document.createElement('div');
    grid.className = 'cc-grid'; grid.id = 'ccGrid';
    grid.innerHTML = cardsHtml();
    radar.parentNode.insertBefore(grid, radar.nextSibling);
    grid.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.cc-btn'); if (b) act(b.getAttribute('data-act'));
    });

    // Futures Lab geri-d\u00f6n bar\u0131
    if (!byId('ccFxBar')) {
      var bar = document.createElement('div'); bar.className = 'cc-fxbar'; bar.id = 'ccFxBar';
      bar.innerHTML = '<button class="cc-fxback" id="ccFxBack">\u2190 Geri D\u00f6n</button><span class="cc-fxtitle" id="ccFxTitle">\u25c8 Futures Lab</span><span class="cc-fxdir" id="ccFxDir"></span><span class="cc-fxnote">i\u015flem/y\u00f6n \u00f6nerisi de\u011fildir \u00b7 yat\u0131r\u0131m tavsiyesi de\u011fildir</span>';
      document.body.appendChild(bar);
      var bk = byId('ccFxBack'); if (bk) bk.addEventListener('click', fxBack);
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mode === 'futures') fxBack(); });

    setInterval(refreshStats, 4000); refreshStats();

    // Render-then-hide: grafik \u00e7izilsin, sonra temiz dashboard'a ge\u00e7
    setTimeout(function () {
      enterDashboard();
      var sp = byId('ccSplash');
      if (sp) { sp.style.opacity = '0'; setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 450); }
    }, 3500);
    // Failsafe: splash hi\u00e7bir ko\u015fulda tak\u0131l\u0131 kalmas\u0131n
    setTimeout(function () { var sp = byId('ccSplash'); if (sp && sp.parentNode) sp.parentNode.removeChild(sp); }, 6000);
  }

  function init() { try { build(); } catch (e) { var sp = byId('ccSplash'); if (sp && sp.parentNode) sp.parentNode.removeChild(sp); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 700); });
  else setTimeout(init, 700);
  setTimeout(init, 1800);

  window.VDControlCenter = { dashboard: backToDashboard, futures: openFuturesLab, coinDetail: openCoinDetail, _build: build };
})();
