
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
:root{
  --bg:#03080f;
  --bg2:rgba(10,20,35,0.8);
  --bg3:rgba(15,30,50,0.6);
  --glass:rgba(255,255,255,0.04);
  --glass2:rgba(255,255,255,0.07);
  --border:rgba(255,255,255,0.08);
  --border2:rgba(255,255,255,0.14);
  --text:#e8f4ff;--text2:#7aaac8;--text3:#3a6080;
  --green:#00e5a0;--green2:#00b87a;
  --red:#ff3d6b;--red2:#cc2050;
  --yellow:#ffc107;--purple:#9d7dfa;
  --cyan:#00d4ff;--orange:#ff7a00;
  --blue:#1565ff;
  --gG:rgba(0,229,160,.15);--gR:rgba(255,61,107,.15);
  --gGd:rgba(0,229,160,.06);--gRd:rgba(255,61,107,.06);
}
*{box-sizing:border-box;margin:0;padding:0;}
html{background:var(--bg);}
body{
  color:var(--text);
  font-family:'Inter',sans-serif;
  min-height:100vh;
  background:radial-gradient(ellipse at 20% 0%,rgba(21,101,255,.12) 0%,transparent 50%),
             radial-gradient(ellipse at 80% 0%,rgba(0,229,160,.08) 0%,transparent 50%),
             radial-gradient(ellipse at 50% 100%,rgba(157,125,250,.06) 0%,transparent 50%),
             var(--bg);
  padding:0 0 24px;
}

/* ── TOPBAR ── */
.topbar{
  background:rgba(3,8,15,0.95);
  border-bottom:1px solid var(--border);
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  padding:0 20px;
  display:flex;align-items:center;gap:16px;
  position:sticky;top:0;z-index:100;
  height:52px;
}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none;}
.logo-icon{width:32px;height:32px;background:linear-gradient(135deg,var(--green),var(--blue));border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
.logo-text{font-size:15px;font-weight:800;letter-spacing:1px;background:linear-gradient(90deg,var(--green),var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.logo-sub{font-size:9px;color:var(--text3);letter-spacing:3px;font-weight:500;margin-top:-2px;}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
.notif-btn{
  display:flex;align-items:center;gap:6px;
  background:var(--glass);border:1px solid var(--border);
  border-radius:8px;padding:6px 12px;cursor:pointer;
  font-size:11px;color:var(--text2);font-family:'Inter',sans-serif;
  transition:all .2s;
}
.notif-btn:hover{border-color:var(--green);color:var(--green);}
.notif-btn.active{background:rgba(0,229,160,.1);border-color:var(--green);color:var(--green);}
.notif-dot{width:7px;height:7px;border-radius:50%;background:var(--text3);}
.notif-dot.on{background:var(--green);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,229,160,.4)}50%{box-shadow:0 0 0 6px rgba(0,229,160,0)}}

/* ── MARKET TICKER (scrolling top bar) ── */
.ticker-wrap{
  background:rgba(5,12,22,0.9);
  border-bottom:1px solid var(--border);
  overflow:hidden;height:34px;display:flex;align-items:center;
}
.ticker-scroll{display:flex;gap:0;animation:scroll 40s linear infinite;white-space:nowrap;}
.ticker-scroll:hover{animation-play-state:paused;}
.ticker-item{display:inline-flex;align-items:center;gap:8px;padding:0 24px;border-right:1px solid var(--border);height:34px;font-size:11px;}
.ticker-sym{color:var(--text2);font-weight:600;letter-spacing:.5px;}
.ticker-price{color:var(--text);font-weight:700;}
.ticker-chg{font-size:10px;font-weight:600;padding:1px 6px;border-radius:3px;}
.ticker-chg.up{background:rgba(0,229,160,.12);color:var(--green);}
.ticker-chg.dn{background:rgba(255,61,107,.12);color:var(--red);}
@keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* ── MAIN CONTENT ── */
.main{padding:20px;max-width:1300px;margin:0 auto;}

/* ── MARKET OVERVIEW ── */
.market-overview{
  display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;
  margin-bottom:20px;
}