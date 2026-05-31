/* ============================================================
   VD SecuriAnalyst — RadarCore  (ui/terminal/radar-core.js)
   Sadece görünüm. Motor/scanner/veri DEĞİŞMEZ.
   RENKLER LİTERAL (SVG attribute'ta var() çözülmediği için).
   ============================================================ */
(function (w) {
  'use strict';
  var C = { cy:'#00E5FF', gn:'#19F0A0', rd:'#FF4D6D', tx:'#DBEFF8', dim:'#436E7C', line:'rgba(0,229,255,0.16)' };
  function pol(cx,cy,r,d){ var a=(d-90)*Math.PI/180; return [cx+r*Math.cos(a), cy+r*Math.sin(a)]; }
  function arc(cx,cy,r,s,e){ var sp=pol(cx,cy,r,e),ep=pol(cx,cy,r,s),lg=(e-s)<=180?0:1;
    return 'M '+sp[0].toFixed(2)+' '+sp[1].toFixed(2)+' A '+r+' '+r+' 0 '+lg+' 0 '+ep[0].toFixed(2)+' '+ep[1].toFixed(2); }
  function esc(t){ return String(t==null?'':t).replace(/[&<>]/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;'})[c];}); }

  function buildSVG(d){
    var S=320,c=S/2,rMain=118,rDot=96,rOuter=138;
    var pct=Math.max(0,Math.min(100, d.confluence==null?0:+d.confluence));
    var sweep=pct/100*360;
    var sym=esc(d.symbol||'—'), dir=esc(d.direction||'');
    var dcol = dir==='SHORT'?C.rd : dir==='LONG'?C.gn : C.cy;
    var confTxt=(d.confluence==null?'··':Math.round(pct))+'%';
    function tk(deg){ var a=pol(c,c,rOuter+6,deg),b=pol(c,c,rOuter+16,deg);
      return '<line class="tick" x1="'+a[0].toFixed(1)+'" y1="'+a[1].toFixed(1)+'" x2="'+b[0].toFixed(1)+'" y2="'+b[1].toFixed(1)+'" stroke="'+C.cy+'" stroke-width="2" opacity="0.6"/>'; }
    var w0=pol(c,c,rOuter,0),w1=pol(c,c,rOuter,38);
    var wedge='M '+c+' '+c+' L '+w0[0].toFixed(1)+' '+w0[1].toFixed(1)+' A '+rOuter+' '+rOuter+' 0 0 1 '+w1[0].toFixed(1)+' '+w1[1].toFixed(1)+' Z';
    var tip=pol(c,c,rOuter,38),o1=pol(c,c,rDot,300),o2=pol(c,c,rMain-28,110);
    return ''+
'<svg viewBox="0 0 '+S+' '+S+'" width="300" height="300" xmlns="http://www.w3.org/2000/svg">'+
 '<defs>'+
  '<radialGradient id="rcGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="'+C.cy+'" stop-opacity="0.18"/><stop offset="70%" stop-color="'+C.cy+'" stop-opacity="0.04"/><stop offset="100%" stop-color="'+C.cy+'" stop-opacity="0"/></radialGradient>'+
  '<linearGradient id="rcSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="'+C.cy+'" stop-opacity="0"/><stop offset="100%" stop-color="'+C.cy+'" stop-opacity="0.30"/></linearGradient>'+
 '</defs>'+
 '<circle cx="'+c+'" cy="'+c+'" r="'+(rMain+8)+'" fill="url(#rcGlow)"/>'+
 '<circle cx="'+c+'" cy="'+c+'" r="'+rOuter+'" fill="none" stroke="'+C.cy+'" stroke-opacity="0.16" stroke-width="1" stroke-dasharray="1 7"/>'+
 '<circle cx="'+c+'" cy="'+c+'" r="'+rDot+'" fill="none" stroke="'+C.cy+'" stroke-opacity="0.14" stroke-width="1"/>'+
 tk(0)+tk(90)+tk(180)+tk(270)+
 '<circle cx="'+c+'" cy="'+c+'" r="'+rMain+'" fill="none" stroke="'+C.cy+'" stroke-opacity="0.12" stroke-width="6"/>'+
 '<path d="'+arc(c,c,rMain,0,Math.max(0.1,sweep))+'" fill="none" stroke="'+C.cy+'" stroke-width="4" stroke-linecap="round"/>'+
 '<g class="sweep"><path d="'+wedge+'" fill="url(#rcSweep)"/><circle cx="'+tip[0].toFixed(1)+'" cy="'+tip[1].toFixed(1)+'" r="4" fill="#fff"/></g>'+
 '<g class="orbit"><circle cx="'+o1[0].toFixed(1)+'" cy="'+o1[1].toFixed(1)+'" r="4" fill="'+C.gn+'"/></g>'+
 '<g class="orbit rev"><circle cx="'+o2[0].toFixed(1)+'" cy="'+o2[1].toFixed(1)+'" r="3" fill="'+C.cy+'"/></g>'+
 '<text x="'+c+'" y="'+(c+18)+'" text-anchor="middle" font-family="ui-monospace,monospace" font-size="56" font-weight="800" fill="'+C.tx+'">'+confTxt+'</text>'+
 '<text x="'+c+'" y="'+(c+38)+'" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" letter-spacing="7" fill="'+C.dim+'">CONFLUENCE</text>'+
 '<text x="'+c+'" y="'+(c+62)+'" text-anchor="middle" font-family="ui-monospace,monospace" font-size="15" font-weight="700" letter-spacing="2" fill="'+dcol+'">'+sym+(dir?'  ·  '+dir:'')+'</text>'+
'</svg>';
  }
  function readData(p){
    if(p) return p;
    try{ var st=(w.TIState&&w.TIState.get&&w.TIState.get())||null;
      if(st&&st.bestSetup){ var b=st.bestSetup,s=st.scanStats||{};
        return {confluence:(b.score!=null?b.score:(b.maturity&&b.maturity.percent)),symbol:b.sym,direction:b.dir,scanned:s.scored,total:s.total,engines:s.engines,nextScan:s.nextScan}; }
    }catch(e){}
    return {confluence:null,symbol:'—',direction:''};
  }
  w.VDRadarCore = {
    svg:function(d){ return buildSVG(readData(d)); },
    mount:function(el,d){ if(typeof el==='string') el=document.getElementById(el)||document.querySelector(el); if(!el)return; el.classList.add('tm-radar'); el.innerHTML=buildSVG(readData(d)); return el; },
    update:function(el,d){ if(typeof el==='string') el=document.getElementById(el)||document.querySelector(el); if(!el)return; el.innerHTML=buildSVG(readData(d)); }
  };
})(typeof window!=='undefined'?window:globalThis);
