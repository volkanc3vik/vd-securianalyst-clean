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
   