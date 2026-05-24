@media(max-width:700px){.market-overview{grid-template-columns:1fr;}}

.mkt-card{
  background:var(--glass);
  border:1px solid var(--border);
  border-radius:16px;padding:16px 18px;
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  position:relative;overflow:hidden;cursor:pointer;
  transition:all .25s;
}
.mkt-card:hover{border-color:var(--border2);transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.3);}
.mkt-card::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;border-radius:16px 16px 0 0;}
.mkt-card.btc::before{background:linear-gradient(90deg,#f7931a,#ffcc00);}
.mkt-card.eth::before{background:linear-gradient(90deg,#627eea,#a78bfa);}
.mkt-card.btcd::before{background:linear-gradient(90deg,var(--cyan),var(--blue));}
.mkt-card-glow{position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;filter:blur(40px);opacity:.15;}
.mkt-card.btc .mkt-card-glow{background:#f7931a;}
.mkt-card.eth .mkt-card-glow{background:#627eea;}
.mkt-card.btcd .mkt-card-glow{background:var(--cyan);}

.mkt-header{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.mkt-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;}
.mkt-icon.btc{background:linear-gradient(135deg,#f7931a,#ffcc00);}
.mkt-icon.eth{background:linear-gradient(135deg,#627eea,#a78bfa);}
.mkt-icon.btcd{background:linear-gradient(135deg,var(--cyan),var(--blue));}
.mkt-name{font-size:13px;font-weight:700;color:var(--text);letter-spacing:.5px;}
.mkt-sub{font-size:10px;color:var(--text3);margin-top:1px;}
.mkt-badge{margin-left:auto;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;}

.mkt-price{font-size:clamp(20px,3vw,26px);font-weight:800;margin-bottom:4px;letter-spacing:-.5px;}
.mkt-chg{font-size:12px;font-weight:600;margin-bottom:12px;}
.mkt-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.mkt-stat{background:rgba(0,0,0,.2);border-radius:8px;padding:7px 10px;}
.mkt-stat-lbl{font-size:9px;color:var(--text3);letter-spacing:1px;margin-bottom:3px;font-weight:500;}
.mkt-stat-val{font-size:12px;font-weight:700;color:var(--text);}

/* BTC.D özel */
.btcd-meter{margin:10px 0;}
.btcd-track{height:8px;background:rgba(0,0,0,.3);border-radius:4px;overflow:hidden;}
.btcd-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--cyan),var(--blue));transition:width .6s;}
.btcd-labels{display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:4px;}

.mkt-signal{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;margin-top:8px;}
.mkt-signal.bull{background:var(--gGd);border:1px solid rgba(0,229,160,.3);color:var(--green);}
.mkt-signal.bear{background:var(--gRd);border:1px solid rgba(255,61,107,.3);color:var(--red);}
.mkt-signal.neut{background:rgba(255,193,7,.06);border:1px solid rgba(255,193,7,.3);color:var(--yellow);}

/* Mini sparkline */
.sparkline{width:100%;height:40px;margin:8px 0;}

/* ── SECTION LABELS ── */
.section{margin-bottom:20px;}
.section-title{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.section-title h2{font-size:12px;font-weight:600;letter-spacing:3px;color:var(--text3);text-transform:uppercase;}
.section-title .pill{font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;}
.pill-green{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.3);color:var(--green);}
.pill-red{background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.3);color:var(--red);}
.pill-cyan{background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3);color:var(--cyan);}
.pill-orange{background:rgba(255,122,0,.1);border:1px solid rgba(255,122,0,.3);color:var(--orange);}

/* ── OPP GRID ── */
@media(max-width:700px){.opp-grid{grid-template-columns:1fr;}}
.joker-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:700px){.joker-grid{grid-template-columns:1fr;}}

/* ── OPP CARD ── */
.opp{
  background:var(--glass);
  border:1px solid var(--border);
  border-radius:16px;padding:18px;
  cursor:pointer;transition:all .25s;
  position:relative;overflow:hidden;
  display:flex;flex-direction:column;
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
}
.opp::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;}
.opp.long::before,.opp.joker-long::before{background:linear-gradient(90deg,var(--green),transparent);}
.opp.short::before,.opp.joker-short::before{background:linear-gradient(90deg,var(--red),transparent);}
.opp.long:hover{border-color:rgba(0,229,160,.4);box-shadow:0 8px 32px var(--gG);transform:translateY(-3px);}
.opp.short:hover{border-color:rgba(255,61,107,.4);box-shadow:0 8px 32px var(--gR);transform:translateY(-3px);}
.opp.joker-long{border-color:rgba(0,212,255,.2);}
.opp.joker-long:hover{border-color:rgba(0,212,255,.5);box-shadow:0 8px 32px rgba(0,212,255,.15);transform:translateY(-3px);}
.opp.joker-short{border-color:rgba(255,122,0,.2);}
.opp.joker-short:hover{border-color:rgba(255,122,0,.5);box-shadow:0 8px 32px rgba(255,122,0,.15);transform:translateY(-3px);}
.opp.loading{opacity:.3;cursor:default;pointer-events:none;animation:shimmer 1.5s infinite;}
@keyframes shimmer{0%,100%{opacity:.3}50%{opacity:.5}}

.opp-glow{position:absolute;bottom:-20px;right:-20px;width:80px;height:80px;border-radius:50%;filter:blur(30px);opacity:.2;}
.opp.long .opp-glow{background:var(--green);}
.opp.short .opp-glow{background:var(--red);}
.opp.joker-long .opp-glow{background:var(--cyan);}
.opp.joker-short .opp-glow{background:var(--orange);}

.opp-dir{font-size:10px;font-weight:700;letter-spacing:3px;margin-bottom:8px;display:flex;align-items:center;gap:6px;}
.opp-dir.long{color:var(--green);}
.opp-dir.short{color:var(--red);}
.opp-dir.joker-l{color:var(--cyan);}
.opp-dir.joker-s{color:var(--orange);}
.opp-sym{font-size:24px;font-weight:800;color:var(--text);margin-bottom:2px;letter-spacing:-.5px;}
.opp-price{font-size:13px;color:var(--text2);margin-bottom:12px;font-weight:500;}

/* Score */
.score-wrap{margin-bottom:10px;}
.score-track{height:4px;background:rgba(255,255,255,.06);border-radius:2px;margin-bottom:5px;overflow:hidden;}
.score-fill{height:100%;border-radius:2px;transition:width .7s cubic-bezier(.4,0,.2,1);}
.score-labels{display:flex;justify-content:space-between;font-size:11px;}
.score-labels b{font-size:15px;font-weight:800;}

/* Risk */
.risk-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.risk-badge{font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;letter-spacing:.5px;}
.risk-low{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.3);color:var(--green);}
.risk-med{background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.3);color:var(--yellow);}
.risk-high{background:rgba(255,122,0,.1);border:1px solid rgba(255,122,0,.3);color:var(--orange);}
.risk-xhigh{background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.3);color:var(--red);}
.risk-track{flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
.risk-fill{height:100%;border-radius:2px;transition:width .6s;}

.opp-inds{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:10px;}
.opp-ind{font-size:11px;color:var(--text3);font-weight:500;}
.opp-ind b{color:var(--text2);}
.opp-desc{font-size:10px;color:var(--text3);line-height:1.55;border-top:1px solid var(--border);padding-top:8px;margin-bottom:10px;flex:1;font-weight:400;}
.opp-btn{
  display:flex;align-items:center;justify-content:center;gap:6px;
  padding:9px;border-radius:10px;font-size:12px;font-weight:600;
  cursor:pointer;transition:all .2s;font-family:'Inter',sans-serif;
  border:none;letter-spacing:.3px;
}

/* ── SCAN STATUS ── */
.scan-card{
  background:var(--glass);border:1px solid var(--border);
  border-radius:12px;padding:12px 16px;margin-bottom:20px;
  display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  backdrop-filter:blur(20px);
}
.scan-dot{width:8px;height:8px;border-radius:50%;background:var(--text3);flex-shrink:0;}
.scan-dot.on{background:var(--green);animation:pulse 1.5s infinite;}
.scan-txt{font-size:12px;color:var(--text2);flex:1;font-weight:500;}
.prog-wrap{height:2px;background:rgba(255,255,255,.06);border-radius:1px;margin-top:6px;display:none;width:100%;}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--green),var(--cyan));border-radius:1px;transition:width .3s;}

/* ── SEARCH ── */
.search-card{
  background:var(--glass);border:1px solid var(--border);
  border-radius:12px;padding:14px 16px;margin-bottom:14px;
  backdrop-filter:blur(20px);
}
.search-row{display:flex;gap:8px;margin-bottom:10px;}
.sym-inp{
  flex:1;background:rgba(0,0,0,.3);
  border:1px solid var(--border2);border-radius:10px;
  padding:11px 16px;color:var(--green);font-size:15px;
  font-family:'Inter',sans-serif;font-weight:600;letter-spacing:1px;
  outline:none;transition:border .2s;
}
.sym-inp:focus{border-color:rgba(0,229,160,.5);box-shadow:0 0 0 3px rgba(0,229,160,.08);}
.iv-row{display:flex;gap:6px;flex-wrap:wrap;}
.iv{
  border:1px solid var(--border);border-radius:8px;padding:7px 16px;
  color:var(--text3);font-size:12px;font-family:'Inter',sans-serif;
  cursor:pointer;background:transparent;transition:all .15s;font-weight:500;
}
.iv.on{border-color:var(--green);color:var(--green);background:rgba(0,229,160,.08);}
.iv:hover:not(.on){border-color:var(--border2);color:var(--text2);}

/* ── GLASS BUTTON ── */
.gbtn{
  display:inline-flex;align-items:center;gap:6px;
  background:var(--glass2);border:1px solid var(--border2);
  border-radius:10px;padding:10px 18px;font-size:12px;
  font-family:'Inter',sans-serif;font-weight:600;
  color:var(--text);cursor:pointer;transition:all .2s;letter-spacing:.3px;
}
.gbtn-green{border-color:rgba(0,229,160,.4);color:var(--green);}
.gbtn-green:hover{background:rgba(0,229,160,.1);box-shadow:0 0 20px rgba(0,229,160,.15);}
.gbtn-purple{border-color:rgba(157,125,250,.4);color:var(--purple);}
.gbtn-yellow{border-color:rgba(255,193,7,.4);color:var(--yellow);font-size:13px;padding:12px 24px;}
.gbtn-yellow:hover{background:rgba(255,193,7,.08);}
.gbtn-sm{padding:7px 14px;font-size:11px;}

/* ── ERROR/LOADER ── */
.err{background:rgba(255,61,107,.07);border:1px solid rgba(255,61,107,.25);border-radius:12px;padding:14px 16px;color:var(--red);font-size:13px;margin-bottom:14px;display:none;font-weight:500;}
.ldr{text-align:center;color:var(--text3);font-size:13px;padding:24px;display:none;font-weight:500;}

@media(max-width:650px){#tvContainer{height:400px;}}

@media(max-width:600px){.entry-grid{grid-template-columns:repeat(2,1fr);}}
.entry-item{background:rgba(0,0,0,.25);border:1px solid var(--border);border-radius:12px;padding:12px 14px;transition:all .2s;}
.entry-item:hover{border-color:var(--border2);}
.entry-lbl{font-size:9px;color:var(--text3);letter-spacing:2px;font-weight:600;margin-bottom:5px;text-transform:uppercase;}
.entry-val{font-size:14px;font-weight:700;}
.entry-sub{font-size:10px;color:var(--text3);margin-top:2px;font-weight:500;}

/* Verdict */
.verdict{border-radius:12px;padding:16px 18px;font-size:13px;line-height:1.75;font-weight:400;}
.verdict.long-v{background:rgba(0,229,160,.06);border:1px solid rgba(0,229,160,.2);border-left:4px solid var(--green);}
.verdict.short-v{background:rgba(255,61,107,.06);border:1px solid rgba(255,61,107,.2);border-left:4px solid var(--red);}
.verdict.wait-v{background:rgba(255,193,7,.04);border:1px solid rgba(255,193,7,.2);border-left:4px solid var(--yellow);}

/* ── S/R BOX ── */
.glass-card{background:var(--glass);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px;backdrop-filter:blur(20px);}
.gc-title{font-size:10px;font-weight:600;letter-spacing:3px;color:var(--text3);text-transform:uppercase;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);}
.sr-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:500px){.sr-grid{grid-template-columns:1fr;}}
.sr-col-title{font-size:10px;font-weight:700;letter-spacing:2px;margin-bottom:8px;text-transform:uppercase;}
.sr-item{background:rgba(0,0,0,.2);border-radius:10px;padding:10px 13px;display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;border:1px solid var(--border);transition:all .15s;}
.sr-item:hover{border-color:var(--border2);}
.sr-label{font-size:10px;color:var(--text3);font-weight:500;}
.sr-val{font-size:14px;font-weight:700;}
.sr-str{font-size:9px;padding:2px 8px;border-radius:20px;font-weight:700;letter-spacing:.5px;}

/* ── PATTERNS ── */
.pat-list{display:flex;flex-direction:column;gap:8px;}
.pat-item{background:rgba(0,0,0,.2);border:1px solid var(--border);border-radius:12px;padding:13px 15px;display:flex;align-items:flex-start;gap:13px;transition:all .15s;}
.pat-item:hover{border-color:var(--border2);}
.pat-icon{font-size:22px;flex-shrink:0;}
.pat-name{font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;}
.pat-desc{font-size:10px;color:var(--text3);line-height:1.5;font-weight:400;}
.pat-sig{font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;white-space:nowrap;flex-shrink:0;letter-spacing:.5px;}

/* ── INDICATORS ── */
@media(min-width:600px){.ind-grid{grid-template-columns:repeat(3,1fr);}}
@media(max-width:600px){.ai-stats{grid-template-columns:repeat(2,1fr);}}
.ai-stat{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:11px 13px;}
.ai-stat-lbl{font-size:9px;color:var(--text3);letter-spacing:2px;font-weight:600;margin-bottom:4px;text-transform:uppercase;}
.ai-stat-val{font-size:18px;font-weight:800;}
.ai-stat-sub{font-size:10px;color:var(--text3);margin-top:2px;}
.ai-wr-bar{height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-top:5px;}
.ai-wr-fill{height:100%;border-radius:3px;transition:width .6s;}
.ai-wgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px;}
.ai-witem{background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:9px 12px;}
.ai-wrow{display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;}
.ai-wname{color:var(--text2);font-weight:600;}
.ai-wval{color:var(--purple);font-weight:700;}
.ai-wbar{height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
.ai-wfill{height:100%;border-radius:2px;transition:width .5s;}
.ai-comment{background:rgba(157,125,250,.06);border:1px solid rgba(157,125,250,.18);border-radius:10px;padding:12px 14px;font-size:12px;color:var(--text2);line-height:1.65;margin-bottom:12px;}
.ai-comment b{color:var(--purple);}
.ai-coin-list{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
.ai-coin-row{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.2);border-radius:7px;padding:7px 11px;font-size:11px;}
.ac-sym{font-weight:700;color:var(--text);width:68px;flex-shrink:0;}
.ac-wr{font-weight:700;width:38px;}
.ac-bar{flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
.ac-fill{height:100%;border-radius:2px;transition:width .5s;}
.ac-cnt{font-size:10px;color:var(--text3);white-space:nowrap;}
.ai-hist{display:flex;flex-direction:column;gap:5px;max-height:300px;overflow-y:auto;}
.ai-hist-row{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.2);border-radius:7px;padding:8px 11px;font-size:11px;border:1px solid rgba(255,255,255,.05);}
.ai-hist-row.win{border-left:3px solid var(--green);}
.ai-hist-row.lose{border-left:3px solid var(--red);}
.ai-hist-row.pending{border-left:3px solid var(--yellow);animation:pendBlink 3s infinite;}
@keyframes pendBlink{0%,100%{border-left-color:rgba(255,193,7,.4)}50%{border-left-color:var(--yellow)}}
.ah-sym{font-weight:700;color:var(--text);width:58px;flex-shrink:0;}
.ah-dir{font-size:10px;font-weight:700;width:48px;flex-shrink:0;}
.ah-dir.long{color:var(--green);}
.ah-dir.short{color:var(--red);}
.ah-conf{color:var(--text3);font-size:10px;width:52px;flex-shrink:0;}
.ah-res{margin-left:auto;font-size:10px;font-weight:700;}
.ah-res.win{color:var(--green);}
.ah-res.lose{color:var(--red);}
.ah-res.pending{color:var(--yellow);}
.ah-pnl{font-size:10px;font-weight:700;margin-left:4px;}
.ah-age{font-size:9px;color:var(--text3);white-space:nowrap;}
.ah-track{font-size:9px;color:var(--text3);width:100%;margin-top:3px;padding-top:3px;border-top:1px solid rgba(255,255,255,.04);}

/* ════════════════════════════════════════════════════
   PROFESSIONAL AI TRADING TERMINAL — EXTRA CSS
   ════════════════════════════════════════════════════ */

/* Market Regime Badge */
.regime-bar{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.07);
  border-radius:12px;padding:10px 16px;margin-bottom:14px;
}
.regime-badge{
  display:inline-flex;align-items:center;gap:6px;
  font-size:11px;font-weight:800;padding:5px 14px;border-radius:20px;
  letter-spacing:1px;text-transform:uppercase;
}
.regime-TREND      {background:rgba(0,229,160,.15);border:1px solid rgba(0,229,160,.4);color:var(--green);}
.regime-SIDEWAYS   {background:rgba(255,193,7,.12);border:1px solid rgba(255,193,7,.4);color:var(--yellow);}
.regime-VOLATILE   {background:rgba(255,122,0,.15);border:1px solid rgba(255,122,0,.4);color:var(--orange);}
.regime-SQUEEZE    {background:rgba(157,125,250,.15);border:1px solid rgba(157,125,250,.4);color:var(--purple);}
.regime-PANIC      {background:rgba(255,61,107,.15);border:1px solid rgba(255,61,107,.4);color:var(--red);}
.regime-ACCUMULATE {background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.4);color:var(--cyan);}
.regime-DISTRIBUTE {background:rgba(255,122,0,.12);border:1px solid rgba(255,122,0,.35);color:var(--orange);}
.regime-desc{font-size:11px;color:var(--text2);flex:1;}
.regime-dot{width:7px;height:7px;border-radius:50%;animation:regimePulse 2s infinite;flex-shrink:0;}
@keyframes regimePulse{0%,100%{opacity:1}50%{opacity:.4}}

/* AI Trade Decision */
.ai-decision-card{
  border-radius:14px;padding:16px 18px;margin-bottom:14px;
  display:flex;align-items:flex-start;gap:14px;
}
.ai-decision-card.STRONG_LONG  {background:linear-gradient(135deg,rgba(0,229,160,.18),rgba(0,229,160,.05));border:2px solid rgba(0,229,160,.5);box-shadow:0 0 30px rgba(0,229,160,.15);}
.ai-decision-card.LONG         {background:rgba(0,229,160,.08);border:1px solid rgba(0,229,160,.3);}
.ai-decision-card.WEAK_LONG    {background:rgba(0,229,160,.04);border:1px solid rgba(0,229,160,.15);}
.ai-decision-card.WAIT         {background:rgba(255,193,7,.06);border:1px solid rgba(255,193,7,.25);}
.ai-decision-card.WEAK_SHORT   {background:rgba(255,61,107,.04);border:1px solid rgba(255,61,107,.15);}
.ai-decision-card.SHORT        {background:rgba(255,61,107,.08);border:1px solid rgba(255,61,107,.3);}
.ai-decision-card.STRONG_SHORT {background:linear-gradient(135deg,rgba(255,61,107,.18),rgba(255,61,107,.05));border:2px solid rgba(255,61,107,.5);box-shadow:0 0 30px rgba(255,61,107,.15);}
.ai-dec-icon{font-size:28px;flex-shrink:0;}
.ai-dec-label{font-size:16px;font-weight:900;letter-spacing:1px;margin-bottom:4px;}
.ai-dec-reason{font-size:12px;color:var(--text2);line-height:1.6;font-style:italic;}
.ai-dec-sub{font-size:11px;color:var(--text3);margin-top:6px;font-weight:400;}

/* Fake Breakout Warning */
.fake-warning{
  display:none;
  background:rgba(255,122,0,.08);border:1px solid rgba(255,122,0,.35);
  border-radius:10px;padding:10px 14px;margin-bottom:10px;
  font-size:12px;color:var(--orange);line-height:1.55;
}
.fake-warning.show{display:block;animation:fakeWarn .5s ease;}
@keyframes fakeWarn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}

/* OI + Funding Panel */
.oi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
@media(max-width:600px){.oi-grid{grid-template-columns:repeat(2,1fr);}}
.oi-card{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:11px 13px;}
.oi-lbl{font-size:9px;color:var(--text3);letter-spacing:2px;font-weight:600;margin-bottom:4px;text-transform:uppercase;}
.oi-val{font-size:15px;font-weight:800;}
.oi-sub{font-size:10px;color:var(--text3);margin-top:2px;}
.oi-badge{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;margin-top:5px;}
.oib-squeeze-s{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.3);color:var(--green);}
.oib-squeeze-l{background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.3);color:var(--red);}
.oib-crowded-l{background:rgba(255,122,0,.1);border:1px solid rgba(255,122,0,.3);color:var(--orange);}
.oib-crowded-s{background:rgba(157,125,250,.1);border:1px solid rgba(157,125,250,.3);color:var(--purple);}
.oib-neutral  {background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--text2);}

/* BTC Influence Meter */
.btc-inf-wrap{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px 14px;margin-bottom:12px;}
.btc-inf-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
.btc-inf-lbl{font-size:10px;color:var(--text3);font-weight:600;letter-spacing:1px;}
.btc-inf-val{font-size:13px;font-weight:800;}
.btc-inf-bar{height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;}
.btc-inf-fill{height:100%;border-radius:3px;transition:width .5s;}

/* Risk Engine */
.risk-engine-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;}
@media(max-width:500px){.risk-engine-grid{grid-template-columns:1fr 1fr;}}
.re-card{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:11px 13px;text-align:center;}
.re-lbl{font-size:9px;color:var(--text3);letter-spacing:2px;font-weight:600;margin-bottom:6px;text-transform:uppercase;}
.re-val{font-size:18px;font-weight:900;}
.re-sub{font-size:10px;color:var(--text3);margin-top:3px;}

/* Trade Management */
.tm-list{display:flex;flex-direction:column;gap:6px;}
.tm-item{display:flex;align-items:center;gap:10px;background:rgba(0,0,0,.2);border-radius:8px;padding:10px 13px;border:1px solid rgba(255,255,255,.05);}
.tm-icon{font-size:16px;flex-shrink:0;}
.tm-text{font-size:12px;color:var(--text2);flex:1;line-height:1.4;}
.tm-text b{color:var(--text);}
.tm-badge{font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;}
.tm-act{background:rgba(0,229,160,.1);border:1px solid rgba(0,229,160,.3);color:var(--green);}
.tm-warn{background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.3);color:var(--yellow);}
.tm-crit{background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.3);color:var(--red);}

/* Volatility Meter */
.vol-meter{height:8px;background:linear-gradient(90deg,var(--green),var(--yellow),var(--orange),var(--red));border-radius:4px;position:relative;margin:6px 0;}
.vol-needle{position:absolute;top:-4px;width:3px;height:16px;background:white;border-radius:2px;transform:translateX(-50%);transition:left .5s;box-shadow:0 0 6px rgba(255,255,255,.5);}

/* Squeeze Detector */
.squeeze-badge{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:4px 12px;border-radius:20px;}
.sq-active{background:rgba(157,125,250,.15);border:1px solid rgba(157,125,250,.4);color:var(--purple);animation:sqPulse 1.5s infinite;}
.sq-inactive{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--text3);}
@keyframes sqPulse{0%,100%{box-shadow:0 0 0 0 rgba(157,125,250,.4)}50%{box-shadow:0 0 0 6px rgba(157,125,250,0)}}

/* Glass card alt başlık */
.gc-sub{font-size:10px;color:var(--text3);margin-bottom:10px;line-height:1.5;}
@keyframes pulse2{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.7;transform:scale(1.1)}}

/* ── AI LWC PANEL ── */
.lwc-panel{background:var(--glass);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:16px;backdrop-filter:blur(20px);}
.lwc-hdr{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 16px;background:rgba(0,0,0,.3);border-bottom:1px solid var(--border);}
.lwc-title{font-size:10px;font-weight:700;letter-spacing:3px;color:var(--text3);text-transform:uppercase;}
.lwc-sym{font-size:15px;font-weight:800;color:var(--text);margin-left:4px;}
.lwc-ctrls{display:flex;gap:5px;margin-left:auto;flex-wrap:wrap;}
.lwcBtn{font-size:10px;font-weight:700;padding:4px 9px;border-radius:5px;cursor:pointer;font-family:'Inter',sans-serif;border:none;transition:all .15s;letter-spacing:.5px;}
.lwcBtn.on{opacity:1;}.lwcBtn:not(.on){opacity:.35;}.lwcBtn:hover{opacity:1!important;}
.lwcBtn.bsr{background:rgba(0,229,160,.12);color:var(--green);border:1px solid rgba(0,229,160,.3);}
.lwcBtn.btp{background:rgba(21,101,255,.12);color:#6ab0ff;border:1px solid rgba(21,101,255,.4);}
.lwcBtn.bms{background:rgba(157,125,250,.12);color:var(--purple);border:1px solid rgba(157,125,250,.3);}
.lwcBtn.bpat{background:rgba(255,193,7,.1);color:var(--yellow);border:1px solid rgba(255,193,7,.3);}
#lwcContainer{width:100%;height:460px;background:#010508;}
@media(max-width:650px){#lwcContainer{height:320px;}}
.lwc-legend{display:flex;gap:12px;flex-wrap:wrap;padding:7px 16px;background:rgba(0,0,0,.2);border-top:1px solid var(--border);font-size:10px;}
.lwc-leg{display:flex;align-items:center;gap:4px;color:var(--text3);}
.lwc-leg span{width:14px;height:2px;border-radius:1px;display:inline-block;}
.lwc-notes{display:flex;flex-wrap:wrap;gap:5px;padding:9px 14px;background:rgba(0,0,0,.15);border-top:1px solid var(--border);min-height:34px;}
.lwc-note{font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;font-family:'Inter',sans-serif;animation:lwcNoteIn .3s ease;}
@keyframes lwcNoteIn{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}

/* ════════════════════════════════════════════════════
@media(max-width:768px){
@media(max-width:400px){.sc-stats{grid-template-columns:repeat(2,1fr);}}
.sc-stat{background:rgba(0,0,0,.2);border-radius:7px;padding:7px 9px;border:1px solid rgba(255,255,255,.05);}
.sc-stat-lbl{font-size:8px;color:var(--text3);letter-spacing:1.5px;font-weight:600;text-transform:uppercase;margin-bottom:3px;}
.sc-stat-val{font-size:13px;font-weight:800;}

/* Timing */
.sc-timing{
  background:rgba(0,0,0,.18);border-radius:8px;padding:8px 11px;
  margin-bottom:10px;border:1px solid rgba(255,255,255,.05);
}
.sc-timing-lbl{font-size:9px;color:var(--text3);letter-spacing:1px;font-weight:600;margin-bottom:4px;}
.sc-timing-val{font-size:11px;color:var(--text2);line-height:1.5;}

/* AI Yorum */
.sc-ai-comment{
  border-radius:8px;padding:10px 13px;
  font-size:11px;line-height:1.65;font-style:italic;
  margin-bottom:10px;color:var(--text2);
}
.sc-ai-comment b{font-style:normal;}

/* Tags */
.sc-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
.sc-tag-item{font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;}

/* Aksiyon butonu */
.sc-action{
  width:100%;padding:10px;border-radius:8px;font-size:12px;font-weight:700;
  font-family:'Inter',sans-serif;cursor:pointer;border:none;
  transition:all .2s;letter-spacing:.5px;
}

/* Boş state */
.sc-empty{
  text-align:center;padding:30px 20px;
  font-size:13px;color:var(--text3);
}
.sc-empty-icon{font-size:28px;display:block;margin-bottom:8px;}

/* Signal Card Paneli */
.sig-card-panel{
  background:var(--glass);border:1px solid var(--border);
  border-radius:16px;overflow:hidden;margin-bottom:14px;
  backdrop-filter:blur(20px);
}
.sig-card-hdr{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  padding:12px 16px;background:rgba(0,0,0,.3);
  border-bottom:1px solid var(--border);
}
.sig-card-title{font-size:10px;font-weight:700;letter-spacing:3px;color:var(--text3);text-transform:uppercase;}
.sig-card-body{padding:14px 16px 6px;}

/* ════════════════════════════════════════
@media(max-width:480px){.risk-grid{grid-template-columns:1fr 1fr;}}
.risk-card{background:rgba(0,0,0,.22);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:11px 13px;text-align:center;}
.risk-card-lbl{font-size:9px;color:var(--text3);letter-spacing:2px;font-weight:600;margin-bottom:5px;text-transform:uppercase;}
.risk-card-val{font-size:20px;font-weight:900;}
.risk-card-sub{font-size:10px;color:var(--text3);margin-top:3px;}

/* Leverage gauge */
.lev-gauge{display:flex;align-items:center;gap:6px;margin:8px 0;}
.lev-bar{flex:1;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;}
.lev-fill{height:100%;border-radius:3px;transition:width .4s;}

   AŞAMA 3 — MOBİL UI + PERFORMANS + PREMİUM HİS
   ════════════════════════════════════════════════════ */

/* ── GPU Accelerated — tüm animasyonlar ── */
*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
@media(max-width:768px){
  #bottomNav{display:flex;justify-content:space-around;align-items:center;}
  body{padding-bottom:max(80px,calc(env(safe-area-inset-bottom)+80px)) !important;}
}
.bn-item{
  display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:6px 12px;border-radius:10px;cursor:pointer;
  font-family:'Inter',sans-serif;transition:all .15s;
  flex:1;-webkit-tap-highlight-color:transparent;
}
.bn-item.active{background:rgba(0,229,160,.08);}
.bn-item:active{transform:scale(.92);background:rgba(255,255,255,.05);}
.bn-icon{font-size:18px;line-height:1;}
.bn-label{font-size:9px;font-weight:600;letter-spacing:.5px;color:var(--text3);transition:color .15s;}
.bn-item.active .bn-label{color:var(--green);}
.bn-badge{
  position:absolute;top:-2px;right:-2px;
  background:var(--red);color:#fff;
  font-size:8px;font-weight:800;
  min-width:14px;height:14px;border-radius:7px;
  display:none;align-items:center;justify-content:center;padding:0 3px;
}
.bn-badge.show{display:flex;}

/* ── Floating Action Button ── */
#fabBtn{
  display:none;
  position:fixed;bottom:90px;right:16px;z-index:9989;
  width:52px;height:52px;border-radius:50%;
  background:linear-gradient(135deg,#1565ff,#00a878);
  border:none;cursor:pointer;font-size:22px;
  box-shadow:0 8px 24px rgba(21,101,255,.4);
  transition:all .2s;font-family:inherit;
  -webkit-tap-highlight-color:transparent;
}
@media(max-width:768px){#fabBtn{display:flex;align-items:center;justify-content:center;}}
#fabBtn:active{transform:scale(.9);}
#fabBtn.scanning{animation:fabScan 1.5s infinite;}
@keyframes fabScan{0%,100%{box-shadow:0 8px 24px rgba(21,101,255,.4)}50%{box-shadow:0 8px 32px rgba(0,229,160,.5)}}

/* ── Swipe Panel ── */
#swipePanel{
  display:none;
  position:fixed;bottom:0;left:0;right:0;z-index:9995;
  background:rgba(2,7,14,.98);
  border-top:1px solid rgba(255,255,255,.1);
  border-radius:20px 20px 0 0;
  backdrop-filter:blur(24px);
  transform:translateY(100%);
  transition:transform .35s cubic-bezier(.4,0,.2,1);
  max-height:80vh;overflow-y:auto;
  padding-bottom:max(16px,env(safe-area-inset-bottom));
}
#swipePanel.open{transform:translateY(0);}
@media(max-width:768px){#swipePanel{display:block;}}
.swipe-handle{
  width:36px;height:4px;border-radius:2px;
  background:rgba(255,255,255,.2);
  margin:10px auto 14px;
}
.swipe-panel-hdr{
  display:flex;align-items:center;gap:10px;
  padding:0 16px 12px;border-bottom:1px solid rgba(255,255,255,.06);
  font-size:12px;font-weight:700;color:var(--text);
}

/* ── Hızlı Coin Geçişi ── */
.quick-coin-strip{
  display:flex;gap:8px;overflow-x:auto;padding:10px 16px;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;
}
.quick-coin-strip::-webkit-scrollbar{display:none;}
.qc-chip{
  flex-shrink:0;padding:6px 14px;border-radius:20px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
  font-size:11px;font-weight:700;color:var(--text2);cursor:pointer;
  font-family:'Inter',sans-serif;transition:all .15s;
  -webkit-tap-highlight-color:transparent;
}
.qc-chip:active{transform:scale(.94);}
.qc-chip.active{background:rgba(0,229,160,.12);border-color:rgba(0,229,160,.4);color:var(--green);}
.qc-chip.short-active{background:rgba(255,61,107,.1);border-color:rgba(255,61,107,.4);color:var(--red);}

/* ── Micro Interactions ── */
.glass-card{transition:box-shadow .2s ease;}
.glass-card:hover{box-shadow:0 8px 40px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.06) inset;}
.gbtn{transition:all .15s ease !important;}
.gbtn:active{transform:scale(.96) !important;}
.opp:hover{transform:translateY(-3px);transition:transform .2s ease;}

/* ── Premium Loading State ── */
.skeleton{
  background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.08) 50%,rgba(255,255,255,.04) 75%);
  background-size:200% 100%;
  animation:skelLoad 1.5s infinite;
  border-radius:6px;
}
@keyframes skelLoad{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ── Intelligent Transitions ── */
.section-reveal{
  opacity:0;transform:translateY(12px);
  transition:opacity .4s ease,transform .4s ease;
}
.section-reveal.visible{opacity:1;transform:translateY(0);}

/* ── Premium Typography ── */
.gc-title{letter-spacing:.5px;}
.opp-sym{letter-spacing:-.5px;}

/* ── Touch Feedback ── */
@media(max-width:768px){
@media(max-width:768px){
  .topbar{padding:8px 12px;flex-wrap:nowrap;gap:6px;}
  .topbar-right{gap:6px;}
  .notif-btn span{display:none;}
  .nc-btn span:not(.nc-badge){display:none;}
  .topbar-logo span:last-child{display:none;}
}


/* ════════════════════════════════════════════════════
@media(max-width:600px){.perf-grid{grid-template-columns:repeat(2,1fr);}}
.perf-card{
  background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.07);
  border-radius:10px;padding:12px;text-align:center;
}
.perf-card-val{font-size:22px;font-weight:900;margin-bottom:3px;}
.perf-card-lbl{font-size:9px;color:var(--text3);letter-spacing:1.5px;font-weight:600;text-transform:uppercase;}
.perf-card-sub{font-size:10px;color:var(--text3);margin-top:4px;}

/* Coin leaderboard */
.coin-lb{display:flex;flex-direction:column;gap:5px;}
.coin-lb-item{
  display:flex;align-items:center;gap:10px;
  padding:9px 12px;border-radius:8px;
  background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);
  transition:background .15s;cursor:default;
}
.coin-lb-item:hover{background:rgba(255,255,255,.03);}
.coin-lb-rank{
  font-size:11px;font-weight:800;color:var(--text3);
  width:20px;text-align:center;flex-shrink:0;
}
.coin-lb-rank.gold{color:#ffd700;}
.coin-lb-rank.silver{color:#c0c0c0;}
.coin-lb-rank.bronze{color:#cd7f32;}
.coin-lb-sym{font-size:13px;font-weight:800;color:var(--text);flex:1;}
.coin-lb-wr{font-size:12px;font-weight:700;}
.coin-lb-bar-wrap{width:60px;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;}
.coin-lb-bar{height:100%;border-radius:2px;background:var(--green);}
.coin-lb-cnt{font-size:10px;color:var(--text3);width:40px;text-align:right;}

/* Signal history list */
.sig-hist-list{display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto;}
.sig-hist-list::-webkit-scrollbar{width:3px;}
.sig-hist-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px;}
.sig-hist-item{
  display:flex;align-items:center;gap:10px;
  padding:10px 12px;border-radius:8px;
  background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);
  border-left:3px solid transparent;
}
.sig-hist-item.win {border-left-color:var(--green);}
.sig-hist-item.loss{border-left-color:var(--red);}
.sig-hist-item.pend{border-left-color:var(--text3);}
.sig-hist-sym{font-size:12px;font-weight:800;color:var(--text);width:70px;flex-shrink:0;}
.sig-hist-dir{font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;flex-shrink:0;}
.sig-hist-dir.long {background:rgba(0,229,160,.1);color:var(--green);border:1px solid rgba(0,229,160,.2);}
.sig-hist-dir.short{background:rgba(255,61,107,.1);color:var(--red);border:1px solid rgba(255,61,107,.2);}
.sig-hist-result{font-size:11px;font-weight:700;margin-left:auto;}
.sig-hist-result.win {color:var(--green);}
.sig-hist-result.loss{color:var(--red);}
.sig-hist-result.pend{color:var(--text3);}
.sig-hist-time{font-size:9px;color:var(--text3);}
.sig-hist-rr{font-size:10px;color:var(--text3);}

/* WinRate gauge */
.wr-gauge{
  display:flex;align-items:center;gap:12px;
  padding:14px;background:rgba(0,0,0,.2);border-radius:10px;
  border:1px solid rgba(255,255,255,.06);margin-bottom:12px;
}
.wr-gauge-ring{
  width:64px;height:64px;border-radius:50%;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:16px;font-weight:900;position:relative;
}
.wr-gauge-info{flex:1;}
.wr-gauge-title{font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px;}
.wr-gauge-sub{font-size:10px;color:var(--text3);line-height:1.5;}

/* Tabs */
.analytics-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;}
.analytics-tab{
  font-size:10px;font-weight:700;padding:5px 14px;border-radius:20px;
  cursor:pointer;font-family:'Inter',sans-serif;border:none;
  transition:all .15s;letter-spacing:.5px;
  background:rgba(255,255,255,.05);color:var(--text3);
  border:1px solid rgba(255,255,255,.08);
}
.analytics-tab.active{background:rgba(0,229,160,.1);color:var(--green);border-color:rgba(0,229,160,.3);}

/* Mini bar chart */
.mini-chart{display:flex;align-items:flex-end;gap:3px;height:40px;margin-top:8px;}
.mini-bar{
  flex:1;border-radius:2px 2px 0 0;min-width:6px;
  transition:height .3s ease;cursor:default;
}
.mini-bar:hover{opacity:.8;}

