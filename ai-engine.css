
#loginScreen{
  position:fixed;inset:0;z-index:99999;
  background:radial-gradient(ellipse at 20% 0%,rgba(21,101,255,.15) 0%,transparent 50%),
             radial-gradient(ellipse at 80% 0%,rgba(0,229,160,.1) 0%,transparent 50%),
             radial-gradient(ellipse at 50% 100%,rgba(125,125,250,.08) 0%,transparent 50%),
             #02070e;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-family:'Inter',sans-serif;transition:opacity .6s ease;
}
#loginScreen.hiding{opacity:0;pointer-events:none;}

.lb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;}
.lb1{width:500px;height:500px;background:rgba(21,101,255,.08);top:-150px;left:-150px;animation:lbFloat 8s ease-in-out infinite;}
.lb2{width:400px;height:400px;background:rgba(0,229,160,.07);bottom:-100px;right:-100px;animation:lbFloat 10s ease-in-out infinite reverse;}
.lb3{width:300px;height:300px;background:rgba(157,125,250,.06);top:50%;left:50%;transform:translate(-50%,-50%);animation:lbFloat 12s ease-in-out infinite;}
@keyframes lbFloat{0%,100%{transform:scale(1) translate(0,0)}50%{transform:scale(1.1) translate(10px,-10px)}}

.login-card{
  position:relative;z-index:1;
  width:100%;max-width:400px;
  padding:40px 36px;margin:0 16px;
  background:rgba(255,255,255,.025);
  border:1px solid rgba(255,255,255,.08);
  border-radius:24px;
  backdrop-filter:blur(30px);
  box-shadow:0 40px 80px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04) inset,0 0 60px rgba(21,101,255,.05);
}

.login-logo{display:flex;align-items:center;gap:12px;margin-bottom:32px;}
.login-logo-icon{
  width:46px;height:46px;border-radius:13px;
  background:linear-gradient(135deg,#1565ff,#00e5a0);
  display:flex;align-items:center;justify-content:center;font-size:22px;
  box-shadow:0 8px 24px rgba(21,101,255,.35);flex-shrink:0;
}
.login-logo-title{font-size:17px;font-weight:800;color:#fff;letter-spacing:.3px;display:block;}
.login-logo-sub{font-size:9px;font-weight:600;letter-spacing:3px;color:rgba(255,255,255,.3);text-transform:uppercase;display:block;margin-top:2px;}

.login-h{font-size:22px;font-weight:800;color:#fff;margin-bottom:6px;letter-spacing:-.3px;}
.login-p{font-size:12px;color:rgba(255,255,255,.35);margin-bottom:28px;line-height:1.6;}

.login-inp-wrap{position:relative;margin-bottom:12px;}
.login-inp{
  width:100%;padding:14px 48px 14px 16px;box-sizing:border-box;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;
  font-size:14px;font-weight:600;color:#fff;
  font-family:'Inter',sans-serif;letter-spacing:2px;
  outline:none;transition:all .2s;
}
.login-inp::placeholder{color:rgba(255,255,255,.2);letter-spacing:0;font-weight:400;font-size:13px;}
.login-inp:focus{border-color:rgba(0,229,160,.5);background:rgba(0,229,160,.04);box-shadow:0 0 0 3px rgba(0,229,160,.08);}
.login-inp.err{border-color:rgba(255,61,107,.5);background:rgba(255,61,107,.04);box-shadow:0 0 0 3px rgba(255,61,107,.08);animation:lShake .4s ease;}
@keyframes lShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}

.login-eye{
  position:absolute;right:14px;top:50%;transform:translateY(-50%);
  background:none;border:none;color:rgba(255,255,255,.3);
  cursor:pointer;font-size:16px;padding:4px;transition:color .2s;
}
.login-eye:hover{color:rgba(255,255,255,.6);}

.login-err{
  font-size:11px;font-weight:600;color:#ff3d6b;
  background:rgba(255,61,107,.08);border:1px solid rgba(255,61,107,.2);
  border-radius:8px;padding:10px 13px;margin-bottom:14px;
  display:none;line-height:1.5;
}
.login-err.show{display:block;animation:lErrIn .2s ease;}
@keyframes lErrIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}

.login-btn{
  width:100%;padding:14px;margin-top:4px;
  background:linear-gradient(135deg,#1565ff,#00a878);
  border:none;border-radius:12px;
  font-size:13px;font-weight:700;color:#fff;
  font-family:'Inter',sans-serif;letter-spacing:.5px;
  cursor:pointer;transition:all .2s;
  box-shadow:0 8px 24px rgba(21,101,255,.3);
}
.login-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 32px rgba(21,101,255,.4);}
.login-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:none;}

.login-spinner{
  display:inline-block;width:13px;height:13px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
  border-radius:50%;animation:lSpin .7s linear infinite;
  vertical-align:middle;margin-right:6px;
}
@keyframes lSpin{to{transform:rotate(360deg)}}

.login-footer{margin-top:24px;text-align:center;font-size:10px;color:rgba(255,255,255,.15);line-height:1.8;}

/* SAYAÇ BAR */
#timerBar{
  position:fixed;top:0;left:0;right:0;z-index:9998;
  background:rgba(2,7,14,.95);border-bottom:1px solid rgba(255,255,255,.06);
  display:none;align-items:center;gap:10px;
  padding:7px 16px;font-family:'Inter',sans-serif;
  backdrop-filter:blur(10px);
}
#timerBar.show{display:flex;}
.tb-icon{font-size:12px;}
.tb-text{font-size:11px;color:rgba(255,255,255,.5);flex:1;}
.tb-text b{color:#00e5a0;font-weight:700;}
.tb-text.warn b{color:#ff7a00;}
.tb-text.crit b{color:#ff3d6b;animation:tbBlink 1s infinite;}
@keyframes tbBlink{0%,100%{opacity:1}50%{opacity:.4}}
.tb-admin{font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(157,125,250,.15);border:1px solid rgba(157,125,250,.3);color:var(--purple,#9d7dfa);}
.tb-logout{
  font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;
  background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.25);
  color:#ff3d6b;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s;
}
.tb-logout:hover{background:rgba(255,61,107,.2);}

/* ═══════════════════════════════════════════════
   PHASE 10 — ELITE PRIORITY ENGINE CSS
   ═══════════════════════════════════════════════ */

/* Execution Mode Switcher */
.exec-mode-bar{display:flex;gap:6px;padding:10px 14px;background:rgba(0,0,0,.3);border-bottom:1px solid rgba(255,255,255,.06);overflow-x:auto;scrollbar-width:none;}
.exec-mode-bar::-webkit-scrollbar{display:none;}
.exec-mode-btn{padding:5px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:var(--text3);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer;white-space:nowrap;transition:all .2s;}
.exec-mode-btn.active{background:rgba(0,212,255,.15);border-color:rgba(0,212,255,.4);color:var(--cyan);}
.exec-mode-btn:hover{background:rgba(255,255,255,.08);}

/* Priority Rank Badge */
.p10-rank{position:absolute;top:-8px;left:50%;transform:translateX(-50%);padding:2px 12px;border-radius:10px;font-size:9px;font-weight:800;letter-spacing:1.5px;z-index:5;white-space:nowrap;}
.p10-rank-1{background:linear-gradient(90deg,#ffd700,#ffaa00);color:#000;}
.p10-rank-2{background:linear-gradient(90deg,#c0c0c0,#a0a0a0);color:#000;}
.p10-rank-3{background:linear-gradient(90deg,#cd7f32,#a05a1a);color:#fff;}

/* Star Grade Badge */
.p10-stars{font-size:13px;letter-spacing:1px;}
.p10-grade-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:10px;font-weight:700;}
.p10-grade-elite  {background:rgba(157,125,250,.2);border:1px solid rgba(157,125,250,.5);color:#b39dfa;}
.p10-grade-strong {background:rgba(0,229,160,.15);border:1px solid rgba(0,229,160,.4);color:var(--green);}
.p10-grade-good   {background:rgba(255,193,7,.12);border:1px solid rgba(255,193,7,.35);color:var(--yellow);}
.p10-grade-weak   {background:rgba(255,122,0,.1);border:1px solid rgba(255,122,0,.3);color:var(--orange);}
.p10-grade-avoid  {background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.3);color:var(--red);}

/* Execution tag */
.p10-exec-tag{display:inline-block;padding:2px 8px;border-radius:8px;font-size:9px;font-weight:700;margin-top:4px;}
.p10-tag-hp  {background:rgba(0,229,160,.12);color:var(--green);}
.p10-tag-agg {background:rgba(255,122,0,.12);color:var(--orange);}
.p10-tag-late{background:rgba(255,61,107,.1);color:var(--red);}
.p10-tag-trap{background:rgba(157,125,250,.12);color:#b39dfa;}
.p10-tag-whale{background:rgba(0,212,255,.12);color:var(--cyan);}

/* Market Narrative */
.p10-narrative{background:rgba(0,0,0,.3);border:1px solid rgba(0,212,255,.15);border-left:3px solid var(--cyan);border-radius:0 10px 10px 0;padding:10px 14px;margin:10px 0;font-size:11px;line-height:1.7;color:var(--text2);}
.p10-narrative b{color:var(--cyan);}
.p10-narrative .n-warn{color:var(--yellow);}
.p10-narrative .n-bull{color:var(--green);}
.p10-narrative .n-bear{color:var(--red);}

/* Liquidity Map */
.p10-liq-map{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:12px;margin:10px 0;}
.p10-liq-row{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.p10-liq-row:last-child{border:none;}
.p10-liq-icon{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.p10-liq-label{font-size:10px;color:var(--text3);flex:1;}
.p10-liq-price{font-size:11px;font-weight:700;}
.p10-liq-bar{width:60px;height:5px;background:rgba(0,0,0,.3);border-radius:3px;overflow:hidden;}
.p10-liq-fill{height:100%;border-radius:3px;}

/* Compact Mode */
.compact-card{background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;}
.compact-dir{font-size:11px;font-weight:800;min-width:55px;}
.compact-sym{font-size:15px;font-weight:900;flex:1;}
.compact-conf{font-size:13px;font-weight:700;min-width:45px;text-align:right;}
.compact-entry{font-size:10px;color:var(--text3);}
.compact-grade{font-size:18px;}

/* AI Mentor */
.p10-mentor{background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.2);border-radius:10px;padding:12px;}
.p10-mentor-msg{font-size:11px;color:var(--text2);line-height:1.6;}
.p10-mentor-tag{display:inline-block;padding:2px 8px;background:rgba(0,212,255,.1);border-radius:6px;font-size:9px;font-weight:700;color:var(--cyan);margin-right:4px;margin-bottom:4px;}

/* Priority score overlay on card */
.p10-priority-overlay{position:absolute;top:8px;right:8px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column;border:2px solid;}
.p10-prio-score{font-size:11px;font-weight:900;line-height:1;}
.p10-prio-label{font-size:7px;font-weight:700;opacity:.7;}

/* Quant mode table */
.p10-quant-table{width:100%;border-collapse:collapse;font-size:10px;}
.p10-quant-table th{color:var(--text3);font-weight:600;padding:5px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);}
.p10-quant-table td{padding:5px 8px;border-bottom:1px solid rgba(255,255,255,.04);}
