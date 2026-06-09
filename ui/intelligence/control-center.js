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
  // Coin Detail / Futures Lab odak modunda gizlenecek üst kabuk (ticker + nav menü + topbar)
  var TOPCHROME = ['.topbar', '.ticker-wrap', '.vdn-topnav', '.vdn-burger'];
  function moHeading() { var mo = document.querySelector('.market-overview'); if (mo) { var h = mo.previousElementSibling; if (h && /^H[1-3]$/.test(h.tagName)) return h; } return null; }
  function driversWrap() { var md = byId('marketDrivers'); return md ? md.parentElement : null; }

  // ---------- MODLAR ----------
  // Analiz yığını (#mainPanel/.search-card/#futuresPanelMount) görünürlüğü artık
  // body.cc-fx + statik CSS ile yönetiliyor (varsayılan ekran-dışı = dashboard temiz).
  function enterDashboard() {
    document.body.classList.remove('cc-fx');
    ['#aiWsLauncher', '#fxWsLauncher', '.vd-analysis-divider'].forEach(function (s) { each(s, hide); });
    DASH_MID.forEach(function (s) { each(s, show); });
    show(moHeading()); show(driversWrap()); show(byId('ccGrid'));
    TOPCHROME.forEach(function (s) { each(s, show); });
    var bar = byId('ccFxBar'); if (bar) bar.style.display = 'none';
    mode = 'dashboard';
  }
  function enterFutures() {
    document.body.classList.add('cc-fx');
    each('#fxWsLauncher', hide); each('.vd-analysis-divider', hide);
    DASH_MID.forEach(function (s) { each(s, hide); });
    hide(moHeading()); hide(driversWrap()); hide(byId('ccGrid'));
    TOPCHROME.forEach(function (s) { each(s, hide); });
    var bar = byId('ccFxBar'); if (bar) bar.style.display = 'flex';
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
  function fxDashBtn(on) { var b = byId('ccFxDash'); if (b) b.style.display = on ? 'inline-flex' : 'none'; }
  function fxToDash() { _fromRadar = false; backToDashboard(); }
  function openFuturesLab() { _fromRadar = false; enterFutures(); setFx('\u25c8 Futures Lab', '\u2190 Dashboard\u2019a D\u00f6n'); setFxDir(''); fxDashBtn(false); }
  function openCoinDetail(sym, dir, score) { _fromRadar = true; enterFutures(); setFx('\u25c8 ' + ((sym || '').replace('USDT', '')) + ' \u2014 Coin Detail', '\u2190 Radara D\u00f6n'); setFxDir(dir, score); fxDashBtn(true); }
  function fxBack() { var r = _fromRadar; _fromRadar = false; backToDashboard(); if (r && window.VDRadarWorkspace && VDRadarWorkspace.open) { setTimeout(function () { VDRadarWorkspace.open(); }, 60); } }

  // ---------- STİL ----------
  var STYLE = ''
    + '.cc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:16px 12px 0}'
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
    + '.cc-fxdash{color:#04101f !important;background:linear-gradient(90deg,#3b9eff,#38bdf8) !important;border:none !important}'
    + '.cc-fxtitle{font-size:14px;font-weight:800;color:#e6edf6}'
    + '.cc-fxnote{margin-left:auto;font-size:10px;color:#8b98ac}'
    + '.cc-fxdir{font-size:12px;font-weight:900;letter-spacing:.04em;border:1px solid transparent;border-radius:8px;padding:4px 11px}'
    + 'body.cc-fx{padding-top:52px}'
    + '#ccSplash{position:fixed;inset:0;background:#0a0e17;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;transition:opacity .4s}'
    + '#ccSplash .ring{width:42px;height:42px;border:3px solid #1e2836;border-top-color:#38bdf8;border-radius:50%;animation:ccspin 1s linear infinite}'
    + '#ccSplash .lbl{font-size:13px;font-weight:700;color:#8b98ac;letter-spacing:.04em}'
    + '/* BUILD 151 — Premium Dashboard Redesign (workspace kartlari) */'
    + '.cc-grid{grid-template-columns:repeat(auto-fit,minmax(196px,1fr));gap:14px}'
    + '.cc-card{background:linear-gradient(160deg,color-mix(in srgb,var(--c) 12%,rgba(8,18,33,.72)),rgba(7,16,28,.72));border:1px solid color-mix(in srgb,var(--c) 24%,rgba(255,255,255,.10));border-radius:18px;padding:0;gap:0;overflow:hidden;text-align:center;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 20%,transparent),inset 0 1px 0 rgba(255,255,255,.07),inset 0 0 34px -20px rgba(255,255,255,.16),0 0 20px -14px color-mix(in srgb,var(--c) 38%,transparent),0 10px 26px -18px rgba(0,0,0,.65);transition:transform .3s,border-color .3s,box-shadow .3s}'
    + '.cc-card::before{height:3px;left:0;right:0;top:0;background:linear-gradient(90deg,transparent,var(--c),transparent)}'
    + '.cc-card::after{content:"";position:absolute;top:0;left:-60%;width:50%;height:100%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent);transition:left .65s ease;pointer-events:none;z-index:1}'
    + '.cc-card:hover{transform:translateY(-4px);border-color:color-mix(in srgb,var(--c) 75%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 55%,transparent),inset 0 1px 0 rgba(255,255,255,.12),inset 0 0 30px -14px var(--c),0 0 0 1px color-mix(in srgb,var(--c) 38%,transparent),0 0 24px -2px color-mix(in srgb,var(--c) 55%,transparent),0 0 60px -12px var(--c),0 26px 60px -34px var(--c)}'
    + '.cc-card:hover::after{left:135%}'
    + '.cc-in{padding:22px 16px 18px;display:flex;flex-direction:column;align-items:center;position:relative;z-index:2}'
    + '.cc-stage{position:relative;width:96px;height:80px;display:grid;place-items:center;margin-bottom:12px}'
    + '.cc-stage::before{content:"";position:absolute;inset:6px 16px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--c) 42%,transparent),transparent 66%);filter:blur(10px);transition:.3s}'
    + '.cc-card:hover .cc-stage::before{inset:0 8px}'
    + '.cc-ring{position:absolute;border:1px solid color-mix(in srgb,var(--c) 28%,transparent);border-radius:50%}'
    + '.cc-ring.r1{width:76px;height:26px;bottom:6px}.cc-ring.r2{width:52px;height:18px;bottom:11px}'
    + '.cc-ico3d{width:56px;height:56px;position:relative;z-index:2;filter:drop-shadow(0 8px 14px color-mix(in srgb,var(--c) 55%,transparent));transition:transform .35s}'
    + '.cc-card:hover .cc-ico3d{transform:translateY(-3px) scale(1.05)}'
    + '.cc-t{font-size:15.5px;font-weight:800;color:var(--v4-text,#EAF6FF)}'
    + '.cc-d{font-size:11.5px;color:var(--v4-text-2,#7FA9C9);line-height:1.55;min-height:0;margin-top:7px}'
    + '.cc-stat{align-self:center;margin-top:12px;font-size:10.5px;font-weight:700;color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);border:1px solid color-mix(in srgb,var(--c) 24%,transparent);border-radius:30px;padding:4px 12px}'
    + '.cc-lockstat{align-self:center;margin-top:12px;border-radius:30px;padding:4px 12px}'
    + '.cc-btn{margin-top:14px;width:auto;align-self:center;font-size:11.5px;font-weight:800;letter-spacing:.02em;color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent);border:1px solid color-mix(in srgb,var(--c) 35%,transparent);border-radius:30px;padding:9px 18px;cursor:pointer;transition:.25s}'
    + '.cc-btn:hover{background:color-mix(in srgb,var(--c) 22%,transparent);filter:none}'
    + '.cc-card.cc-locked{opacity:.95}'
    + '.cc-card.cc-locked .cc-btn{background:#1b2433;color:#cbd5e6;border:1px solid #2b3a52}'
    + '@keyframes ccspin{to{transform:rotate(360deg)}}';

  function injectStyle() {
    if (byId('vd-cc-style')) return;
    var st = document.createElement('style'); st.id = 'vd-cc-style'; st.textContent = STYLE;
    (document.head || document.documentElement).appendChild(st);
  }

  // ---------- KARTLAR ----------
  function cardsHtml() {
    var elite = isElite();
    // BUILD 151 — Premium Dashboard Redesign: zengin ikonlu workspace kartlari
    var ICON = {
      radar: '<svg class="cc-ico3d" viewBox="0 0 64 64"><defs><radialGradient id="cg-radar" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#fff2cf"/><stop offset="42%" stop-color="#f5b301"/><stop offset="100%" stop-color="#7a4a10"/></radialGradient></defs><circle cx="32" cy="31" r="25" fill="url(#cg-radar)" opacity=".16"/><circle cx="32" cy="31" r="25" fill="none" stroke="#f5b301" stroke-width="2" opacity=".55"/><circle cx="32" cy="31" r="16.5" fill="none" stroke="#f5b301" stroke-width="1.4" opacity=".4"/><path d="M32 31 L54 18 A25 25 0 0 1 55 33 Z" fill="url(#cg-radar)" opacity=".55"/><circle cx="47" cy="21" r="3.2" fill="#fff3d0"/><circle cx="32" cy="31" r="2.6" fill="#ffe6a8"/></svg>',
      ai: '<svg class="cc-ico3d" viewBox="0 0 64 64"><defs><linearGradient id="cg-ai" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cdeaff"/><stop offset=".5" stop-color="#3b9eff"/><stop offset="1" stop-color="#1b347e"/></linearGradient></defs><path d="M30 12c-7 0-12 4-13 10-5 1-8 5-8 10 0 4 2 7 5 9 0 5 4 9 11 9 1.5 2.5 3.5 3.5 5 3.5V12.5C29 12 29.5 12 30 12z" fill="url(#cg-ai)"/><path d="M34 12c7 0 12 4 13 10 5 1 8 5 8 10 0 4-2 7-5 9 0 5-4 9-11 9-1.5 2.5-3.5 3.5-5 3.5V12.5C35 12 34.5 12 34 12z" fill="url(#cg-ai)" opacity=".93"/><path d="M32 17v32" stroke="#e2f1ff" stroke-width="1.3" opacity=".5"/></svg>',
      futures: '<svg class="cc-ico3d" viewBox="0 0 64 64"><defs><linearGradient id="cg-fut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6b0"/><stop offset=".5" stop-color="#ff8a3d"/><stop offset="1" stop-color="#a8350f"/></linearGradient></defs><line x1="20" y1="11" x2="20" y2="53" stroke="#ff8a3d" stroke-width="2" opacity=".55"/><rect x="14" y="22" width="12" height="22" rx="3" fill="url(#cg-fut)"/><line x1="44" y1="7" x2="44" y2="49" stroke="#ff8a3d" stroke-width="2" opacity=".55"/><rect x="38" y="15" width="12" height="18" rx="3" fill="url(#cg-fut)"/></svg>',
      perf: '<svg class="cc-ico3d" viewBox="0 0 64 64"><defs><linearGradient id="cg-perf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4ffe4"/><stop offset=".5" stop-color="#36d399"/><stop offset="1" stop-color="#0e6f4d"/></linearGradient></defs><rect x="12" y="36" width="11" height="16" rx="2.5" fill="url(#cg-perf)"/><rect x="26.5" y="26" width="11" height="26" rx="2.5" fill="url(#cg-perf)"/><rect x="41" y="16" width="11" height="36" rx="2.5" fill="url(#cg-perf)"/></svg>',
      elite: '<svg class="cc-ico3d" viewBox="0 0 64 64"><defs><linearGradient id="cg-eliteA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3d8ff"/><stop offset="1" stop-color="#b39dfa"/></linearGradient><linearGradient id="cg-eliteB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b39dfa"/><stop offset="1" stop-color="#46279f"/></linearGradient></defs><path d="M21 16h22l9 11-20 23L13 27z" fill="url(#cg-eliteB)"/><path d="M21 16h22l-11 11z" fill="url(#cg-eliteA)"/><path d="M13 27h39" stroke="#fff" stroke-width="1" opacity=".28"/></svg>',
      archive: '<svg class="cc-ico3d" viewBox="0 0 64 64"><defs><radialGradient id="cg-arch" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#d2ddec"/><stop offset="100%" stop-color="#4a5a72"/></radialGradient></defs><rect x="12" y="12" width="40" height="40" rx="9" fill="#16202f" stroke="#8b98ac" stroke-width="2"/><circle cx="32" cy="32" r="13" fill="none" stroke="#9fb1c8" stroke-width="2"/><circle cx="32" cy="32" r="7" fill="none" stroke="#9fb1c8" stroke-width="1.4"/><circle cx="32" cy="32" r="2.6" fill="#e2eaf5"/></svg>'
    };
    var defs = [
      { k: 'radar', c: '#f5b301', ic: '\u25c8', t: 'Opportunity Radar', d: 'Alt\u0131n \u00b7 Turuncu \u00b7 Gri katman \u2014 9 kart, 3 a\u015fama. En olgun yap\u0131lar.', stat: '3 katman \u00b7 9 kart', btn: 'Radar\u0131 A\u00e7 \u2192' },
      { k: 'ai', c: '#3b9eff', ic: '\u25c8', t: 'AI Intelligence', d: 'AI Reasoning \u00b7 A\u011f\u0131rl\u0131kl\u0131 Confirmation \u00b7 ECE 2.0 \u00b7 Narrative.', stat: 'Karar Motoru', btn: 'AI Workspace \u2192' },
      { k: 'futures', c: '#ff8a3d', ic: '\u25c8', t: 'Futures Lab', d: 'Canl\u0131 Grafik \u00b7 SMC \u00b7 Risk Engine \u00b7 Entry Engine \u00b7 OI / Funding.', stat: 'Tam ekran analiz', btn: 'Lab\u0027\u0131 A\u00e7 \u2192' },
      { k: 'perf', c: '#36d399', ic: '\u25c8', t: 'Performance', d: 'Win Rate \u00b7 Coin Leaderboard \u00b7 Sinyal Ge\u00e7mi\u015fi \u00b7 AI Learning.', stat: 'Do\u011frulanm\u0131\u015f sonu\u00e7lar', btn: 'A\u00e7 \u2192', statId: 'ccStat-perf' },
      { k: 'elite', c: '#b39dfa', ic: '\u25c8', t: 'Elite Intelligence', d: 'Do\u011frulanm\u0131\u015f sonu\u00e7 istihbarat\u0131 \u00b7 katman baz\u0131nda tutarl\u0131l\u0131k \u00b7 \u00f6\u011frenme e\u011frisi.', locked: !elite },
      { k: 'archive', c: '#8b98ac', ic: '\u25c8', t: 'Archive', d: 'Ge\u00e7mi\u015f analiz ar\u015fivi \u00b7 sonu\u00e7 takibi \u00b7 tutarl\u0131l\u0131k kayd\u0131.', stat: 'Sonu\u00e7 ar\u015fivi', btn: 'Ar\u015fivi A\u00e7 \u2192' }
    ];
    return defs.map(function (x) {
      var ic = ICON[x.k] || '';
      var stage = '<div class="cc-stage"><span class="cc-ring r1"></span><span class="cc-ring r2"></span>' + ic + '</div>';
      var statEl, btn;
      if (x.k === 'elite' && x.locked) {
        statEl = '<div class="cc-lockstat">\ud83d\udd12 Kilitli \u2014 Elite Pass</div>';
        btn = '<button class="cc-btn" data-act="elite-locked">Elite Pass Al \u2192</button>';
        return '<div class="cc-card cc-locked" style="--c:' + x.c + '"><div class="cc-in">' + stage + '<div class="cc-t">' + x.t + '</div><div class="cc-d">' + x.d + '</div>' + statEl + btn + '</div></div>';
      }
      var sid = x.statId ? ' id="' + x.statId + '"' : '';
      statEl = '<div class="cc-stat"' + sid + '>' + (x.stat || '') + '</div>';
      var label = x.btn || ('A\u00e7 \u2192');
      if (x.k === 'elite') label = 'Elite Intelligence \u2192';
      btn = '<button class="cc-btn" data-act="' + x.k + '">' + label + '</button>';
      return '<div class="cc-card" style="--c:' + x.c + '"><div class="cc-in">' + stage + '<div class="cc-t">' + x.t + '</div><div class="cc-d">' + x.d + '</div>' + statEl + btn + '</div></div>';
    }).join('');
  }

  function act(k) {
    try {
      if (k === 'radar') { if (window.VDRadarWorkspace && VDRadarWorkspace.open) VDRadarWorkspace.open(); else { var b = byId('erOpenWs'); if (b) b.click(); } }
      else if (k === 'ai') { if (window.VDAiWorkspace && VDAiWorkspace.open) VDAiWorkspace.open(); }
      else if (k === 'futures') { openFuturesLab(); }
      else if (k === 'perf') { if (window.VDPerfWorkspace && VDPerfWorkspace.open) VDPerfWorkspace.open(); }
      else if (k === 'elite') { location.href = 'intelligence-center.html'; }
      else if (k === 'elite-locked') { location.href = '/legal/premium.html'; }
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
      bar.innerHTML = '<button class="cc-fxback" id="ccFxBack">\u2190 Dashboard\u2019a D\u00f6n</button><button class="cc-fxback cc-fxdash" id="ccFxDash" style="display:none">Dashboard\u2019a D\u00f6n</button><span class="cc-fxtitle" id="ccFxTitle">\u25c8 Futures Lab</span><span class="cc-fxdir" id="ccFxDir"></span><span class="cc-fxnote">i\u015flem/y\u00f6n \u00f6nerisi de\u011fildir \u00b7 yat\u0131r\u0131m tavsiyesi de\u011fildir</span>';
      document.body.appendChild(bar);
      var bk = byId('ccFxBack'); if (bk) bk.addEventListener('click', fxBack);
      var bd = byId('ccFxDash'); if (bd) bd.addEventListener('click', fxToDash);
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mode === 'futures') fxBack(); });

    setInterval(refreshStats, 4000); refreshStats();

    // Dashboard temiz başlar (analiz yığını CSS ile zaten ekran-dışı). Splash YOK.
    enterDashboard();
  }

  function init() { try { build(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 700); });
  else setTimeout(init, 700);
  setTimeout(init, 1800);

  // bfcache'ten (history.back) geri gelince: dashboard'u TEMİZ duruma getir.
  // Aksi halde tarayıcı, temizlenmeden önceki anlık görüntüyü (paneller görünür) geri yükleyebilir.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    var sp = byId('ccSplash'); if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
    if (mode !== 'futures' && byId('ccGrid')) { try { enterDashboard(); } catch (err) {} }
  });

  window.VDControlCenter = { dashboard: backToDashboard, futures: openFuturesLab, coinDetail: openCoinDetail, _build: build };
})();
