   AI BİLDİRİM MERKEZİ + ENTRY ENGINE — CSS
   ════════════════════════════════════════════════════ */

/* Bildirim ikonu - topbar */
.nc-btn{
  position:relative;display:flex;align-items:center;gap:6px;
  background:rgba(255,255,255,.04);border:1px solid var(--border);
  border-radius:8px;padding:6px 12px;cursor:pointer;
  font-size:11px;font-weight:600;color:var(--text2);
  font-family:'Inter',sans-serif;transition:all .2s;
}
.nc-btn:hover{border-color:var(--purple);color:var(--purple);}
.nc-btn.has-critical{border-color:rgba(255,61,107,.6);color:var(--red);animation:ncCritical 1.5s infinite;}
@keyframes ncCritical{0%,100%{box-shadow:0 0 0 0 rgba(255,61,107,.3)}50%{box-shadow:0 0 0 6px rgba(255,61,107,0)}}
.nc-badge{
  position:absolute;top:-6px;right:-6px;
  background:var(--red);color:#fff;
  font-size:9px;font-weight:800;
  min-width:16px;height:16px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  padding:0 4px;display:none;
}
.nc-badge.show{display:flex;}

/* Dropdown panel */
.nc-panel{
  position:fixed;top:52px;right:14px;
  width:380px;max-width:calc(100vw - 28px);
  background:rgba(2,7,14,.97);
  border:1px solid rgba(157,125,250,.25);
  border-radius:14px;z-index:999;
  backdrop-filter:blur(24px);
  box-shadow:0 20px 60px rgba(0,0,0,.6);
  display:none;
  flex-direction:column;
  max-height:80vh;overflow:hidden;
}
.nc-panel.open{display:flex;animation:ncDrop .2s ease;}
  .nc-panel{
    top:0;left:0;right:0;bottom:0;
    width:100%;max-width:100%;
    border-radius:0;max-height:100vh;
    z-index:10000;
    position:fixed;
  }
  .nc-panel.open{
    display:flex;
  }
}
@keyframes ncDrop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
.nc-panel-hdr{
  display:flex;align-items:center;gap:8px;
  padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.07);
  flex-shrink:0;
}
.nc-panel-title{font-size:12px;font-weight:700;color:var(--text);letter-spacing:1px;}
.nc-panel-count{font-size:10px;color:var(--text3);margin-left:auto;}
.nc-clear{font-size:10px;color:var(--text3);cursor:pointer;padding:3px 8px;border-radius:4px;border:1px solid rgba(255,255,255,.08);background:none;font-family:'Inter',sans-serif;transition:all .15s;}
.nc-clear:hover{color:var(--red);border-color:rgba(255,61,107,.3);}

/* Filtreler */
.nc-filters{
  display:flex;gap:5px;padding:9px 14px;flex-wrap:wrap;
  border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;
}
.nc-filter{
  font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;
  cursor:pointer;font-family:'Inter',sans-serif;border:none;
  transition:all .15s;letter-spacing:.5px;
}
.nc-filter.active{opacity:1;}
.nc-filter:not(.active){opacity:.4;}
.nc-filter:hover{opacity:1;}
.nf-all  {background:rgba(255,255,255,.08);color:var(--text2);}
.nf-long {background:rgba(0,229,160,.12);color:var(--green);border:1px solid rgba(0,229,160,.2);}
.nf-short{background:rgba(255,61,107,.1);color:var(--red);border:1px solid rgba(255,61,107,.2);}
.nf-warn {background:rgba(255,122,0,.1);color:var(--orange);border:1px solid rgba(255,122,0,.2);}
.nf-crit {background:rgba(255,61,107,.15);color:var(--red);border:1px solid rgba(255,61,107,.3);}
.nf-entry{background:rgba(0,212,255,.1);color:var(--cyan);border:1px solid rgba(0,212,255,.2);}
.nf-fake {background:rgba(255,193,7,.1);color:var(--yellow);border:1px solid rgba(255,193,7,.2);}

/* Bildirim listesi */
.nc-list{overflow-y:auto;flex:1;padding:6px 0;}
.nc-item{
  padding:11px 16px;border-bottom:1px solid rgba(255,255,255,.04);
  cursor:default;transition:background .1s;position:relative;
}
.nc-item:hover{background:rgba(255,255,255,.02);}
.nc-item.unread::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
  border-radius:0 2px 2px 0;
}
.nc-item.unread.nc-critical::before{background:var(--red);}
.nc-item.unread.nc-high::before{background:var(--orange);}
.nc-item.unread.nc-medium::before{background:var(--yellow);}
.nc-item.unread.nc-low::before{background:var(--green);}
.nc-item-top{display:flex;align-items:center;gap:7px;margin-bottom:5px;}
.nc-sym{font-size:11px;font-weight:800;color:var(--text);}
.nc-dir{font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;}
.nc-dir.long{background:rgba(0,229,160,.12);color:var(--green);border:1px solid rgba(0,229,160,.25);}
.nc-dir.short{background:rgba(255,61,107,.1);color:var(--red);border:1px solid rgba(255,61,107,.25);}
.nc-dir.warn{background:rgba(255,122,0,.1);color:var(--orange);border:1px solid rgba(255,122,0,.25);}
.nc-dir.info{background:rgba(157,125,250,.1);color:var(--purple);border:1px solid rgba(157,125,250,.25);}
.nc-dir.entry{background:rgba(0,212,255,.1);color:var(--cyan);border:1px solid rgba(0,212,255,.25);}
.nc-dir.fake{background:rgba(255,193,7,.1);color:var(--yellow);border:1px solid rgba(255,193,7,.25);}
.nc-level{font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:auto;}
.nc-level.critical{background:rgba(255,61,107,.2);color:var(--red);}
.nc-level.high{background:rgba(255,122,0,.15);color:var(--orange);}
.nc-level.medium{background:rgba(255,193,7,.12);color:var(--yellow);}
.nc-level.low{background:rgba(0,229,160,.1);color:var(--green);}
.nc-msg{font-size:11px;color:var(--text2);line-height:1.55;margin-bottom:5px;}
.nc-meta{display:flex;gap:10px;font-size:9px;color:var(--text3);}
.nc-time{margin-left:auto;}
.nc-empty{text-align:center;padding:30px 20px;font-size:12px;color:var(--text3);}
.nc-empty span{font-size:24px;display:block;margin-bottom:8px;}

/* Entry Confirmation Engine Panel */
.ece-panel{
  background:linear-gradient(135deg,rgba(0,212,255,.05),rgba(157,125,250,.04));
  border:1px solid rgba(0,212,255,.18);border-radius:14px;
  padding:16px 18px;margin-bottom:14px;
}
.ece-hdr{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
.ece-title{font-size:10px;font-weight:700;letter-spacing:3px;color:var(--text3);text-transform:uppercase;}
.ece-stage-wrap{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
.ece-stage{
  display:flex;align-items:center;gap:10px;
  padding:9px 12px;border-radius:8px;
  background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);
  transition:all .3s;
}
.ece-stage.active{
  background:rgba(0,212,255,.08);border-color:rgba(0,212,255,.3);
  box-shadow:0 0 12px rgba(0,212,255,.1);
}
.ece-stage.done{
  background:rgba(0,229,160,.06);border-color:rgba(0,229,160,.2);
}
.ece-stage.failed{
  background:rgba(255,61,107,.06);border-color:rgba(255,61,107,.2);
  opacity:.6;
}
.ece-stage-icon{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}
.ece-stage-icon.pending{background:rgba(255,255,255,.07);color:var(--text3);}
.ece-stage-icon.active{background:rgba(0,212,255,.2);color:var(--cyan);animation:eceActive 1.5s infinite;}
.ece-stage-icon.done{background:rgba(0,229,160,.15);color:var(--green);}
.ece-stage-icon.failed{background:rgba(255,61,107,.15);color:var(--red);}
@keyframes eceActive{0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,.4)}50%{box-shadow:0 0 0 5px rgba(0,212,255,0)}}
.ece-stage-name{font-size:11px;font-weight:700;color:var(--text2);flex:1;}
.ece-stage-desc{font-size:10px;color:var(--text3);line-height:1.4;}
.ece-stage-time{font-size:9px;color:var(--text3);white-space:nowrap;}

/* Ana AI yorum kutusu */
.ece-comment{
  background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);
  border-radius:10px;padding:11px 14px;
  font-size:12px;color:var(--text2);line-height:1.65;
  font-style:italic;
}
.ece-comment b{color:var(--cyan);font-style:normal;}
.ece-comment .warn{color:var(--orange);}
.ece-comment .good{color:var(--green);}
.ece-comment .bad{color:var(--red);}

/* Trade Assistant şerit */
.ta-strip{
  display:flex;align-items:center;gap:8px;
  background:rgba(0,0,0,.25);border-radius:8px;padding:8px 12px;
  margin-top:8px;
}
.ta-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;animation:taDot 2s infinite;}
@keyframes taDot{0%,100%{opacity:1}50%{opacity:.3}}
.ta-text{font-size:11px;color:var(--text2);font-weight:500;}

/* Popup bildirim (sağ alt) */
.nc-popup{
  position:fixed;bottom:20px;right:16px;z-index:1000;
  display:flex;flex-direction:column;gap:8px;pointer-events:none;
}
.nc-popup-item{
  background:rgba(2,7,14,.95);border-radius:10px;padding:12px 14px;
  border:1px solid rgba(255,255,255,.1);min-width:280px;max-width:340px;
  pointer-events:all;animation:ncPopIn .3s ease;
  backdrop-filter:blur(20px);cursor:pointer;
}
.nc-popup-item.nc-critical{border-color:rgba(255,61,107,.5);box-shadow:0 0 20px rgba(255,61,107,.2);}
.nc-popup-item.nc-high{border-color:rgba(255,122,0,.4);}
.nc-popup-item.nc-medium{border-color:rgba(255,193,7,.3);}
.nc-popup-item.nc-low{border-color:rgba(0,229,160,.3);}
@keyframes ncPopIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.ncp-top{display:flex;align-items:center;gap:6px;margin-bottom:5px;}
.ncp-sym{font-size:12px;font-weight:800;color:var(--text);}
.ncp-msg{font-size:11px;color:var(--text2);line-height:1.5;}
.ncp-close{margin-left:auto;font-size:14px;cursor:pointer;color:var(--text3);background:none;border:none;font-family:inherit;padding:0;}

/* ════════════════════════════════════════════════════