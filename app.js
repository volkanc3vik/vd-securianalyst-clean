
// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
let SYM='BTCUSDT',INTV='15m';
window.SYM=SYM; window.INTV=INTV;
let TK=null,KL=[],IND=null,FUND=null;
let alarmOn=true,lastSigType=null,AC=null;
let refreshTimer=null,scanTimer=null,tickerTimer=null,clockTimer=null;
let FUTURES_SYMS=[],notifPerm=false;
const IVLS=['1m','5m','15m','1h','4h'];
const BASE='https://api.binance.com';
const FBASE='https://fapi.binance.com';

// ══════════════════════════════════════════
// SCROLL KORUMA SİSTEMİ
// DOM güncellenince scroll pozisyonu kaybolmasın
// ══════════════════════════════════════════
const ScrollGuard = (() => {
  let _locked   = false;
  let _savedPos = 0;
  let _lockTimer = null;

  // Güncelleme başlamadan önce çağır
  function save() {
    if (!_locked) {
      _savedPos = window.scrollY || document.documentElement.scrollTop || 0;
    }
  }

  // Güncelleme bittikten sonra çağır
  function restore() {
    if (_savedPos > 50) { // Sadece sayfada aşağıdaysa restore et
      requestAnimationFrame(() => {
        window.scrollTo({ top: _savedPos, behavior: 'instant' });
      });
    }
  }

  // Belirli bir süre boyunca scroll'u kilitle
  function lock(ms = 500) {
    _locked = true;
    _savedPos = window.scrollY || 0;
    clearTimeout(_lockTimer);
    _lockTimer = setTimeout(() => {
      _locked = false;
      restore();
    }, ms);
  }

  // innerHTML atamaları için wrap fonksiyonu
  // Kullanım: ScrollGuard.safeSetHTML(el, html)
  function safeSetHTML(el, html) {
    if (!el) return;
    save();
    el.innerHTML = html;
    restore();
  }

  return { save, restore, lock, safeSetHTML };
})();

// DOM gözlemcisi — büyük layout shift'leri yakala ve scroll'u koru
(function() {
  if (typeof MutationObserver === 'undefined') return;

  let _pendingRestore = false;
  let _lastScroll = 0;

  // Scroll pozisyonunu sürekli kaydet
  window.addEventListener('scroll', () => {
    _lastScroll = window.scrollY;
  }, { passive: true });

  const observer = new MutationObserver((mutations) => {
    // Büyük DOM değişikliği var mı?
    const bigChange = mutations.some(m =>
      m.addedNodes.length > 2 || m.removedNodes.length > 2
    );

    if (bigChange && _lastScroll > 100 && !_pendingRestore) {
      const savedScroll = _lastScroll;
      _pendingRestore = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (Math.abs(window.scrollY - savedScroll) > 80) {
            window.scrollTo({ top: savedScroll, behavior: 'instant' });
          }
          _pendingRestore = false;
        });
      });
    }
  });

  // Sayfa yüklenince gözlemi başlat
  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('.main') || document.body;
    observer.observe(main, {
      childList: true,
      subtree:   true,
    });
  });
})();

// ══════════════════════════════════════════
// CLOCK
// ══════════════════════════════════════════
function startClock(){
  const el=document.getElementById('liveTime');
  clockTimer=setInterval(()=>{
    if(el)el.textContent=new Date().toLocaleTimeString('tr-TR');
  },1000);
}

// ══════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════
async function requestNotif(){
  if(!('Notification' in window)){alert('Tarayıcınız bildirimleri desteklemiyor.');return;}
  const perm=await Notification.requestPermission();
  notifPerm=perm==='granted';
  const btn=document.getElementById('notifBtn');
  const dot=document.getElementById('notifDot');
  const txt=document.getElementById('notifTxt');
  if(notifPerm){
    btn.classList.add('active');dot.classList.add('on');txt.textContent='Bildirim Açık 🔔';
    new Notification('VD SecuriAnalyst',{body:'Bildirimler açıldı! Al/Sat sinyallerini ekran dışında da alacaksınız.',icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%2300e896"/><text x="16" y="22" text-anchor="middle" font-size="18">◈</text></svg>'});
  }else{txt.textContent='Bildirim Reddedildi';}
}

function sendNotif(sym,type,price){
  // Browser Notification (ekran kapalıyken bile çalışır)
  if(notifPerm&&Notification.permission==='granted'){
    const n=new Notification(`${type==='buy'?'▲ AL':'▼ SAT'} — ${sym}`,{
      body:`Fiyat: $${price}\nEMA + MACD çaprazması tespit edildi\nVD SecuriAnalyst`,
      icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%2300e896"/><text x="16" y="22" text-anchor="middle" font-size="18" fill="white">◈</text></svg>',
      tag:'crypto-signal',
      requireInteraction:true,
    });
    n.onclick=()=>{window.focus();n.close();};
  }
  // In-app popup
  showPopup(sym,type,price);
  // Ses
  beep(type);
  // Alarm log
  const el=document.getElementById('almLog');
  if(el)el.textContent=(type==='buy'?'AL':'SAT')+' '+sym+' @ '+new Date().toLocaleTimeString('tr-TR');
}

// ══════════════════════════════════════════
// AUDIO
// ══════════════════════════════════════════
function beep(t){
  try{
    if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();
    [[t==='buy'?880:440,0],[t==='buy'?1100:330,320]].forEach(([f,d])=>setTimeout(()=>{
      const o=AC.createOscillator(),g=AC.createGain();
      o.connect(g);g.connect(AC.destination);
      o.frequency.value=f;o.type='sine';
      g.gain.setValueAtTime(.25,AC.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.7);
      o.start();o.stop(AC.currentTime+.7);
    },d));
  }catch(e){}
}

function showPopup(sym,type,price){
  document.querySelectorAll('.popup').forEach(e=>e.remove());
  const d=document.createElement('div');
  d.className='popup '+(type==='sell'?'sell':'buy');
  d.innerHTML=`
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:${type==='buy'?'var(--green)':'var(--red)'};margin-bottom:5px">${type==='buy'?'▲ AL SİNYALİ':'▼ SAT SİNYALİ'}</div>
    <div style="font-size:18px;font-weight:800;margin-bottom:3px">${sym}</div>
    <div style="font-size:13px;color:var(--text2);font-weight:500">$${price}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:6px;font-weight:400">EMA + MACD çaprazması tespit edildi</div>
    <div style="margin-top:10px;font-size:11px;cursor:pointer;color:var(--text3);font-weight:500" onclick="this.parentElement.remove()">✕ Kapat</div>`;
  document.body.appendChild(d);
  setTimeout(()=>{if(d.parentElement)d.remove();},10000);
}

// ══════════════════════════════════════════
// API
// ══════════════════════════════════════════
async function get(url){
  const r=await fetch(url);
  if(!r.ok)throw new Error('HTTP '+r.status);
  const d=await r.json();
  if(d&&d.code&&+d.code<0)throw new Error(d.msg||'API hatası');
  return d;
}

async function getFuturesSymbols(){
  try{
    const d=await get(`${FBASE}/fapi/v1/exchangeInfo`);
    return d.symbols.filter(s=>s.quoteAsset==='USDT'&&s.status==='TRADING'&&s.contractType==='PERPETUAL').map(s=>s.symbol).sort();
  }catch(e){
    return['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','SUIUSDT','PEPEUSDT','WIFUSDT','APTUSDT','ARBUSDT','OPUSDT','NEARUSDT','DOTUSDT','INJUSDT','MATICUSDT','ATOMUSDT'];
  }
}

async function fetchCoin(sym,intv){
  const[tk,kl]=await Promise.all([
    get(`${FBASE}/fapi/v1/ticker/24hr?symbol=${sym}`),
    get(`${FBASE}/fapi/v1/klines?symbol=${sym}&interval=${intv}&limit=200`),
  ]);
  if(!Array.isArray(kl))throw new Error('Geçersiz kline verisi');
  const candles=kl.map(k=>({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]}));
  const[fund,ls]=await Promise.allSettled([
    get(`${FBASE}/fapi/v1/premiumIndex?symbol=${sym}`),
    get(`${FBASE}/fapi/v1/openInterest?symbol=${sym}`),
  ]);
  return{tk,candles,fund:fund.status==='fulfilled'?fund.value:null,ls:ls.status==='fulfilled'?ls.value:null};
}

// ══════════════════════════════════════════
// INDICATORS
// ══════════════════════════════════════════
function calcEMA(c,p){if(c.length<p)return[];const k=2/(p+1);let e=c.slice(0,p).reduce((a,b)=>a+b,0)/p;const r=[e];for(let i=p;i<c.length;i++){e=c[i]*k+e*(1-k);r.push(e);}return r;}
function calcRSI(c,p=14){if(c.length<p+2)return 50;let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];d>0?(g+=d):(l-=d);}let ag=g/p,al=l/p;for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1];ag=(ag*(p-1)+Math.max(d,0))/p;al=(al*(p-1)+Math.max(-d,0))/p;}return al===0?100:+(100-100/(1+ag/al)).toFixed(2);}
function calcMACD(c){const e12=calcEMA(c,12),e26=calcEMA(c,26);if(!e12.length||!e26.length)return{line:0,signal:0,hist:0,hArr:[]};const len=Math.min(e12.length,e26.length);const ml=Array.from({length:len},(_,i)=>e12[e12.length-len+i]-e26[e26.length-len+i]);const sig=calcEMA(ml,9);const hArr=ml.slice(ml.length-sig.length).map((v,i)=>v-sig[i]);const last=ml[ml.length-1],s=sig[sig.length-1]||0;return{line:last,signal:s,hist:last-s,hArr};}
function calcBB(c,p=20){if(c.length<p)return null;const sl=c.slice(-p),m=sl.reduce((a,b)=>a+b,0)/p,std=Math.sqrt(sl.reduce((a,b)=>a+(b-m)**2,0)/p);return{upper:m+2*std,mid:m,lower:m-2*std};}
function calcATR(candles,p=14){if(candles.length<2)return 0;const trs=candles.slice(1).map((c,i)=>Math.max(c.h-c.l,Math.abs(c.h-candles[i].c),Math.abs(c.l-candles[i].c)));const sl=trs.slice(-p);return sl.reduce((a,b)=>a+b,0)/sl.length;}

function calcRisk(closes,chg,atr,price){
  const atrPct=(atr/price)*100,absChg=Math.abs(chg),r=calcRSI(closes);
  const rR=r>75||r<25?30:r>70||r<30?20:r>65||r<35?10:0;
  const aR=atrPct>5?40:atrPct>3?30:atrPct>2?20:atrPct>1?10:5;
  const cR=absChg>10?30:absChg>5?20:absChg>3?10:5;
  const t=Math.min(100,rR+aR+cR);
  let label,cls;
  if(t<=25){label='DÜŞÜK';cls='risk-low';}
  else if(t<=50){label='ORTA';cls='risk-med';}
  else if(t<=75){label='YÜKSEK';cls='risk-high';}
  else{label='ÇOK YÜKSEK';cls='risk-xhigh';}
  return{score:t,label,cls};
}

// ══════════════════════════════════════════
// SPARKLINE
// ══════════════════════════════════════════
function drawSpark(id,prices,color){
  const svg=document.getElementById(id);if(!svg)return;
  const n=prices.length;if(n<2)return;
  const min=Math.min(...prices),max=Math.max(...prices),range=max-min||1;
  const W=120,H=40;
  const pts=prices.map((p,i)=>`${(i/(n-1))*W},${H-((p-min)/range)*H}`).join(' ');
  const isUp=prices[n-1]>=prices[0];
  const col=isUp?'#00e5a0':'#ff3d6b';
  svg.innerHTML=`
    <defs>
      <linearGradient id="sg${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${col}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${pts} ${W},${H} 0,${H}" fill="url(#sg${id})"/>
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ══════════════════════════════════════════
// MARKET OVERVIEW
// ══════════════════════════════════════════
async function updateMarketOverview(){
  ScrollGuard.save(); // Scroll pozisyonunu kaydet
  // BTC & ETH
  for(const cfg of[
    {sym:'BTCUSDT',id:'btc',badge:'btcBadge',priceId:'btcPrice',chgId:'btcChg',highId:'btcHigh',lowId:'btcLow',rsiId:'btcRsi',volId:'btcVol',sigId:'btcSignal',spark:'btcSpark'},
    {sym:'ETHUSDT',id:'eth',badge:'ethBadge',priceId:'ethPrice',chgId:'ethChg',highId:'ethHigh',lowId:'ethLow',rsiId:'ethRsi',volId:'ethVol',sigId:'ethSignal',spark:'ethSpark'},
  ]){
    try{
      const[tk,kl]=await Promise.all([
        get(`${FBASE}/fapi/v1/ticker/24hr?symbol=${cfg.sym}`),
        get(`${FBASE}/fapi/v1/klines?symbol=${cfg.sym}&interval=${INTV}&limit=50`),
      ]);
      const closes=kl.map(k=>+k[4]);
      const price=+tk.lastPrice,chg=+tk.priceChangePercent,isUp=chg>=0;
      const rsiV=calcRSI(closes);
      const mr=calcMACD(closes);
      const e9=calcEMA(closes,9),e21=calcEMA(closes,21);
      const isLong=e9[e9.length-1]>e21[e21.length-1]&&mr.hist>0&&rsiV<70;
      const isShort=e9[e9.length-1]<e21[e21.length-1]&&mr.hist<0&&rsiV>30;

      const dec=price>1000?0:price>100?2:price>1?4:6;
      setEl(cfg.priceId,'$'+price.toLocaleString('en',{minimumFractionDigits:dec,maximumFractionDigits:dec}),isUp?'mkt-price up':'mkt-price dn');
      setEl(cfg.chgId,(isUp?'▲ ':' ▼')+Math.abs(chg).toFixed(2)+'%',isUp?'mkt-chg up':'mkt-chg dn');
      setEl(cfg.highId,'$'+fmtP(+tk.highPrice));
      setEl(cfg.lowId,'$'+fmtP(+tk.lowPrice));
      setEl(cfg.rsiId,rsiV.toString(),rsiV>70?'mkt-stat-val dn':rsiV<30?'mkt-stat-val up':'mkt-stat-val yl');
      setEl(cfg.volId,fmtM(+tk.quoteVolume));
      const bdg=document.getElementById(cfg.badge);if(bdg)bdg.textContent=isUp?'+'+chg.toFixed(2)+'%':chg.toFixed(2)+'%';
      const sig=document.getElementById(cfg.sigId);
      if(sig){
        if(isLong){sig.className='mkt-signal bull';sig.innerHTML='▲ LONG fırsatı';}
        else if(isShort){sig.className='mkt-signal bear';sig.innerHTML='▼ SHORT fırsatı';}
        else{sig.className='mkt-signal neut';sig.innerHTML='◆ Nötr bölge';}
      }
      drawSpark(cfg.spark,closes.slice(-30));
    }catch(e){}
  }

  // BTC Dominance — fapi global ticker ile yaklaşık hesapla
  try{
    const allTickers = await get(`${FBASE}/fapi/v1/ticker/24hr`);
    const totalVol = allTickers.reduce((a,t)=>a+(+t.quoteVolume||0),0);
    const btcVol = allTickers.filter(t=>t.symbol==='BTCUSDT').reduce((a,t)=>a+(+t.quoteVolume||0),0);
    const dom = totalVol>0 ? (btcVol/totalVol*100) : 50;
    const domStr=dom.toFixed(2)+'%';
    setEl('btcdPrice',domStr,'mkt-price',true);
    document.getElementById('btcdFill').style.width=dom+'%';
    document.getElementById('btcdPct').textContent=domStr;
    const isHighDom=dom>55,isLowDom=dom<45;
    const bdg=document.getElementById('btcdBadge');
    if(bdg)bdg.textContent=dom.toFixed(1)+'%';
    const desc=document.getElementById('btcdDesc');
    const sig=document.getElementById('btcdSignal');
    const adv=document.getElementById('btcdAdvice');
    if(isHighDom){
      if(desc)desc.textContent='BTC hâkimiyeti yüksek — altcoin piyasası baskı altında';
      if(sig){sig.className='mkt-signal bull';sig.innerHTML='▲ BTC güçlü — Altcoin zayıf';}
      if(adv)adv.textContent='💡 Dominans yüksek iken altcoin long pozisyonları risklidir. BTC ağırlıklı strateji önerilir.';
    }else if(isLowDom){
      if(desc)desc.textContent='BTC hâkimiyeti düşük — altcoin sezonu olabilir';
      if(sig){sig.className='mkt-signal neut';sig.innerHTML='◆ Altcoin Sezonu İşareti';}
      if(adv)adv.textContent='💡 Dominans düşük iken seçici altcoin long fırsatları değerlendirilebilir.';
    }else{
      if(desc)desc.textContent='BTC hâkimiyeti nötr seviyede';
      if(sig){sig.className='mkt-signal neut';sig.innerHTML='◆ Dengeli Piyasa';}
      if(adv)adv.textContent='💡 Karma strateji — hem BTC hem seçici altcoin pozisyonları uygun.';
    }
    const chgEl=document.getElementById('btcdChg');
    if(chgEl){chgEl.textContent=domStr+' hâkimiyet';chgEl.className='mkt-chg';}
  }catch(e){
    // Fallback: CoinGecko yoksa tahmini göster
    const desc=document.getElementById('btcdDesc');
    if(desc)desc.textContent='BTC dominans verisi gecikmeli yükleniyor...';
  }
}

// ══════════════════════════════════════════
// TICKER BAND
// ══════════════════════════════════════════
const TICKER_SYMS=[
  ['BTCUSDT','btc'],['ETHUSDT','eth'],['BNBUSDT','bnb'],['SOLUSDT','sol'],
  ['XRPUSDT','xrp'],['DOGEUSDT','doge'],['ADAUSDT','ada'],['AVAXUSDT','avax'],
  ['LINKUSDT','link'],['PEPEUSDT','pepe'],
];
async function updateTicker(){
  try{
    const tickers=await get(`${FBASE}/fapi/v1/ticker/24hr?symbols=${JSON.stringify(TICKER_SYMS.map(t=>t[0]))}`);
    tickers.forEach(tk=>{
      const cfg=TICKER_SYMS.find(t=>t[0]===tk.symbol);
      if(!cfg)return;
      const id=cfg[1];const price=+tk.lastPrice;const chg=+tk.priceChangePercent;
      const dec=price>1000?0:price>100?2:price>1?4:6;
      const priceStr='$'+price.toLocaleString('en',{maximumFractionDigits:dec});
      const chgStr=(chg>=0?'+':'')+chg.toFixed(2)+'%';
      const cls=chg>=0?'ticker-chg up':'ticker-chg dn';
      ['t_'+id,'t_'+id+'2'].forEach(i=>{const el=document.getElementById(i);if(el)el.textContent=priceStr;});
      ['tc_'+id,'tc_'+id+'2'].forEach(i=>{const el=document.getElementById(i);if(el){el.textContent=chgStr;el.className=cls;}});
    });
  }catch(e){}
}

// ══════════════════════════════════════════
// SCORING
// ══════════════════════════════════════════
function scoreLong(closes,chg){
  const e9=calcEMA(closes,9),e21=calcEMA(closes,21),e50=calcEMA(closes,50);
  const e9v=e9[e9.length-1],e21v=e21[e21.length-1],e50v=e50[e50.length-1];
  const r=calcRSI(closes),m=calcMACD(closes),b=calcBB(closes);
  const p=closes[closes.length-1];let s=0;
  if(e9v>e21v)s+=20;if(e21v>e50v)s+=15;if(e9v>e21v&&e21v>e50v)s+=10;
  if(r>=45&&r<=65)s+=20;else if(r>=30&&r<45)s+=10;else if(r>65)s-=5;
  if(m.hist>0)s+=20;if(m.line>0&&m.hist>0)s+=5;
  if(b){if(p>b.mid)s+=10;if(p<=b.lower*1.005)s+=10;if(p>b.upper)s-=10;}
  if(chg>0)s+=5;if(chg>3)s+=5;
  return{score:Math.max(0,Math.min(100,s)),rsi:r,mh:m.hist,ema:e9v>e21v?(e21v>e50v?'▲▲▲':'▲▲'):'▼',p,
    e9v,e21v,e50v,macdObj:m};
}
function scoreShort(closes,chg){
  const e9=calcEMA(closes,9),e21=calcEMA(closes,21),e50=calcEMA(closes,50);
  const e9v=e9[e9.length-1],e21v=e21[e21.length-1],e50v=e50[e50.length-1];
  const r=calcRSI(closes),m=calcMACD(closes),b=calcBB(closes);
  const p=closes[closes.length-1];let s=0;
  if(e9v<e21v)s+=20;if(e21v<e50v)s+=15;if(e9v<e21v&&e21v<e50v)s+=10;
  if(r>=35&&r<=55)s+=20;else if(r>70)s+=15;else if(r>55&&r<=70)s+=8;
  if(m.hist<0)s+=20;if(m.line<0&&m.hist<0)s+=5;
  if(b){if(p<b.mid)s+=10;if(p>=b.upper*0.995)s+=10;if(p<b.lower)s-=10;}
  if(chg<0)s+=5;if(chg<-3)s+=5;
  return{score:Math.max(0,Math.min(100,s)),rsi:r,mh:m.hist,ema:e9v<e21v?(e21v<e50v?'▼▼▼':'▼▼'):'▲',p,
    e9v,e21v,e50v,macdObj:m};
}
function jokerScoreLong(closes,chg,atr,price){
  const r=calcRSI(closes),m=calcMACD(closes);
  const e9=calcEMA(closes,9),e21=calcEMA(closes,21);
  const atrPct=(atr/price)*100;let s=0;
  if(atrPct>3)s+=25;else if(atrPct>2)s+=15;else if(atrPct>1)s+=8;
  if(r>=25&&r<=40)s+=25;else if(r>=40&&r<=50)s+=15;
  if(m.hist>0&&m.hArr.length>1&&m.hArr[m.hArr.length-2]<0)s+=20;else if(m.hist>0)s+=10;
  if(e9[e9.length-1]>e21[e21.length-1])s+=15;
  if(Math.abs(chg)>5)s+=15;
  return Math.min(100,s);
}
function jokerScoreShort(closes,chg,atr,price){
  const r=calcRSI(closes),m=calcMACD(closes);
  const e9=calcEMA(closes,9),e21=calcEMA(closes,21);
  const atrPct=(atr/price)*100;let s=0;
  if(atrPct>3)s+=25;else if(atrPct>2)s+=15;else if(atrPct>1)s+=8;
  if(r>=65&&r<=80)s+=25;else if(r>=55&&r<=65)s+=15;
  if(m.hist<0&&m.hArr.length>1&&m.hArr[m.hArr.length-2]>0)s+=20;else if(m.hist<0)s+=10;
  if(e9[e9.length-1]<e21[e21.length-1])s+=15;
  if(Math.abs(chg)>5)s+=15;
  return Math.min(100,s);
}
function oppDesc(sc,dir){
  const pts=[];
  if(dir==='long'){
    if(sc.ema==='▲▲▲')pts.push('EMA tam hizalı yükseliş');
    else if(sc.ema==='▲▲')pts.push('EMA yükseliş trendi');
    if(sc.mh>0)pts.push('MACD pozitif');
    if(sc.rsi>=45&&sc.rsi<=65)pts.push('RSI ideal ('+sc.rsi+')');
    else if(sc.rsi<45)pts.push('RSI dipten ('+sc.rsi+')');
  }else{
    if(sc.ema==='▼▼▼')pts.push('EMA tam aşağı hizalı');
    else if(sc.ema==='▼▼')pts.push('EMA düşüş trendi');
    if(sc.mh<0)pts.push('MACD negatif');
    if(sc.rsi>65)pts.push('RSI aşırı alım ('+sc.rsi+')');
    else if(sc.rsi>=35)pts.push('RSI short bölge ('+sc.rsi+')');
  }
  return pts.slice(0,3).join(' · ')||'Teknik analiz yapıldı';
}

// ══════════════════════════════════════════
// S/R & PATTERNS
// ══════════════════════════════════════════
function calcSR(candles,price){
  const n=Math.min(100,candles.length),sl=candles.slice(-n),pivots=[];
  for(let i=2;i<sl.length-2;i++){
    if(sl[i].h>sl[i-1].h&&sl[i].h>sl[i-2].h&&sl[i].h>sl[i+1].h&&sl[i].h>sl[i+2].h)pivots.push({val:sl[i].h,type:'resist'});
    if(sl[i].l<sl[i-1].l&&sl[i].l<sl[i-2].l&&sl[i].l<sl[i+1].l&&sl[i].l<sl[i+2].l)pivots.push({val:sl[i].l,type:'support'});
  }
  const cluster=(pts,thr=0.003)=>{
    const sorted=[...pts].sort((a,b)=>a-b);const groups=[];let cur=null;
    sorted.forEach(p=>{
      if(!cur||Math.abs(p-cur.avg)/cur.avg>thr){if(cur)groups.push(cur);cur={avg:p,count:1,sum:p};}
      else{cur.sum+=p;cur.count++;cur.avg=cur.sum/cur.count;}
    });
    if(cur)groups.push(cur);return groups.sort((a,b)=>b.count-a.count);
  };
  const res=cluster(pivots.filter(p=>p.type==='resist'&&p.val>price).map(p=>p.val)).slice(0,4).sort((a,b)=>a.avg-b.avg);
  const sup=cluster(pivots.filter(p=>p.type==='support'&&p.val<price).map(p=>p.val)).slice(0,4).sort((a,b)=>b.avg-a.avg);
  return{res,sup};
}

function detectPatterns(candles,e9a,e21a,mr){
  const pats=[],sl=candles.slice(-30);
  const closes=sl.map(c=>c.c),highs=sl.map(c=>c.h),lows=sl.map(c=>c.l);
  const lC=sl[sl.length-1],pC=sl[sl.length-2];
  const body=Math.abs(lC.c-lC.o),ls2=Math.min(lC.c,lC.o)-lC.l,us=lC.h-Math.max(lC.c,lC.o),tot=lC.h-lC.l;
  if(pC.c<pC.o&&lC.c>lC.o&&lC.c>pC.o&&lC.o<pC.c)pats.push({icon:'🟢',name:'Bullish Engulfing',desc:'Önceki kırmızı mumu yutan yeşil mum. Güçlü yükseliş sinyali.',signal:'LONG',col:'var(--green)'});
  if(pC.c>pC.o&&lC.c<lC.o&&lC.c<pC.o&&lC.o>pC.c)pats.push({icon:'🔴',name:'Bearish Engulfing',desc:'Önceki yeşil mumu yutan kırmızı mum. Güçlü düşüş sinyali.',signal:'SHORT',col:'var(--red)'});
  if(ls2>body*2&&us<body*0.5&&body>0)pats.push({icon:'🔨',name:'Çekiç (Hammer)',desc:'Uzun alt gölge, küçük gövde. Dipten dönüş sinyali.',signal:'LONG',col:'var(--green)'});
  if(us>body*2&&ls2<body*0.5&&body>0)pats.push({icon:'⭐',name:'Kayan Yıldız (Shooting Star)',desc:'Uzun üst gölge, küçük gövde. Tepeden dönüş sinyali.',signal:'SHORT',col:'var(--red)'});
  if(tot>0&&body<tot*0.1)pats.push({icon:'➕',name:'Doji',desc:'Açılış=kapanış. Kararsızlık ve dönüş potansiyeli.',signal:'BEKLE',col:'var(--yellow)'});
  if(e9a.length>1&&e21a.length>1){
    const e9p=e9a[e9a.length-2],e9c=e9a[e9a.length-1],e21p=e21a[e21a.length-2],e21c=e21a[e21a.length-1];
    if(e9p<=e21p&&e9c>e21c)pats.push({icon:'📈',name:'EMA Golden Cross 9/21',desc:'EMA9 EMA21\'i yukarı kesti. Yükseliş trendinin başlangıcı.',signal:'LONG',col:'var(--green)'});
    if(e9p>=e21p&&e9c<e21c)pats.push({icon:'📉',name:'EMA Death Cross 9/21',desc:'EMA9 EMA21\'i aşağı kesti. Düşüş trendinin başlangıcı.',signal:'SHORT',col:'var(--red)'});
  }
  if(mr.hArr.length>1){
    const hc=mr.hArr[mr.hArr.length-1],hp=mr.hArr[mr.hArr.length-2];
    if(hp<=0&&hc>0)pats.push({icon:'⚡',name:'MACD Boğa Kesişimi',desc:'Histogram negatiften pozitife döndü. Momentum yükseliyor.',signal:'LONG',col:'var(--green)'});
    if(hp>=0&&hc<0)pats.push({icon:'⚡',name:'MACD Ayı Kesişimi',desc:'Histogram pozitiften negatife döndü. Momentum düşüyor.',signal:'SHORT',col:'var(--red)'});
  }
  const minL=Math.min(...lows.slice(-20));
  if(lows.slice(-20).filter(l=>Math.abs(l-minL)/minL<0.005).length>=2&&closes[closes.length-1]>minL*1.01)
    pats.push({icon:'🔁',name:'Çift Dip (Double Bottom)',desc:'W formasyonu. İki kez test edilen destek. Yükseliş potansiyeli.',signal:'LONG',col:'var(--green)'});
  const maxH=Math.max(...highs.slice(-20));
  if(highs.slice(-20).filter(h=>Math.abs(h-maxH)/maxH<0.005).length>=2&&closes[closes.length-1]<maxH*0.99)
    pats.push({icon:'🔄',name:'Çift Tepe (Double Top)',desc:'M formasyonu. İki kez reddedilen direnç. Düşüş potansiyeli.',signal:'SHORT',col:'var(--red)'});
  return pats;
}

// ══════════════════════════════════════════
// ENTRY
// ══════════════════════════════════════════
function calcEntry(candles,ind,tk){
  const price=+tk.lastPrice;
  const{rsi:r,macd:m,ema9:e9,ema21:e21,atr:at}=ind;
  const isLong=e9>e21&&m.hist>0&&r<70;
  const isShort=e9<e21&&m.hist<0&&r>30;
  if(isLong){const entry=price,stop=entry-at*1.5,tp1=entry+at*2,tp2=entry+at*3.5,tp3=entry+at*5.5;return{dir:'LONG',entry,stop,tp1,tp2,tp3,rr:+((tp2-entry)/(entry-stop)).toFixed(2)};}
  if(isShort){const entry=price,stop=entry+at*1.5,tp1=entry-at*2,tp2=entry-at*3.5,tp3=entry-at*5.5;return{dir:'SHORT',entry,stop,tp1,tp2,tp3,rr:+((entry-tp2)/(stop-entry)).toFixed(2)};}
  return null;
}
function calcConf(ind,tk){
  const{rsi:r,macd:m,ema9:e9,ema21:e21,ema50:e50,bb:b}=ind;
  const price=+tk.lastPrice;let s=0;
  if(e9>e21)s+=20;else s-=10;if(e21>e50)s+=15;else s-=5;
  if(m.hist>0)s+=20;else s-=10;
  if(r>=45&&r<=65)s+=15;else if(r>=30&&r<=75)s+=7;
  if(b&&price>b.mid)s+=10;if(+tk.priceChangePercent>0)s+=5;
  return Math.max(10,Math.min(100,50+s));
}

// ══════════════════════════════════════════
// TRADINGVIEW
// ══════════════════════════════════════════
function loadTV(sym,intv){
  const tvMap={'1m':'1','5m':'5','15m':'15','1h':'60','4h':'240'};
  const tf=tvMap[intv]||'15',tvSym='BINANCE:'+sym+'.P';
  const container=document.getElementById('tvContainer');
  container.innerHTML='';
  const tryWidget=()=>{
    try{
      new TradingView.widget({
        container_id:'tvContainer',autosize:true,symbol:tvSym,interval:tf,
        timezone:'Asia/Istanbul',theme:'dark',style:'1',locale:'tr',
        toolbar_bg:'#03080f',enable_publishing:false,hide_top_toolbar:false,
        save_image:false,height:540,width:'100%',
        studies:['RSI@tv-basicstudies','MACD@tv-basicstudies','MAExp@tv-basicstudies','BB@tv-basicstudies'],
        overrides:{
          'mainSeriesProperties.candleStyle.upColor':'#00e5a0',
          'mainSeriesProperties.candleStyle.downColor':'#ff3d6b',
          'mainSeriesProperties.candleStyle.borderUpColor':'#00e5a0',
          'mainSeriesProperties.candleStyle.borderDownColor':'#ff3d6b',
          'mainSeriesProperties.candleStyle.wickUpColor':'#00e5a0',
          'mainSeriesProperties.candleStyle.wickDownColor':'#ff3d6b',
          'paneProperties.background':'#03080f',
          'paneProperties.backgroundType':'solid',
          'paneProperties.vertGridProperties.color':'rgba(255,255,255,0.04)',
          'paneProperties.horzGridProperties.color':'rgba(255,255,255,0.04)',
          'scalesProperties.textColor':'#7aaac8',
          'scalesProperties.backgroundColor':'#03080f',
        },
      });
    }catch(e){loadTVFallback(sym,intv);}
  };
  if(window.TradingView){tryWidget();}
  else{
    const s=document.createElement('script');s.src='https://s3.tradingview.com/tv.js';
    s.onload=tryWidget;s.onerror=()=>loadTVFallback(sym,intv);
    container.appendChild(s);
  }
}
function loadTVFallback(sym,intv){
  const tvMap={'1m':'1','5m':'5','15m':'15','1h':'60','4h':'240'};
  const container=document.getElementById('tvContainer');container.innerHTML='';
  const iframe=document.createElement('iframe');
  iframe.src=`https://www.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent('BINANCE:'+sym+'.P')}&interval=${tvMap[intv]||'15'}&hidesidetoolbar=0&hidetoptoolbar=0&theme=dark&style=1&locale=tr&timezone=Asia%2FIstanbul&studies=RSI%40tv-basicstudies%1FMACD%40tv-basicstudies%1FMAExp%40tv-basicstudies%1FBB%40tv-basicstudies&allow_symbol_change=1&save_image=0&withdateranges=1`;
  iframe.style.cssText='width:100%;height:540px;border:none;display:block;';
  iframe.setAttribute('allowfullscreen','');container.appendChild(iframe);
}

// ══════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════
function setEl(id,txt,cls){const el=document.getElementById(id);if(!el)return;el.textContent=txt;if(cls!==undefined)el.className=cls;}
function fmtP(n){if(!n||isNaN(n))return'—';const v=Math.abs(n);const d=v>1000?0:v>100?2:v>1?4:v>0.01?5:7;return n.toLocaleString('en',{maximumFractionDigits:d,minimumFractionDigits:d});}
function fmtM(n){if(!n||isNaN(+n))return'—';const v=Math.abs(+n);return v>=1e9?(v/1e9).toFixed(2)+'B$':v>=1e6?(v/1e6).toFixed(1)+'M$':(v/1e3).toFixed(0)+'K$';}
function pctDiff(a,b){return(((b-a)/Math.abs(a))*100).toFixed(2)+'%';}

// ══════════════════════════════════════════
// UPDATE UI
// ══════════════════════════════════════════
function updateUI(tk,candles,fund,ls){
  const closes=candles.map(c=>c.c);
  const e9a=calcEMA(closes,9),e21a=calcEMA(closes,21),e50a=calcEMA(closes,50);
  const e9v=e9a[e9a.length-1],e21v=e21a[e21a.length-1],e50v=e50a[e50a.length-1];
  const rv=calcRSI(closes),mr=calcMACD(closes),bv=calcBB(closes),av=calcATR(candles);
  const price=+tk.lastPrice,chg=+tk.priceChangePercent,isUp=chg>=0;

  window.TK=tk; window.KL=candles; window.FUND=fund;
  TK=tk;KL=candles;FUND=fund;
  window.IND={rsi:rv,macd:mr,ema9:e9v,ema21:e21v,ema50:e50v,e9a,e21a,bb:bv,atr:av};
  IND=window.IND;

  setEl('tvSymLbl',SYM);
  const tvp=document.getElementById('tvPrice');if(tvp){tvp.textContent='$'+fmtP(price);tvp.className='tv-price-lbl '+(isUp?'up':'dn');}
  const tvc=document.getElementById('tvChg');if(tvc){tvc.textContent=(isUp?'▲ ':' ▼')+Math.abs(chg).toFixed(2)+'%';tvc.className='tv-chg-lbl '+(isUp?'up':'dn');}

  const risk=calcRisk(closes,chg,av,price);
  const mrEl=document.getElementById('mainRisk');if(mrEl){mrEl.textContent=risk.label;mrEl.className='risk-badge '+risk.cls;}

  const ent=calcEntry(candles,IND,tk);
  const conf=calcConf(IND,tk);
  setEl('confScore',conf);
  setEl('volLbl',fmtM(+tk.quoteVolume));

  const sb=document.getElementById('sigBadge');
  if(ent&&ent.dir==='LONG'){sb.textContent='▲ LONG';sb.className='sig-badge long';}
  else if(ent&&ent.dir==='SHORT'){sb.textContent='▼ SHORT';sb.className='sig-badge short';}
  else{sb.textContent='◆ BEKLE';sb.className='sig-badge wait';}

  if(ent){
    const d=price>1000?2:price>100?3:price>1?4:6;
    setEl('eEntry',fmtP(ent.entry),'entry-val up');setEl('eEntryN',ent.dir==='LONG'?'Alım noktası':'Satım noktası');
    setEl('eStop',fmtP(ent.stop),'entry-val dn');setEl('eStopP',pctDiff(ent.entry,ent.stop),'entry-sub dn');
    setEl('eTp1',fmtP(ent.tp1),'entry-val up');setEl('eTp1P',pctDiff(ent.entry,ent.tp1),'entry-sub up');
    setEl('eTp2',fmtP(ent.tp2),'entry-val up');setEl('eTp2P',pctDiff(ent.entry,ent.tp2),'entry-sub up');
    setEl('eTp3',fmtP(ent.tp3),'entry-val up');setEl('eTp3P',pctDiff(ent.entry,ent.tp3),'entry-sub up');
    setEl('eRR','1 : '+ent.rr,'entry-val yl');setEl('eRRN',ent.rr>=2?'✓ Mükemmel R/R':ent.rr>=1.5?'✓ İyi R/R':'Dikkatli ol');
  }else{
    ['eEntry','eStop','eTp1','eTp2','eTp3','eRR'].forEach(id=>setEl(id,'—'));
    ['eEntryN','eStopP','eTp1P','eTp2P','eTp3P','eRRN'].forEach(id=>setEl(id,''));
  }

  const vd=document.getElementById('verdict');
  if(ent&&ent.dir==='LONG'){
    vd.className='verdict long-v';
    vd.innerHTML=`<b style="color:var(--green)">▲ LONG — İşleme Girilebilir</b><br>Giriş: <b>$${fmtP(ent.entry)}</b> → Stop: <b>$${fmtP(ent.stop)}</b> → TP1: <b>$${fmtP(ent.tp1)}</b> → TP2: <b>$${fmtP(ent.tp2)}</b><br>R/R <b>1:${ent.rr}</b> · Güven <b>${conf}/100</b> · Risk: <b>${risk.label}</b> · Stop seviyesini koruyun.`;
  }else if(ent&&ent.dir==='SHORT'){
    vd.className='verdict short-v';
    vd.innerHTML=`<b style="color:var(--red)">▼ SHORT — İşleme Girilebilir</b><br>Giriş: <b>$${fmtP(ent.entry)}</b> → Stop: <b>$${fmtP(ent.stop)}</b> → TP1: <b>$${fmtP(ent.tp1)}</b> → TP2: <b>$${fmtP(ent.tp2)}</b><br>R/R <b>1:${ent.rr}</b> · Güven <b>${conf}/100</b> · Risk: <b>${risk.label}</b> · Stop seviyesini koruyun.`;
  }else{
    vd.className='verdict wait-v';
    vd.innerHTML=`<b style="color:var(--yellow)">◆ BEKLE — Net sinyal yok</b><br>RSI: <b>${rv}</b> · MACD: <b>${mr.hist>0?'Pozitif':'Negatif'}</b> · EMA: <b>${e9v>e21v?'Yükseliş':'Düşüş'}</b> · Risk: <b>${risk.label}</b><br>Güçlü sinyal oluşana kadar bekleyin. Sabır en iyi stratejidir.`;
  }

  // S/R
  const sr=calcSR(candles,price);
  const mkSR=(val,cnt,dir)=>{
    const col=dir==='resist'?'var(--red)':'var(--green)';
    const str=cnt>=3?'Güçlü':cnt>=2?'Orta':'Zayıf';
    const d2=document.createElement('div');d2.className='sr-item';
    d2.innerHTML=`<div class="sr-label">${dir==='resist'?'Direnç':'Destek'}</div><div class="sr-val" style="color:${col}">$${fmtP(val)}</div><div class="sr-str" style="background:${col}18;color:${col}">${str}</div>`;
    return d2;
  };
  const rl=document.getElementById('resistList'),sl2=document.getElementById('supportList');
  rl.innerHTML='';sl2.innerHTML='';
  if(!sr.res.length)rl.innerHTML='<div style="font-size:11px;color:var(--text3);padding:6px 0">Direnç bulunamadı</div>';
  else sr.res.forEach(r=>rl.appendChild(mkSR(r.avg,r.count,'resist')));
  if(!sr.sup.length)sl2.innerHTML='<div style="font-size:11px;color:var(--text3);padding:6px 0">Destek bulunamadı</div>';
  else sr.sup.forEach(s=>sl2.appendChild(mkSR(s.avg,s.count,'support')));

  // Patterns
  const pats=detectPatterns(candles,e9a,e21a,mr);
  const pl=document.getElementById('patList');
  if(!pats.length){pl.innerHTML='<div style="font-size:12px;color:var(--text3);padding:6px 0">◌ Belirgin formasyon tespit edilmedi.</div>';}
  else{
    pl.innerHTML='';
    pats.forEach(p=>{
      const d2=document.createElement('div');d2.className='pat-item';
      d2.innerHTML=`<div class="pat-icon">${p.icon}</div><div style="flex:1"><div class="pat-name">${p.name}</div><div class="pat-desc">${p.desc}</div></div><div class="pat-sig" style="background:${p.col}18;color:${p.col};border:1px solid ${p.col}44">${p.signal}</div>`;
      pl.appendChild(d2);
    });
  }

  // L/S
  setEl('lsSym',SYM);
  const oiv=ls?+ls.openInterest*price:0;
  setEl('longAmt',fmtM(oiv*0.55)+' LONG','up');
  setEl('shortAmt','SHORT '+fmtM(oiv*0.45),'dn');
  // L/S oranını RSI bazlı tahmin et (CORS engelini aşmak için)
  const lp = Math.max(30, Math.min(70, 100 - rv));
  const sp = 100 - lp;
  const ll=document.getElementById('lsL'),ls3=document.getElementById('lsS');
  if(ll){ll.style.width=lp.toFixed(1)+'%';ll.textContent=lp.toFixed(1)+'%';}
  if(ls3){ls3.style.width=sp.toFixed(1)+'%';ls3.textContent=sp.toFixed(1)+'%';}
  setEl('lsRatio','RSI bazlı tahmin');
  setEl('lsNote',lp>sp?'🟢 Long pozisyonlar baskın — yükseliş beklentisi':'🔴 Short pozisyonlar baskın — düşüş beklentisi');

  // Indicators
  const rEl=document.getElementById('iRsi');
  if(rEl){rEl.textContent=rv;rEl.className='ind-val '+(rv>70?'dn':rv<30?'up':'yl');}
  const rb=document.getElementById('rsiBar');
  if(rb){rb.style.width=rv+'%';rb.style.background=rv<30?'var(--green)':rv>70?'var(--red)':'var(--yellow)';}
  setEl('iRsiN',rv>70?'⚠ Aşırı alım':rv<30?'⚠ Aşırı satım':'Nötr bölge');
  const mEl=document.getElementById('iMacd');
  if(mEl){mEl.textContent=mr.hist>0?'▲ Pozitif':'▼ Negatif';mEl.className='ind-val '+(mr.hist>0?'up':'dn');}
  setEl('iMacdN','Histogram: '+mr.hist.toFixed(6));
  const eEl=document.getElementById('iEma');
  if(eEl){eEl.textContent=e9v>e21v?'▲ Yukarı':'▼ Aşağı';eEl.className='ind-val '+(e9v>e21v?'up':'dn');}
  setEl('iEmaN',fmtP(e9v)+' / '+fmtP(e21v));
  const e5El=document.getElementById('iEma50');
  if(e5El){e5El.textContent=price>e50v?'▲ Üstünde':'▼ Altında';e5El.className='ind-val '+(price>e50v?'up':'dn');}
  setEl('iEma50N',fmtP(e50v));
  setEl('iBb',bv?fmtP(bv.upper):'—');setEl('iBbN',bv?'Alt: '+fmtP(bv.lower):'');
  setEl('iAtr',fmtP(av));

  // Signal alarm
  const sigs=[];
  const n2=Math.min(KL.length,e9a.length,e21a.length);
  const ho=KL.length-mr.hArr.length;
  for(let i=1;i<n2;i++){
    const ci=KL.length-n2+i,hi=ci-ho;
    const hn=hi>=0&&hi<mr.hArr.length?mr.hArr[hi]:0,hp2=hi-1>=0?mr.hArr[hi-1]:0;
    if((e9a[i-1]<=e21a[i-1]&&e9a[i]>e21a[i])||(hp2<=0&&hn>0))sigs.push({idx:ci,type:'buy'});
    else if((e9a[i-1]>=e21a[i-1]&&e9a[i]<e21a[i])||(hp2>=0&&hn<0))sigs.push({idx:ci,type:'sell'});
  }
  if(sigs.length){
    const last=sigs[sigs.length-1];
    if(last.idx===KL.length-1&&last.type!==lastSigType){
      lastSigType=last.type;
      sendNotif(SYM,last.type,fmtP(price));
    }
  }

  setEl('tsEl','Son güncelleme: '+new Date().toLocaleTimeString('tr-TR')+' · 30s otomatik yenilenir');
  document.getElementById('mainPanel').style.display='block';
}

// ══════════════════════════════════════════
// LOAD COIN
// ══════════════════════════════════════════
async function loadCoin(sym,intv){
  document.getElementById('errBox').style.display='none';
  document.getElementById('ldr').style.display='block';
  document.getElementById('mainPanel').style.display='none';

  try{
    const{tk,candles,fund,ls}=await fetchCoin(sym,intv);
    updateUI(tk,candles,fund,ls);loadTV(sym,intv);
    // AI LWC Panel
    setTimeout(()=>{
      try{
        const ent=IND?calcEntry(candles,IND,tk):null;
        const sr=calcSR(candles,+tk.lastPrice);
        const pats=IND?detectPatterns(candles,IND.e9a,IND.e21a,IND.macd):[];
        const vols=candles.slice(-5).map(c=>c.v);
        const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/4;
        const lc=candles[candles.length-1];
        const fake=IND&&IND.bb&&(+tk.lastPrice>IND.bb.upper||+tk.lastPrice<IND.bb.lower)&&lc.v<avgV*0.8;
        LWC.update(candles,tk,IND,ent,sr,pats,fake);
      }catch(e){console.warn('LWC:',e);}
    },500);
  }catch(e){
    const eb=document.getElementById('errBox');
    eb.style.display='block';
    eb.textContent='⚠ Veri alınamadı: '+e.message+'. Sembol Binance Futures\'ta işlem görmüyor olabilir.';
    document.getElementById('mainPanel').style.display='block';
  }
  document.getElementById('ldr').style.display='none';
}
function openCoin(sym){SYM=sym;window.SYM=sym;document.getElementById('symInput').value=sym;loadCoin(SYM,INTV);setTimeout(()=>{const el=document.getElementById('mainPanel');if(el)el.scrollIntoView({behavior:'smooth'});},200);}
function doSearch(){
  const s=document.getElementById('symInput').value.trim().toUpperCase();if(!s)return;
  if(FUTURES_SYMS.length&&!FUTURES_SYMS.includes(s)){const eb=document.getElementById('errBox');eb.style.display='block';eb.textContent='⚠ '+s+' Binance Futures\'ta işlem görmüyor. Geçerli bir futures sembolü girin.';return;}
  SYM=s;window.SYM=s;loadCoin(SYM,INTV);
}

// ══════════════════════════════════════════
// INTERVAL BUTTONS
// ══════════════════════════════════════════
function buildIv(){
  const w=document.getElementById('ivRow');w.innerHTML='';
  IVLS.forEach(iv=>{
    const b=document.createElement('button');b.className='iv'+(iv===INTV?' on':'');b.textContent=iv;
    b.onclick=()=>{INTV=iv;buildIv();loadCoin(SYM,INTV);};w.appendChild(b);
  });
}

// ══════════════════════════════════════════
// RENDER CARD
// ══════════════════════════════════════════
function renderCard(item,dir,container,isJoker=false){
  const col=dir==='long'?'var(--green)':'var(--red)';
  const jCol=dir==='long'?'var(--cyan)':'var(--orange)';
  const mainCol=isJoker?jCol:col;
  const score=dir==='long'?item.lScore:item.sScore;
  const ema=dir==='long'?item.lEma:item.sEma;
  const desc=dir==='long'?item.lDesc:item.sDesc;
  const risk=item.risk;
  const chgStr=(item.chg>=0?'+':'')+item.chg.toFixed(2)+'%';
  const cardClass=isJoker?(dir==='long'?'opp joker-long':'opp joker-short'):'opp '+dir;
  const dirClass=isJoker?(dir==='long'?'joker-l':'joker-s'):dir;
  const dirTxt=isJoker?(dir==='long'?'🃏 JOKER LONG':'🃏 JOKER SHORT'):(dir==='long'?'▲ LONG':'▼ SHORT');
  const dec=item.price>1000?0:item.price>100?2:item.price>1?4:item.price>0.01?5:7;

  const d=document.createElement('div');d.className=cardClass;
  d.innerHTML=`<div class="opp-glow"></div>
    <div class="opp-dir ${dirClass}">${dirTxt}</div>
    <div class="opp-sym">${item.sym.replace('USDT','')}</div>
    <div class="opp-price">$${item.price.toLocaleString('en',{maximumFractionDigits:dec})} <span style="color:${item.chg>=0?'var(--green)':'var(--red)'};margin-left:6px;font-weight:600">${chgStr}</span></div>
    <div class="score-wrap">
      <div class="score-track"><div class="score-fill" style="width:${score}%;background:linear-gradient(90deg,${mainCol},${mainCol}88)"></div></div>
      <div class="score-labels"><span style="color:var(--text3);font-size:11px">Güven Skoru</span><b style="color:${mainCol}">${score}/100</b></div>
    </div>
    <div class="risk-row">
      <div class="risk-badge ${risk.cls}">${risk.label}</div>
      <div class="risk-track"><div class="risk-fill" style="width:${risk.score}%;background:${risk.cls==='risk-low'?'var(--green)':risk.cls==='risk-med'?'var(--yellow)':risk.cls==='risk-high'?'var(--orange)':'var(--red)'}"></div></div>
    </div>
    <div class="opp-inds">
      <div class="opp-ind">RSI: <b>${item.rsi}</b></div>
      <div class="opp-ind">EMA: <b>${ema}</b></div>
      <div class="opp-ind">MACD: <b style="color:${item.mh>0?'var(--green)':'var(--red)'}">${item.mh>0?'▲':'▼'}</b></div>
      <div class="opp-ind">24s: <b style="color:${item.chg>=0?'var(--green)':'var(--red)'}">${chgStr}</b></div>
    </div>
    <div class="opp-desc">${desc}${isJoker?'<br><span style="color:'+jCol+';font-weight:600">⚡ Yüksek volatilite — küçük pozisyon</span>':''}</div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button style="flex:1;padding:7px 10px;background:${mainCol}12;border:1px solid ${mainCol}44;border-radius:8px;color:${mainCol};font-size:10px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif"
        onclick="event.stopPropagation();window.SYM='${item.sym}';document.getElementById('symInput').value='${item.sym}';loadCoin('${item.sym}',INTV);setTimeout(()=>{const el=document.getElementById('mainPanel');if(el)el.scrollIntoView({behavior:'smooth'});},300)">
        📈 Grafikte Aç
      </button>
      <button style="padding:7px 14px;background:${mainCol}20;border:1px solid ${mainCol}60;border-radius:8px;color:${mainCol};font-size:10px;font-weight:800;cursor:pointer;font-family:Inter,sans-serif"
        onclick="event.stopPropagation();FuturesPanel.openModal({sym:'${item.sym}',dir:'${dir.toUpperCase()}',price:${item.price||0},sl:${dir==='long'?(item.sl||0):(item.slShort||0)},tp1:${dir==='long'?(item.tp1||0):(item.tp1Short||0)},tp2:${dir==='long'?(item.tp2||0):(item.tp2Short||0)}})">
        ⚡ İşlem Aç
      </button>
    </div>`;
  d.onclick = (e) => {
    if(e.target.tagName === 'BUTTON') return;
    // Son kart verisini kaydet (terminal'de kullanmak için)
    window._lastCardData = {
      sym: item.sym, dir: dir.toUpperCase(), price: item.price||0,
      sl:  dir==='long'?(item.sl||0):(item.slShort||0),
      tp1: dir==='long'?(item.tp1||0):(item.tp1Short||0),
      tp2: dir==='long'?(item.tp2||0):(item.tp2Short||0),
    };
    SYM = item.sym;
    document.getElementById('symInput').value = item.sym;
    loadCoin(SYM, INTV);
    setTimeout(()=>{ const el=document.getElementById('mainPanel'); if(el) el.scrollIntoView({behavior:'smooth'}); }, 300);
  };
  container.appendChild(d);
}

// ══════════════════════════════════════════
// MARKET SCAN
// ══════════════════════════════════════════
async function startScan(){
  if(!FUTURES_SYMS.length){
    setEl('scanTxt','Futures coin listesi alınıyor...');
    FUTURES_SYMS=await getFuturesSymbols();
  }
  await scanMarket();
}

async function scanMarket(){
  ScrollGuard.save(); // Scroll pozisyonunu kaydet
  const dot=document.getElementById('scanDot'),pw=document.getElementById('progWrap'),pf=document.getElementById('progFill');
  dot.classList.add('on');if(pw)pw.style.display='block';
  let symsToScan=FUTURES_SYMS;
  try{
    const tickers=await get(`${FBASE}/fapi/v1/ticker/24hr`);
    const sorted=tickers.filter(t=>t.symbol.endsWith('USDT')).sort((a,b)=>+b.quoteVolume-+a.quoteVolume).slice(0,100).map(t=>t.symbol);
    if(sorted.length)symsToScan=sorted;
  }catch(e){}

  const results=[];
  for(let i=0;i<symsToScan.length;i++){
    const sym=symsToScan[i];
    const pct=Math.round((i+1)/symsToScan.length*100);
    setEl('scanTxt',`Taranıyor ${i+1}/${symsToScan.length} — ${sym} (${pct}%)`);
    if(pf)pf.style.width=pct+'%';
    try{
      const[kl,tk]=await Promise.all([
        get(`${FBASE}/fapi/v1/klines?symbol=${sym}&interval=${INTV}&limit=100`),
        get(`${FBASE}/fapi/v1/ticker/24hr?symbol=${sym}`),
      ]);
      if(!Array.isArray(kl)||kl.length<30)continue;
      const closes=kl.map(k=>+k[4]),candles=kl.map(k=>({h:+k[2],l:+k[3],c:+k[4],o:+k[1],v:+k[5]}));
      const chg=+tk.priceChangePercent,price=+tk.lastPrice;
      const atr=calcATR(candles);
      const risk=calcRisk(closes,chg,atr,price);
      const lSc=scoreLong(closes,chg),sSc=scoreShort(closes,chg);
      const jlSc=jokerScoreLong(closes,chg,atr,price),jsSc=jokerScoreShort(closes,chg,atr,price);

      // SL/TP değerleri — ATR bazlı
      const slLong  = +(price - atr*1.5).toFixed(4);
      const tp1Long = +(price + atr*2.0).toFixed(4);
      const tp2Long = +(price + atr*3.5).toFixed(4);
      const slShort  = +(price + atr*1.5).toFixed(4);
      const tp1Short = +(price - atr*2.0).toFixed(4);
      const tp2Short = +(price - atr*3.5).toFixed(4);

      results.push({sym,chg,price,rsi:lSc.rsi,mh:lSc.mh,risk,atr,
        lScore:lSc.score,sScore:sSc.score,lEma:lSc.ema,sEma:sSc.ema,
        lDesc:oppDesc(lSc,'long'),sDesc:oppDesc(sSc,'short'),jlScore:jlSc,jsScore:jsSc,
        // SL/TP — renderCard'da kullanılır
        sl:slLong, tp1:tp1Long, tp2:tp2Long,
        slShort, tp1Short, tp2Short,
        // ── Trading Intelligence için ek veri ──────────────────────
        closes,
        candles,
        ind: {
          rsi:   lSc.rsi,
          ema9:  lSc.e9v   ?? null,
          ema21: lSc.e21v  ?? null,
          ema50: lSc.e50v  ?? null,
          atr:   atr,
          macd:  lSc.macdObj ? { histogram: lSc.macdObj.hist, line: lSc.macdObj.line } : null,
        },
        dir: lSc.score > sSc.score ? 'LONG' : (sSc.score > lSc.score ? 'SHORT' : null),
      });
    }catch(e){}
    await new Promise(r=>setTimeout(r,60));
  }

  const top3L=[...results].sort((a,b)=>b.lScore-a.lScore).slice(0,3);
  const top3S=[...results].sort((a,b)=>b.sScore-a.sScore).slice(0,3);
  const topSyms=new Set([...top3L,...top3S].map(i=>i.sym));
  const jokerL=[...results].filter(i=>!topSyms.has(i.sym)).sort((a,b)=>b.jlScore-a.jlScore)[0];
  const jokerS=[...results].filter(i=>!topSyms.has(i.sym)).sort((a,b)=>b.jsScore-a.jsScore)[0];

  const lg=document.getElementById('longGrid'),sg=document.getElementById('shortGrid'),jg=document.getElementById('jokerGrid');
  const _scrollPos = window.scrollY; // Mevcut pozisyonu kaydet
  lg.innerHTML='';sg.innerHTML='';jg.innerHTML='';
  if(top3L.length)top3L.forEach(it=>renderCard(it,'long',lg));
  else lg.innerHTML='<div style="font-size:13px;color:var(--text3);padding:14px">Long fırsatı bulunamadı.</div>';
  if(top3S.length)top3S.forEach(it=>renderCard(it,'short',sg));
  else sg.innerHTML='<div style="font-size:13px;color:var(--text3);padding:14px">Short fırsatı bulunamadı.</div>';
  if(jokerL){jokerL.lScore=jokerL.jlScore;jokerL.lDesc='Ani kırılım potansiyeli · ATR: '+(jokerL.atr/jokerL.price*100).toFixed(2)+'% · '+oppDesc({score:jokerL.lScore,rsi:jokerL.rsi,mh:jokerL.mh,ema:jokerL.lEma},'long');renderCard(jokerL,'long',jg,true);}
  if(jokerS){jokerS.sScore=jokerS.jsScore;jokerS.sDesc='Ani düşüş potansiyeli · ATR: '+(jokerS.atr/jokerS.price*100).toFixed(2)+'% · '+oppDesc({score:jokerS.sScore,rsi:jokerS.rsi,mh:jokerS.mh,ema:jokerS.sEma},'short');renderCard(jokerS,'short',jg,true);}
  // Scroll pozisyonunu geri yükle
  if(_scrollPos > 100) requestAnimationFrame(()=>window.scrollTo({top:_scrollPos,behavior:'instant'}));

  // ── PHASE 10: Priority Engine scan hook ──
  try{ P10.onScanComplete(results); }catch(e){}

  // ── Trading Intelligence — scan sonuçlarını yayınla ──
  try{ window.dispatchEvent(new CustomEvent('vd:scan:complete', { detail: { results } })); }catch(e){}

  // ── AI: Tarama sinyallerini kaydet ──────────────────────────────
  // Top 3 Long, Top 3 Short ve Jokerler için giriş/stop/tp hesapla
  // ve AI öğrenme motoruna kaydet — otomatik takip başlatılır
  try{
    const _recordScanSig = async (item, dir) => {
      if(!item||!item.price||!item.atr) return;
      // Bu coin için klines çekip entry hesapla
      try{
        const kl = await fetch(`${FBASE}/fapi/v1/klines?symbol=${item.sym}&interval=${INTV}&limit=100`)
          .then(r=>r.ok?r.json():null);
        if(!kl||!Array.isArray(kl)||kl.length<30) return;
        const closes  = kl.map(k=>+k[4]);
        const candles = kl.map(k=>({t:+k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5]}));
        const e9a=calcEMA(closes,9),e21a=calcEMA(closes,21),e50a=calcEMA(closes,50);
        const e9v=e9a[e9a.length-1],e21v=e21a[e21a.length-1],e50v=e50a[e50a.length-1];
        const mr  = calcMACD(closes);
        const rsi = calcRSI(closes);
        const atr = calcATR(candles);
        const bb  = calcBB(closes);
        if(!atr) return;

        // Basit entry hesabı (calcEntry ile aynı mantık)
        const price = closes[closes.length-1];
        let entry,stop,tp1,tp2,tp3,rr;
        if(dir==='LONG'){
          entry=price; stop=+(price-atr*1.5);
          tp1=+(price+atr*2); tp2=+(price+atr*3.5); tp3=+(price+atr*5.5);
          rr=+((tp2-entry)/(entry-stop)).toFixed(2);
        } else {
          entry=price; stop=+(price+atr*1.5);
          tp1=+(price-atr*2); tp2=+(price-atr*3.5); tp3=+(price-atr*5.5);
          rr=+((entry-tp2)/(stop-entry)).toFixed(2);
        }
        if(rr<=0) return;

        const ema = e9v>e21v?(e21v>e50v?'▲▲▲':'▲▲'):(e21v<e50v?'▼▼▼':'▼▼');
        const score = dir==='LONG' ? item.lScore : item.sScore;
        const conf  = AI.adjustConf(score, item.sym, dir, rsi, ema, (atr/price)*100);
        const pats  = detectPatterns(candles, e9a, e21a, mr);

        AI.record({
          sym    : item.sym,
          tf     : INTV,
          type   : dir,
          conf,
          rsi,
          macdH  : mr.hist,
          ema,
          atrPct : (atr/price)*100,
          funding: 0,
          volume : item.price*1e6, // placeholder
          entry, tp1, tp2, tp3, stop,
          pats   : pats.map(p=>p.name),
          source : 'scan', // taramadan geldi
        });
      }catch(e){}
    };

    // Paralel kaydet — UI'yı bloklamaz
    const scanSigs = [
      ...top3L.map(it=>({it,dir:'LONG'})),
      ...top3S.map(it=>({it,dir:'SHORT'})),
    ];
    if(jokerL) scanSigs.push({it:jokerL,dir:'LONG'});
    if(jokerS) scanSigs.push({it:jokerS,dir:'SHORT'});

    // 2 saniye gecikmeyle kaydet (UI render önce bitsin)
    setTimeout(()=>{
      Promise.allSettled(scanSigs.map(({it,dir})=>_recordScanSig(it,dir)))
        .then(()=>renderAI());
    }, 2000);
  }catch(e){}

  dot.classList.remove('on');if(pw)pw.style.display='none';
  setEl('scanTxt',`✓ ${results.length} coin tarandı · ${new Date().toLocaleTimeString('tr-TR')} · 2 dk'da yenilenir`);
}

// ══════════════════════════════════════════
// COPY PROMPT
// ══════════════════════════════════════════
function copyPrompt(){
  if(!TK||!KL.length||!IND){alert('Önce bir coin yükleyin.');return;}
  const last=KL[KL.length-1],f6=n=>n!=null?(+n).toFixed(6):'—';
  const{rsi:r,macd:m,ema9:e9,ema21:e21,ema50:e50,bb:b,atr:at}=IND;
  const ent=calcEntry(KL,IND,TK);
  const risk=calcRisk(KL.map(c=>c.c),+TK.priceChangePercent,at,+TK.lastPrice);
  const pats=detectPatterns(KL,IND.e9a,IND.e21a,m);
  const sr=calcSR(KL,+TK.lastPrice);

  const prompt=`Sen profesyonel bir kripto futures trader ve teknik analistsin.

COIN: ${SYM} | ZAMAN: ${INTV}
FİYAT: ${last.c} USDT | 24s: ${(+TK.priceChangePercent).toFixed(2)}%
Hacim: ${(+TK.quoteVolume/1e6).toFixed(2)}M USDT
${FUND?`Funding: ${(+FUND.lastFundingRate*100).toFixed(4)}%`:''}
Risk: ${risk.label} (${risk.score}/100)

TEKNİK:
RSI: ${r} | MACD: ${m.hist>0?'+':''}${f6(m.hist)} | EMA Yön: ${e9>e21?'▲ YUKARI':'▼ AŞAĞI'}
EMA9/21/50: ${f6(e9)} / ${f6(e21)} / ${f6(e50)}
BB: Üst ${f6(b?.upper)} | Orta ${f6(b?.mid)} | Alt ${f6(b?.lower)}
ATR: ${f6(at)} (%${(at/+TK.lastPrice*100).toFixed(2)} volatilite)

DESTEK/DİRENÇ:
Dirençler: ${sr.res.map(r=>'$'+fmtP(r.avg)).join(', ')||'—'}
Destekler: ${sr.sup.map(s=>'$'+fmtP(s.avg)).join(', ')||'—'}

FORMASYONLAR: ${pats.length?pats.map(p=>p.name+'('+p.signal+')').join(', '):'Yok'}

${ent?`SİSTEM: ${ent.dir} | Giriş:${f6(ent.entry)} Stop:${f6(ent.stop)} TP1:${f6(ent.tp1)} TP2:${f6(ent.tp2)} TP3:${f6(ent.tp3)} R/R:1:${ent.rr}`:'SİSTEM: BEKLE'}

SON 5 MUM: ${KL.slice(-5).map(k=>`O:${k.o} H:${k.h} L:${k.l} C:${k.c}`).join(' | ')}

NET TÜRKÇE YANIT:
🎯 YÖN: | Güven: /100 | Risk:
📍 GİRİŞ: | STOP: | TP1: | TP2: | TP3:
⚖️ R/R: 1:
💡 YORUM: [2-3 cümle, stop ve risk yönetimi dahil]`;

  const done=()=>{const ok=document.getElementById('copyOk');if(ok){ok.style.display='inline';setTimeout(()=>{ok.style.display='none';window.open('https://claude.ai','_blank');},700);}};
  navigator.clipboard.writeText(prompt).then(done).catch(()=>{const ta=document.createElement('textarea');ta.value=prompt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done();});
}


// ════════════════════════════════════════════════════════════════════
// AI LEARNING ENGINE + OTOMATİK FİYAT TAKİBİ
//
// Ne yapar:
//  1. Her sinyal geldiğinde otomatik kaydeder
//  2. Fiyatı arka planda izler — TP/SL'ye ulaşınca otomatik öğrenir
//  3. Coin bazlı başarı oranı tutar
//  4. Adaptif ağırlıklarla ilerideki sinyalleri düzeltir
//  5. Tüm veri localStorage'da — PC kapansa bile korunur
// ════════════════════════════════════════════════════════════════════
const AI = (() => {
  const KEY      = 'ai_analyst_pro_v2';
  const MAX_RECS = 500;
  const MIN_SAMP = 6;      // öğrenme için min örnek
  const LR       = 0.035;  // öğrenme hızı — yavaş ve güvenli
  const W_MIN    = 0.4;
  const W_MAX    = 1.8;
  const TRACK_INTERVAL = 60000;    // 1 dk'da bir fiyat kontrol
  const MAX_TRACK_HOURS = 48;      // 48 saatten eski sinyalleri kapat
  const TP_CHECK_MULT = 1.0;       // TP'ye tam ulaşınca tetikle

  const DEF_W = {ema:1, macd:1, rsi:1, volume:1, funding:1, volatility:1};

  let _sigs  = [];
  let _w     = {...DEF_W};
  let _coins = {};   // {sym: {win,lose,pending,fakeBreak,goodBreak}}
  let _pats  = {};   // {patName: {win,lose}}
  let _ready = false;
  let _trackTimer = null;

  // ── localStorage ──────────────────────────────────────────────────
  function _save(){
    try{
      localStorage.setItem(KEY, JSON.stringify({
        sigs:_sigs.slice(-MAX_RECS), w:_w, coins:_coins, pats:_pats, v:Date.now()
      }));
    }catch(e){
      // Doldu — eski yarıyı sil
      _sigs = _sigs.slice(-Math.floor(MAX_RECS/2));
      try{ localStorage.setItem(KEY, JSON.stringify({sigs:_sigs,w:_w,coins:_coins,pats:_pats,v:Date.now()})); }catch(e2){}
    }
  }

  function _load(){
    if(_ready) return;
    try{
      const raw = localStorage.getItem(KEY);
      if(raw){
        const d = JSON.parse(raw);
        _sigs  = Array.isArray(d.sigs) ? d.sigs  : [];
        _w     = d.w     ? {...DEF_W,...d.w}     : {...DEF_W};
        _coins = d.coins ? d.coins               : {};
        _pats  = d.pats  ? d.pats                : {};
      }
    }catch(e){ _sigs=[];_w={...DEF_W};_coins={};_pats={}; }
    _ready = true;
  }

  // ── Sinyal kaydet ──────────────────────────────────────────────────
  function record(info){
    _load();
    if(!info.sym||!info.type) return null; // geçersiz veri
    // Aynı coin için zaten pending sinyal varsa üstüne yazma
    const existing = _sigs.find(s=>s.sym===info.sym&&s.result==='pending');
    if(existing) return existing.id;

    const id = Date.now()+'_'+Math.random().toString(36).slice(2,6);
    const sig = {
      id, ts:Date.now(),
      sym:info.sym, tf:info.tf||'15m', type:info.type,
      conf:info.conf||0, rsi:info.rsi||0, macdH:info.macdH||0,
      ema:info.ema||'', atrPct:info.atrPct||0,
      funding:info.funding||0, volume:info.volume||0,
      entry:info.entry||0, tp1:info.tp1||0, tp2:info.tp2||0,
      tp3:info.tp3||0, stop:info.stop||0,
      pats:info.pats||[],
      result:'pending', doneAt:null,
      // Fiyat takibi için
      maxFav:info.entry||0,   // en favori fiyat (long için yükseğe, short için aşağıya)
      maxAdv:info.entry||0,   // en ters fiyat
      checkCount:0,
      lastPrice:info.entry||0,
    };
    _sigs.push(sig);
    if(!_coins[sig.sym]) _coins[sig.sym]={win:0,lose:0,pending:0,fakeBreak:0,goodBreak:0};
    _coins[sig.sym].pending++;
    _save();
    return id;
  }

  // ── Sonuç kaydet + öğren ───────────────────────────────────────────
  function _resolve(id, result, autoTrack=false){
    _load();
    const sig = _sigs.find(s=>s.id===id);
    if(!sig||sig.result!=='pending') return false;
    sig.result  = result;
    sig.doneAt  = Date.now();
    sig.autoResolved = autoTrack;
    const win = result!=='stop';

    // Coin istatistik güncelle
    const cp = _coins[sig.sym];
    if(cp){
      cp.pending = Math.max(0, cp.pending-1);
      win ? cp.win++ : cp.lose++;
      // Fake breakout tespiti:
      // Sinyal yönünün TAM TERSİ hareket ettiyse fake breakout say
      if(!win && sig.maxFav && sig.entry){
        const oppMove = sig.type==='LONG'
          ? (sig.entry - sig.maxAdv) / sig.entry  // aşağı ne kadar gitti
          : (sig.maxAdv - sig.entry) / sig.entry;  // yukarı ne kadar gitti
        if(oppMove > 0.005) cp.fakeBreak++;
      }
      if(win) cp.goodBreak++;
    }

    // Pattern istatistik güncelle
    (sig.pats||[]).forEach(p=>{
      if(!_pats[p]) _pats[p]={win:0,lose:0};
      win ? _pats[p].win++ : _pats[p].lose++;
    });

    _learn(sig, win);
    _save();
    renderAI();
    return true;
  }

  // ── Adaptif öğrenme ───────────────────────────────────────────────
  function _learn(sig, win){
    const d = win ? LR : -LR;
    const clamp = v => +(Math.max(W_MIN, Math.min(W_MAX, v)).toFixed(3));

    // EMA — hizalama ne kadar güçlüyse o kadar etkili
    if(sig.ema==='▲▲▲'||sig.ema==='▼▼▼')      _w.ema = clamp(_w.ema + d*1.3);
    else if(sig.ema==='▲▲'||sig.ema==='▼▼')   _w.ema = clamp(_w.ema + d*0.7);
    else                                         _w.ema = clamp(_w.ema + d*0.3);

    // MACD
    if(Math.abs(sig.macdH)>0) _w.macd = clamp(_w.macd + d*1.0);

    // RSI — uçlarda başarısızsa ekstra ceza
    if((sig.rsi>72||sig.rsi<28)&&!win)  _w.rsi = clamp(_w.rsi - LR*1.8);
    else if(sig.rsi>=45&&sig.rsi<=65)   _w.rsi = clamp(_w.rsi + d*0.9);
    else                                 _w.rsi = clamp(_w.rsi + d*0.5);

    // Hacim
    _w.volume = clamp(_w.volume + d*0.7);

    // Funding — aşırı pozitif/negatifken başarısızsa ceza
    if(Math.abs(sig.funding)>0.05&&!win) _w.funding = clamp(_w.funding - LR*1.2);
    else                                  _w.funding = clamp(_w.funding + d*0.4);

    // Volatilite — yüksek ATR başarısızsa ceza
    if(sig.atrPct>4&&!win)       _w.volatility = clamp(_w.volatility - LR*1.5);
    else if(sig.atrPct<2&&win)   _w.volatility = clamp(_w.volatility + LR*0.5);
    else                          _w.volatility = clamp(_w.volatility + d*0.3);
  }

  // ── OTOMATİK FİYAT TAKİBİ ─────────────────────────────────────────
  // Sistem siteyi açık bıraktığında arka planda izler
  // Kullanıcı hiçbir şey yapmak zorunda değil
  async function _checkPrices(){
    _load();
    const pending = _sigs.filter(s => {
      if(s.result!=='pending') return false;
      if(!s.entry||!s.tp1||!s.stop) return false;
      // 48 saatten eskiyse zaman aşımı — başarısız say
      if(Date.now()-s.ts > MAX_TRACK_HOURS*3600000){
        _resolve(s.id,'stop',true); // zaman aşımı = başarısız
        return false;
      }
      return true;
    });

    if(!pending.length) return;

    // Tüm pending coinlerin fiyatını tek batch ile çek
    const syms = [...new Set(pending.map(s=>s.sym).filter(Boolean))];
    const prices = {};

    await Promise.allSettled(syms.map(async sym=>{
      if(!sym) return;
      try{
        const r = await fetch(`${FBASE}/fapi/v1/ticker/price?symbol=${sym}`);
        const d = await r.json();
        if(d&&d.price) prices[sym] = +d.price;
      }catch(e){}
    }));

    pending.forEach(sig=>{
      const price = prices[sig.sym];
      if(!price) return;

      sig.checkCount  = (sig.checkCount||0)+1;
      sig.lastPrice   = price;

      const isLong = sig.type==='LONG';

      // Max favori / max ters fiyat güncelle
      if(isLong){
        sig.maxFav = Math.max(sig.maxFav||sig.entry, price);
        sig.maxAdv = Math.min(sig.maxAdv||sig.entry, price);
      } else {
        sig.maxFav = Math.min(sig.maxFav||sig.entry, price);
        sig.maxAdv = Math.max(sig.maxAdv||sig.entry, price);
      }

      // Sonuç kontrolü
      if(isLong){
        if(price <= sig.stop)              { _resolve(sig.id,'stop',true);  return; }
        if(sig.tp3 && price >= sig.tp3)    { _resolve(sig.id,'tp3',true);   return; }
        if(sig.tp2 && price >= sig.tp2)    { _resolve(sig.id,'tp2',true);   return; }
        if(price >= sig.tp1)               { _resolve(sig.id,'tp1',true);   return; }
      } else {
        if(price >= sig.stop)              { _resolve(sig.id,'stop',true);  return; }
        if(sig.tp3 && price <= sig.tp3)    { _resolve(sig.id,'tp3',true);   return; }
        if(sig.tp2 && price <= sig.tp2)    { _resolve(sig.id,'tp2',true);   return; }
        if(price <= sig.tp1)               { _resolve(sig.id,'tp1',true);   return; }
      }
    });

    _save();
    renderAI();
  }

  // Takip timer'ı başlat
  function startTracking(){
    if(_trackTimer) clearInterval(_trackTimer);
    _trackTimer = setInterval(_checkPrices, TRACK_INTERVAL);
    _checkPrices(); // hemen bir kontrol yap
  }

  // Sayfa görünür olduğunda takibi devam ettir
  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden) _checkPrices();
  });

  // ── İstatistik ────────────────────────────────────────────────────
  function stats(){
    _load();
    const res   = _sigs.filter(s=>s.result!=='pending');
    const wins  = res.filter(s=>s.result!=='stop');
    const longs = res.filter(s=>s.type==='LONG');
    const shorts= res.filter(s=>s.type==='SHORT');
    const lw    = wins.filter(s=>s.type==='LONG');
    const sw    = wins.filter(s=>s.type==='SHORT');

    const coinList = Object.entries(_coins)
      .map(([sym,c])=>({
        sym, total:c.win+c.lose,
        wr:c.win+c.lose>0 ? c.win/(c.win+c.lose) : 0,
        fakeRate: c.win+c.lose>0 ? c.fakeBreak/(c.win+c.lose) : 0,
      }))
      .filter(c=>c.total>=3)
      .sort((a,b)=>b.wr-a.wr);

    const patList = Object.entries(_pats)
      .map(([name,p])=>({name,total:p.win+p.lose,wr:p.win+p.lose>0?p.win/(p.win+p.lose):0}))
      .filter(p=>p.total>=3)
      .sort((a,b)=>b.wr-a.wr);

    return{
      total  : _sigs.length,
      resolved:res.length,
      pending: _sigs.filter(s=>s.result==='pending').length,
      wr     : res.length ? wins.length/res.length*100 : null,
      longWR : longs.length ? lw.length/longs.length*100 : null,
      shortWR: shorts.length ? sw.length/shorts.length*100 : null,
      longCnt: longs.length, shortCnt:shorts.length,
      best   : coinList[0]||null,
      worst  : coinList[coinList.length-1]||null,
      coinList: coinList.slice(0,8),
      bestPat: patList[0]||null,
      recent : [..._sigs].reverse().slice(0,20),
      w      : {..._w},
    };
  }

  // ── AI Yorumu ─────────────────────────────────────────────────────
  function commentary(st){
    if(st.resolved < MIN_SAMP)
      return `Sistem <b>${st.pending}</b> sinyali otomatik takip ediyor. `+
             `${st.resolved}/${MIN_SAMP} sonuç bekleniyor — öğrenme başlamak üzere.`;

    const lines=[];
    if(st.wr>=65)      lines.push(`Genel başarı oranı güçlü (<b>${st.wr.toFixed(0)}%</b>).`);
    else if(st.wr>=50) lines.push(`Başarı oranı makul (<b>${st.wr.toFixed(0)}%</b>).`);
    else               lines.push(`Başarı oranı düşük (<b>${st.wr.toFixed(0)}%</b>) — sistem öğreniyor.`);

    const {ema,macd,rsi,volume,funding,volatility} = st.w;
    if(ema>1.3)        lines.push(`EMA hizalama yüksek başarı gösteriyor — ağırlık artırıldı (<b>${ema.toFixed(2)}x</b>).`);
    if(ema<0.7)        lines.push(`EMA sinyalleri güvenilirliğini yitirdi (<b>${ema.toFixed(2)}x</b>).`);
    if(macd>1.3)       lines.push(`MACD cross güvenilir — ağırlık artırıldı (<b>${macd.toFixed(2)}x</b>).`);
    if(macd<0.7)       lines.push(`MACD tutarsız — ağırlık azaltıldı (<b>${macd.toFixed(2)}x</b>).`);
    if(rsi<0.7)        lines.push(`RSI uç değerlerde başarısızlık yüksek — filtre sıkılaştı.`);
    if(volatility<0.7) lines.push(`Yüksek volatilite sinyalleri başarısız — ceza uygulandı.`);
    if(funding<0.7)    lines.push(`Aşırı funding durumlarından kaçınılıyor.`);
    if(volume>1.3)     lines.push(`Yüksek hacim konfirmasyonu başarıyı artırıyor.`);
    if(st.best)        lines.push(`En başarılı: <b>${st.best.sym.replace('USDT','')}</b> (%${(st.best.wr*100).toFixed(0)} WR, ${st.best.total} sinyal).`);
    if(st.worst&&st.worst.sym!==st.best?.sym&&st.worst.wr<0.4)
      lines.push(`Sorunlu coin: <b>${st.worst.sym.replace('USDT','')}</b> — bu coinde güven düşürüldü.`);
    if(st.bestPat)     lines.push(`En güçlü formasyon: <b>${st.bestPat.name}</b> (%${(st.bestPat.wr*100).toFixed(0)}).`);

    return lines.join(' ') || 'Sistem analiz ediyor...';
  }

  // ── Adaptif confidence ayarı ──────────────────────────────────────
  // Bu fonksiyon mevcut scoreLong/scoreShort'un üstüne çarpan uygular
  function adjustConf(baseScore, sym, type, rsi, ema, atrPct){
    _load();
    let score = baseScore;
    const w = _w;

    // Ağırlık etkisi
    if(ema==='▲▲▲'||ema==='▼▼▼') score += (w.ema-1)*12;
    else if(ema==='▲▲'||ema==='▼▼') score += (w.ema-1)*6;
    score += (w.macd-1)*8;
    if(rsi>=45&&rsi<=65) score += (w.rsi-1)*8;
    score += (w.volume-1)*5;
    if(atrPct>3) score -= (1-w.volatility)*10;

    // Coin bazlı geçmiş etkisi
    const cp = _coins[sym];
    if(cp && cp.win+cp.lose >= MIN_SAMP){
      const wr = cp.win/(cp.win+cp.lose);
      score += (wr-0.5)*18;
      // Fake breakout oranı yüksekse ekstra ceza
      const fakeRate = cp.fakeBreak/(cp.win+cp.lose);
      if(fakeRate>0.3) score -= fakeRate*15;
    }

    return Math.max(10, Math.min(97, Math.round(score)));
  }

  function resetWeights(){
    if(!confirm('Ağırlıklar varsayılana döndürülsün mü?')) return;
    _w = {...DEF_W}; _save(); renderAI();
  }
  function clearAll(){
    if(!confirm('Tüm sinyal geçmişi ve öğrenme verisi silinsin mi?')) return;
    _sigs=[];_coins={};_pats={};_w={...DEF_W}; _save(); renderAI();
  }

  return {record, resolve:_resolve, startTracking, stats, commentary, adjustConf, resetWeights, clearAll, load:_load, getW:()=>({..._w})};
})();

// ════════════════════════════════════════════════════════════════════
// AI PANEL RENDER
// ════════════════════════════════════════════════════════════════════
function renderAI(){
  const st = AI.stats();
  const $  = id => document.getElementById(id);

  if($('aiTotal'))    $('aiTotal').textContent = st.total;
  if($('aiLearnInfo'))$('aiLearnInfo').textContent = st.resolved+' sonuçlandı, '+st.pending+' takipte';

  if($('aiWR')){
    $('aiWR').textContent = st.wr!=null ? st.wr.toFixed(1)+'%' : '—';
    $('aiWR').style.color = st.wr>=60?'var(--green)':st.wr>=50?'var(--yellow)':'var(--red)';
    if($('aiWRBar')) $('aiWRBar').style.width = (st.wr||0)+'%';
  }
  if($('aiLongWR'))  { $('aiLongWR').textContent  = st.longWR!=null  ? st.longWR.toFixed(1)+'%'  : '—'; }
  if($('aiLongCnt')) { $('aiLongCnt').textContent  = st.longCnt+' long sinyal'; }
  if($('aiShortWR')) {
    $('aiShortWR').textContent = st.shortWR!=null ? st.shortWR.toFixed(1)+'%' : '—';
    $('aiShortWR').style.color = st.shortWR>=60?'var(--red)':st.shortWR>=50?'var(--yellow)':'var(--orange)';
  }
  if($('aiShortCnt')){ $('aiShortCnt').textContent = st.shortCnt+' short sinyal'; }
  if($('aiBest'))    {
    $('aiBest').textContent  = st.best  ? st.best.sym.replace('USDT','')  : '—';
    $('aiBestWR').textContent= st.best  ? '%'+(st.best.wr*100).toFixed(0)+' WR ('+st.best.total+' sig)' : '—';
  }
  if($('aiWorst'))   {
    $('aiWorst').textContent  = st.worst ? st.worst.sym.replace('USDT','') : '—';
    $('aiWorstWR').textContent= st.worst ? '%'+(st.worst.wr*100).toFixed(0)+' WR ('+st.worst.total+' sig)': '—';
  }
  if($('aiComment')) $('aiComment').innerHTML = AI.commentary(st);

  // Ağırlık barları
  const wmap = [
    ['ema','wEma','wEmaB'],['macd','wMacd','wMacdB'],['rsi','wRsi','wRsiB'],
    ['volume','wVol','wVolB'],['funding','wFund','wFundB'],['volatility','wVola','wVolaB'],
  ];
  wmap.forEach(([k,vid,bid])=>{
    const v = st.w[k]||1;
    if($(vid)) $(vid).textContent = v.toFixed(2)+'x';
    if($(bid)){
      $(bid).style.width      = ((v-0.4)/1.4*100).toFixed(0)+'%';
      $(bid).style.background = v>1.1?'var(--green)':v<0.9?'var(--red)':'linear-gradient(90deg,var(--purple),var(--cyan))';
    }
  });

  // Coin listesi
  const cl = $('aiCoinList');
  if(cl){
    if(!st.coinList.length){
      cl.innerHTML='<div style="font-size:11px;color:var(--text3);padding:4px 0">Henüz coin verisi yok.</div>';
    } else {
      cl.innerHTML='';
      st.coinList.forEach(c=>{
        const wr  = (c.wr*100).toFixed(0);
        const col = c.wr>=0.6?'var(--green)':c.wr>=0.5?'var(--yellow)':'var(--red)';
        const fakeTag = c.fakeRate>0.3 ? ' <span style="font-size:9px;color:var(--orange)">[fake↑]</span>' : '';
        const d=document.createElement('div'); d.className='ai-coin-row';
        d.innerHTML=`<span class="ac-sym">${c.sym.replace('USDT','')}</span>
          <span class="ac-wr" style="color:${col}">%${wr}${fakeTag}</span>
          <div class="ac-bar"><div class="ac-fill" style="width:${wr}%;background:${col}"></div></div>
          <span class="ac-cnt">${c.total} sinyal</span>`;
        cl.appendChild(d);
      });
    }
  }

  // Sinyal geçmişi
  const hl = $('aiHistList');
  if(hl){
    if(!st.recent.length){
      hl.innerHTML='<div style="font-size:11px;color:var(--text3);padding:4px 0">Henüz kayıtlı sinyal yok.</div>';
    } else {
      hl.innerHTML='';
      st.recent.forEach(sig=>{
        if(!sig||!sig.sym||!sig.type) return; // eksik veri varsa atla
        const cls     = sig.result==='pending'?'pending':sig.result==='stop'?'lose':'win';
        const autoTag = sig.autoResolved?' <span style="font-size:9px;color:var(--text3)">[oto]</span>':'';
        const resText = sig.result==='pending' ? '⏳ İzleniyor'
          : sig.result==='stop' ? '✗ Stop'
          : '✓ '+sig.result.toUpperCase();
        const resCol  = sig.result==='pending'?'var(--yellow)':sig.result==='stop'?'var(--red)':'var(--green)';
        const age     = Math.round((Date.now()-sig.ts)/60000);
        const ageStr  = age<60?age+'dk':Math.floor(age/60)+'s';

        // Fiyat hareketi yüzdesi (pending için)
        let trackInfo = '';
        if(sig.result==='pending'&&sig.lastPrice&&sig.entry){
          const mv = ((sig.lastPrice-sig.entry)/sig.entry*100).toFixed(2);
          const isL= sig.type==='LONG';
          const favorable = isL?(+mv>0):(+mv<0);
          trackInfo=`<span class="ah-track">Giriş: $${sig.entry.toFixed?sig.entry.toFixed(4):sig.entry} → Şu an: $${sig.lastPrice.toFixed?sig.lastPrice.toFixed(4):sig.lastPrice} <b style="color:${favorable?'var(--green)':'var(--red)'}">(${mv>0?'+':''}${mv}%)</b></span>`;
        }

        const d=document.createElement('div'); d.className='ai-hist-row '+cls;
        const srcTag = sig.source==='scan'
          ? ' <span style="font-size:8px;color:var(--cyan);background:rgba(0,212,255,.1);padding:1px 5px;border-radius:3px;border:1px solid rgba(0,212,255,.25)">TARAMA</span>'
          : ' <span style="font-size:8px;color:var(--purple);background:rgba(157,125,250,.1);padding:1px 5px;border-radius:3px;border:1px solid rgba(157,125,250,.25)">GRAFİK</span>';
        d.innerHTML=`<span class="ah-sym">${sig.sym.replace('USDT','')}</span>
          <span class="ah-dir ${sig.type.toLowerCase()}">${sig.type==='LONG'?'▲':'▼'} ${sig.type}</span>
          <span class="ah-conf">%${sig.conf}${srcTag}</span>
          <span class="ah-res ${cls}" style="color:${resCol}">${resText}${autoTag}</span>
          <span class="ah-age">${ageStr} önce</span>
          ${trackInfo}`;
        hl.appendChild(d);
      });
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// SİNYAL KAYIT — updateUI tamamlanınca otomatik kaydet
// ════════════════════════════════════════════════════════════════════
const _origUpdateUI = typeof updateUI === 'function' ? updateUI : null;
if(_origUpdateUI){
  window.updateUI = function(tk, candles, fund, ls){
    // Önce orijinal updateUI'yi çalıştır — sinyal mantığı değişmez
    _origUpdateUI(tk, candles, fund, ls);

    // 600ms sonra sinyal varsa kaydet (DOM güncellenmesini bekle)
    setTimeout(()=>{
      try{
        if(!window.TK||!window.IND||!window.KL||!window.KL.length) return;
        const ent = calcEntry(window.KL, window.IND, window.TK);
        if(!ent) return; // Sinyal yoksa kaydetme

        const pats = detectPatterns(window.KL, window.IND.e9a, window.IND.e21a, window.IND.macd);
        const e9   = window.IND.ema9, e21=window.IND.ema21, e50=window.IND.ema50;
        const ema  = e9>e21 ? (e21>e50?'▲▲▲':'▲▲') : (e21<e50?'▼▼▼':'▼▼');
        const conf = AI.adjustConf(
          Math.round(calcConf(window.IND, window.TK)),
          window.SYM, ent.dir,
          window.IND.rsi, ema,
          (window.IND.atr/+window.TK.lastPrice)*100
        );

        AI.record({
          sym    : window.SYM,
          tf     : window.INTV,
          type   : ent.dir,
          conf,
          rsi    : window.IND.rsi,
          macdH  : window.IND.macd.hist,
          ema,
          atrPct : (window.IND.atr / +window.TK.lastPrice) * 100,
          funding: window.FUND ? +window.FUND.lastFundingRate*100 : 0,
          volume : +window.TK.quoteVolume,
          entry  : ent.entry,
          tp1    : ent.tp1, tp2:ent.tp2, tp3:ent.tp3, stop:ent.stop,
          pats   : pats.map(p=>p.name),
        });
        renderAI();
      }catch(e){}
    }, 600);
  };
}


// ════════════════════════════════════════════════════════════════════
// PROFESSIONAL AI TRADING TERMINAL — EXTRA ENGINES
// Market Regime | OI/Funding | BTC Correlation | Fake Breakout
// Risk Engine | Trade Decision | Trade Management
// ════════════════════════════════════════════════════════════════════

// ── 1. MARKET REGIME ENGINE ──────────────────────────────────────────
const MarketRegime = {
  _mode: 'SIDEWAYS',
  _btcData: null,

  // BTC verisi çek ve sakla
  async fetchBTC(){
    try{
      const [tk, kl] = await Promise.all([
        fetch(`${FBASE}/fapi/v1/ticker/24hr?symbol=BTCUSDT`).then(r=>r.json()),
        fetch(`${FBASE}/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=50`).then(r=>r.json()),
      ]);
      const closes = kl.map(k=>+k[4]);
      const e9  = calcEMA(closes,9),  e21=calcEMA(closes,21), e50=calcEMA(closes,50);
      const bb  = calcBB(closes);
      const atr = calcATR(kl.map(k=>({h:+k[2],l:+k[3],c:+k[4]})));
      const rsi = calcRSI(closes);
      const mr  = calcMACD(closes);
      const price = closes[closes.length-1];
      this._btcData = {
        price, chg:+tk.priceChangePercent,
        e9v:e9[e9.length-1], e21v:e21[e21.length-1], e50v:e50[e50.length-1],
        bb, atr, rsi, macdHist:mr.hist,
        atrPct:(atr/price)*100,
        vol:+tk.quoteVolume,
      };
    }catch(e){}
  },

  // Modu belirle
  detect(closes, candles, atrPct){
    const rsi   = calcRSI(closes);
    const mr    = calcMACD(closes);
    const bb    = calcBB(closes);
    const price = closes[closes.length-1];
    const e9    = calcEMA(closes,9), e21=calcEMA(closes,21), e50=calcEMA(closes,50);
    const e9v   = e9[e9.length-1], e21v=e21[e21.length-1], e50v=e50[e50.length-1];

    // BBW — Bollinger Band genişliği (squeeze tespiti)
    const bbw = bb ? (bb.upper-bb.lower)/bb.mid*100 : 5;

    // Momentum
    const mom5 = closes.length>5 ? (price-closes[closes.length-6])/closes[closes.length-6]*100 : 0;

    // Hacim trendi
    const vols  = candles.slice(-10).map(c=>c.v);
    const avgV  = vols.slice(0,-3).reduce((a,b)=>a+b,0)/7;
    const lastV = vols.slice(-3).reduce((a,b)=>a+b,0)/3;
    const volRatio = lastV/avgV;

    // PANIC: RSI<25, sert düşüş, yüksek hacim
    if(rsi<25 && mom5<-5 && volRatio>1.5) return 'PANIC';
    // SQUEEZE: BBW dar, düşük volatilite
    if(bbw<2.5 && atrPct<1.5) return 'SQUEEZE';
    // VOLATILE: Yüksek ATR
    if(atrPct>5) return 'VOLATILE';
    // TREND: EMA hizalı, momentum güçlü
    if(e9v>e21v&&e21v>e50v&&Math.abs(mom5)>2&&volRatio>1.2) return 'TREND';
    if(e9v<e21v&&e21v<e50v&&Math.abs(mom5)>2&&volRatio>1.2) return 'TREND';
    // ACCUMULATE: RSI düşük, hacim artıyor ama fiyat stabil
    if(rsi<45 && volRatio>1.3 && Math.abs(mom5)<2) return 'ACCUMULATE';
    // DISTRIBUTE: RSI yüksek, hacim artıyor ama fiyat stabil
    if(rsi>60 && volRatio>1.2 && Math.abs(mom5)<2) return 'DISTRIBUTE';
    // Default
    return 'SIDEWAYS';
  },

  // UI güncelle
  update(mode){
    this._mode = mode;
    const cfg = {
      TREND      :{label:'📈 TREND',     col:'var(--green)',  dot:'#00e5a0', desc:'Trend marketi — EMA sinyalleri güçlü, trendi takip et.'},
      SIDEWAYS   :{label:'◈ SIDEWAYS',  col:'var(--yellow)', dot:'#ffc107', desc:'Yatay piyasa — RSI/Bollinger önemli, range trade dikkati.'},
      VOLATILE   :{label:'⚡ VOLATİL',  col:'var(--orange)', dot:'#ff7a00', desc:'Yüksek volatilite — pozisyon boyutunu küçük tut.'},
      SQUEEZE    :{label:'🔮 SQUEEZE',  col:'var(--purple)', dot:'#9d7dfa', desc:'Bollinger sıkışması — büyük hareket yakın olabilir, yön belirsiz.'},
      PANIC      :{label:'🔴 PANIC',    col:'var(--red)',    dot:'#ff3d6b', desc:'Panik satisi — long acmaktan kacin, stoplari sikistir.'},
      ACCUMULATE :{label:'🌊 BİRİKİM',  col:'var(--cyan)',   dot:'#00d4ff', desc:'Birikim fazı — büyük oyuncular alıyor olabilir, dikkatli long.'},
      DISTRIBUTE :{label:'📤 DAĞITIM', col:'var(--orange)', dot:'#ff7a00', desc:'Dağıtım fazı — büyük oyuncular satıyor olabilir, dikkatli short.'},
    };
    const c = cfg[mode]||cfg.SIDEWAYS;
    const badge=document.getElementById('regimeBadge');
    const desc =document.getElementById('regimeDesc');
    const dot  =document.getElementById('regimeDot');
    if(badge){badge.textContent=c.label;badge.className='regime-badge regime-'+mode;}
    if(desc) desc.textContent=c.desc;
    if(dot)  dot.style.background=c.dot;
  },

  getMode(){ return this._mode; },
  getBTC(){ return this._btcData; },

  // Moda göre skor çarpanı
  getScoreMultiplier(dir){
    const m=this._mode;
    if(m==='PANIC'&&dir==='LONG')  return 0.5;  // panic'te long skoru yarıya
    if(m==='TREND')                return 1.2;  // trend'de sinyal güçlü
    if(m==='VOLATILE')             return 0.75; // volatil'de güvensiz
    if(m==='SQUEEZE')              return 0.8;  // squeeze'de yön yok
    return 1.0;
  },
};

// ── 2. OI + FUNDING ANALİZİ ──────────────────────────────────────────
async function fetchOIFunding(sym){
  const result={oi:null,fund:null,lsRatio:null,oiChange:null};
  try{
    const [oi, fund] = await Promise.allSettled([
      fetch(`${FBASE}/fapi/v1/openInterest?symbol=${sym}`).then(r=>r.json()),
      fetch(`${FBASE}/fapi/v1/fundingRate?symbol=${sym}&limit=2`).then(r=>r.json()),
    ]);
    if(oi.status==='fulfilled')   result.oi=+oi.value.openInterest;
    if(fund.status==='fulfilled'&&Array.isArray(fund.value)&&fund.value.length)
      result.fund=+fund.value[fund.value.length-1].fundingRate*100;
  }catch(e){}
  return result;
}

function renderOIFunding(data, price){
  const {oi,fund,lsRatio,oiChange}=data;
  const fmtB=v=>v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v.toFixed(0);

  if(oi&&price){
    document.getElementById('oiVal').textContent='$'+fmtB(oi*price);
    document.getElementById('oiVal').style.color='var(--text)';
  }
  if(oiChange!==null){
    const el=document.getElementById('oiChange');
    if(el){el.textContent='OI Değişim: '+(oiChange>0?'+':'')+oiChange+'%';el.style.color=oiChange>0?'var(--green)':'var(--red)';}
  }
  if(fund!==null){
    const fEl=document.getElementById('fundVal');
    const fSub=document.getElementById('fundStatus');
    if(fEl){fEl.textContent=(fund>=0?'+':'')+fund.toFixed(4)+'%';fEl.style.color=Math.abs(fund)>0.05?'var(--red)':fund>0?'var(--green)':'var(--orange)';}
    if(fSub)fSub.textContent=Math.abs(fund)>0.1?'⚠ Aşırı funding':Math.abs(fund)>0.05?'Yüksek':'Normal';
  }
  if(lsRatio!==null){
    const lEl=document.getElementById('lsRatioVal');
    const lSub=document.getElementById('lsStatus');
    if(lEl){lEl.textContent=lsRatio.toFixed(2);lEl.style.color=lsRatio>1.5?'var(--orange)':lsRatio<0.7?'var(--purple)':'var(--text)';}
    if(lSub)lSub.textContent=lsRatio>1.5?'Long kalabalık':lsRatio<0.7?'Short kalabalık':'Dengeli';
  }

  // Badge analizi
  const badges=[];
  if(lsRatio&&fund!==null){
    if(lsRatio<0.7&&fund<0)    badges.push({text:'⚡ SHORT SQUEEZE RİSKİ',cls:'oib-squeeze-s'});
    if(lsRatio>1.5&&fund>0.05) badges.push({text:'⚡ LONG SQUEEZE RİSKİ',cls:'oib-squeeze-l'});
    if(lsRatio>1.8)            badges.push({text:'🔴 LONG KALABALIK',cls:'oib-crowded-l'});
    if(lsRatio<0.6)            badges.push({text:'🔵 SHORT KALABALIK',cls:'oib-crowded-s'});
    if(!badges.length)         badges.push({text:'✓ DENGELI POZISYON',cls:'oib-neutral'});
  }
  const row=document.getElementById('oiBadgeRow');
  if(row){
    row.innerHTML='';
    badges.forEach(b=>{
      const d=document.createElement('div');d.className='oi-badge '+b.cls;d.textContent=b.text;
      row.appendChild(d);
    });
  }
  return {fund,lsRatio,oiChange,badges};
}

// ── 3. BTC CORRELATION ENGINE ─────────────────────────────────────────
function calcBTCInfluence(btcData, coinChg, coinRsi){
  if(!btcData) return {score:50,desc:'BTC verisi bekleniyor...',color:'var(--text3)'};
  const {chg:btcChg,rsi:btcRsi,e9v,e21v,atrPct}=btcData;
  let score=50;
  let factors=[];

  // BTC yönü etkisi
  if(btcChg>3){score+=15;factors.push('BTC güçlü yükseliş');}
  else if(btcChg>1){score+=8;factors.push('BTC pozitif');}
  else if(btcChg<-3){score-=15;factors.push('BTC sert düşüş ⚠');}
  else if(btcChg<-1){score-=8;factors.push('BTC negatif');}

  // BTC EMA durumu
  if(e9v>e21v){score+=8;factors.push('BTC trend yukarı');}
  else{score-=8;factors.push('BTC trend aşağı');}

  // BTC volatilitesi
  if(atrPct>4){score-=10;factors.push('BTC volatil ⚠');}

  // RSI uyumu
  if(btcRsi>70&&coinRsi>70){score-=10;factors.push('İkisi de aşırı alım');}
  if(btcRsi<30&&coinRsi<30){score+=10;factors.push('İkisi de dipte');}

  score=Math.max(0,Math.min(100,score));
  const color=score>=65?'var(--green)':score>=40?'var(--yellow)':'var(--red)';
  const desc=score>=70?'BTC destekliyor — altcoin pozisyonları için uygun ortam.'
    :score>=50?'BTC nötr — dikkatli pozisyon boyutu önerilir.'
    :score>=35?'BTC baskı altında — altcoin longa dikkat.'
    :'BTC olumsuz — altcoin long riskli, wait veya short düşün.';

  // UI güncelle
  const valEl=document.getElementById('btcInfVal');
  const barEl=document.getElementById('btcInfBar');
  const descEl=document.getElementById('btcInfDesc');
  if(valEl){valEl.textContent=score+'/100';valEl.style.color=color;}
  if(barEl){barEl.style.width=score+'%';barEl.style.background=color;}
  if(descEl)descEl.textContent=desc+' ('+factors.slice(0,2).join(', ')+')';

  return{score,desc,color,factors};
}

// ── 4. FAKE BREAKOUT FILTER ───────────────────────────────────────────
function detectFakeBreakout(closes, candles, oiData, btcData){
  const risks=[];
  const price=closes[closes.length-1];
  const bb=calcBB(closes);
  const atr=calcATR(candles);

  // Hacimsiz kırılım
  const vols=candles.slice(-5).map(c=>c.v);
  const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/4;
  const lastV=vols[vols.length-1];
  if(bb&&(price>bb.upper||price<bb.lower)&&lastV<avgV*0.8)
    risks.push('Hacimsiz BB kırılımı');

  // Wick manipulation
  const lastC=candles[candles.length-1];
  const body=Math.abs(lastC.c-lastC.o);
  const totalRange=lastC.h-lastC.l;
  if(totalRange>0&&body/totalRange<0.25&&totalRange>atr*1.5)
    risks.push('Wick manipülasyonu şüphesi');

  // Aşırı funding
  if(oiData&&oiData.fund!==null&&Math.abs(oiData.fund)>0.1)
    risks.push('Aşırı funding oranı');

  // OI düşerken fiyat yükseliyor (fake)
  if(oiData&&oiData.oiChange!==null&&+oiData.oiChange<-1&&closes[closes.length-1]>closes[closes.length-4])
    risks.push('OI düşerken fiyat artıyor');

  // BTC ters yön
  if(btcData&&Math.abs(btcData.chg)>2){
    const coinDir=closes[closes.length-1]>closes[closes.length-4]?1:-1;
    const btcDir=btcData.chg>0?1:-1;
    if(coinDir!==btcDir) risks.push('BTC ile ters yön hareketi');
  }

  const isFake=risks.length>=2;
  const warnEl=document.getElementById('fakeWarning');
  if(warnEl){
    if(isFake){
      warnEl.classList.add('show');
      warnEl.innerHTML='⚠ <b>FAKE BREAKOUT RİSKİ</b> — '+risks.join(' · ')+'. Bu kurulumda pozisyon açmak risklidir.';
    } else {
      warnEl.classList.remove('show');
    }
  }
  return{isFake,risks};
}

// ── 5. AI TRADE DECISION ENGINE ───────────────────────────────────────
function calcAIDecision(params){
  const {
    ent, conf, rsi, macdHist, emaAlign,
    oiData, btcInfluence, fakeBreak,
    regimeMode, atrPct
  }=params;

  // Base karar
  let decision='WAIT', score=conf||50;
  if(!ent) decision='WAIT';
  else if(ent.dir==='LONG')  decision='LONG';
  else if(ent.dir==='SHORT') decision='SHORT';

  // Modifiyerler
  if(fakeBreak&&fakeBreak.isFake) score-=20;
  if(btcInfluence){
    if(decision==='LONG'&&btcInfluence.score<35) score-=15;
    if(decision==='LONG'&&btcInfluence.score>65) score+=8;
  }
  if(oiData){
    // Long squeeze riski — short'u güçlendir
    if(decision==='SHORT'&&oiData.lsRatio>1.5) score+=10;
    // Short squeeze riski — long'u güçlendir
    if(decision==='LONG'&&oiData.lsRatio<0.7)  score+=10;
    // Aşırı funding long'u zayıflatır
    if(decision==='LONG'&&oiData.fund>0.1)     score-=10;
  }
  if(regimeMode==='PANIC'&&decision==='LONG')   score-=20;
  if(regimeMode==='TREND') score+=5;
  if(atrPct>5) score-=10;
  score=Math.max(10,Math.min(95,score));

  // Kademe belirle
  let finalDec, icon, color, reasons=[];
  if(decision==='LONG'){
    if(score>=80)     {finalDec='STRONG_LONG'; icon='🚀';color='var(--green)';}
    else if(score>=65){finalDec='LONG';        icon='▲'; color='var(--green)';}
    else              {finalDec='WEAK_LONG';   icon='↗'; color='rgba(0,229,160,.7)';}
  } else if(decision==='SHORT'){
    if(score>=80)     {finalDec='STRONG_SHORT';icon='📉';color='var(--red)';}
    else if(score>=65){finalDec='SHORT';       icon='▼'; color='var(--red)';}
    else              {finalDec='WEAK_SHORT';  icon='↘'; color='rgba(255,61,107,.7)';}
  } else {
    finalDec='WAIT'; icon='⏸'; color='var(--yellow)';
  }

  // Sebep cümlesi
  if(fakeBreak&&fakeBreak.risks.length) reasons.push(fakeBreak.risks[0]);
  if(btcInfluence&&btcInfluence.score<40) reasons.push('BTC baskı altında');
  if(oiData&&oiData.lsRatio>1.5) reasons.push('Long crowded position');
  if(oiData&&oiData.fund>0.08)   reasons.push('Elevated funding risk');
  if(regimeMode==='PANIC')        reasons.push('Panic sell mode active');
  if(regimeMode==='TREND'&&ent)   reasons.push('Strong trend alignment');
  if(emaAlign==='▲▲▲'||emaAlign==='▼▼▼') reasons.push('Triple EMA alignment');
  if(score>=80) reasons.push('High probability setup');

  const label={
    STRONG_LONG:'STRONG LONG',LONG:'LONG',WEAK_LONG:'WEAK LONG',
    WAIT:'WAIT',
    WEAK_SHORT:'WEAK SHORT',SHORT:'SHORT',STRONG_SHORT:'STRONG SHORT',
  }[finalDec];

  // UI güncelle
  const card=document.getElementById('aiDecisionCard');
  const icEl=document.getElementById('aiDecIcon');
  const lbEl=document.getElementById('aiDecLabel');
  const rsEl=document.getElementById('aiDecReason');
  const sbEl=document.getElementById('aiDecSub');
  if(card) card.className='ai-decision-card '+finalDec;
  if(icEl) icEl.textContent=icon;
  if(lbEl){lbEl.textContent=label;lbEl.style.color=color;}
  if(rsEl) rsEl.textContent=reasons.length?reasons.join(' · '):'Teknik koşullar karşılandı.';
  if(sbEl) sbEl.textContent='Güven Skoru: '+score+'/100 · Market: '+regimeMode;

  return{decision:finalDec,score,reasons};
}

// ── 6. RISK ENGINE ───────────────────────────────────────────────────
function calcRiskEngine(atr, price, conf, regimeMode, atrPct){
  // Önerilen kaldıraç
  let lev=5;
  if(atrPct>4)     lev=2;
  else if(atrPct>3)lev=3;
  else if(atrPct>2)lev=5;
  else             lev=7;
  if(regimeMode==='VOLATILE'||regimeMode==='PANIC') lev=Math.min(lev,2);
  if(regimeMode==='TREND'&&conf>75) lev=Math.min(lev+2,10);

  // Risk yüzdesi
  let riskPct=1;
  if(conf>=80)       riskPct=2;
  else if(conf>=70)  riskPct=1.5;
  else if(conf>=60)  riskPct=1;
  else               riskPct=0.5;
  if(atrPct>4)       riskPct*=0.5;

  // Stop genişliği
  const stopPct=atrPct*1.5;

  // UI
  const levEl=document.getElementById('reLev');
  const riskEl=document.getElementById('reRisk');
  const stopEl=document.getElementById('reStop');
  const advEl=document.getElementById('reAdvice');
  if(levEl){levEl.textContent=lev+'x';levEl.style.color=lev<=3?'var(--red)':lev<=5?'var(--yellow)':'var(--green)';}
  if(riskEl) riskEl.textContent=riskPct+'%';
  if(stopEl) stopEl.textContent=stopPct.toFixed(1)+'%';
  const advice = conf>=75&&atrPct<3
    ? `Güçlü setup. ${lev}x kaldıraç ile portföyün %${riskPct}'ini riske at. Stop: %${stopPct.toFixed(1)}.`
    : atrPct>4
    ? `Yüksek volatilite. Maksimum ${lev}x, %${riskPct} risk. Stop geniş tutulmalı.`
    : `Orta kalite setup. ${lev}x kaldıraç uygun. Pozisyon boyutunu küçük tut.`;
  if(advEl) advEl.textContent=advice;

  return{lev,riskPct,stopPct};
}

// ── 7. TRADE MANAGEMENT AI ───────────────────────────────────────────
function renderTradeManagement(ent, price, btcData, oiData, atrPct){
  const list=document.getElementById('tmList');
  const status=document.getElementById('tmStatus');
  if(!list||!ent) return;

  const suggestions=[];
  const isLong=ent.dir==='LONG';

  // TP1 yakın mı?
  const distToTp1=isLong?(ent.tp1-price)/price*100:(price-ent.tp1)/price*100;
  const distToStop=isLong?(price-ent.stop)/price*100:(ent.stop-price)/price*100;

  if(distToTp1<0.5&&distToTp1>0)
    suggestions.push({icon:'🎯',text:'<b>TP1\'e yakın</b> — Kısmi kar al (%25-50), stop\'u giriş seviyesine çek.',badge:'tm-act',badgeText:'HAREKET ET'});

  if(btcData&&Math.abs(btcData.chg)>2){
    const btcDir=btcData.chg>0?'LONG':'SHORT';
    if(btcDir!==ent.dir)
      suggestions.push({icon:'⚠',text:'<b>BTC ters yönde</b> ('+btcData.chg.toFixed(2)+'%) — Pozisyonu küçült veya çık.',badge:'tm-warn',badgeText:'DİKKAT'});
  }

  if(atrPct>5)
    suggestions.push({icon:'🔥',text:'<b>Volatilite yüksek</b> — Pozisyon boyutunu azalt, stopları genişlet.',badge:'tm-warn',badgeText:'VOLATİL'});

  if(oiData&&oiData.fund!==null&&Math.abs(oiData.fund)>0.1)
    suggestions.push({icon:'💰',text:'<b>Aşırı funding</b> ('+oiData.fund.toFixed(3)+'%) — Tutma maliyeti yüksek, uzun süre bekleme.',badge:'tm-warn',badgeText:'FUNDING'});

  if(distToStop<0.3&&distToStop>0)
    suggestions.push({icon:'🛑',text:'<b>Stop\'a çok yakın</b> — Pozisyonu gözden geçir, risk/ödül bozulmuş olabilir.',badge:'tm-crit',badgeText:'UYARI'});

  if(!suggestions.length)
    suggestions.push({icon:'✓',text:'Pozisyon yönetimi normal — Planı takip et, stop seviyeni koru.',badge:'tm-act',badgeText:'NORMAL'});

  list.innerHTML='';
  suggestions.forEach(s=>{
    const d=document.createElement('div');d.className='tm-item';
    d.innerHTML=`<div class="tm-icon">${s.icon}</div><div class="tm-text">${s.text}</div><div class="tm-badge ${s.badge}">${s.badgeText}</div>`;
    list.appendChild(d);
  });
  if(status) status.textContent=`${ent.dir} pozisyon analizi · Giriş: $${price.toFixed?price.toFixed(4):price}`;
}

// ── 8. SQUEEZE DETECTOR ──────────────────────────────────────────────
function detectSqueeze(closes, candles){
  const bb=calcBB(closes);
  const atr=calcATR(candles);
  const price=closes[closes.length-1];
  if(!bb) return false;
  const bbw=(bb.upper-bb.lower)/bb.mid*100;
  const atrPct=(atr/price)*100;
  const isSqueeze=bbw<2.5&&atrPct<1.5;
  const el=document.getElementById('squeezeBadge');
  if(el){
    el.className='squeeze-badge '+(isSqueeze?'sq-active':'sq-inactive');
    el.textContent=isSqueeze?'🔮 SQUEEZE ALGILANDI':'◈ SQUEEZE: YOK';
  }
  return isSqueeze;
}


// Uygulama başlarken de market regime'i güncelle
setTimeout(()=>MarketRegime.fetchBTC(), 3000);


// ════════════════════════════════════════════════════════════════════
// AI LWC — Lightweight Charts Grafik Motoru
// Tam entegre: zoom/scroll ile çizgiler beraber kayar
// ════════════════════════════════════════════════════════════════════
const LWC = (() => {
  let chart=null, series=null, libs=false, last=null;
  const show={sr:true,tp:true,ms:true,pat:true};
  const lines=[];
  const marks=[];

  function loadLib(cb){
    if(window.LightweightCharts){cb();return;}
    const s=document.createElement('script');
    s.src='https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js';
    s.onload=()=>{libs=true;cb();};
    s.onerror=()=>console.warn('LWC yuklenemedi');
    document.head.appendChild(s);
  }

  function initChart(){
    const el=document.getElementById('lwcContainer');
    if(!el||!window.LightweightCharts)return false;
    el.innerHTML='';
    chart=LightweightCharts.createChart(el,{
      width:el.clientWidth, height:el.clientHeight||460,
      layout:{background:{color:'#010508'},textColor:'#6a9ec0',fontFamily:'Inter,sans-serif',fontSize:11},
      grid:{vertLines:{color:'rgba(255,255,255,.03)'},horzLines:{color:'rgba(255,255,255,.03)'}},
      crosshair:{
        vertLine:{color:'rgba(255,255,255,.18)',labelBackgroundColor:'#0a1824'},
        horzLine:{color:'rgba(255,255,255,.18)',labelBackgroundColor:'#0a1824'},
      },
      rightPriceScale:{borderColor:'rgba(255,255,255,.06)',scaleMargins:{top:.08,bottom:.12}},
      timeScale:{borderColor:'rgba(255,255,255,.06)',timeVisible:true,secondsVisible:false},
      handleScale:{mouseWheel:true,pinch:true,axisPressedMouseMove:true},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
    });
    series=chart.addCandlestickSeries({
      upColor:'#00e5a0',downColor:'#ff3d6b',
      borderUpColor:'#00e5a0',borderDownColor:'#ff3d6b',
      wickUpColor:'#00e5a0',wickDownColor:'#ff3d6b',
    });
    // Responsive
    new ResizeObserver(()=>{
      if(chart&&el)chart.applyOptions({width:el.clientWidth,height:el.clientHeight||460});
    }).observe(el);
    return true;
  }

  function clearAll(){
    lines.forEach(l=>{try{series&&series.removePriceLine(l);}catch(e){}});
    lines.length=0;
    marks.length=0;
    if(series)try{series.setMarkers([]);}catch(e){}
  }

  function addLine(price,color,dashed,width,title){
    if(!series||!price||isNaN(+price))return;
    try{
      const pl=series.createPriceLine({
        price:+price,color,lineWidth:width||1,
        lineStyle:dashed?2:0,
        axisLabelVisible:true,title:title||'',
      });
      lines.push(pl);
    }catch(e){}
  }

  function addMark(time,pos,color,shape,text){
    marks.push({time:Math.floor(+time/1000),position:pos,color,shape,text:text||''});
  }

  function detectMS(candles){
    const res=[],sl=candles.slice(-50);
    let pH=null,pL=null;
    for(let i=2;i<sl.length-1;i++){
      const c=sl[i],p=sl[i-1],pp=sl[i-2];
      if(pp.h<p.h&&p.h>c.h){
        const t=pH!==null?(p.h>pH?'HH':'LH'):'HH';
        res.push({type:t,price:p.h,time:p.t});pH=p.h;
      }
      if(pp.l>p.l&&p.l<c.l){
        const t=pL!==null?(p.l<pL?'LL':'HL'):'LL';
        res.push({type:t,price:p.l,time:p.t});pL=p.l;
      }
    }
    if(res.length>=2){
      const lm=res[res.length-1];
      const cur=sl[sl.length-1];
      const lh=res.find(r=>r.type==='LH');
      if(lm.type==='LL'&&lh&&cur.c>lh.price)res.push({type:'CHOCH',price:lm.price,time:cur.t});
      if(lm.type==='HH'&&cur.c<lm.price*0.995)res.push({type:'BOS',price:lm.price,time:cur.t});
    }
    return res.slice(-8);
  }

  function updateNotes(data){
    const el=document.getElementById('lwcNotes');
    if(!el)return;
    const notes=[];
    const{rsi,macdHist,emaAlign,entry,fakeBreakout,atrPct,patterns,conf}=data;
    if(fakeBreakout)notes.push({t:'⚠ Fake Breakout Riski',bg:'rgba(255,122,0,.15)',c:'#ff7a00',b:'rgba(255,122,0,.4)'});
    if(entry){
      const d=entry.dir;
      notes.push({
        t:(d==='LONG'?'▲ LONG':'▼ SHORT')+' · R/R 1:'+entry.rr+' · %'+conf,
        bg:d==='LONG'?'rgba(0,229,160,.1)':'rgba(255,61,107,.1)',
        c:d==='LONG'?'#00e5a0':'#ff3d6b',
        b:d==='LONG'?'rgba(0,229,160,.3)':'rgba(255,61,107,.3)',
      });
    }
    if(rsi>72)notes.push({t:'RSI Aşırı Alım ('+rsi+')',bg:'rgba(255,122,0,.1)',c:'#ff7a00',b:'rgba(255,122,0,.3)'});
    if(rsi<28)notes.push({t:'RSI Aşırı Satım ('+rsi+')',bg:'rgba(0,229,160,.1)',c:'#00e5a0',b:'rgba(0,229,160,.3)'});
    if(macdHist>0&&emaAlign&&emaAlign.includes('▲'))
      notes.push({t:'Momentum yükseliyor',bg:'rgba(0,229,160,.08)',c:'#00c070',b:'rgba(0,229,160,.2)'});
    if(macdHist<0&&emaAlign&&emaAlign.includes('▼'))
      notes.push({t:'Momentum düşüyor',bg:'rgba(255,61,107,.08)',c:'#ff6080',b:'rgba(255,61,107,.2)'});
    if(atrPct>4)notes.push({t:'Yüksek Volatilite',bg:'rgba(255,193,7,.08)',c:'#ffc107',b:'rgba(255,193,7,.25)'});
    if(patterns&&show.pat)patterns.slice(0,3).forEach(p=>
      notes.push({t:p.icon+' '+p.name,bg:'rgba(255,255,255,.05)',c:'#a0c0d8',b:'rgba(255,255,255,.12)'})
    );
    el.innerHTML=notes.length
      ?notes.map(n=>`<span class="lwc-note" style="background:${n.bg};color:${n.c};border:1px solid ${n.b}">${n.t}</span>`).join('')
      :'<span style="font-size:11px;color:var(--text3)">Analiz bekleniyor...</span>';
  }

  function redraw(data){
    if(!series)return;
    clearAll();
    const{sr,entry,candles,price,fakeBreakout}=data;

    // S/R
    if(show.sr&&sr){
      (sr.sup||[]).forEach((s,i)=>{
        const str=s.count>=3;
        addLine(s.avg,str?'#00e5a0':'rgba(0,229,160,.5)',!str,str?2:1,'S'+(i+1)+(str?' GÜÇLÜ':''));
      });
      (sr.res||[]).forEach((r,i)=>{
        const str=r.count>=3;
        addLine(r.avg,str?'#ff3d6b':'rgba(255,61,107,.5)',!str,str?2:1,'R'+(i+1)+(str?' GÜÇLÜ':''));
      });
    }

    // Entry/TP/SL
    if(show.tp&&entry){
      addLine(entry.stop,'rgba(255,61,107,.85)',true,2,'STOP LOSS');
      addLine(entry.entry,'#1565ff',false,2.5,'GİRİŞ');
      addLine(entry.tp1,'rgba(0,229,160,.9)',true,1.5,'TP 1');
      addLine(entry.tp2,'rgba(0,229,160,.75)',true,1.5,'TP 2');
      if(entry.tp3)addLine(entry.tp3,'rgba(0,212,255,.7)',true,1,'TP 3');
      // Sinyal marker
      if(candles&&candles.length){
        const lc=candles[candles.length-1];
        const il=entry.dir==='LONG';
        addMark(lc.t,il?'belowBar':'aboveBar',il?'#00e5a0':'#ff3d6b',il?'arrowUp':'arrowDown',il?'▲ LONG':'▼ SHORT');
      }
    }

    // Market Structure
    if(show.ms&&candles&&candles.length>=10){
      const msData=detectMS(candles);
      const mcol={HH:'#00e5a0',HL:'#00c070',LH:'#ff6080',LL:'#ff3d6b',BOS:'#9d7dfa',CHOCH:'#ffc107'};
      msData.forEach(m=>{
        const c=mcol[m.type]||'#aaa';
        addMark(m.time,m.type==='HH'||m.type==='HL'?'aboveBar':'belowBar',c,'circle',m.type);
        if(m.type==='BOS'||m.type==='CHOCH')addLine(m.price,c,true,1,m.type);
      });
    }

    // Marker uygula
    if(marks.length){
      const sorted=[...marks].sort((a,b)=>a.time-b.time);
      try{series.setMarkers(sorted);}catch(e){}
    }

    updateNotes(data);
  }

  function toggle(key){
    show[key]=!show[key];
    const cap=key.charAt(0).toUpperCase()+key.slice(1);
    const btn=document.getElementById('lwcBtn'+cap);
    if(btn)btn.classList.toggle('on',show[key]);
    if(last)redraw(last);
  }

  function update(candles,tk,ind,entry,sr,patterns,fakeBreakout){
    if(!candles||!candles.length||!tk)return;
    const symEl=document.getElementById('lwcSym');
    if(symEl)symEl.textContent=window.SYM||'';

    loadLib(()=>{
      if(!chart&&!initChart())return;

      // Mum verisini hazırla
      const data=candles
        .filter(c=>c.t&&c.o&&c.h&&c.l&&c.c)
        .map(c=>({time:Math.floor(+c.t/1000),open:+c.o,high:+c.h,low:+c.l,close:+c.c}))
        .sort((a,b)=>a.time-b.time)
        .reduce((acc,c)=>{  // Duplikat zamanları sil
          if(!acc.length||acc[acc.length-1].time!==c.time)acc.push(c);
          return acc;
        },[]);

      if(!data.length)return;
      try{series.setData(data);chart.timeScale().fitContent();}catch(e){console.warn('LWC setData:',e);return;}

      const price=+tk.lastPrice;
      const rsi=ind?ind.rsi:50;
      const macdHist=ind?ind.macd.hist:0;
      const e9=ind?ind.ema9:0,e21=ind?ind.ema21:0,e50=ind?ind.ema50:0;
      const emaAlign=e9>e21?(e21>e50?'▲▲▲':'▲▲'):(e21<e50?'▼▼▼':'▼▼');
      const atrPct=ind&&ind.atr?ind.atr/price*100:2;
      let conf=50;
      if(ind){
        if(e9>e21)conf+=20;else conf-=10;
        if(e21>e50)conf+=15;else conf-=5;
        if(macdHist>0)conf+=20;else conf-=10;
        if(rsi>=45&&rsi<=65)conf+=15;
        conf=Math.max(10,Math.min(100,conf));
      }

      last={candles,price,rsi,macdHist,emaAlign,atrPct,conf,entry,sr,patterns,fakeBreakout};
      redraw(last);
    });
  }

  return{update,toggle};
})();


// ════════════════════════════════════════════════════════════════════
// AI BİLDİRİM MERKEZİ (NC) + ENTRY CONFIRMATION ENGINE (ECE)
// Türkçe AI Trade Assistant — Profesyonel Futures Analizi
// ════════════════════════════════════════════════════════════════════

// ── NC: Bildirim Merkezi ──────────────────────────────────────────────
const NC = (() => {
  const KEY    = 'nc_history_v1';
  const MAX    = 200;
  let _notifs  = [];
  let _open    = false;
  let _filter  = 'all';
  let _unread  = 0;
  let _loaded  = false;

  // LocalStorage
  function _save(){
    try{ localStorage.setItem(KEY, JSON.stringify(_notifs.slice(-MAX))); }catch(e){}
  }
  function _load(){
    if(_loaded) return;
    try{
      const raw = localStorage.getItem(KEY);
      if(raw) _notifs = JSON.parse(raw);
    }catch(e){ _notifs=[]; }
    _loaded = true;
  }

  // Yeni bildirim ekle
  function add(opts){
    _load();
    const n = {
      id      : Date.now()+'_'+Math.random().toString(36).slice(2,5),
      ts      : Date.now(),
      sym     : opts.sym   || '',
      dir     : opts.dir   || 'info',  // long|short|warn|info|entry|fake
      level   : opts.level || 'medium',// critical|high|medium|low
      msg     : opts.msg   || '',
      conf    : opts.conf  || null,
      risk    : opts.risk  || null,
      regime  : opts.regime|| null,
      stage   : opts.stage || null,
      unread  : true,
    };
    _notifs.unshift(n);
    if(_notifs.length > MAX) _notifs = _notifs.slice(0, MAX);
    _unread++;
    _save();
    _renderBadge();
    _renderList();
    _showPopup(n);
    // Sesli uyarı — kritik
    if(n.level==='critical'||n.level==='high') _beepNC(n.level);
    return n.id;
  }

  // Sesli uyarı
  function _beepNC(level){
    try{
      if(!window._ncAC) window._ncAC = new(window.AudioContext||window.webkitAudioContext)();
      const freq = level==='critical' ? 880 : 660;
      const o=window._ncAC.createOscillator(), g=window._ncAC.createGain();
      o.connect(g); g.connect(window._ncAC.destination);
      o.frequency.value=freq; o.type='sine';
      g.gain.setValueAtTime(.15, window._ncAC.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, window._ncAC.currentTime+.4);
      o.start(); o.stop(window._ncAC.currentTime+.4);
    }catch(e){}
  }

  // Badge güncelle
  function _renderBadge(){
    const badge = document.getElementById('ncBadge');
    const btn   = document.getElementById('ncBtn');
    if(badge){
      if(_unread > 0){
        badge.textContent = _unread > 99 ? '99+' : _unread;
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    }
    // Kritik bildirim varsa glow
    const hasCrit = _notifs.slice(0,5).some(n=>n.level==='critical'&&n.unread);
    if(btn) btn.classList.toggle('has-critical', hasCrit);
  }

  // Popup goster
  function _showPopup(n){
    const wrap = document.getElementById('ncPopup');
    if(!wrap) return;
    const item = document.createElement('div');
    item.className = 'nc-popup-item nc-'+n.level;
    const dirEmoji = {long:'▲',short:'▼',warn:'⚠',info:'◈',entry:'🎯',fake:'🪤'}[n.dir]||'◈';
    const dirCol   = {long:'var(--green)',short:'var(--red)',warn:'var(--orange)',info:'var(--purple)',entry:'var(--cyan)',fake:'var(--yellow)'}[n.dir]||'var(--text2)';
    item.innerHTML = `
      <div class="ncp-top">
        <span style="font-weight:800;color:${dirCol}">${dirEmoji} ${n.sym||'SİSTEM'}</span>
        <button class="ncp-close" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
      <div class="ncp-msg">${n.msg}</div>
    `;
    item._created = Date.now();
    wrap.appendChild(item);
    // 6 saniye sonra otomatik kaldır
    setTimeout(()=>{ try{item.remove();}catch(e){} }, 6000);
    // Max 4 popup
    while(wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
  }

  // Liste render
  function _renderList(){
    const list = document.getElementById('ncList');
    const cnt  = document.getElementById('ncPanelCount');
    if(!list) return;
    _load();

    let filtered = _filter==='all' ? _notifs
      : _filter==='long'  ? _notifs.filter(n=>n.dir==='long')
      : _filter==='short' ? _notifs.filter(n=>n.dir==='short')
      : _filter==='warn'  ? _notifs.filter(n=>n.dir==='warn')
      : _filter==='entry' ? _notifs.filter(n=>n.dir==='entry')
      : _filter==='fake'  ? _notifs.filter(n=>n.dir==='fake')
      : _filter==='crit'  ? _notifs.filter(n=>n.level==='critical')
      : _notifs;

    if(cnt) cnt.textContent = filtered.length + ' bildirim';

    if(!filtered.length){
      list.innerHTML = '<div class="nc-empty"><span>🔔</span>Bu kategoride bildirim yok</div>';
      return;
    }

    list.innerHTML = '';
    filtered.slice(0, 50).forEach(n => {
      const d  = document.createElement('div');
      const cls = `nc-item${n.unread?' unread':''} nc-${n.level}`;
      d.className = cls;
      const ago  = _timeAgo(n.ts);
      const dirLabel = {long:'▲ LONG',short:'▼ SHORT',warn:'⚠ UYARI',info:'◈ BİLGİ',entry:'🎯 GİRİŞ',fake:'🪤 FAKE'}[n.dir]||n.dir.toUpperCase();
      const lvlLabel = {critical:'KRİTİK',high:'YÜKSEK',medium:'ORTA',low:'DÜŞÜK'}[n.level]||n.level;
      d.innerHTML = `
        <div class="nc-item-top">
          ${n.sym?`<span class="nc-sym">${n.sym.replace('USDT','')}</span>`:'<span class="nc-sym" style="color:var(--text3)">SİSTEM</span>'}
          <span class="nc-dir ${n.dir}">${dirLabel}</span>
          <span class="nc-level ${n.level}">${lvlLabel}</span>
        </div>
        <div class="nc-msg">${n.msg}</div>
        <div class="nc-meta">
          ${n.conf?`<span>Güven: %${n.conf}</span>`:''}
          ${n.risk?`<span>Risk: ${n.risk}</span>`:''}
          ${n.regime?`<span>${n.regime}</span>`:''}
          <span class="nc-time">${ago}</span>
        </div>
      `;
      d.onclick = ()=>{ n.unread=false; _save(); d.classList.remove('unread'); };
      list.appendChild(d);
    });
  }

  function _timeAgo(ts){
    const s = Math.floor((Date.now()-ts)/1000);
    if(s<60) return s+'sn önce';
    if(s<3600) return Math.floor(s/60)+'dk önce';
    if(s<86400) return Math.floor(s/3600)+'s önce';
    return Math.floor(s/86400)+'g önce';
  }

  function toggle(){
    _open = !_open;
    const p = document.getElementById('ncPanel');
    if(p) p.classList.toggle('open', _open);
    if(_open){
      // Tüm görünenleri okundu işaretle
      _notifs.forEach(n=>{ if(n.unread) n.unread=false; });
      _unread = 0;
      _save();
      _renderBadge();
      _renderList();
    }
  }

  function filter(key){
    _filter = key;
    document.querySelectorAll('.nc-filter').forEach(b=>b.classList.remove('active'));
    const el = document.getElementById('nf-'+key);
    if(el) el.classList.add('active');
    _renderList();
  }

  function clearAll(){
    if(!confirm('Tüm bildirimler silinsin mi?')) return;
    _notifs=[]; _unread=0; _save(); _renderBadge(); _renderList();
  }

  // Panel dışına tıklayınca kapat
  document.addEventListener('click', e=>{
    if(_open && !e.target.closest('#ncPanel') && !e.target.closest('#ncBtn') && !e.target.closest('#bn-notif')){
      _open=false;
      const p=document.getElementById('ncPanel');
      if(p) p.classList.remove('open');
    }
  });

  _load();
  return{add,toggle,filter,clearAll};
})();

// ════════════════════════════════════════════════════════════════════
// ENTRY CONFIRMATION ENGINE (ECE)
// Setup aşamalarını takip eder, Türkçe yorum üretir
// ════════════════════════════════════════════════════════════════════
const ECE = (() => {

  let _sym = '', _dir = '', _stages = {};

  // Stage durumları
  const STAGES = [
    {id:'s1', name:'Setup Tespit Edildi'},
    {id:'s2', name:'Kırılım Oluşuyor'},
    {id:'s3', name:'Hacim Onayı Bekleniyor'},
    {id:'s4', name:'Retest İzleniyor'},
    {id:'s5', name:'Momentum Artıyor'},
    {id:'s6', name:'Giriş Onaylandı'},
  ];

  // Stage güncelle
  function _setStage(idx, status, desc, notify){
    const s = STAGES[idx];
    if(!s) return;
    const el  = document.getElementById('ece-s'+(idx+1));
    const ico = document.getElementById('ece-i'+(idx+1));
    const dEl = document.getElementById('ece-d'+(idx+1));
    const tEl = document.getElementById('ece-t'+(idx+1));
    if(!el) return;
    el.className  = 'ece-stage '+status;
    ico.className = 'ece-stage-icon '+status;
    ico.textContent = status==='done'?'✓':status==='failed'?'✗':(idx+1);
    if(dEl&&desc) dEl.textContent = desc;
    if(tEl) tEl.textContent = new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
    if(notify && _sym){
      NC.add({
        sym:_sym, dir:_dir||'info',
        level: status==='done'&&idx===5?'high':status==='failed'?'high':'medium',
        msg:notify, stage:s.name,
      });
    }
  }

  function _resetStages(){
    for(let i=0;i<6;i++){
      const el  = document.getElementById('ece-s'+(i+1));
      const ico = document.getElementById('ece-i'+(i+1));
      if(el)  el.className='ece-stage pending';
      if(ico){ico.className='ece-stage-icon pending';ico.textContent=i+1;}
    }
  }

  // Trade Assistant mesajı
  function _setTA(msg, color){
    const el  = document.getElementById('taText');
    const dot = document.querySelector('#taStrip .ta-dot');
    if(el)  el.textContent = msg;
    if(dot) dot.style.background = color||'var(--cyan)';
  }

  // Ana yorum kutusu
  function _setComment(html){
    const el = document.getElementById('eceComment');
    if(el) el.innerHTML = html;
  }

  // ── Analiz et ve aşamaları güncelle ────────────────────────────
  function analyze(params){
    const{sym,tk,closes,candles,ind,entry,sr,fakeBreakout,oiData,btcData,regimeMode}=params;
    _sym = sym; _dir = entry?entry.dir:'';
    _resetStages();

    // Sembol etiketi
    const symEl = document.getElementById('eceSymLbl');
    if(symEl) symEl.textContent = sym;

    const price    = +tk.lastPrice;
    const rsi      = ind.rsi;
    const macdHist = ind.macd.hist;
    const e9=ind.ema9,e21=ind.ema21,e50=ind.ema50;
    const atr      = ind.atr||0;
    const atrPct   = (atr/price)*100;
    const bb       = ind.bb;

    // Hacim kontrolü
    const vols   = candles.slice(-10).map(c=>c.v);
    const avgVol = vols.slice(0,-1).reduce((a,b)=>a+b,0)/9;
    const curVol = candles[candles.length-1].v;
    const volOk  = curVol > avgVol*1.3;
    const volRatio= (curVol/avgVol).toFixed(1);

    // Momentum
    const mom3 = closes.length>4 ? (price-closes[closes.length-5])/closes[closes.length-5]*100 : 0;
    const momStr = mom3 > 0 ? '+'+mom3.toFixed(2)+'%' : mom3.toFixed(2)+'%';

    const isLong = entry && entry.dir==='LONG';
    const dir    = isLong ? 'LONG' : 'SHORT';
    const dirTr  = isLong ? 'yükseliş' : 'düşüş';

    // ── Stage 1: Setup tespiti ──
    const hasSetup = entry && (
      (isLong  && e9>e21 && macdHist>0) ||
      (!isLong && e9<e21 && macdHist<0)
    );
    if(hasSetup){
      const emaStr = isLong ? 'EMA9 > EMA21' : 'EMA9 < EMA21';
      _setStage(0,'done',
        `${emaStr} · MACD ${isLong?'pozitif':'negatif'} · RSI ${rsi}`,
        `${sym} için ${dir} setup güçleniyor. ${emaStr} hizalaması var.`
      );
    } else {
      _setStage(0,'active','Teknik koşullar henüz tam oluşmadı...');
      _setComment(`<span class="warn">Henüz net bir ${dirTr} setupı tespit edilemedi.</span> EMA hizalaması ve MACD yönü bekleniyor.`);
      _setTA('Setup bekleniyor — FOMO ile giriş önerilmez.','var(--orange)');
      return;
    }

    // ── Stage 2: Kırılım kontrolü ──
    const bbBreak = bb && (price>bb.upper||(isLong&&price>bb.mid)||(!isLong&&price<bb.mid));
    if(bbBreak){
      _setStage(1,'done',
        `Fiyat ${isLong?'Bollinger üst bandı':'Bollinger orta bandı'} ${isLong?'aştı':'kırdı'}`,
        `${sym} kırılım hareketi gösteriyor. Kapanış teyidi bekleniyor.`
      );
    } else {
      _setStage(1,'active','Kırılım henüz oluşmadı — mum kapanışı bekleniyor...');
      _setStage(2,'pending','—');
      _setComment(`Setup tespit edildi ama <span class="warn">kırılım henüz oluşmadı.</span> Mum kapanışı beklenmeli.`);
      _setTA('Mum kapanışı bekleniyor. Şu an kovalamak riskli.','var(--yellow)');
      return;
    }

    // ── Stage 3: Hacim onayı ──
    if(volOk){
      _setStage(2,'done',
        `Hacim ortalamanın ${volRatio}x üstünde — güçlü onay`,
        `${sym} hareketinde hacim onayı geldi. Hareket gerçek olabilir.`
      );
    } else {
      _setStage(2,'active',`Hacim ${volRatio}x — onay için 1.3x gerekiyor`);
      _setStage(3,'pending','—');
      _setComment(`Kırılım oluştu ama <span class="warn">hacim onayı henüz gelmedi.</span> Hacimsiz kırılım fake breakout riski taşıyor.`);
      _setTA('Hacim onayı eksik. Beklemek daha güvenli.','var(--orange)');
      NC.add({sym,dir:isLong?'warn':'warn',level:'medium',
        msg:`${sym} kırılım yaptı ama hacim onayı henüz gelmedi. Hacimsiz ${dirTr} hareketleri aldatıcı olabilir.`});
      return;
    }

    // ── Stage 4: Fake breakout filtresi ──
    if(fakeBreakout){
      _setStage(3,'failed','Fake breakout riski tespit edildi!');
      _setStage(4,'pending','—');_setStage(5,'pending','—');
      _setComment(`<span class="bad">⚠ FAKE BREAKOUT RİSKİ!</span> Hacimsiz kırılım veya BTC uyumsuzluğu tespit edildi. Bu harekete güvenilmesi risklidir.`);
      _setTA('Fake breakout riski yüksek. Pozisyon açmak tavsiye edilmez.','var(--red)');
      NC.add({sym,dir:'fake',level:'critical',
        msg:`${sym} hareketinde fake breakout riski tespit edildi. Market maker stop avı yapıyor olabilir.`});
      return;
    } else {
      _setStage(3,'done','Fake breakout filtresi geçildi — hareket gerçek görünüyor');
    }

    // ── Stage 5: Momentum ──
    const momOk = isLong ? (macdHist>0&&mom3>0.2) : (macdHist<0&&mom3<-0.2);
    if(momOk){
      _setStage(4,'done',`Momentum ${dirTr} yönünde güçleniyor · ${momStr}`);
    } else {
      _setStage(4,'active',`Momentum zayıf · ${momStr} — daha güçlü hareket bekleniyor`);
      _setStage(5,'pending','—');
      _setComment(`Setup güçlü ama <span class="warn">momentum henüz yeterli değil.</span> ${momStr} hareket ile giriş erken olabilir.`);
      _setTA('Momentum güçlenmesini bekle. Kâr potansiyeli henüz düşük.','var(--yellow)');
      return;
    }

    // ── Stage 6: Giriş onayı ──
    const conf = entry ? Math.round(entry.rr*15 + (volOk?20:0) + (momOk?20:0) + (hasSetup?25:0)) : 0;
    const confCapped = Math.min(97, conf);

    _setStage(5,'done',
      `Tüm koşullar karşılandı · Güven %${confCapped} · R/R 1:${entry?.rr||'—'}`,
      null
    );

    // Büyük giriş bildirimi
    NC.add({
      sym, dir:isLong?'entry':'entry', level:'high', conf:confCapped,
      risk: atrPct>4?'YÜKSEK':atrPct>2.5?'ORTA':'DÜŞÜK',
      regime: regimeMode||'—',
      msg: `${dir} setup tamamlandı. Giriş: $${(+tk.lastPrice).toLocaleString('en',{maximumFractionDigits:4})} · Stop: $${entry?.stop?.toFixed?entry.stop.toFixed(4):entry?.stop||'—'} · R/R 1:${entry?.rr||'—'}. ${isLong?'EMA hizalama ve hacim konfirmasyonu sağlandı.':'Ayı trendi ve hacim baskısı onaylandı.'}`
    });

    // Yorum
    const riskTr = atrPct>4?'<span class="bad">yüksek volatilite</span>':atrPct>2.5?'<span class="warn">orta volatilite</span>':'<span class="good">düşük volatilite</span>';
    _setComment(
      `<b>Giriş Onaylandı.</b> ${isLong?'Yükseliş':'Düşüş'} setupı tüm koşulları karşıladı. ` +
      `Hacim ${volRatio}x ortalamanın üstünde. Momentum ${dirTr} yönünde güçleniyor. ` +
      `Risk: ${riskTr}. ${entry?.rr>=2?`<span class="good">R/R 1:${entry.rr} — iyi bir setup.</span>`:`<span class="warn">R/R 1:${entry?.rr||'—'} — dikkatli pozisyon.</span>`}`
    );
    _setTA(`GİRİŞ HAZIR — Stop Loss: $${entry?.stop?.toFixed?entry.stop.toFixed(4):entry?.stop||'—'} · TP1: $${entry?.tp1?.toFixed?entry.tp1.toFixed(4):entry?.tp1||'—'}`, 'var(--green)');

    // Market Maker Trap kontrolü
    _checkTraps(sym, candles, closes, isLong, oiData, btcData);
  }

  // ── Market Maker Trap tespiti ────────────────────────────────
  function _checkTraps(sym, candles, closes, isLong, oiData, btcData){
    const last   = candles[candles.length-1];
    const body   = Math.abs(last.c-last.o);
    const total  = last.h-last.l;
    const wickRatio = total>0 ? body/total : 1;

    // Wick trap — büyük wick, küçük gövde
    if(wickRatio < 0.25 && total > 0){
      NC.add({sym, dir:'warn', level:'high',
        msg:`${sym} mumunda büyük wick tespit edildi. Market maker stop avı yapıyor olabilir. Ani wick hareketlerine dikkat edin.`});
    }

    // BTC uyumsuzluk
    if(btcData && Math.abs(btcData.chg) > 2){
      const btcUp = btcData.chg > 0;
      if((isLong && !btcUp) || (!isLong && btcUp)){
        NC.add({sym, dir:'warn', level:'high',
          msg:`BTC ${btcData.chg>0?'yükseliyor':'düşüyor'} ama ${sym} ters yönde hareket ediyor. BTC yönü setup ile uyumsuz hale geldi.`});
      }
    }

    // Likidite sweep ihtimali
    if(oiData && oiData.lsRatio){
      if(isLong && oiData.lsRatio < 0.7){
        NC.add({sym, dir:'warn', level:'medium',
          msg:`${sym} short kalabalık. Likidite toplama (short squeeze) ihtimali artıyor. Ani yukarı hareket beklenebilir.`});
      }
      if(!isLong && oiData.lsRatio > 1.8){
        NC.add({sym, dir:'warn', level:'medium',
          msg:`${sym} long kalabalık. Long squeeze riski yükseldi. Yüksek kaldıraç önerilmez.`});
      }
    }
  }

  return{analyze};
})();

// ════════════════════════════════════════════════════════════════════
// Scan sinyallerinden de bildirim üret
const _origScanNotif = typeof showScanSignal==='function' ? showScanSignal : null;
if(_origScanNotif){
  window.showScanSignal = function(sym, sig){
    if(_origScanNotif) _origScanNotif(sym, sig);
    const isBuy = sig.type==='buy';
    NC.add({
      sym, dir: isBuy?'long':'short',
      level: sig.conf>=85?'high':'medium',
      conf: sig.conf,
      msg: `${sym.replace('USDT','')} için ${isBuy?'LONG':'SHORT'} sinyal tespit edildi. ` +
           `Giriş: $${sig.price} · R/R 1:${sig.rr} · TP1: $${sig.tp1}. ` +
           `${isBuy?'EMA hizalama ve hacim onayı mevcut.':'Ayı baskısı ve hacim konfirmasyonu sağlandı.'}`,
    });
  };
}


// ════════════════════════════════════════════════════════════════════
// SMART MONEY CONCEPTS (SMC) + LIQUIDITY ENGINE
// Market Maker analizi, likidite tespiti, kurumsal yapı analizi
// ════════════════════════════════════════════════════════════════════
const SMC = (() => {

  // ── Yardımcı ─────────────────────────────────────────────────────
  const fmtP = (p,dec=4) => p?(+p).toLocaleString('en',{maximumFractionDigits:dec,minimumFractionDigits:dec}):'—';
  const setEl = (id,v) => { const e=document.getElementById(id); if(e)e.textContent=v; };
  const setHTML = (id,v) => { const e=document.getElementById(id); if(e)e.innerHTML=v; };

  // ── 1. Equal Highs/Lows tespiti ──────────────────────────────────
  function detectEqualLevels(candles, tol=0.002){
    const highs = [];
    const lows  = [];
    const n     = candles.length;

    // Pivot high/low bul
    for(let i=2; i<n-2; i++){
      if(candles[i].h >= candles[i-1].h && candles[i].h >= candles[i-2].h &&
         candles[i].h >= candles[i+1].h && candles[i].h >= candles[i+2].h){
        highs.push({price:candles[i].h, idx:i});
      }
      if(candles[i].l <= candles[i-1].l && candles[i].l <= candles[i-2].l &&
         candles[i].l <= candles[i+1].l && candles[i].l <= candles[i+2].l){
        lows.push({price:candles[i].l, idx:i});
      }
    }

    // Equal High/Low: birbirine %0.2 yakın pivotlar
    const equalHighs = [];
    for(let i=0; i<highs.length; i++){
      for(let j=i+1; j<highs.length; j++){
        if(Math.abs(highs[i].price-highs[j].price)/highs[i].price < tol){
          equalHighs.push({price:(highs[i].price+highs[j].price)/2, count:2});
          break;
        }
      }
    }
    const equalLows = [];
    for(let i=0; i<lows.length; i++){
      for(let j=i+1; j<lows.length; j++){
        if(Math.abs(lows[i].price-lows[j].price)/lows[i].price < tol){
          equalLows.push({price:(lows[i].price+lows[j].price)/2, count:2});
          break;
        }
      }
    }
    return{equalHighs, equalLows, allHighs:highs, allLows:lows};
  }

  // ── 2. Liquidity Sweep tespiti ────────────────────────────────────
  function detectLiquiditySweep(candles){
    const sweeps = [];
    const n = candles.length;
    for(let i=5; i<n; i++){
      const c    = candles[i];
      const prev = candles.slice(i-5, i);
      const maxH = Math.max(...prev.map(p=>p.h));
      const minL = Math.min(...prev.map(p=>p.l));
      const body = Math.abs(c.c-c.o);
      const total= c.h-c.l;
      const wickRatio = total>0 ? body/total : 1;

      // Yukarı sweep: wick yukarı gitti, geri kapandı
      if(c.h > maxH && c.c < maxH && wickRatio < 0.4 && total>0){
        sweeps.push({type:'bearish_sweep', price:c.h, idx:i, msg:'Yukarı wick ile buy-side likidite toplandı'});
      }
      // Aşağı sweep
      if(c.l < minL && c.c > minL && wickRatio < 0.4 && total>0){
        sweeps.push({type:'bullish_sweep', price:c.l, idx:i, msg:'Aşağı wick ile sell-side likidite toplandı'});
      }
    }
    return sweeps.slice(-5); // son 5
  }

  // ── 3. Order Block tespiti ────────────────────────────────────────
  function detectOrderBlocks(candles){
    const obs = [];
    const n   = candles.length;
    for(let i=2; i<n-1; i++){
      const c    = candles[i];
      const next = candles[i+1];
      const body = Math.abs(c.c-c.o);
      const avgBody = candles.slice(i-5,i).map(x=>Math.abs(x.c-x.o)).reduce((a,b)=>a+b,0)/5;

      // Bullish OB: ayı mumu + sonraki güçlü boğa mumu
      if(c.c < c.o && next.c > next.o && body > avgBody*1.5 && next.c > c.h){
        obs.push({type:'bullish', high:c.o, low:c.l, idx:i,
          desc:'Kurumsal alım bölgesi — fiyat bu bölgeyi test edebilir'});
      }
      // Bearish OB: boğa mumu + sonraki güçlü ayı mumu
      if(c.c > c.o && next.c < next.o && body > avgBody*1.5 && next.c < c.l){
        obs.push({type:'bearish', high:c.h, low:c.o, idx:i,
          desc:'Kurumsal satış bölgesi — direnç olarak çalışabilir'});
      }
    }
    return obs.slice(-4); // son 4
  }

  // ── 4. Fair Value Gap (FVG) tespiti ──────────────────────────────
  function detectFVG(candles){
    const fvgs = [];
    const n    = candles.length;
    for(let i=1; i<n-1; i++){
      const prev = candles[i-1];
      const mid  = candles[i];
      const next = candles[i+1];

      // Bullish FVG: prev.high < next.low (boşluk)
      if(prev.h < next.l && (next.l - prev.h)/prev.h > 0.001){
        fvgs.push({type:'bullish', high:next.l, low:prev.h, idx:i,
          filled: candles.slice(i+1).some(c=>c.l<=prev.h),
          pct: ((next.l-prev.h)/prev.h*100).toFixed(3)});
      }
      // Bearish FVG: prev.low > next.high
      if(prev.l > next.h && (prev.l - next.h)/prev.l > 0.001){
        fvgs.push({type:'bearish', high:prev.l, low:next.h, idx:i,
          filled: candles.slice(i+1).some(c=>c.h>=prev.l),
          pct: ((prev.l-next.h)/prev.l*100).toFixed(3)});
      }
    }
    // En yakın 4 FVG
    return fvgs.filter(f=>!f.filled).slice(-4);
  }

  // ── 5. Displacement tespiti ───────────────────────────────────────
  function detectDisplacement(candles){
    const n = candles.length;
    const results = [];
    const avgRange = candles.slice(-20).map(c=>c.h-c.l).reduce((a,b)=>a+b,0)/20;
    for(let i=n-5; i<n; i++){
      const c    = candles[i];
      const range= c.h-c.l;
      const body = Math.abs(c.c-c.o);
      const bodyRatio = range>0 ? body/range : 0;
      // Displacement: büyük gövde, ortalamanın 2x üstünde
      if(range > avgRange*2 && bodyRatio > 0.6){
        const isBull = c.c > c.o;
        results.push({type: isBull?'bullish':'bearish', range, bodyRatio, idx:i,
          msg: isBull ? 'Kurumsal alım displacement' : 'Kurumsal satış displacement'});
      }
    }
    return results;
  }

  // ── 6. Market Structure (gelişmiş) ───────────────────────────────
  function analyzeMS(candles){
    const n   = candles.length;
    const pts = [];
    let pH=null, pL=null, trend='neutral';
    for(let i=2; i<n-2; i++){
      const c=candles[i],p=candles[i-1],pp=candles[i-2],nx=candles[i+1],nx2=candles[i+2];
      if(p.h>=pp.h&&p.h>=c.h&&p.h>=nx.h){
        const type=pH!==null?(p.h>pH?'HH':'LH'):'HH';
        pts.push({type,price:p.h,idx:i-1});pH=p.h;
      }
      if(p.l<=pp.l&&p.l<=c.l&&p.l<=nx.l){
        const type=pL!==null?(p.l<pL?'LL':'HL'):'LL';
        pts.push({type,price:p.l,idx:i-1});pL=p.l;
      }
    }
    // Trend tespiti
    const recent = pts.slice(-6);
    const hhCount = recent.filter(p=>p.type==='HH'||p.type==='HL').length;
    const llCount = recent.filter(p=>p.type==='LL'||p.type==='LH').length;
    if(hhCount>llCount) trend='bullish';
    else if(llCount>hhCount) trend='bearish';

    // BOS/CHOCH
    const events = [];
    if(pts.length>=3){
      const last=pts[pts.length-1];
      const cur=candles[n-1];
      const prevHH=pts.filter(p=>p.type==='HH').slice(-2)[0];
      const prevLL=pts.filter(p=>p.type==='LL').slice(-2)[0];
      if(last.type==='LL'&&prevHH&&cur.c>prevHH.price) events.push({type:'CHOCH',price:prevHH.price,dir:'bullish'});
      if(last.type==='HH'&&prevLL&&cur.c<prevLL.price) events.push({type:'CHOCH',price:prevLL.price,dir:'bearish'});
      if(last.type==='LL'&&cur.c<last.price) events.push({type:'BOS',price:last.price,dir:'bearish'});
      if(last.type==='HH'&&cur.c>last.price) events.push({type:'BOS',price:last.price,dir:'bullish'});
    }
    return{pts:pts.slice(-8), trend, events};
  }

  // ── 7. Session Intelligence ───────────────────────────────────────
  function getSession(){
    const h = new Date().getUTCHours();
    if(h>=0&&h<7)   return{name:'Asya Seansı',   cls:'sess-asia',  emoji:'🌏', desc:'Hacim düşük, yatay hareket beklenir'};
    if(h>=7&&h<12)  return{name:'London Open',    cls:'sess-london',emoji:'🇬🇧', desc:'Yüksek volatilite, trend oluşumu'};
    if(h>=12&&h<17) return{name:'NY Overlap',     cls:'sess-ny',    emoji:'🌎', desc:'En yüksek hacim dönemi, güçlü hareketler'};
    if(h>=17&&h<21) return{name:'New York Seansı',cls:'sess-ny',    emoji:'🇺🇸', desc:'Momentum devam edebilir'};
    return{name:'Seans Dışı', cls:'sess-off', emoji:'🌙', desc:'Düşük hacim, dikkatli olun'};
  }

  // ── 8. Trade Quality Score ────────────────────────────────────────
  function calcQuality(params){
    const{closes,candles,ind,entry,sweeps,obs,fvgs,ms,displacement}=params;
    let score=0, reasons=[], warnings=[];

    // Likidite sweep sonrası reversal
    if(sweeps.length&&sweeps[sweeps.length-1].idx>=candles.length-5){
      score+=20; reasons.push('Yakın likidite sweep');
    }
    // Order block desteği
    if(obs.length) { score+=15; reasons.push('Order block tespit edildi'); }
    // FVG var
    if(fvgs.length) { score+=10; reasons.push('FVG imbalance mevcut'); }
    // Displacement
    if(displacement.length) { score+=20; reasons.push('Displacement hareketi'); }
    // Trend uyumu
    if(ms.trend==='bullish'&&entry&&entry.dir==='LONG')  { score+=20; reasons.push('MS trend uyumlu'); }
    if(ms.trend==='bearish'&&entry&&entry.dir==='SHORT') { score+=20; reasons.push('MS trend uyumlu'); }
    // BOS/CHOCH
    if(ms.events.length) { score+=10; reasons.push(ms.events[0].type+' tespit edildi'); }
    // R/R
    if(entry&&entry.rr>=2.5) { score+=10; reasons.push('Güçlü R/R'); }
    // Volume
    const vols=candles.slice(-5).map(c=>c.v);
    const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/4;
    if(vols[vols.length-1]>avgV*1.3) { score+=10; reasons.push('Hacim onayı'); }
    else warnings.push('Hacim onayı eksik');

    score=Math.min(100,score);
    const grade = score>=75?'YÜKSEK':score>=50?'ORTA':'DÜŞÜK';
    const barCls = score>=75?'qf-high':score>=50?'qf-medium':'qf-low';
    return{score, grade, barCls, reasons, warnings};
  }

  // ── Ana render fonksiyonu ─────────────────────────────────────────
  function render(params){
    const{sym,tk,closes,candles,ind,entry,regimeMode}=params;
    const price = +tk.lastPrice;
    const dec   = price>1000?2:price>1?4:6;
    const fp    = p=>(+p).toLocaleString('en',{maximumFractionDigits:dec});

    // Sembol
    setEl('smcSymLbl', sym);

    // Session
    const sess = getSession();
    const sb=document.getElementById('smcSessionBadge');
    if(sb){sb.textContent=sess.emoji+' '+sess.name;sb.className='session-badge '+sess.cls;}

    // Analizler
    const eqLevels    = detectEqualLevels(candles);
    const sweeps      = detectLiquiditySweep(candles);
    const obs         = detectOrderBlocks(candles);
    const fvgs        = detectFVG(candles);
    const displacement= detectDisplacement(candles);
    const ms          = analyzeMS(candles);

    // Quality
    const quality = calcQuality({closes,candles,ind,entry,sweeps,obs,fvgs,ms,displacement});

    // ── Likidite Kartı ────────────────────────────────────────────
    const hasBuySide  = eqLevels.equalHighs.length > 0;
    const hasSellSide = eqLevels.equalLows.length  > 0;
    const lastSweep   = sweeps[sweeps.length-1];
    const liqStatus   = lastSweep ? (lastSweep.type==='bearish_sweep'?'Buy-side toplandı':'Sell-side toplandı') : 'Aktif likidite havuzu';
    const liqCol      = lastSweep ? (lastSweep.type==='bearish_sweep'?'var(--red)':'var(--green)') : 'var(--text)';
    setEl('smcLiqVal', lastSweep ? '⚡ Sweep Algılandı' : hasBuySide||hasSellSide ? '◈ Likidite Var' : '— Nötr');
    document.getElementById('smcLiqVal').style.color = liqCol;
    setEl('smcLiqSub', sess.desc);
    const liqTags=document.getElementById('smcLiqTags');
    if(liqTags){
      liqTags.innerHTML='';
      if(hasBuySide)  liqTags.innerHTML+=`<span class="smc-tag smc-bear">Buy-side Liq.</span>`;
      if(hasSellSide) liqTags.innerHTML+=`<span class="smc-tag smc-bull">Sell-side Liq.</span>`;
      if(lastSweep)   liqTags.innerHTML+=`<span class="smc-tag smc-warn">Sweep!</span>`;
    }

    // ── Market Structure Kartı ────────────────────────────────────
    const trendTr = ms.trend==='bullish'?'Yükseliş Trendi':ms.trend==='bearish'?'Düşüş Trendi':'Nötr Yapı';
    const trendCol= ms.trend==='bullish'?'var(--green)':ms.trend==='bearish'?'var(--red)':'var(--text2)';
    setEl('smcMSVal', trendTr);
    document.getElementById('smcMSVal').style.color = trendCol;
    setEl('smcMSSub', ms.events.length ? ms.events.map(e=>e.type).join(' · ') : 'Yapı devam ediyor...');
    const msTags=document.getElementById('smcMSTags');
    if(msTags){
      msTags.innerHTML='';
      ms.pts.slice(-4).forEach(p=>{
        const c=p.type==='HH'||p.type==='HL'?'smc-bull':'smc-bear';
        msTags.innerHTML+=`<span class="smc-tag ${c}">${p.type}</span>`;
      });
      ms.events.forEach(e=>{
        const c=e.dir==='bullish'?'smc-bull':'smc-bear';
        msTags.innerHTML+=`<span class="smc-tag ${c}">${e.type}</span>`;
      });
    }

    // ── Order Block Kartı ────────────────────────────────────────
    const lastOB = obs[obs.length-1];
    setEl('smcOBVal', lastOB ? (lastOB.type==='bullish'?'▲ Bullish OB':'▼ Bearish OB') : '— Tespit Yok');
    document.getElementById('smcOBVal').style.color = lastOB ? (lastOB.type==='bullish'?'var(--green)':'var(--red)') : 'var(--text3)';
    setEl('smcOBSub', lastOB ? lastOB.desc : 'Kurumsal bölge tespit edilmedi');
    const obTags=document.getElementById('smcOBTags');
    if(obTags){
      obTags.innerHTML='';
      obs.slice(-3).forEach(ob=>{
        const c=ob.type==='bullish'?'smc-bull':'smc-bear';
        const lbl=ob.type==='bullish'?'▲ Bullish OB':'▼ Bearish OB';
        obTags.innerHTML+=`<span class="smc-tag ${c}">${lbl}</span>`;
      });
    }

    // ── Quality Score ────────────────────────────────────────────
    setEl('smcQualVal', quality.score+'/100');
    const qBar=document.getElementById('smcQualBar');
    if(qBar){qBar.style.width=quality.score+'%';qBar.className='quality-fill '+quality.barCls;}
    setEl('smcQualSub', quality.grade+' KALİTE — '+quality.reasons.slice(0,2).join(', '));

    // ── Likidite Heatmap ─────────────────────────────────────────
    const allH = eqLevels.allHighs.slice(-10).map(h=>h.price);
    const allL = eqLevels.allLows.slice(-10).map(l=>l.price);
    const buyLiq  = allH.length ? Math.max(...allH) : price;
    const sellLiq = allL.length ? Math.min(...allL) : price;
    const buyPct  = Math.min(100, Math.max(10, ((buyLiq-price)/price*100*20+50)));
    const sellPct = Math.min(100, Math.max(10, ((price-sellLiq)/price*100*20+50)));
    const eqHPct  = Math.min(100, eqLevels.equalHighs.length*30);
    const eqLPct  = Math.min(100, eqLevels.equalLows.length*30);
    const shPct   = Math.min(100, sweeps.length*25);
    const el2=document.getElementById('liqBuyBar');if(el2)el2.style.width=buyPct+'%';
    setEl('liqBuyVal', fp(buyLiq));
    const el3=document.getElementById('liqSellBar');if(el3)el3.style.width=sellPct+'%';
    setEl('liqSellVal', fp(sellLiq));
    const el4=document.getElementById('liqEHBar');if(el4)el4.style.width=eqHPct+'%';
    setEl('liqEHVal', eqLevels.equalHighs.length ? eqLevels.equalHighs.length+' bölge' : 'Yok');
    const el5=document.getElementById('liqELBar');if(el5)el5.style.width=eqLPct+'%';
    setEl('liqELVal', eqLevels.equalLows.length ? eqLevels.equalLows.length+' bölge' : 'Yok');
    const el6=document.getElementById('liqSHBar');if(el6)el6.style.width=shPct+'%';
    setEl('liqSHVal', sweeps.length ? sweeps.length+' sweep' : 'Yok');

    // ── FVG Listesi ──────────────────────────────────────────────
    const fvgList=document.getElementById('smcFVGList');
    if(fvgList){
      if(!fvgs.length){
        fvgList.innerHTML='<div style="font-size:11px;color:var(--text3);padding:4px 0">Aktif FVG tespit edilmedi</div>';
      } else {
        fvgList.innerHTML='';
        fvgs.slice(-4).forEach(f=>{
          const isBull=f.type==='bullish';
          const d=document.createElement('div');
          d.className='fvg-item '+(isBull?'fvg-bull':'fvg-bear');
          d.innerHTML=`<span class="fvg-sym">${isBull?'▲ Bullish':'▼ Bearish'}</span>
            <span class="fvg-range">$${fp(f.low)} — $${fp(f.high)} (%${f.pct})</span>
            <span class="fvg-status" style="background:${isBull?'rgba(0,229,160,.12)':'rgba(255,61,107,.1)'};color:${isBull?'var(--green)':'var(--red)'};border:1px solid ${isBull?'rgba(0,229,160,.3)':'rgba(255,61,107,.3)'}">Açık</span>`;
          fvgList.appendChild(d);
        });
      }
    }

    // ── LWC üzerine SMC katmanları ekle ─────────────────────────
    _addLWCLayers({eqLevels, obs, fvgs, ms, sweeps, price});

    // ── Ana SMC Yorumu ───────────────────────────────────────────
    const comment = _generateSMCComment({
      sym, price, ms, sweeps, obs, fvgs, displacement,
      eqLevels, entry, quality, sess, regimeMode
    });
    setHTML('smcComment', comment);

    // ── NC Bildirimleri ──────────────────────────────────────────
    _sendSMCNotifs({sym, ms, sweeps, obs, fvgs, displacement, eqLevels, entry, quality});
  }

  // ── LWC'ye SMC katmanları ekle ────────────────────────────────────
  function _addLWCLayers({eqLevels, obs, fvgs, ms, sweeps, price}){
    if(!window.LWC || !window.LWC._addLine) return;
    // Equal Highs — turuncu kesikli
    eqLevels.equalHighs.slice(-2).forEach((eh,i)=>{
      try{window.LWC._addLine(eh.price,'rgba(255,122,0,0.7)',true,1,'EQ.H '+(i+1));}catch(e){}
    });
    // Equal Lows — mor kesikli
    eqLevels.equalLows.slice(-2).forEach((el,i)=>{
      try{window.LWC._addLine(el.price,'rgba(157,125,250,0.7)',true,1,'EQ.L '+(i+1));}catch(e){}
    });
    // Order Blocks — kalın çizgi
    obs.slice(-2).forEach(ob=>{
      const col=ob.type==='bullish'?'rgba(0,229,160,0.5)':'rgba(255,61,107,0.5)';
      try{window.LWC._addLine(ob.high,col,false,1.5,(ob.type==='bullish'?'▲':'▼')+' OB');}catch(e){}
      try{window.LWC._addLine(ob.low,col,true,1,'');}catch(e){}
    });
    // FVG orta noktası
    fvgs.slice(-2).forEach(f=>{
      const mid=(f.high+f.low)/2;
      const col=f.type==='bullish'?'rgba(0,229,160,0.35)':'rgba(255,61,107,0.35)';
      try{window.LWC._addLine(mid,col,true,1,f.type==='bullish'?'▲ FVG':'▼ FVG');}catch(e){}
    });
    // BOS/CHOCH
    ms.events.forEach(ev=>{
      const col=ev.dir==='bullish'?'rgba(0,229,160,0.6)':'rgba(255,61,107,0.6)';
      try{window.LWC._addLine(ev.price,col,true,1.5,ev.type);}catch(e){}
    });
  }

  // ── SMC Türkçe Yorum ──────────────────────────────────────────────
  function _generateSMCComment(p){
    const{sym,ms,sweeps,obs,fvgs,displacement,eqLevels,entry,quality,sess,regimeMode}=p;
    const parts=[];
    const sn=sym.replace('USDT','');
    // Market Structure
    if(ms.trend==='bullish') parts.push(`<b>${sn}</b> yükseliş yapısını koruyor — Higher High ve Higher Low serisinde.`);
    else if(ms.trend==='bearish') parts.push(`<b>${sn}</b> düşüş yapısında — Lower High ve Lower Low baskısı devam ediyor.`);
    // Events
    if(ms.events.length){
      const e=ms.events[0];
      if(e.type==='CHOCH') parts.push(`<span class="${e.dir==='bullish'?'bull':'bear'}">${e.dir==='bullish'?'Yükseliş':'Düşüş'} CHoCH oluştu</span> — trend değişimi ihtimali güçleniyor.`);
      if(e.type==='BOS')   parts.push(`<span class="${e.dir==='bullish'?'bull':'bear'}">${e.dir==='bullish'?'Yükseliş':'Düşüş'} BOS</span> ile yapı teyit edildi.`);
    }
    // Sweep
    if(sweeps.length){
      const s=sweeps[sweeps.length-1];
      parts.push(`<span class="warn">Likidite sweep algılandı:</span> ${s.msg}. Market maker stop avı yapıyor olabilir.`);
    }
    // Order Block
    if(obs.length){
      const ob=obs[obs.length-1];
      parts.push(`${ob.type==='bullish'?'<span class="bull">Kurumsal alım bölgesi</span>':'<span class="bear">Kurumsal satış bölgesi</span>'} yakınında fiyat hareketi gözlemleniyor.`);
    }
    // FVG
    if(fvgs.length) parts.push(`${fvgs.length} adet açık Fair Value Gap imbalance tespit edildi — fiyat bu bölgelere çekilebilir.`);
    // Displacement
    if(displacement.length) parts.push(`<span class="${displacement[0].type==='bullish'?'bull':'bear'}">Displacement hareketi</span> algılandı — kurumsal giriş işareti olabilir.`);
    // Equal Levels
    if(eqLevels.equalHighs.length) parts.push(`Üst bölgede <span class="warn">Equal Highs</span> var — buy-side likidite hedef alınabilir.`);
    if(eqLevels.equalLows.length)  parts.push(`Alt bölgede <span class="warn">Equal Lows</span> var — sell-side likidite sweep riski mevcut.`);
    // Quality
    if(quality.score>=75) parts.push(`<span class="bull">Setup kalitesi yüksek (%${quality.score}/100)</span> — ${quality.reasons.slice(0,2).join(', ')}.`);
    else if(quality.score<40) parts.push(`<span class="warn">Setup kalitesi düşük (%${quality.score}/100)</span> — giriş için daha fazla teyit beklenmeli.`);
    // Session
    parts.push(`<span class="info">${sess.emoji} ${sess.name}:</span> ${sess.desc}.`);
    return parts.join(' ') || 'Smart Money analizi tamamlandı.';
  }

  // ── NC Bildirimleri gönder ────────────────────────────────────────
  function _sendSMCNotifs({sym,ms,sweeps,obs,fvgs,displacement,eqLevels,entry,quality}){
    if(!window.NC) return;
    const sn=sym.replace('USDT','');
    // Sweep bildirimi
    if(sweeps.length){
      const s=sweeps[sweeps.length-1];
      NC.add({sym,dir:'fake',level:'high',
        msg:`${sn}: ${s.msg}. Market maker stop avı yapıyor olabilir. Sahte kırılımlara dikkat edin.`});
    }
    // CHoCH bildirimi
    const choch=ms.events.find(e=>e.type==='CHOCH');
    if(choch){
      NC.add({sym,dir:choch.dir==='bullish'?'long':'short',level:'high',
        msg:`${sn} CHoCH oluştu — ${choch.dir==='bullish'?'yükseliş':'düşüş'} trend değişimi ihtimali güçleniyor.`});
    }
    // Equal Highs uyarısı
    if(eqLevels.equalHighs.length>=1){
      NC.add({sym,dir:'warn',level:'medium',
        msg:`${sn} üst bölgesinde Equal Highs tespit edildi. Buy-side likidite hedef alınabilir — trap riski var.`});
    }
    // Düşük kalite uyarısı
    if(quality.score<35&&entry){
      NC.add({sym,dir:'warn',level:'high',
        msg:`${sn} setup kalitesi düşük (%${quality.score}/100). Likidite ve kurumsal yapı desteği yetersiz — giriş için bekle.`});
    }
    // Displacement
    if(displacement.length){
      const d=displacement[0];
      NC.add({sym,dir:d.type==='bullish'?'long':'short',level:'medium',
        msg:`${sn} displacement hareketi algılandı. ${d.type==='bullish'?'Kurumsal alım':'Kurumsal satış'} baskısı görünüyor.`});
    }
  }

  // ── Public interface ──────────────────────────────────────────────
  return{render, detectEqualLevels, detectLiquiditySweep, detectOrderBlocks, detectFVG, detectDisplacement, analyzeMS, getSession};
})();


// ════════════════════════════════════════════════════════════════════
// PROFESSIONAL SIGNAL CARD ENGINE (SCE)
// Adaptif sinyal kalitesi, trade modu, rarity sistemi
// ════════════════════════════════════════════════════════════════════
const SCE = (() => {

  // ── Trade Modları ─────────────────────────────────────────────────
  const MODES = {
    SAFE:       {min:75, label:'SAFE',       tip:'Güvenli giriş — yüksek konfirmasyon gerekir', minRarity:2},
    BALANCED:   {min:60, label:'BALANCED',   tip:'Dengeli yaklaşım — iyi fırsat/risk oranı',    minRarity:1},
    AGGRESSIVE: {min:45, label:'AGGRESSIVE', tip:'Agresif giriş — yüksek risk, yüksek potansiyel', minRarity:0},
    SCALP:      {min:55, label:'SCALP',      tip:'Hızlı scalp — düşük hedef, sıkı stop',       minRarity:1},
    SNIPER:     {min:82, label:'SNIPER',     tip:'Sadece A+ setup — çok nadir, yüksek kalite',  minRarity:4},
  };

  // ── Rarity Seviyeleri ─────────────────────────────────────────────
  const RARITIES = [
    {id:0, label:'WATCHLIST',         cls:'sc-watchlist',   badge:'rgba(255,255,255,.08)',   badgeTxt:'#888',   minScore:30},
    {id:1, label:'EARLY SETUP',       cls:'sc-early',       badge:'rgba(0,212,255,.12)',     badgeTxt:'#00d4ff',minScore:45},
    {id:2, label:'CONFIRMATION',      cls:'sc-confirmation',badge:'rgba(255,193,7,.12)',     badgeTxt:'#ffc107',minScore:58},
    {id:3, label:'ENTRY READY',       cls:'sc-entry-ready', badge:'rgba(0,229,160,.15)',     badgeTxt:'#00e5a0',minScore:68},
    {id:4, label:'HIGH PROBABILITY',  cls:'sc-high-prob',   badge:'rgba(0,229,160,.2)',      badgeTxt:'#00e5a0',minScore:80},
    {id:5, label:'A+ SETUP',          cls:'sc-aplus',       badge:'rgba(157,125,250,.2)',    badgeTxt:'#b39dfa',minScore:92},
  ];

  let _mode = 'SAFE';
  let _cards = new Map(); // sym -> card
  let _lastRender = 0;

  // ── Mod ayarla ────────────────────────────────────────────────────
  function setMode(mode){
    _mode = mode;
    document.querySelectorAll('.tm-btn').forEach(b=>b.classList.remove('active'));
    const btn = document.getElementById('tm-'+mode.toLowerCase());
    if(btn) btn.classList.add('active');
    const cfg = MODES[mode];
    const tipEl = document.getElementById('scModeTip');
    if(tipEl) tipEl.textContent = cfg.tip;
    _renderAll();
  }

  // ── Ana skor hesapla ──────────────────────────────────────────────
  function calcSignalScore(params){
    const{closes,candles,ind,entry,sr,fakeBreakout,smcData,regimeMode,btcData}=params;
    let score = 0;
    const factors = [];
    const warnings = [];
    const isLong = entry && entry.dir==='LONG';

    // ── Teknik hizalama ──
    if(ind){
      const e9=ind.ema9,e21=ind.ema21,e50=ind.ema50;
      const mr=ind.macd;
      // EMA tam hizalama
      if(isLong&&e9>e21&&e21>e50)  {score+=18;factors.push('EMA tam hizalama');}
      else if(isLong&&e9>e21)       {score+=10;factors.push('EMA kısmi hizalama');}
      if(!isLong&&e9<e21&&e21<e50) {score+=18;factors.push('EMA tam hizalama');}
      else if(!isLong&&e9<e21)      {score+=10;factors.push('EMA kısmi hizalama');}
      // MACD
      if(isLong&&mr&&mr.hist>0)    {score+=12;factors.push('MACD pozitif');}
      if(!isLong&&mr&&mr.hist<0)   {score+=12;factors.push('MACD negatif');}
      // RSI
      const rsi=ind.rsi;
      if(isLong&&rsi>=42&&rsi<=65) {score+=10;factors.push('RSI ideal bölge');}
      if(!isLong&&rsi>=35&&rsi<=58){score+=10;factors.push('RSI ideal bölge');}
      if(isLong&&rsi>72)           {score-=8; warnings.push('RSI aşırı alım');}
      if(!isLong&&rsi<28)          {score-=8; warnings.push('RSI aşırı satım');}
    }

    // ── Hacim ──
    const vols=candles.slice(-8).map(c=>c.v);
    const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/7;
    const curV=candles[candles.length-1].v;
    const volRatio=curV/avgV;
    if(volRatio>2)      {score+=15;factors.push('Güçlü hacim ('+volRatio.toFixed(1)+'x)');}
    else if(volRatio>1.3){score+=8; factors.push('Hacim onayı');}
    else                 {warnings.push('Hacim yetersiz');}

    // ── R/R ──
    if(entry){
      if(entry.rr>=3)    {score+=12;factors.push('Mükemmel R/R (1:'+entry.rr+')');}
      else if(entry.rr>=2){score+=8; factors.push('İyi R/R (1:'+entry.rr+')');}
      else if(entry.rr>=1.5){score+=4;}
      else                {score-=5; warnings.push('Zayıf R/R');}
    }

    // ── Fake Breakout ──
    if(fakeBreakout)    {score-=20;warnings.push('Fake breakout riski');}

    // ── SMC ──
    if(smcData){
      if(smcData.quality>=70) {score+=12;factors.push('Yüksek SMC kalitesi');}
      else if(smcData.quality>=50){score+=6;}
      if(smcData.sweeps)      {score+=8; factors.push('Likidite sweep');}
      if(smcData.ob)          {score+=8; factors.push('Order block desteği');}
      if(smcData.fvg)         {score+=5; factors.push('FVG mevcut');}
      if(smcData.displacement){score+=10;factors.push('Displacement hareketi');}
      // Market structure
      if(smcData.msTrend==='bullish'&&isLong)  {score+=10;factors.push('MS trend uyumlu');}
      if(smcData.msTrend==='bearish'&&!isLong) {score+=10;factors.push('MS trend uyumlu');}
      if(smcData.choch)  {score+=8; factors.push('CHoCH oluştu');}
      if(smcData.bos)    {score+=5; factors.push('BOS teyit');}
      if(smcData.eqHighs&&isLong) {warnings.push('Equal highs — trap riski');}
      if(smcData.eqLows&&!isLong) {warnings.push('Equal lows — trap riski');}
    }

    // ── BTC Alignment ──
    let btcAlign = 50;
    if(btcData){
      if(isLong&&btcData.chg>1)   {score+=8; factors.push('BTC destekliyor'); btcAlign=75;}
      if(isLong&&btcData.chg<-2)  {score-=10;warnings.push('BTC baskı altında'); btcAlign=25;}
      if(!isLong&&btcData.chg<-1) {score+=8; factors.push('BTC düşüş uyumlu'); btcAlign=75;}
      if(!isLong&&btcData.chg>2)  {score-=10;warnings.push('BTC yükseliş — short riskli'); btcAlign=25;}
    }

    // ── Market Regime ──
    if(regimeMode==='PANIC'&&isLong)   {score-=15;warnings.push('Panik modu — long riskli');}
    if(regimeMode==='TREND')           {score+=8; factors.push('Trend marketi');}
    if(regimeMode==='VOLATILE')        {score-=8; warnings.push('Volatil market');}
    if(regimeMode==='SQUEEZE')         {score+=5; factors.push('Squeeze — patlama yakın');}

    score = Math.max(0, Math.min(100, Math.round(score)));

    // Rarity belirle
    const rarity = [...RARITIES].reverse().find(r=>score>=r.minScore) || RARITIES[0];

    // Timing tavsiyesi
    let timing = 'Mum kapanışı bekleniyor.';
    if(score>=80)        timing = 'Giriş bölgesi oluştu. Teyit için son mumu izle.';
    else if(score>=65)   timing = 'Şartlar güçleniyor. Retest veya kapanış onayı bekleniyor.';
    else if(score>=50)   timing = 'Erken aşama. Hacim ve momentum artışı bekleniyor.';
    else if(volRatio<1.3)timing = 'Hacim onayı eksik. Beklemek daha güvenli.';
    else if(fakeBreakout)timing = 'Fake breakout riski var. Bu harekete güvenilmesi riskli.';

    // Agresif mod için timing güncellemesi
    if(_mode==='AGGRESSIVE'&&score>=45) timing = 'Agresif giriş mümkün — stop sıkı tutulmalı.';
    if(_mode==='SCALP')                 timing = 'Scalp fırsatı — hızlı giriş, küçük hedef.';
    if(_mode==='SNIPER'&&score<90)      timing = 'Sniper modu — setup henüz A+ değil. Bekle.';

    return{score, rarity, factors, warnings, timing, btcAlign, volRatio};
  }

  // ── AI Türkçe Yorum üret ──────────────────────────────────────────
  function generateComment(params, result){
    const{sym,ind,entry,fakeBreakout,smcData,btcData,regimeMode}=params;
    const{score,rarity,factors,warnings}=result;
    const sn = sym.replace('USDT','');
    const isLong = entry && entry.dir==='LONG';
    const parts = [];

    // Temel yorum
    if(score>=80){
      parts.push(isLong
        ? `<b>${sn}</b> güçlü bir yükseliş setupı oluşturdu.`
        : `<b>${sn}</b> güçlü bir düşüş setupı oluşturdu.`);
    } else if(score>=60){
      parts.push(`<b>${sn}</b> için ${isLong?'yükseliş':'düşüş'} şartları güçleniyor.`);
    } else {
      parts.push(`<b>${sn}</b> henüz erken aşamada — teyit bekleniyor.`);
    }

    // SMC yorumları
    if(smcData){
      if(smcData.sweeps) parts.push('Likidite süpürmesi sonrası fiyat tepki verdi.');
      if(smcData.ob)     parts.push(isLong ? 'Kurumsal alım bölgesi destek oluşturuyor.' : 'Kurumsal satış bölgesinde baskı var.');
      if(smcData.choch)  parts.push(`CHoCH oluştu — trend değişimi ihtimali ${isLong?'güçlendi':'zayıfladı'}.`);
      if(smcData.eqHighs&&isLong) parts.push('Üstte equal highs var — likidite tuzağına dikkat.');
    }

    // BTC yorumu
    if(btcData){
      if(btcData.chg>2&&isLong)    parts.push('BTC güçlü yükseliş desteği sağlıyor.');
      if(btcData.chg<-2&&isLong)   parts.push('BTC baskı altında — altcoin long için dikkatli olun.');
      if(btcData.chg<-2&&!isLong)  parts.push('BTC zayıflığı düşüş baskısını destekliyor.');
    }

    // Regime yorumu
    if(regimeMode==='TREND')    parts.push('Trend marketi — momentum sinyalleri daha güvenilir.');
    if(regimeMode==='VOLATILE') parts.push('Volatil market — pozisyon boyutunu küçük tut.');
    if(regimeMode==='SQUEEZE')  parts.push('Bollinger sıkışması var — büyük hareket yakın olabilir.');
    if(regimeMode==='PANIC')    parts.push('Panik modu aktif — agresif long açmak riskli.');

    // Fake breakout uyarısı
    if(fakeBreakout) parts.push('Fake breakout riski tespit edildi — bu harekete güvenilmesi önerilmez.');

    // R/R yorumu
    if(entry&&entry.rr>=2.5) parts.push(`R/R 1:${entry.rr} ile güçlü bir risk/ödül oranı mevcut.`);
    if(entry&&entry.rr<1.5)  parts.push('R/R oranı zayıf — pozisyon büyüklüğüne dikkat et.');

    // Uyarılar
    if(warnings.length) parts.push(`Dikkat: ${warnings.slice(0,2).join(', ')}.`);

    return parts.slice(0,4).join(' ');
  }

  // ── Kart render ───────────────────────────────────────────────────
  // ── Onay sistemi (9 koşul) ──────────────────────────────────────
  function _calcConfirmations(params, result){
    const{closes,candles,ind,entry,smcData,btcData,fakeBreakout}=params;
    const{score,volRatio,btcAlign}=result;
    const isLong=entry&&entry.dir==='LONG';

    const checks=[
      {id:'ema',   lbl:'EMA Hizalama', ok: ind&&(isLong?(ind.ema9>ind.ema21):(ind.ema9<ind.ema21))},
      {id:'macd',  lbl:'MACD',         ok: ind&&(isLong?ind.macd.hist>0:ind.macd.hist<0)},
      {id:'rsi',   lbl:'RSI',          ok: ind&&(isLong?(ind.rsi>=42&&ind.rsi<=68):(ind.rsi>=32&&ind.rsi<=58))},
      {id:'vol',   lbl:'Hacim',        ok: volRatio>=1.3},
      {id:'btc',   lbl:'BTC Uyum',     ok: btcAlign>=50},
      {id:'rr',    lbl:'R/R',          ok: entry&&entry.rr>=2},
      {id:'smc',   lbl:'SMC',          ok: smcData&&(smcData.ob||smcData.sweeps||smcData.choch)},
      {id:'fake',  lbl:'Fake Yok',     ok: !fakeBreakout},
      {id:'regime',lbl:'Regime',       ok: !!params.regimeMode&&params.regimeMode!=='PANIC'},
    ];

    const confirmed=checks.filter(c=>c.ok).length;
    const total=checks.length;

    // Grade
    let grade,gradeLabel,gradeBg,gradeCol,priorityLabel,priorityBg,priorityCol;
    if(confirmed>=9)     {grade='S';gradeLabel='⭐⭐⭐';gradeBg='rgba(157,125,250,.2)';gradeCol='#b39dfa';priorityLabel='ELITE SETUP';priorityBg='rgba(157,125,250,.2)';priorityCol='#b39dfa';}
    else if(confirmed>=7){grade='A';gradeLabel='⭐⭐';gradeBg='rgba(0,229,160,.15)';gradeCol='var(--green)';priorityLabel='STRONG SETUP';priorityBg='rgba(0,229,160,.12)';priorityCol='var(--green)';}
    else if(confirmed>=5){grade='B';gradeLabel='⭐';gradeBg='rgba(255,193,7,.12)';gradeCol='var(--yellow)';priorityLabel='CONFIRMED SETUP';priorityBg='rgba(255,193,7,.1)';priorityCol='var(--yellow)';}
    else if(confirmed>=4){grade='C';gradeLabel='⚡';gradeBg='rgba(255,122,0,.12)';gradeCol='var(--orange)';priorityLabel='AGGRESSIVE ENTRY';priorityBg='rgba(255,122,0,.1)';priorityCol='var(--orange)';}
    else                 {grade='D';gradeLabel='○';gradeBg='rgba(255,255,255,.08)';gradeCol='var(--text3)';priorityLabel='WEAK SETUP';priorityBg='rgba(255,255,255,.06)';priorityCol='var(--text3)';}

    // Missing
    const missing=checks.filter(c=>!c.ok).map(c=>c.lbl);

    // AI reasoning özet
    let aiLine='';
    if(confirmed>=9)      aiLine='Tüm 9 onay tamamlandı. Kurumsal kalite setup.';
    else if(confirmed>=7) aiLine=`${confirmed}/9 onay. Güçlü setup — giriş değerlendirilebilir.`;
    else if(confirmed>=5) aiLine=`${confirmed}/9 onay. Erken momentum. ${missing.slice(0,2).join(', ')} bekleniyor.`;
    else if(confirmed>=4) aiLine=`${confirmed}/9 onay. Agresif setup. Yüksek risk — stop sıkı tut.`;
    else                  aiLine=`${confirmed}/9 onay. Zayıf setup — ${missing.slice(0,3).join(', ')} eksik.`;

    return{checks,confirmed,total,grade,gradeLabel,gradeBg,gradeCol,priorityLabel,priorityBg,priorityCol,missing,aiLine};
  }

  // ── Yeni _renderCard ────────────────────────────────────────────
  function _renderCard(params, result, tk){
    const{sym,entry,ind,regimeMode,btcData}=params;
    const{score,rarity,factors,warnings,timing,btcAlign,volRatio}=result;
    if(!entry) return null;

    const isLong = entry.dir==='LONG';
    const price  = +tk.lastPrice;
    const dec    = price>1000?2:price>1?4:6;
    const fp     = p=>(+p).toLocaleString('en',{maximumFractionDigits:dec});

    // 9 onay hesapla
    const conf9 = _calcConfirmations(params, result);

    // Risk
    const atrPct = ind&&ind.atr ? (ind.atr/price*100) : 2;
    const riskLbl= atrPct>4?'YÜKSEK':atrPct>2.5?'ORTA':'DÜŞÜK';
    const riskCol= atrPct>4?'var(--red)':atrPct>2.5?'var(--orange)':'var(--green)';
    const dirCol = isLong?'var(--green)':'var(--red)';
    const cardBg = isLong?'rgba(0,229,160,.03)':'rgba(255,61,107,.03)';

    // Elite kart sınıfı
    const isElite = conf9.confirmed>=7;
    const cardCls = isElite
      ? `signal-card sc-elite${!isLong?' short-card':''}`
      : `signal-card ${rarity.cls}${!isLong?' short-card':''}`;

    const aggrLabel=_mode==='SAFE'?'Konservatif':_mode==='AGGRESSIVE'?'Agresif':_mode==='SCALP'?'Scalp':_mode==='SNIPER'?'Sniper':'Dengeli';

    const comment=generateComment(params,result);

    const d=document.createElement('div');
    d.className=cardCls;
    d.style.position='relative';

    d.innerHTML=`
      <!-- Rank ribbon -->
      ${conf9.confirmed>=9?`<div class="sc-ribbon" style="border-color:transparent #b39dfa transparent transparent"></div><div class="sc-ribbon-txt">S</div>`
        :conf9.confirmed>=7?`<div class="sc-ribbon" style="border-color:transparent rgba(0,229,160,.8) transparent transparent"></div><div class="sc-ribbon-txt">A</div>`:''}

      <!-- Priority Badge -->
      <div class="sc-priority-badge" style="background:${conf9.priorityBg};color:${conf9.priorityCol};border:1px solid ${conf9.priorityCol}44">
        ${conf9.gradeLabel} ${conf9.priorityLabel}
      </div>

      <!-- Top: Sym + Dir -->
      <div class="sc-top" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <!-- Grade -->
          <div class="sc-grade" style="background:${conf9.gradeBg};color:${conf9.gradeCol}">${conf9.grade}</div>
          <div>
            <div class="sc-sym" style="color:${dirCol}">${sym.replace('USDT','')}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${aggrLabel} · ${MODES[_mode].label}</div>
          </div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div class="sc-dir-badge sc-dir-${isLong?'long':'short'}" style="margin-bottom:4px">${isLong?'▲ LONG':'▼ SHORT'}</div>
          <div style="font-size:9px;color:var(--text3)">${new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      </div>

      <!-- Confirmation Progress -->
      <div class="sc-conf-bar">
        <div class="sc-conf-dots">
          ${Array.from({length:conf9.total},(_,i)=>{
            const filled=i<conf9.confirmed;
                        const realCls=filled?(conf9.confirmed>=7?'filled':conf9.confirmed>=5?'filled warn':'filled weak'):'empty';
            return `<div class="sc-conf-dot ${realCls}"></div>`;
          }).join('')}
        </div>
        <span class="sc-conf-label">${conf9.confirmed}/${conf9.total}</span>
      </div>

      <!-- AI Reasoning Line -->
      <div style="font-size:11px;font-weight:600;color:${conf9.priorityCol};margin-bottom:10px;padding:7px 10px;background:${conf9.priorityBg};border-radius:7px;border-left:3px solid ${conf9.priorityCol}">
        ${conf9.aiLine}
      </div>

      <!-- 9 Onay Grid -->
      <div class="sc-conf-grid">
        ${conf9.checks.map(c=>`
          <div class="sc-conf-item ${c.ok?'ok':'pend'}">
            <span>${c.ok?'✓':'○'}</span>
            <span>${c.lbl}</span>
          </div>
        `).join('')}
      </div>

      <!-- Stats -->
      <div class="sc-stats">
        <div class="sc-stat">
          <div class="sc-stat-lbl">Setup Skoru</div>
          <div class="sc-stat-val" style="color:${score>=75?'var(--green)':score>=50?'var(--yellow)':'var(--red)'}">${score}/100</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-lbl">Güven</div>
          <div class="sc-stat-val" style="color:${dirCol}">${Math.round(score*.95)}%</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-lbl">Risk</div>
          <div class="sc-stat-val" style="color:${riskCol}">${riskLbl}</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-lbl">R/R</div>
          <div class="sc-stat-val" style="color:var(--yellow)">1:${entry.rr}</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-lbl">BTC Uyum</div>
          <div class="sc-stat-val" style="color:${btcAlign>=60?'var(--green)':btcAlign>=40?'var(--yellow)':'var(--red)'}">${btcAlign}/100</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-lbl">Hacim</div>
          <div class="sc-stat-val" style="color:${volRatio>=1.5?'var(--green)':volRatio>=1?'var(--yellow)':'var(--red)'}">${volRatio.toFixed(1)}x</div>
        </div>
      </div>

      <!-- Fiyat seviyeleri -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px">
        <div class="sc-stat"><div class="sc-stat-lbl">Giriş</div><div class="sc-stat-val" style="color:#6ab0ff;font-size:11px">$${fp(entry.entry)}</div></div>
        <div class="sc-stat"><div class="sc-stat-lbl">Stop</div><div class="sc-stat-val" style="color:var(--red);font-size:11px">$${fp(entry.stop)}</div></div>
        <div class="sc-stat"><div class="sc-stat-lbl">TP1</div><div class="sc-stat-val" style="color:var(--green);font-size:11px">$${fp(entry.tp1)}</div></div>
        <div class="sc-stat"><div class="sc-stat-lbl">TP2</div><div class="sc-stat-val" style="color:var(--green);font-size:11px">$${fp(entry.tp2)}</div></div>
      </div>

      <!-- Missing confirmations -->
      ${conf9.missing.length?`
        <div class="sc-missing">
          <div class="sc-missing-lbl">⏳ EKSİK ONAYLAR</div>
          ${conf9.missing.join(' · ')}
        </div>
      `:''}

      <!-- Timing -->
      <div class="sc-timing">
        <div class="sc-timing-lbl">⏱ GİRİŞ ZAMANLAMA</div>
        <div class="sc-timing-val">${timing}</div>
      </div>

      <!-- AI Yorum -->
      <div class="sc-ai-comment" style="background:${cardBg};border:1px solid ${dirCol}18">
        ${comment}
      </div>

      <!-- Tags -->
      <div class="sc-tags">
        ${factors.slice(0,4).map(f=>`<span class="sc-tag-item" style="background:rgba(0,229,160,.08);color:var(--green);border:1px solid rgba(0,229,160,.2)">✓ ${f}</span>`).join('')}
        ${warnings.slice(0,2).map(w=>`<span class="sc-tag-item" style="background:rgba(255,122,0,.08);color:var(--orange);border:1px solid rgba(255,122,0,.2)">⚠ ${w}</span>`).join('')}
        <span class="sc-tag-item" style="background:rgba(255,255,255,.05);color:var(--text3);border:1px solid rgba(255,255,255,.1)">${regimeMode||'—'}</span>
      </div>

      <!-- Aksiyon -->
      <button class="sc-action" style="background:${dirCol}15;color:${dirCol};border:1px solid ${dirCol}40">
        Grafikte Aç & Analiz Et →
      </button>
    `;

    d.querySelector('.sc-action').onclick=()=>{
      window.SYM=sym;
      const inp=document.getElementById('symInput');
      if(inp) inp.value=sym;
      if(typeof loadCoin==='function') loadCoin(sym,window.INTV||'15m');
      setTimeout(()=>{const el=document.getElementById('mainPanel');if(el)el.scrollIntoView({behavior:'smooth'});},300);
    };

    return d;
  }

  // ── Sort sistemi ────────────────────────────────────────────────
  let _sortMode='score';
  function setSort(mode){
    _sortMode=mode;
    document.querySelectorAll('.sc-sort-btn').forEach(b=>b.classList.remove('active'));
    const btn=document.getElementById('sort-'+mode);
    if(btn) btn.classList.add('active');
    _renderAll();
  }

  // ── Kart güncelle ────────────────────────────────────────────────
  function updateCard(sym, params, tk){
    const result = calcSignalScore(params);
    const cfg    = MODES[_mode];
    if(result.score < cfg.min){
      _cards.delete(sym);
    } else if(result.rarity.id >= cfg.minRarity){
      _cards.set(sym, {params, result, tk, ts:Date.now(), sym});
    }
    _renderAll();
  }

  // ── Tüm kartları render ───────────────────────────────────────────
  function _renderAll(){
    const container = document.getElementById('scContainer');
    const countEl   = document.getElementById('scCount');
    if(!container) return;

    // 10 dakikadan eski kartları temizle
    for(const[sym,c] of _cards){
      if(Date.now()-c.ts > 600000) _cards.delete(sym);
    }

    // Sort modu
    let sorted = [..._cards.entries()];
    if(_sortMode==='score')       sorted.sort((a,b)=>b[1].result.score-a[1].result.score);
    else if(_sortMode==='conf')   sorted.sort((a,b)=>(b[1].result.rarity.id)-(a[1].result.rarity.id));
    else if(_sortMode==='rr')     sorted.sort((a,b)=>(b[1].params.entry?.rr||0)-(a[1].params.entry?.rr||0));
    else if(_sortMode==='newest') sorted.sort((a,b)=>b[1].ts-a[1].ts);
    else if(_sortMode==='long')   sorted=sorted.filter(([,c])=>c.params.entry?.dir==='LONG').sort((a,b)=>b[1].result.score-a[1].result.score);
    else if(_sortMode==='short')  sorted=sorted.filter(([,c])=>c.params.entry?.dir==='SHORT').sort((a,b)=>b[1].result.score-a[1].result.score);

    if(countEl) countEl.textContent = sorted.length+' aktif kart';

    if(!sorted.length){
      container.innerHTML = `<div class="sc-empty"><span class="sc-empty-icon">🎯</span>Şu an gösterilecek güçlü setup yok.<br><span style="font-size:11px;margin-top:6px;display:block">Mod: ${MODES[_mode].label} · Min skor: ${MODES[_mode].min}</span></div>`;
      return;
    }

    container.innerHTML='';
    sorted.slice(0,5).forEach(([sym,c])=>{
      const card = _renderCard(c.params, c.result, c.tk);
      if(card) container.appendChild(card);
    });
  }

  return{setMode, setSort, updateCard, calcSignalScore, generateComment};
})();

// ════════════════════════════════════════════════════════════════════
// BİRLEŞİK updateUI HOOK — Tüm motorları tek noktada çalıştır
// (AI Engine, ECE, SMC, SCE)
// ════════════════════════════════════════════════════════════════════
const _baseUpdateUI = window.updateUI;
window.updateUI = async function(tk, candles, fund, ls){
  // Orijinal updateUI
  _baseUpdateUI(tk, candles, fund, ls);

  // Tüm motorları sırayla çalıştır
  setTimeout(async ()=>{
    try{
      if(!candles||!candles.length||!SYM) return;
      window.SYM = SYM; // her zaman senkron tut
      const ind = window.IND || IND;
      if(!ind) return;
      const closes  = candles.map(c=>c.c);
      const price   = +tk.lastPrice;
      const chg     = +tk.priceChangePercent;
      const rsi     = calcRSI(closes);
      const mr      = calcMACD(closes);
      const e9      = calcEMA(closes,9), e21=calcEMA(closes,21), e50=calcEMA(closes,50);
      const e9v     = e9[e9.length-1], e21v=e21[e21.length-1], e50v=e50[e50.length-1];
      const emaAlign= e9v>e21v?(e21v>e50v?'▲▲▲':'▲▲'):(e21v<e50v?'▼▼▼':'▼▼');
      const atr     = calcATR(candles);
      const atrPct  = (atr/price)*100;
      const conf    = Math.round(calcConf(ind,tk));
      const ent     = calcEntry(candles, ind, tk);
      const sr      = calcSR(candles, price);

      // Fake breakout
      const vols=candles.slice(-5).map(c=>c.v);
      const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/4;
      const lc=candles[candles.length-1];
      const fake=ind.bb&&(price>ind.bb.upper||price<ind.bb.lower)&&lc.v<avgV*0.8;

      // ── Market Regime ──
      const regimeMode = MarketRegime.detect(closes, candles, atrPct);
      MarketRegime.update(regimeMode);

      // ── BTC verisi ──
      await MarketRegime.fetchBTC();
      const btcData = MarketRegime.getBTC();

      // ── OI + Funding ──
      const oiData = await fetchOIFunding(window.SYM);
      renderOIFunding(oiData, price);

      // ── BTC Influence ──
      const btcInf = calcBTCInfluence(btcData, chg, rsi);

      // ── Fake Breakout ──
      const fakeRes = detectFakeBreakout(closes, candles, oiData, btcData);

      // ── Squeeze ──
      detectSqueeze(closes, candles);

      // ── AI Trade Decision ──
      calcAIDecision({
        ent, conf, rsi, macdHist:mr.hist, emaAlign,
        oiData, btcInfluence:btcInf,
        fakeBreak:fakeRes, regimeMode, atrPct,
      });

      // ── Risk Engine ──
      calcRiskEngine(atr, price, conf, regimeMode, atrPct);

      // ── Trade Management ──
      renderTradeManagement(ent, price, btcData, oiData, atrPct);

      // ── SMC ──
      SMC.render({
        sym:window.SYM, tk, closes,
        candles, ind,
        entry:ent, regimeMode,
      });

      // ── ECE ──
      ECE.analyze({
        sym:window.SYM, tk, closes,
        candles, ind,
        entry:ent, sr, fakeBreakout:fake,
        oiData, btcData, regimeMode,
      });

      // ── SCE (Signal Card Engine) ──
      if(ent){
        const smcData = window._lastSMCData||null;
        SCE.updateCard(window.SYM, {
          sym:window.SYM, closes, candles,
          ind, entry:ent, tk, sr,
          fakeBreakout:fake, smcData, btcData, regimeMode,
        }, tk);

        // A+ setup bildirimi
        const scRes = SCE.calcSignalScore({
          closes, candles, ind,
          entry:ent, fakeBreakout:fake, smcData, btcData, regimeMode,
        });
        if(scRes.score>=90 && window.NC){
          NC.add({
            sym:window.SYM, dir:ent.dir==='LONG'?'entry':'entry',
            level:'critical', conf:scRes.score,
            msg:`${window.SYM.replace('USDT','')} A+ SETUP! Skor: ${scRes.score}/100. ${ent.dir==='LONG'?'Yükseliş':'Düşüş'} için tüm şartlar hizalandı.`,
          });
        }
      }

    }catch(e){ console.warn('Birleşik updateUI hook hata:', e); }
  }, 800);
};

// SMC verisi cache'le
const _origSMCRender = typeof SMC!=='undefined'&&SMC.render ? SMC.render.bind(SMC) : null;
if(_origSMCRender && typeof SMC!=='undefined'){
  SMC.render = function(params){
    _origSMCRender(params);
    // SMC sonuçlarını SCE için cache'le
    try{
      const candles = params.candles||[];
      const eq  = SMC.detectEqualLevels(candles);
      const sw  = SMC.detectLiquiditySweep(candles);
      const ob  = SMC.detectOrderBlocks(candles);
      const fvg = SMC.detectFVG(candles);
      const dis = SMC.detectDisplacement(candles);
      const ms  = SMC.analyzeMS(candles);
      window._lastSMCData = {
        quality    : (sw.length?25:0)+(ob.length?20:0)+(fvg.length?15:0)+(dis.length?25:0)+(ms.events.length?15:0),
        sweeps     : sw.length>0,
        ob         : ob.length>0,
        fvg        : fvg.length>0,
        displacement: dis.length>0,
        msTrend    : ms.trend,
        choch      : ms.events.some(e=>e.type==='CHOCH'),
        bos        : ms.events.some(e=>e.type==='BOS'),
        eqHighs    : eq.equalHighs.length>0,
        eqLows     : eq.equalLows.length>0,
      };
    }catch(e){}
  };
}

// ══════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// AŞAMA 1: WebSocket Motor + AI Reasoning + Entry Engine 2.0
// ════════════════════════════════════════════════════════════════════

// ── 1. WEBSOCKET MOTORU ───────────────────────────────────────────────
const WSEngine = (() => {
  const FWSS = 'wss://fstream.binance.com/ws';
  let _sockets = {};
  let _data    = {};
  let _callbacks = {};
  let _reconnectTimers = {};
  let _status = 'disconnected';

  function _setStatus(s){
    _status = s;
    const el = document.getElementById('wsStatus');
    if(!el) return;
    const cfg = {
      connected   : {txt:'● WS CANLI',    col:'var(--green)'},
      connecting  : {txt:'◌ Bağlanıyor...', col:'var(--yellow)'},
      reconnecting: {txt:'↻ Yeniden bağlanıyor...', col:'var(--orange)'},
      disconnected: {txt:'○ Bağlantı Yok', col:'var(--red)'},
    };
    const c = cfg[s]||cfg.disconnected;
    el.textContent = c.txt;
    el.style.color = c.col;
  }

  function subscribe(sym, onData){
    const key = sym.toLowerCase();
    if(_sockets[key]) { _callbacks[key] = onData; return; }
    _callbacks[key] = onData;
    _connect(key);
  }

  function _connect(key){
    _setStatus('connecting');
    const streams = [
      `${key}@ticker`,
      `${key}@kline_15m`,
      `${key}@depth5@100ms`,
      `${key}@aggTrade`,
      `${key}@forceOrder`,
    ].join('/');

    const ws = new WebSocket(`${FWSS}/${streams}`);
    _sockets[key] = ws;

    ws.onopen = () => {
      _setStatus('connected');
      if(_reconnectTimers[key]){ clearTimeout(_reconnectTimers[key]); delete _reconnectTimers[key]; }
    };

    ws.onmessage = (e) => {
      try{
        const msg = JSON.parse(e.data);
        if(!_data[key]) _data[key] = {};
        const d = _data[key];

        // ── PHASE 2: Latency ölçümü ──
        if(!d._lastMsgTs){
          _health.pingTs = performance.now() - 50; // ilk bağlantı tahmini
        }
        const now = performance.now();
        if(_health.pingTs > 0 && now - _health.pingTs < 2000){
          const lat = now - _health.pingTs;
          _health.latencySamples.push(lat);
          if(_health.latencySamples.length > 30) _health.latencySamples.shift();
          _health.pingTs = 0;
        }
        _health.packetCount++;
        _health.lastPacketTs = Date.now();
        _health.uptime = Math.floor((Date.now() - _health.startTs) / 1000);
        d._lastMsgTs = Date.now();
        // Her 50 pakette latency ölç
        if(_health.packetCount % 50 === 0) _health.pingTs = performance.now();
        _updateHealthUI();

        if(msg.e === '24hrTicker'){
          d.price      = +msg.c;
          d.priceChg   = +msg.P;
          d.volume     = +msg.q;
          d.high       = +msg.h;
          d.low        = +msg.l;
          d.trades     = +msg.n;
          // Canlı fiyat güncelle
          _updateLivePrice(d.price, d.priceChg);
        }
        if(msg.e === 'kline'){
          const k = msg.k;
          d.kline = {o:+k.o,h:+k.h,l:+k.l,c:+k.c,v:+k.v,closed:k.x};
        }
        if(msg.e === 'depthUpdate'||msg.e === 'depth'){
          // Order book imbalance hesapla
          if(msg.b&&msg.a){
            const bids = msg.b.slice(0,5);
            const asks = msg.a.slice(0,5);
            const bidVol = bids.reduce((s,x)=>s+(+x[0])*(+x[1]),0);
            const askVol = asks.reduce((s,x)=>s+(+x[0])*(+x[1]),0);
            const total  = bidVol + askVol;
            d.obImbalance = total > 0 ? bidVol / total : 0.5;
            d.bidVol = bidVol; d.askVol = askVol;
            // En iyi fiyat seviyeleri
            d.bestBid = bids[0] ? +bids[0][0] : null;
            d.bestAsk = asks[0] ? +asks[0][0] : null;
            d.spread  = d.bestBid && d.bestAsk ? ((d.bestAsk - d.bestBid) / d.bestBid * 100).toFixed(4) : null;
            // OB güç skoru (0-100)
            d.obScore = Math.round(d.obImbalance * 100);
            // OB baskı yönü
            d.obPressure = d.obImbalance > 0.6 ? 'ALIM' : d.obImbalance < 0.4 ? 'SATIŞ' : 'NÖTR';
            // UI güncelle
            _updateOBUI(d);
          }
        }
        if(msg.e === 'aggTrade'){
          if(!d.trades) d.trades = [];
          d.aggressiveBuy  = msg.m === false;  // maker=false → taker buy
          d.aggressiveSell = msg.m === true;
          d.lastTradeSize  = +msg.q * +msg.p;
          // Volume delta — kayan pencere (son 60 saniye)
          if(!d.volumeDelta) d.volumeDelta = 0;
          if(!d._vdBuy)  d._vdBuy  = 0;
          if(!d._vdSell) d._vdSell = 0;
          if(!d._vdTrades) d._vdTrades = [];
          const tradeVal = d.lastTradeSize;
          const isBuy = msg.m === false;
          d.volumeDelta += isBuy ? tradeVal : -tradeVal;
          if(isBuy) d._vdBuy += tradeVal; else d._vdSell += tradeVal;
          // Trade listesi — son 100 trade
          d._vdTrades.push({ ts: Date.now(), val: tradeVal, buy: isBuy });
          if(d._vdTrades.length > 100) d._vdTrades.shift();
          // Büyük emir tespiti (whale)
          if(tradeVal > 50000){
            d.lastWhale = { val: tradeVal, buy: isBuy, ts: Date.now(), price: +msg.p };
          }
          // Aggressive ratio
          const totalVD = d._vdBuy + d._vdSell;
          d.aggressiveBuyRatio = totalVD > 0 ? d._vdBuy / totalVD : 0.5;
          // 60 saniyede bir sıfırla
          if(!d._vdResetTs) d._vdResetTs = Date.now();
          if(Date.now() - d._vdResetTs > 60000){
            d._vdBuy = 0; d._vdSell = 0; d.volumeDelta = 0;
            d._vdResetTs = Date.now();
          }
          // Volume Delta UI güncelle
          _updateVolumeDeltaUI(d, key.toUpperCase().replace('usdt','USDT'));
        }
        if(msg.e === 'forceOrder'){
          const o = msg.o;
          d.lastLiquidation = {
            side: o.S, price: +o.p, qty: +o.q,
            value: +o.p * +o.q, ts: Date.now()
          };
          _onLiquidation(d.lastLiquidation, key.toUpperCase().replace('usdt','USDT'));
        }

        if(_callbacks[key]) _callbacks[key](d);
      }catch(err){}
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      delete _sockets[key];
      _setStatus('reconnecting');
      // Exponential backoff ile yeniden bağlan
      _reconnectTimers[key] = setTimeout(()=>_connect(key), 3000);
    };
  }

  function _updateLivePrice(price, chg){
    const priceEl = document.getElementById('livePrice');
    const chgEl   = document.getElementById('liveChg');
    if(priceEl && price){
      const dec = price>1000?2:price>1?4:6;
      priceEl.textContent = '$'+price.toLocaleString('en',{maximumFractionDigits:dec,minimumFractionDigits:dec});
      priceEl.style.color = chg>=0?'var(--green)':'var(--red)';
    }
    if(chgEl && chg!==undefined){
      chgEl.textContent = (chg>=0?'+':'')+chg.toFixed(2)+'%';
      chgEl.style.color = chg>=0?'var(--green)':'var(--red)';
    }
  }

  // ── PHASE 2: Volume Delta UI ─────────────────────────────────────────
  function _updateVolumeDeltaUI(d, sym){
    const el = document.getElementById('vdPanel');
    if(!el) return;
    const buy  = d._vdBuy  || 0;
    const sell = d._vdSell || 0;
    const total= buy + sell;
    const buyPct  = total > 0 ? (buy/total*100).toFixed(1) : 50;
    const sellPct = total > 0 ? (sell/total*100).toFixed(1) : 50;
    const delta   = buy - sell;
    const deltaFmt= delta >= 0
      ? '+$'+(delta>=1e6?(delta/1e6).toFixed(2)+'M':(delta/1e3).toFixed(0)+'K')
      : '-$'+(Math.abs(delta)>=1e6?(Math.abs(delta)/1e6).toFixed(2)+'M':(Math.abs(delta)/1e3).toFixed(0)+'K');
    const deltaCol= delta >= 0 ? 'var(--green)' : 'var(--red)';
    const ratio   = d.aggressiveBuyRatio || 0.5;
    const whaleHtml = d.lastWhale && (Date.now()-d.lastWhale.ts < 30000)
      ? `<div style="font-size:10px;color:${d.lastWhale.buy?'var(--green)':'var(--red)'};margin-top:6px;padding:4px 8px;background:rgba(${d.lastWhale.buy?'0,229,160':'255,61,107'},.08);border-radius:6px">
           🐋 Whale: ${d.lastWhale.buy?'ALIM':'SATIŞ'} $${(d.lastWhale.val/1000).toFixed(0)}K @ $${d.lastWhale.price.toFixed(2)}
         </div>` : '';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--text3)">◈ VOLUME DELTA (60s)</span>
        <span style="font-size:13px;font-weight:800;color:${deltaCol}">${deltaFmt}</span>
      </div>
      <div style="height:8px;background:rgba(0,0,0,.3);border-radius:4px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${buyPct}%;background:linear-gradient(90deg,var(--green),var(--green2));border-radius:4px;transition:width .3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px">
        <span style="color:var(--green)">▲ ALIM ${buyPct}%</span>
        <span style="color:var(--red)">▼ SATIŞ ${sellPct}%</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <div style="flex:1;background:rgba(0,229,160,.06);border:1px solid rgba(0,229,160,.2);border-radius:8px;padding:6px 8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">ALIM</div>
          <div style="font-size:11px;font-weight:700;color:var(--green)">$${buy>=1e6?(buy/1e6).toFixed(1)+'M':buy>=1e3?(buy/1e3).toFixed(0)+'K':'—'}</div>
        </div>
        <div style="flex:1;background:rgba(255,61,107,.06);border:1px solid rgba(255,61,107,.2);border-radius:8px;padding:6px 8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">SATIŞ</div>
          <div style="font-size:11px;font-weight:700;color:var(--red)">$${sell>=1e6?(sell/1e6).toFixed(1)+'M':sell>=1e3?(sell/1e3).toFixed(0)+'K':'—'}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:6px 8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">ORAN</div>
          <div style="font-size:11px;font-weight:700;color:var(--cyan)">${(ratio*100).toFixed(0)}%</div>
        </div>
      </div>
      ${whaleHtml}
    `;
  }

  // ── PHASE 2: Order Book UI ───────────────────────────────────────────
  function _updateOBUI(d){
    const el = document.getElementById('obPanel');
    if(!el) return;
    const obi     = d.obImbalance || 0.5;
    const bidPct  = (obi * 100).toFixed(1);
    const askPct  = ((1-obi) * 100).toFixed(1);
    const pressure= d.obPressure || 'NÖTR';
    const pCol    = pressure==='ALIM'?'var(--green)':pressure==='SATIŞ'?'var(--red)':'var(--yellow)';
    const bidFmt  = d.bidVol ? '$'+(d.bidVol>=1e6?(d.bidVol/1e6).toFixed(2)+'M':(d.bidVol/1e3).toFixed(0)+'K') : '—';
    const askFmt  = d.askVol ? '$'+(d.askVol>=1e6?(d.askVol/1e6).toFixed(2)+'M':(d.askVol/1e3).toFixed(0)+'K') : '—';
    const spread  = d.spread ? d.spread+'%' : '—';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--text3)">◈ ORDER BOOK (5 SEVİYE)</span>
        <span style="font-size:11px;font-weight:700;color:${pCol}">${pressure}</span>
      </div>
      <div style="position:relative;height:10px;background:rgba(255,61,107,.15);border-radius:5px;overflow:hidden;margin-bottom:6px">
        <div style="position:absolute;left:0;top:0;height:100%;width:${bidPct}%;background:linear-gradient(90deg,var(--green2),var(--green));border-radius:5px;transition:width .2s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:8px">
        <span style="color:var(--green)">BID ${bidPct}% · ${bidFmt}</span>
        <span style="color:var(--text3)">SPREAD ${spread}</span>
        <span style="color:var(--red)">ASK ${askPct}% · ${askFmt}</span>
      </div>
      <div style="height:6px;background:rgba(0,0,0,.2);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${bidPct}%;background:var(--green);opacity:.4;transition:width .2s"></div>
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:6px">
        <div style="flex:1;height:4px;background:rgba(0,0,0,.2);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${bidPct}%;background:var(--green);opacity:.6"></div>
        </div>
        <span style="font-size:10px;color:${pCol};font-weight:700;min-width:60px;text-align:center">
          ${obi > 0.65 ? '🟢 Güçlü Alım' : obi < 0.35 ? '🔴 Güçlü Satış' : obi > 0.55 ? '🟡 Hafif Alım' : obi < 0.45 ? '🟡 Hafif Satış' : '⚪ Dengeli'}
        </span>
        <div style="flex:1;height:4px;background:rgba(0,0,0,.2);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${askPct}%;background:var(--red);opacity:.6;float:right"></div>
        </div>
      </div>
    `;
  }

  function _onLiquidation(liq, sym){
    if(!window.NC||liq.value<50000) return;
    const side = liq.side==='BUY'?'Short Likidasyon':'Long Likidasyon';
    const val  = liq.value>=1e6?(liq.value/1e6).toFixed(2)+'M$':(liq.value/1e3).toFixed(0)+'K$';
    NC.add({sym, dir:'warn', level: liq.value>500000?'critical':'high',
      msg:`⚡ ${sym.replace('USDT','')} ${side}: ${val} pozisyon tasfiye edildi @ $${liq.price.toFixed(4)}. Likidite hareketi dikkat!`
    });
  }

  function getData(sym){ return _data[sym.toLowerCase()]||{}; }
  function unsubscribe(sym){
    const key=sym.toLowerCase();
    if(_sockets[key]){ _sockets[key].close(); delete _sockets[key]; }
    delete _callbacks[key];
    delete _data[key];
  }
  function getStatus(){ return _status; }

  // ── PHASE 2: Health Monitor ──────────────────────────────────────────
  const _health = {
    packetCount: 0,
    lastPacketTs: 0,
    latencySamples: [],
    pingTs: 0,
    uptime: 0,
    startTs: Date.now(),
    errors: 0,
  };

  // Latency ölçümü için ping/pong sistemi
  function _measureLatency(ws){
    if(!ws || ws.readyState !== 1) return;
    _health.pingTs = performance.now();
    // Binance WS latency: ilk mesaj gelişini ölç
  }

  function _recordPacket(){
    _health.packetCount++;
    const now = performance.now();
    if(_health.pingTs > 0){
      const lat = now - _health.pingTs;
      if(lat < 5000){ // gerçekçi latency
        _health.latencySamples.push(lat);
        if(_health.latencySamples.length > 20) _health.latencySamples.shift();
      }
      _health.pingTs = 0;
    }
    _health.lastPacketTs = Date.now();
    _health.uptime = Math.floor((Date.now() - _health.startTs) / 1000);
    _updateHealthUI();
  }

  function getAvgLatency(){
    if(!_health.latencySamples.length) return null;
    return (_health.latencySamples.reduce((a,b)=>a+b,0) / _health.latencySamples.length).toFixed(0);
  }

  function _updateHealthUI(){
    const el = document.getElementById('wsHealthPanel');
    if(!el) return;
    const lat = getAvgLatency();
    const latColor = !lat ? 'var(--text3)' : lat < 100 ? 'var(--green)' : lat < 300 ? 'var(--yellow)' : 'var(--red)';
    const latTxt   = lat ? lat + 'ms' : '—';
    const pkt      = _health.packetCount > 999 ? (_health.packetCount/1000).toFixed(1)+'K' : _health.packetCount;
    const upSec    = _health.uptime;
    const upTxt    = upSec < 60 ? upSec+'s' : upSec < 3600 ? Math.floor(upSec/60)+'m' : Math.floor(upSec/3600)+'h';

    el.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">LATENCY</span>
          <span style="font-size:12px;font-weight:700;color:${latColor}">${latTxt}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">PAKET</span>
          <span style="font-size:12px;font-weight:700;color:var(--cyan)">${pkt}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">UPTIME</span>
          <span style="font-size:12px;font-weight:700;color:var(--green)">${upTxt}</span>
        </div>
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:9px;color:var(--text3);letter-spacing:1px">DURUM</span>
          <span style="font-size:12px;font-weight:700;color:${_status==='connected'?'var(--green)':'var(--red)'}">${_status==='connected'?'CANLI':'KESİLDİ'}</span>
        </div>
      </div>
    `;
  }

  // Orijinal onmessage'ı health tracking ile wrap et
  const _origConnect = _connect;

  function getHealth(){ return { ..._health, avgLatency: getAvgLatency() }; }

  return{subscribe, unsubscribe, getData, getStatus, getHealth};
})();

// ── 2. AI REASONING ENGINE ────────────────────────────────────────────
const AIReasoning = (() => {

  // Her karar için reasoning üret
  function buildReasoning(params){
    const {
      sym, dir, closes, candles, ind, entry,
      oiData, btcData, wsData, regimeMode,
      smcData, fakeBreak, conf
    } = params;

    const reasons   = [];
    const conflicts  = [];
    const confirms   = [];
    const rejects    = [];
    let   decision   = 'WAIT';
    let   finalConf  = conf || 50;

    const isLong = dir === 'LONG';
    const price  = closes[closes.length-1];
    const rsi    = ind.rsi;
    const macd   = ind.macd;
    const e9=ind.ema9, e21=ind.ema21, e50=ind.ema50;

    // ── Teknik analiz ──
    if(isLong){
      if(e9>e21&&e21>e50)     { confirms.push('EMA tam hizalama (9>21>50)'); finalConf+=10; }
      else if(e9>e21)          { confirms.push('EMA kısmi pozitif'); finalConf+=5; }
      else                     { conflicts.push('EMA hizalama yok'); finalConf-=10; }
      if(macd.hist>0)          { confirms.push('MACD histogramı pozitif'); finalConf+=8; }
      else                     { conflicts.push('MACD histogramı negatif'); finalConf-=8; }
      if(rsi>=45&&rsi<=65)     { confirms.push(`RSI ideal bölge (${rsi.toFixed(0)})`); finalConf+=8; }
      else if(rsi>72)          { conflicts.push(`RSI aşırı alım (${rsi.toFixed(0)})`); finalConf-=12; rejects.push('RSI aşırı alım — giriş riskli'); }
      else if(rsi<35)          { confirms.push(`RSI aşırı satım — dip potansiyeli (${rsi.toFixed(0)})`); }
    } else {
      if(e9<e21&&e21<e50)     { confirms.push('EMA tam aşağı hizalama'); finalConf+=10; }
      else if(e9<e21)          { confirms.push('EMA kısmi negatif'); finalConf+=5; }
      else                     { conflicts.push('EMA yükseliş hizalaması short ile çelişiyor'); finalConf-=10; }
      if(macd.hist<0)          { confirms.push('MACD histogramı negatif — baskı devam'); finalConf+=8; }
      else                     { conflicts.push('MACD pozitife dönüyor — short zayıflıyor'); finalConf-=8; }
      if(rsi>=35&&rsi<=55)     { confirms.push(`RSI short için uygun (${rsi.toFixed(0)})`); finalConf+=8; }
      else if(rsi<28)          { conflicts.push(`RSI aşırı satım — short kovalamak riskli (${rsi.toFixed(0)})`); finalConf-=12; }
    }

    // ── Hacim analizi ──
    const vols = candles.slice(-10).map(c=>c.v);
    const avgV = vols.slice(0,-1).reduce((a,b)=>a+b,0)/9;
    const curV = candles[candles.length-1].v;
    const volR = curV/avgV;
    if(volR>=1.5)      { confirms.push(`Güçlü hacim onayı (${volR.toFixed(1)}x)`); finalConf+=8; }
    else if(volR>=1.1) { confirms.push(`Hacim artışı var (${volR.toFixed(1)}x)`); finalConf+=4; }
    else               { conflicts.push(`Hacim yetersiz (${volR.toFixed(1)}x ort.)`); finalConf-=6; }

    // ── WS Gerçek zamanlı veri ──
    if(wsData){
      if(wsData.obImbalance!==undefined){
        const obi = wsData.obImbalance;
        if(isLong&&obi>0.6)       { confirms.push(`Order book alım baskısı (${(obi*100).toFixed(0)}%)`); finalConf+=6; }
        else if(!isLong&&obi<0.4) { confirms.push(`Order book satış baskısı (${((1-obi)*100).toFixed(0)}%)`); finalConf+=6; }
        else if(isLong&&obi<0.4)  { conflicts.push('Order book satış tarafında ağır'); finalConf-=6; }
      }
      if(wsData.lastLiquidation){
        const liq = wsData.lastLiquidation;
        const age = (Date.now()-liq.ts)/1000;
        if(age<60){
          if(isLong&&liq.side==='BUY')   { confirms.push('Short likidasyon yakın — long momentum'); finalConf+=5; }
          if(!isLong&&liq.side==='SELL') { confirms.push('Long likidasyon yakın — short momentum'); finalConf+=5; }
        }
      }
    }

    // ── OI + Funding ──
    if(oiData){
      if(oiData.fund!==null){
        const f = oiData.fund;
        if(isLong&&f>0.08)         { conflicts.push(`Funding aşırı pozitif (%${f.toFixed(3)}) — long kalabalık`); finalConf-=10; rejects.push(`Funding %${f.toFixed(3)} — long pozisyon için maliyetli`); }
        else if(isLong&&f<-0.05)   { confirms.push(`Negatif funding long'u destekliyor (%${f.toFixed(3)})`); finalConf+=8; }
        else if(!isLong&&f<-0.08)  { conflicts.push(`Funding aşırı negatif — short kalabalık`); finalConf-=10; }
        else if(!isLong&&f>0.05)   { confirms.push(`Pozitif funding short'u destekliyor`); finalConf+=8; }
      }
      if(oiData.oiChange!==null){
        const oiC = +oiData.oiChange;
        if(isLong&&oiC>2)          { confirms.push(`OI artışı long momentum destekliyor (+%${oiC.toFixed(1)})`); finalConf+=5; }
        if(!isLong&&oiC<-2)        { confirms.push(`OI düşüşü short momentum destekliyor (%${oiC.toFixed(1)})`); finalConf+=5; }
        if(isLong&&oiC<-3)         { conflicts.push(`OI hızla düşüyor — pozisyon kapanıyor olabilir`); finalConf-=8; }
      }
    }

    // ── BTC Korelasyon ──
    if(btcData){
      if(isLong&&btcData.chg>1)    { confirms.push(`BTC yükseliş desteği (%${btcData.chg.toFixed(2)})`); finalConf+=6; }
      else if(isLong&&btcData.chg<-2) { conflicts.push(`BTC düşüyor — altcoin long için olumsuz`); finalConf-=8; rejects.push('BTC zayıflığı long girişi için risk oluşturuyor'); }
      else if(!isLong&&btcData.chg<-1) { confirms.push(`BTC düşüş short'u destekliyor`); finalConf+=6; }
    }

    // ── SMC ──
    if(smcData){
      if(smcData.sweeps)     { confirms.push('Likidite süpürmesi gerçekleşti — reversal ihtimali'); finalConf+=6; }
      if(smcData.ob)         { confirms.push(isLong?'Bullish order block destek sağlıyor':'Bearish order block baskı oluşturuyor'); finalConf+=5; }
      if(smcData.choch)      { confirms.push('CHoCH oluştu — trend değişim sinyali'); finalConf+=8; }
      if(smcData.eqHighs&&isLong) { conflicts.push('Equal highs üstte — likidite tuzağı riski'); finalConf-=5; }
    }

    // ── Fake Breakout ──
    if(fakeBreak){
      rejects.push('Fake breakout riski yüksek — hacimsiz kırılım tespit edildi');
      conflicts.push('Wick manipülasyonu veya hacimsiz breakout');
      finalConf -= 15;
    }

    // ── Market Regime ──
    if(regimeMode==='PANIC'&&isLong)   { rejects.push('Panik modu — long pozisyon açmak riskli'); finalConf-=15; }
    if(regimeMode==='TREND')           { confirms.push('Trend modu — momentum sinyalleri güçlü'); finalConf+=5; }
    if(regimeMode==='VOLATILE')        { conflicts.push('Volatil market — stop aralığı genişletilmeli'); finalConf-=8; }

    // ── R/R kontrolü ──
    if(entry){
      if(entry.rr>=2.5)  { confirms.push(`Güçlü R/R oranı (1:${entry.rr})`); finalConf+=5; }
      else if(entry.rr<1.5) { rejects.push(`Zayıf R/R oranı (1:${entry.rr}) — giriş önerilmez`); finalConf-=10; }
    }

    finalConf = Math.max(10, Math.min(97, Math.round(finalConf)));

    // ── Nihai karar ──
    if(rejects.length>0&&finalConf<50)      decision = 'REJECTED';
    else if(finalConf>=80&&confirms.length>=4) decision = 'STRONG_'+dir;
    else if(finalConf>=65)                   decision = dir;
    else if(finalConf>=50&&conflicts.length<3) decision = 'WEAK_'+dir;
    else                                      decision = 'WAIT';

    // ── Türkçe özet ──
    const summary = _buildSummary(decision, dir, confirms, conflicts, rejects, finalConf, sym);

    return { decision, confidence:finalConf, confirms, conflicts, rejects, summary };
  }

  function _buildSummary(decision, dir, confirms, conflicts, rejects, conf, sym){
    const sn = sym.replace('USDT','');
    let lines = [];

    if(decision==='REJECTED'){
      lines.push(`${sn} — GİRİŞ REDDEDİLDİ (Güven: %${conf})`);
      rejects.slice(0,3).forEach(r=>lines.push(`✗ ${r}`));
    } else if(decision.startsWith('STRONG')){
      lines.push(`${sn} — GÜÇLÜ ${dir} SETUP (Güven: %${conf})`);
      confirms.slice(0,3).forEach(c=>lines.push(`✓ ${c}`));
      if(conflicts.length) lines.push(`⚠ ${conflicts[0]}`);
    } else if(decision===dir){
      lines.push(`${sn} — ${dir} SETUP (Güven: %${conf})`);
      confirms.slice(0,2).forEach(c=>lines.push(`✓ ${c}`));
      if(conflicts.length) lines.push(`⚠ ${conflicts[0]}`);
    } else if(decision.startsWith('WEAK')){
      lines.push(`${sn} — ZAYIF ${dir} (Güven: %${conf}) — Bekle`);
      if(conflicts.length) conflicts.slice(0,2).forEach(c=>lines.push(`⚠ ${c}`));
    } else {
      lines.push(`${sn} — BEKLEME (Güven: %${conf})`);
      if(conflicts.length) lines.push(`⚠ ${conflicts[0]}`);
      lines.push('Daha güçlü konfirmasyon bekleniyor.');
    }

    return lines;
  }

  return { buildReasoning };
})();

// ════════════════════════════════════════════════════════════════════
// PHASE 3 — AI DECISION & CONFIRMATION ENGINE (Gelişmiş)
// ════════════════════════════════════════════════════════════════════
const AIDecisionEngine = (() => {

  // ── Ağırlıklı Koşullar (toplam 100 puan) ────────────────────────────
  const WEIGHTED_CONDITIONS = [
    { id:'ema_full',    weight:12, label:'EMA Tam Hizalama (9>21>50)',    critical:false },
    { id:'macd',        weight:10, label:'MACD Histogram Yönü',           critical:false },
    { id:'rsi',         weight:8,  label:'RSI Bölge Uyumu',               critical:false },
    { id:'volume',      weight:10, label:'Hacim Onayı (≥1.3x)',           critical:false },
    { id:'btc',         weight:8,  label:'BTC Korelasyon',                critical:false },
    { id:'rr',          weight:10, label:'R/R Oranı (≥2.0)',              critical:true  },
    { id:'smc',         weight:8,  label:'SMC Yapı (OB/CHoCH/Sweep)',     critical:false },
    { id:'no_fake',     weight:10, label:'Fake Breakout Yok',             critical:true  },
    { id:'regime',      weight:8,  label:'Market Rejimi Uyumu',           critical:false },
    { id:'ob_imbalance',weight:8,  label:'Order Book Baskısı',            critical:false },
    { id:'funding',     weight:8,  label:'Funding Sağlıklı',              critical:false },
  ];

  // Durum geçmişi (pending → confirmed/failed)
  let _history = {};
  let _lastResult = null;

  // ── Ana değerlendirme fonksiyonu ─────────────────────────────────────
  function evaluate(params){
    const { closes, candles, ind, entry, oiData, btcData, wsData, regimeMode, smcData, fakeBreak, sym } = params;
    if(!entry || !ind) return null;

    const isLong = entry.dir === 'LONG';
    const price  = closes[closes.length-1];

    // Hacim hesapla
    const vols = candles.slice(-10).map(c=>c.v);
    const avgV = vols.slice(0,-1).reduce((a,b)=>a+b,0)/9;
    const volR = candles[candles.length-1].v / avgV;

    // Her koşulu değerlendir
    const results = WEIGHTED_CONDITIONS.map(cond => {
      let status = 'pending'; // pending | confirmed | failed
      let detail = '';
      let score  = 0;

      switch(cond.id){
        case 'ema_full':
          if(isLong){
            if(ind.ema9>ind.ema21 && ind.ema21>ind.ema50){ status='confirmed'; score=cond.weight; detail='9>21>50 ✓'; }
            else if(ind.ema9>ind.ema21){ status='pending'; score=cond.weight*0.5; detail='9>21 ✓, 50 bekleniyor'; }
            else { status='failed'; detail='EMA negatif'; }
          } else {
            if(ind.ema9<ind.ema21 && ind.ema21<ind.ema50){ status='confirmed'; score=cond.weight; detail='9<21<50 ✓'; }
            else if(ind.ema9<ind.ema21){ status='pending'; score=cond.weight*0.5; detail='9<21 ✓, 50 bekleniyor'; }
            else { status='failed'; detail='EMA yükseliş hizası'; }
          }
          break;

        case 'macd':
          if(isLong){
            if(ind.macd.hist>0 && ind.macd.macd>ind.macd.signal){ status='confirmed'; score=cond.weight; detail=`Hist: +${ind.macd.hist.toFixed(4)}`; }
            else if(ind.macd.hist>0){ status='pending'; score=cond.weight*0.6; detail='Hist pozitif, sinyal bekleniyor'; }
            else { status='failed'; detail=`Hist: ${ind.macd.hist.toFixed(4)}`; }
          } else {
            if(ind.macd.hist<0 && ind.macd.macd<ind.macd.signal){ status='confirmed'; score=cond.weight; detail=`Hist: ${ind.macd.hist.toFixed(4)}`; }
            else if(ind.macd.hist<0){ status='pending'; score=cond.weight*0.6; detail='Hist negatif, sinyal bekleniyor'; }
            else { status='failed'; detail='MACD dönüyor'; }
          }
          break;

        case 'rsi':
          const rsi = ind.rsi;
          if(isLong){
            if(rsi>=45&&rsi<=65){ status='confirmed'; score=cond.weight; detail=`RSI: ${rsi.toFixed(1)} (ideal)`; }
            else if(rsi>=35&&rsi<45){ status='pending'; score=cond.weight*0.5; detail=`RSI: ${rsi.toFixed(1)} (düşük)`; }
            else if(rsi>65&&rsi<=72){ status='pending'; score=cond.weight*0.4; detail=`RSI: ${rsi.toFixed(1)} (yüksek)`; }
            else if(rsi>72){ status='failed'; detail=`RSI: ${rsi.toFixed(1)} — aşırı alım`; }
            else { status='failed'; detail=`RSI: ${rsi.toFixed(1)}`; }
          } else {
            if(rsi>=32&&rsi<=55){ status='confirmed'; score=cond.weight; detail=`RSI: ${rsi.toFixed(1)} (ideal)`; }
            else if(rsi>55&&rsi<=68){ status='pending'; score=cond.weight*0.5; detail=`RSI: ${rsi.toFixed(1)} (yüksek)`; }
            else if(rsi<28){ status='failed'; detail=`RSI: ${rsi.toFixed(1)} — aşırı satım`; }
            else { status='pending'; score=cond.weight*0.3; detail=`RSI: ${rsi.toFixed(1)}`; }
          }
          break;

        case 'volume':
          if(volR>=1.5){ status='confirmed'; score=cond.weight; detail=`${volR.toFixed(1)}x ort.`; }
          else if(volR>=1.2){ status='pending'; score=cond.weight*0.6; detail=`${volR.toFixed(1)}x — artıyor`; }
          else { status='failed'; detail=`${volR.toFixed(1)}x — yetersiz`; }
          break;

        case 'btc':
          if(btcData){
            if(isLong && btcData.chg>0.5){ status='confirmed'; score=cond.weight; detail=`BTC +%${btcData.chg.toFixed(2)}`; }
            else if(!isLong && btcData.chg<-0.5){ status='confirmed'; score=cond.weight; detail=`BTC -%${Math.abs(btcData.chg).toFixed(2)}`; }
            else if(Math.abs(btcData.chg)<0.5){ status='pending'; score=cond.weight*0.5; detail=`BTC nötr (%${btcData.chg.toFixed(2)})`; }
            else { status='failed'; detail=`BTC ters yön (%${btcData.chg.toFixed(2)})`; }
          } else { status='pending'; detail='BTC verisi bekleniyor'; }
          break;

        case 'rr':
          if(entry.rr>=2.5){ status='confirmed'; score=cond.weight; detail=`1:${entry.rr} ✓`; }
          else if(entry.rr>=2.0){ status='confirmed'; score=cond.weight*0.8; detail=`1:${entry.rr}`; }
          else if(entry.rr>=1.5){ status='pending'; score=cond.weight*0.5; detail=`1:${entry.rr} — düşük`; }
          else { status='failed'; detail=`1:${entry.rr} — yetersiz`; }
          break;

        case 'smc':
          if(smcData){
            const pts = (smcData.sweeps?1:0)+(smcData.ob?1:0)+(smcData.choch?1:0)+(smcData.bos?1:0);
            if(pts>=2){ status='confirmed'; score=cond.weight; detail=`${pts} SMC sinyali`; }
            else if(pts>=1){ status='pending'; score=cond.weight*0.6; detail=`${pts} SMC sinyali`; }
            else { status='failed'; detail='SMC yapı yok'; }
          } else { status='pending'; detail='SMC analizi bekleniyor'; }
          break;

        case 'no_fake':
          if(!fakeBreak){ status='confirmed'; score=cond.weight; detail='Fake breakout riski yok'; }
          else { status='failed'; detail='Fake breakout tespit edildi'; }
          break;

        case 'regime':
          if(regimeMode==='TREND'){ status='confirmed'; score=cond.weight; detail='Trend modu ✓'; }
          else if(regimeMode==='RANGE'||regimeMode==='BREAKOUT'){ status='pending'; score=cond.weight*0.6; detail=regimeMode; }
          else if(regimeMode==='PANIC'&&isLong){ status='failed'; detail='Panik modu — long riskli'; }
          else if(regimeMode==='VOLATILE'){ status='pending'; score=cond.weight*0.4; detail='Volatil market'; }
          else { status='pending'; score=cond.weight*0.5; detail=regimeMode||'Analiz ediliyor'; }
          break;

        case 'ob_imbalance':
          if(wsData&&wsData.obImbalance!==undefined){
            const obi = wsData.obImbalance;
            if(isLong&&obi>0.6){ status='confirmed'; score=cond.weight; detail=`Alım baskısı %${(obi*100).toFixed(0)}`; }
            else if(!isLong&&obi<0.4){ status='confirmed'; score=cond.weight; detail=`Satış baskısı %${((1-obi)*100).toFixed(0)}`; }
            else if(Math.abs(obi-0.5)<0.1){ status='pending'; score=cond.weight*0.5; detail='Dengeli sipariş defteri'; }
            else { status='failed'; detail=`Ters baskı %${(isLong?((1-obi)*100):(obi*100)).toFixed(0)}`; }
          } else { status='pending'; detail='WS verisi bekleniyor'; }
          break;

        case 'funding':
          if(oiData&&oiData.fund!==null){
            const f = oiData.fund;
            if(isLong&&f>=-0.02&&f<=0.05){ status='confirmed'; score=cond.weight; detail=`Funding: %${f.toFixed(3)}`; }
            else if(!isLong&&f>=-0.05&&f<=0.02){ status='confirmed'; score=cond.weight; detail=`Funding: %${f.toFixed(3)}`; }
            else if(Math.abs(f)<0.1){ status='pending'; score=cond.weight*0.5; detail=`Funding: %${f.toFixed(3)}`; }
            else { status='failed'; detail=`Funding aşırı: %${f.toFixed(3)}`; }
          } else { status='pending'; detail='Funding verisi bekleniyor'; }
          break;
      }

      return { ...cond, status, detail, score };
    });

    // Toplam skor hesapla
    const totalScore = results.reduce((s,r)=>s+r.score, 0);
    const maxScore   = WEIGHTED_CONDITIONS.reduce((s,c)=>s+c.weight, 0);
    const pct        = Math.round(totalScore / maxScore * 100);

    // Kritik koşullar
    const criticalFailed = results.filter(r=>r.critical && r.status==='failed');
    const confirmed      = results.filter(r=>r.status==='confirmed').length;
    const pending        = results.filter(r=>r.status==='pending').length;
    const failed         = results.filter(r=>r.status==='failed').length;

    // Setup grade belirle
    let grade, tier, tierColor, tierBg, tierEmoji;
    if(criticalFailed.length>0){
      grade='F'; tier='REDDEDILDI'; tierColor='var(--red)'; tierBg='rgba(255,61,107,.12)'; tierEmoji='✗';
    } else if(pct>=85 && confirmed>=8){
      grade='S'; tier='INSTITUTIONAL GRADE'; tierColor='#b39dfa'; tierBg='rgba(157,125,250,.15)'; tierEmoji='⭐';
    } else if(pct>=72 && confirmed>=7){
      grade='A'; tier='STRONG SETUP'; tierColor='var(--green)'; tierBg='rgba(0,229,160,.12)'; tierEmoji='⭐';
    } else if(pct>=58 && confirmed>=5){
      grade='B'; tier='CONFIRMED SETUP'; tierColor='var(--yellow)'; tierBg='rgba(255,193,7,.1)'; tierEmoji='✓';
    } else if(pct>=45 && confirmed>=4){
      grade='C'; tier='AGGRESSIVE ENTRY'; tierColor='var(--orange)'; tierBg='rgba(255,122,0,.1)'; tierEmoji='⚡';
    } else {
      grade='D'; tier='WEAK SETUP'; tierColor='var(--text3)'; tierBg='rgba(255,255,255,.05)'; tierEmoji='○';
    }

    // Eksik koşullar (pending olanlar)
    const missing = results.filter(r=>r.status!=='confirmed').map(r=>({
      label: r.label,
      weight: r.weight,
      status: r.status,
      detail: r.detail,
    })).sort((a,b)=>b.weight-a.weight);

    // AI özet cümle
    const aiSummary = _buildAISummary(entry.dir, tier, confirmed, results.length, pct, missing, criticalFailed, sym);

    const result = {
      conditions: results,
      score: pct,
      totalScore, maxScore,
      confirmed, pending, failed,
      grade, tier, tierColor, tierBg, tierEmoji,
      missing,
      criticalFailed,
      aiSummary,
      dir: entry.dir,
    };

    _lastResult = result;
    _renderPhase3UI(result);
    return result;
  }

  function _buildAISummary(dir, tier, confirmed, total, pct, missing, critFailed, sym){
    const sn = sym ? sym.replace('USDT','') : '—';
    if(critFailed.length>0){
      return `${sn} — Kritik koşul(lar) karşılanmadı: ${critFailed.map(c=>c.label).join(', ')}. Giriş reddedildi.`;
    }
    if(tier==='INSTITUTIONAL GRADE'){
      return `${sn} — ${confirmed}/${total} onay tamamlandı (%${pct} skor). Kurumsal kalite ${dir} setup. Tüm kritik koşullar karşılandı.`;
    }
    if(tier==='STRONG SETUP'){
      return `${sn} — ${confirmed}/${total} onay (%${pct}). Güçlü ${dir} setup. ${missing.filter(m=>m.status==='pending').slice(0,2).map(m=>m.label).join(', ')} bekleniyor.`;
    }
    if(tier==='CONFIRMED SETUP'){
      return `${sn} — ${confirmed}/${total} onay (%${pct}). Erken momentum. ${missing.slice(0,3).map(m=>m.label).join(', ')} eksik.`;
    }
    if(tier==='AGGRESSIVE ENTRY'){
      return `${sn} — ${confirmed}/${total} onay (%${pct}). Agresif giriş. Yüksek risk — stop sıkı tutulmalı. ${missing.slice(0,2).map(m=>m.label).join(', ')} bekleniyor.`;
    }
    return `${sn} — ${confirmed}/${total} onay (%${pct}). Zayıf setup — daha güçlü konfirmasyon bekleniyor.`;
  }

  function _renderPhase3UI(r){
    const el = document.getElementById('phase3Panel');
    if(!el) return;

    const barW = r.score;
    const barCol = r.score>=80?'var(--green)':r.score>=60?'var(--yellow)':r.score>=40?'var(--orange)':'var(--red)';

    const condHtml = r.conditions.map(c=>{
      const col  = c.status==='confirmed'?'var(--green)':c.status==='pending'?'var(--yellow)':'var(--red)';
      const icon = c.status==='confirmed'?'✓':c.status==='pending'?'◌':'✗';
      const bg   = c.status==='confirmed'?'rgba(0,229,160,.07)':c.status==='pending'?'rgba(255,193,7,.05)':'rgba(255,61,107,.07)';
      return `
        <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:${bg};border-radius:6px;border:1px solid ${col}22">
          <span style="color:${col};font-weight:700;font-size:11px;min-width:14px">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-weight:600;color:${c.status==='confirmed'?'var(--text)':'var(--text2)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.label}</div>
            <div style="font-size:9px;color:var(--text3)">${c.detail}</div>
          </div>
          <div style="font-size:9px;font-weight:700;color:${col};min-width:30px;text-align:right">+${c.score.toFixed(0)}</div>
        </div>
      `;
    }).join('');

    const missingHtml = r.missing.slice(0,4).filter(m=>m.status!=='confirmed').map(m=>`
      <span style="font-size:9px;padding:2px 7px;background:rgba(255,255,255,.06);border-radius:10px;color:${m.status==='pending'?'var(--yellow)':'var(--red)'}">
        ${m.status==='pending'?'◌':'✗'} ${m.label.split(' ').slice(0,2).join(' ')}
      </span>
    `).join('');

    el.innerHTML = `
      <!-- Tier Badge -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="padding:5px 14px;border-radius:20px;background:${r.tierBg};border:1px solid ${r.tierColor}44;font-size:11px;font-weight:700;color:${r.tierColor}">
          ${r.tierEmoji} ${r.tier}
        </div>
        <div style="margin-left:auto;font-size:24px;font-weight:900;color:${r.tierColor}">${r.grade}</div>
      </div>

      <!-- Skor Bar -->
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px">
          <span style="color:var(--text3)">Ağırlıklı Güven Skoru</span>
          <span style="font-weight:700;color:${barCol}">${r.score}%</span>
        </div>
        <div style="height:8px;background:rgba(0,0,0,.3);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,${barCol},${barCol}88);border-radius:4px;transition:width .5s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;margin-top:3px;color:var(--text3)">
          <span>✓ ${r.confirmed} onay</span>
          <span>◌ ${r.pending} bekliyor</span>
          <span>✗ ${r.failed} başarısız</span>
        </div>
      </div>

      <!-- AI Özet -->
      <div style="background:rgba(0,0,0,.25);border-left:3px solid ${r.tierColor};padding:8px 10px;border-radius:0 8px 8px 0;margin-bottom:10px;font-size:10px;color:var(--text2);line-height:1.5">
        ${r.aiSummary}
      </div>

      <!-- Koşullar -->
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--text3);text-transform:uppercase;margin-bottom:6px">◈ KONFİRMASYON DETAYI</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">
        ${condHtml}
      </div>

      <!-- Eksik koşullar -->
      ${r.missing.filter(m=>m.status!=='confirmed').length>0?`
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--text3);text-transform:uppercase;margin-bottom:6px">◈ EKSİK / BEKLENEN</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">${missingHtml}</div>
      `:''}
    `;
  }

  function getLastResult(){ return _lastResult; }

  return { evaluate, getLastResult };
})();

// ── 3. ENTRY CONFIRMATION ENGINE 2.0 ─────────────────────────────────
const ECE2 = (() => {

  const STAGES_DEF = [
    {id:'breakout',  name:'Kırılım Oluştu',       icon:'📊'},
    {id:'candle',    name:'Mum Kapanışı',          icon:'🕯'},
    {id:'retest',    name:'Retest',                icon:'🔄'},
    {id:'volume',    name:'Hacim Teyidi',          icon:'📈'},
    {id:'btc',       name:'BTC Yönü',              icon:'₿'},
    {id:'funding',   name:'Funding Sağlıklı',      icon:'💰'},
    {id:'orderbook', name:'Orderbook Desteği',     icon:'📚'},
    {id:'liq',       name:'Likidasyon Tuzağı Yok', icon:'⚡'},
  ];

  let _stageStatus = {};
  let _sym = '';

  function reset(sym){
    _sym = sym;
    _stageStatus = {};
    STAGES_DEF.forEach(s=>{ _stageStatus[s.id]='pending'; });
    _render();
  }

  function update(stageId, status, desc){
    // status: 'confirmed'|'failed'|'pending'
    _stageStatus[stageId] = status;
    _render();

    // Tüm confirmed mu?
    const all = STAGES_DEF.filter(s=>s.id!=='liq');
    const confirmed = all.filter(s=>_stageStatus[s.id]==='confirmed');
    const failed    = all.filter(s=>_stageStatus[s.id]==='failed');

    if(confirmed.length>=6&&failed.length===0){
      _fireHighConfidence();
    }
  }

  function _fireHighConfidence(){
    if(!window.NC) return;
    NC.add({
      sym:_sym, dir:'entry', level:'critical',
      msg:`🎯 HIGH CONFIDENCE ENTRY — ${_sym.replace('USDT','')} için tüm giriş koşulları karşılandı! Entry bölgesi oluştu.`
    });
  }

  function _render(){
    const container = document.getElementById('ece2Stages');
    if(!container) return;
    container.innerHTML = '';
    STAGES_DEF.forEach(s=>{
      const st = _stageStatus[s.id]||'pending';
      const colors = {confirmed:'var(--green)',failed:'var(--red)',pending:'var(--text3)'};
      const icons  = {confirmed:'✓',failed:'✗',pending:'○'};
      const d = document.createElement('div');
      d.style.cssText=`display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:7px;background:rgba(0,0,0,.2);border:1px solid ${st==='confirmed'?'rgba(0,229,160,.2)':st==='failed'?'rgba(255,61,107,.2)':'rgba(255,255,255,.05)'};margin-bottom:5px;transition:all .3s;`;
      d.innerHTML=`<span style="font-size:14px">${s.icon}</span><span style="font-size:11px;font-weight:600;color:var(--text2);flex:1">${s.name}</span><span style="font-size:12px;font-weight:800;color:${colors[st]}">${icons[st]}</span>`;
      container.appendChild(d);
    });
  }

  // Coin verisi gelince otomatik değerlendir
  function evaluate(params){
    const{closes,candles,ind,entry,oiData,btcData,wsData,fakeBreak}=params;
    if(!entry) return;
    const isLong = entry.dir==='LONG';
    const price  = closes[closes.length-1];
    const bb     = ind.bb;

    // Kırılım
    const bbBreak = bb&&(isLong?price>bb.upper:price<bb.lower);
    update('breakout', bbBreak?'confirmed':'pending');

    // Mum kapanışı — son mum kapalı mı
    const lastCandle = candles[candles.length-1];
    const isClosedCandle = wsData&&wsData.kline?wsData.kline.closed:true;
    update('candle', isClosedCandle?'confirmed':'pending');

    // Hacim
    const vols=candles.slice(-8).map(c=>c.v);
    const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/7;
    const volOk=vols[vols.length-1]>avgV*1.3;
    update('volume', volOk?'confirmed':'pending');

    // BTC
    if(btcData){
      const btcOk=isLong?btcData.chg>-1:btcData.chg<1;
      update('btc', btcOk?'confirmed':'failed');
    }

    // Funding
    if(oiData&&oiData.fund!==null){
      const fundOk=isLong?oiData.fund<0.08:oiData.fund>-0.08;
      update('funding', fundOk?'confirmed':'failed');
    }

    // Order book
    if(wsData&&wsData.obImbalance!==undefined){
      const obOk=isLong?wsData.obImbalance>0.5:wsData.obImbalance<0.5;
      update('orderbook', obOk?'confirmed':'pending');
    }

    // Likidasyon tuzağı
    update('liq', fakeBreak?'failed':'confirmed');

    // Retest — fiyat entry bölgesine yakın mı
    if(entry.entry){
      const dist=Math.abs(price-entry.entry)/entry.entry*100;
      update('retest', dist<0.5?'confirmed':dist<2?'pending':'failed');
    }
  }

  return{reset, update, evaluate};
})();

// ── AI REASONING PANELİ HTML ──────────────────────────────────────────
function renderAIReasoning(data){
  const el = document.getElementById('aiReasoningPanel');
  if(!el||!data) return;
  const{decision,confidence,confirms,conflicts,rejects,summary}=data;

  const decColors = {
    STRONG_LONG:'var(--green)',LONG:'var(--green)',WEAK_LONG:'rgba(0,229,160,.6)',
    WAIT:'var(--yellow)',
    WEAK_SHORT:'rgba(255,61,107,.6)',SHORT:'var(--red)',STRONG_SHORT:'var(--red)',
    REJECTED:'var(--red)',
  };
  const col = decColors[decision]||'var(--text2)';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:13px;font-weight:800;color:${col}">${decision.replace('_',' ')}</span>
      <span style="font-size:10px;background:${col}18;border:1px solid ${col}44;color:${col};padding:2px 8px;border-radius:10px;font-weight:700">%${confidence}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
      ${confirms.slice(0,4).map(c=>`<div style="font-size:10px;color:var(--green)">✓ ${c}</div>`).join('')}
      ${conflicts.slice(0,3).map(c=>`<div style="font-size:10px;color:var(--orange)">⚠ ${c}</div>`).join('')}
      ${rejects.slice(0,2).map(r=>`<div style="font-size:10px;color:var(--red)">✗ ${r}</div>`).join('')}
    </div>
    <div style="font-size:10px;color:var(--text3);border-top:1px solid rgba(255,255,255,.06);padding-top:6px">
      ${summary.map(s=>`<div>${s}</div>`).join('')}
    </div>
  `;
}

// ── WS STATUS + REASONING HTML EKLE ──────────────────────────────────
// updateUI hook — WS + Reasoning entegre
const _origUI_Phase1 = typeof updateUI === 'function' ? updateUI : null;
if(_origUI_Phase1){
  window.updateUI = async function(tk, candles, fund, ls){
    _origUI_Phase1(tk, candles, fund, ls);
    setTimeout(async ()=>{
      try{
        if(!window.IND||!window.KL||!window.SYM) return;
        const sym    = window.SYM;
        const closes = window.KL.map(c=>c.c);
        const ind    = window.IND;
        const ent    = calcEntry(window.KL, ind, tk);
        const wsData = WSEngine.getData(sym);
        const btcData= typeof MarketRegime!=='undefined'?MarketRegime.getBTC():null;
        const rMode  = typeof MarketRegime!=='undefined'?MarketRegime.getMode():null;

        // OI/Fund
        let oiData = null;
        try{
          const [oiR, frR] = await Promise.allSettled([
            fetch(`${window.FBASE||'https://fapi.binance.com'}/fapi/v1/openInterest?symbol=${sym}`).then(r=>r.json()),
            fetch(`${window.FBASE||'https://fapi.binance.com'}/fapi/v1/fundingRate?symbol=${sym}&limit=2`).then(r=>r.json()),
          ]);
          const oi = oiR.status==='fulfilled'?oiR.value:null;
          const fr = frR.status==='fulfilled'?frR.value:null;
          let oiChange = null;
          try{
            // openInterestHist kaldırıldı (CORS)
          }catch(e){}
          oiData = {
            oi    : oi?+oi.openInterest:null,
            fund  : fr&&Array.isArray(fr)&&fr.length?+fr[fr.length-1].fundingRate*100:null,
            oiChange,
          };
        }catch(e){}

        // Fake breakout
        const vols=window.KL.slice(-5).map(c=>c.v);
        const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/4;
        const lc=window.KL[window.KL.length-1];
        const fake=ind.bb&&(+tk.lastPrice>ind.bb.upper||+tk.lastPrice<ind.bb.lower)&&lc.v<avgV*0.8;

        const smcData = window._lastSMCData||null;

        // AI Reasoning
        if(ent){
          const reasoning = AIReasoning.buildReasoning({
            sym, dir:ent.dir, closes, candles:window.KL,
            ind, entry:ent, oiData, btcData, wsData,
            regimeMode:rMode, smcData, fakeBreak:fake, conf:Math.round(calcConf(ind,tk)),
          });
          renderAIReasoning(reasoning);

          // ECE 2.0
          ECE2.evaluate({closes, candles:window.KL, ind, entry:ent, oiData, btcData, wsData, fakeBreak:fake});

          // ── PHASE 3: Ağırlıklı AI Karar Motoru ──
          AIDecisionEngine.evaluate({
            closes, candles:window.KL, ind, entry:ent,
            oiData, btcData, wsData,
            regimeMode:rMode, smcData,
            fakeBreak: fake,
            sym,
          });

          // ── PHASE 10: Elite Priority Engine & Market Narrative ──
          P10.onCoinUpdate({
            sym, dir:ent.dir, closes, candles:window.KL,
            ind, entry:ent, oiData, btcData,
            regimeMode:rMode, smcData, fakeBreak:fake,
          }, wsData);
        } else {
          // Entry yok ama narrative yine de çalışsın
          P10.onCoinUpdate({
            sym, dir:'LONG', closes, candles:window.KL,
            ind, entry:null, oiData, btcData,
            regimeMode:rMode, smcData, fakeBreak:fake,
          }, wsData);
        }

        // WS'yi başlat / güncelle
        WSEngine.subscribe(sym, (wsD)=>{
          // Canlı fiyat zaten _updateLivePrice ile güncelleniyor
        });

      }catch(e){ console.warn('Phase1 hata:', e); }
    }, 600);
  };
}

// loadCoin sonrası WS subscribe
const _origLoadCoin_WS = typeof loadCoin === 'function' ? loadCoin : null;


// ════════════════════════════════════════════════════════════════════
// AŞAMA 2: SMC PRO + FAKE BREAKOUT DETECTOR + RISK ENGINE PRO
// ════════════════════════════════════════════════════════════════════

// ── 1. FAKE BREAKOUT DETECTOR PRO ────────────────────────────────────
const FBDetector = (() => {

  function analyze(closes, candles, ind, wsData, oiData, btcData){
    const signals  = [];
    const price    = closes[closes.length-1];
    const bb       = ind.bb;
    const atr      = ind.atr;
    let   riskScore= 0;

    // ── Hacimsiz kırılım ──
    const vols  = candles.slice(-8).map(c=>c.v);
    const avgV  = vols.slice(0,-1).reduce((a,b)=>a+b,0)/7;
    const lastV = candles[candles.length-1].v;
    const volR  = lastV/avgV;
    if(bb&&(price>bb.upper||price<bb.lower)&&volR<0.8){
      signals.push({type:'Hacimsiz Breakout', risk:30, col:'var(--orange)',
        desc:`Hacim ortalamanın ${(volR*100).toFixed(0)}%'inde — breakout güvenilmez`});
      riskScore += 30;
    }

    // ── Wick manipülasyonu ──
    const lastC  = candles[candles.length-1];
    const body   = Math.abs(lastC.c-lastC.o);
    const total  = lastC.h-lastC.l;
    const wickR  = total>0 ? body/total : 1;
    if(wickR<0.25&&total>atr*0.8){
      signals.push({type:'Wick Manipülasyonu', risk:25, col:'var(--orange)',
        desc:`Mum gövdesi total aralığın %${(wickR*100).toFixed(0)}'i — wick tuzağı riski`});
      riskScore += 25;
    }

    // ── Trapped Longs/Shorts ──
    const prevHigh = Math.max(...candles.slice(-10,-1).map(c=>c.h));
    const prevLow  = Math.min(...candles.slice(-10,-1).map(c=>c.l));
    if(price>prevHigh&&lastC.c<prevHigh){
      signals.push({type:'Trapped Longs', risk:20, col:'var(--red)',
        desc:'Fiyat önceki yüksek üstüne çıkıp geri kapandı — longlar sıkıştı'});
      riskScore += 20;
    }
    if(price<prevLow&&lastC.c>prevLow){
      signals.push({type:'Trapped Shorts', risk:20, col:'var(--green)',
        desc:'Fiyat önceki düşük altına indi, geri kapandı — shortlar sıkıştı'});
      riskScore += 20;
    }

    // ── Funding Trap ──
    if(oiData&&oiData.fund!==null){
      if(Math.abs(oiData.fund)>0.1){
        signals.push({type:'Funding Tuzağı', risk:20, col:'var(--orange)',
          desc:`Funding %${oiData.fund.toFixed(3)} — ${oiData.fund>0?'aşırı long':'aşırı short'} kalabalık`});
        riskScore += 20;
      }
    }

    // ── OI Uyumsuzluğu ──
    if(oiData&&oiData.oiChange!==null){
      const oiC = +oiData.oiChange;
      const priceUp = closes[closes.length-1]>closes[closes.length-5];
      if(priceUp&&oiC<-2){
        signals.push({type:'OI Uyumsuzluğu', risk:15, col:'var(--orange)',
          desc:`Fiyat yükselirken OI düşüyor (%${oiC.toFixed(1)}) — gerçek alım değil`});
        riskScore += 15;
      }
    }

    // ── BTC Ters Yön ──
    if(btcData&&Math.abs(btcData.chg)>2){
      const btcUp   = btcData.chg>0;
      const coinUp  = closes[closes.length-1]>closes[closes.length-4];
      if(btcUp!==coinUp){
        signals.push({type:'BTC Uyumsuzluğu', risk:15, col:'var(--orange)',
          desc:`BTC ${btcData.chg>0?'yükseliyor':'düşüyor'} ama coin ters yönde — manipülasyon riski`});
        riskScore += 15;
      }
    }

    // ── WS: Aggressive Order Imbalance ──
    if(wsData&&wsData.obImbalance!==undefined){
      const obi = wsData.obImbalance;
      if(price>prevHigh&&obi<0.35){
        signals.push({type:'Order Book Uyumsuz', risk:10, col:'var(--yellow)',
          desc:'Breakout yukarı ama order book satış ağırlıklı'});
        riskScore += 10;
      }
    }

    riskScore = Math.min(100, riskScore);
    const isFake = riskScore >= 40;

    // UI Güncelle
    _render(riskScore, signals, isFake);

    return {isFake, riskScore, signals};
  }

  function _render(score, signals, isFake){
    const scoreEl  = document.getElementById('fbRiskScore');
    const barEl    = document.getElementById('fbRiskBar');
    const subEl    = document.getElementById('fbRiskSub');
    const typeEl   = document.getElementById('fbTypeVal');
    const typeSub  = document.getElementById('fbTypeSub');
    const tagsEl   = document.getElementById('fbSignalTags');
    const warnEl   = document.getElementById('fbWarningBanner');
    const warnTxt  = document.getElementById('fbWarningText');

    const col = score>=60?'var(--red)':score>=30?'var(--orange)':'var(--green)';
    const barCls = score>=60?'fb-high':score>=30?'fb-med':'fb-low';
    const lbl = score>=60?'YÜKSEK RİSK':score>=30?'ORTA RİSK':'DÜŞÜK RİSK';

    if(scoreEl){scoreEl.textContent=score+'/100';scoreEl.style.color=col;}
    if(barEl){barEl.style.width=score+'%';barEl.className='fb-fill '+barCls;}
    if(subEl) subEl.textContent=lbl;
    if(typeEl){typeEl.textContent=isFake?'⚠ Fake Risk Var':'✓ Gerçek Hareket';typeEl.style.color=isFake?col:'var(--green)';}
    if(typeSub) typeSub.textContent=signals.length?signals[0].desc:'Belirgin risk sinyali yok';

    if(tagsEl){
      tagsEl.innerHTML='';
      signals.forEach(s=>{
        const t=document.createElement('span');
        t.style.cssText=`font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:${s.col}18;border:1px solid ${s.col}44;color:${s.col}`;
        t.textContent=s.type;
        tagsEl.appendChild(t);
      });
    }

    if(warnEl&&warnTxt){
      if(isFake){
        warnEl.style.display='block';
        warnTxt.textContent=signals.slice(0,2).map(s=>s.desc).join(' · ');
      } else {
        warnEl.style.display='none';
      }
    }
  }

  return{analyze};
})();

// ── 2. SMC PRO RENDERER ───────────────────────────────────────────────
const SMCPro = (() => {

  function render(params){
    const{sym,closes,candles,ind,entry,wsData,oiData,btcData}=params;
    const price=closes[closes.length-1];
    const sn=sym.replace('USDT','');

    // SMC temel analiz (mevcut SMC'den al)
    let eqLevels={equalHighs:[],equalLows:[]};
    let sweeps=[];
    let obs=[];
    let fvgs=[];
    let ms={trend:'neutral',pts:[],events:[]};
    let displacement=[];

    try{
      if(window.SMC){
        eqLevels    = SMC.detectEqualLevels(candles);
        sweeps      = SMC.detectLiquiditySweep(candles);
        obs         = SMC.detectOrderBlocks(candles);
        fvgs        = SMC.detectFVG(candles);
        ms          = SMC.analyzeMS(candles);
        displacement= SMC.detectDisplacement(candles);
      }
    }catch(e){}

    // ── Market Structure ──
    const trendTr = ms.trend==='bullish'?'📈 Yükseliş':ms.trend==='bearish'?'📉 Düşüş':'↔ Nötr';
    const trendCol= ms.trend==='bullish'?'var(--green)':ms.trend==='bearish'?'var(--red)':'var(--text2)';
    const tEl = document.getElementById('smcProTrend');
    if(tEl){tEl.textContent=trendTr;tEl.style.color=trendCol;}

    const tagsEl = document.getElementById('smcProStructTags');
    if(tagsEl){
      tagsEl.innerHTML='';
      ms.pts.slice(-5).forEach(p=>{
        const col=p.type==='HH'||p.type==='HL'?'var(--green)':'var(--red)';
        const t=document.createElement('span');
        t.className='smc-struct-badge';
        t.style.cssText=`background:${col}15;border:1px solid ${col}35;color:${col}`;
        t.textContent=p.type;
        tagsEl.appendChild(t);
      });
    }

    // Son olay
    const evEl  = document.getElementById('smcProEvent');
    const evSub = document.getElementById('smcProEventSub');
    if(ms.events.length&&evEl){
      const ev=ms.events[ms.events.length-1];
      const ec=ev.dir==='bullish'?'var(--green)':'var(--red)';
      evEl.textContent=ev.type;evEl.style.color=ec;
      if(evSub) evSub.textContent=ev.type==='CHOCH'?'Trend değişim sinyali':'Yapı kırılımı teyit edildi';
    } else if(evEl){evEl.textContent='—';if(evSub)evSub.textContent='Henüz olay yok';}

    // ── Equal Levels ──
    const eqEl  = document.getElementById('smcProEqLevels');
    const eqSub = document.getElementById('smcProEqSub');
    const totalEq = eqLevels.equalHighs.length+eqLevels.equalLows.length;
    if(eqEl){
      eqEl.textContent=totalEq>0?totalEq+' Seviye':'Yok';
      eqEl.style.color=totalEq>0?'var(--orange)':'var(--green)';
    }
    if(eqSub){
      const parts=[];
      if(eqLevels.equalHighs.length) parts.push(`${eqLevels.equalHighs.length} Equal High`);
      if(eqLevels.equalLows.length)  parts.push(`${eqLevels.equalLows.length} Equal Low`);
      eqSub.textContent=parts.join(' · ')||'Temiz yapı';
    }

    // ── Sweep ──
    const swEl  = document.getElementById('smcProSweep');
    const swSub = document.getElementById('smcProSweepSub');
    const lastSw=sweeps[sweeps.length-1];
    if(swEl){
      swEl.textContent=lastSw?'⚡ '+sweeps.length+' Sweep':'Yok';
      swEl.style.color=lastSw?'var(--orange)':'var(--green)';
    }
    if(swSub) swSub.textContent=lastSw?lastSw.msg:'Son süpürme yok';

    // ── Order Block ──
    const obEl  = document.getElementById('smcProOB');
    const obSub = document.getElementById('smcProOBSub');
    const lastOB=obs[obs.length-1];
    if(obEl){
      obEl.textContent=lastOB?(lastOB.type==='bullish'?'▲ Bullish OB':'▼ Bearish OB'):'—';
      obEl.style.color=lastOB?(lastOB.type==='bullish'?'var(--green)':'var(--red)'):'var(--text3)';
    }
    if(obSub) obSub.textContent=lastOB?lastOB.desc:'Kurumsal bölge yok';

    // ── FVG ──
    const fvgEl  = document.getElementById('smcProFVG');
    const fvgSub = document.getElementById('smcProFVGSub');
    const activeFvg=fvgs.filter(f=>!f.filled);
    if(fvgEl){
      fvgEl.textContent=activeFvg.length?activeFvg.length+' Açık FVG':'Temiz';
      fvgEl.style.color=activeFvg.length?'var(--yellow)':'var(--green)';
    }
    if(fvgSub) fvgSub.textContent=activeFvg.length?`${activeFvg[0].type==='bullish'?'Bullish':'Bearish'} imbalance mevcut`:'Boşluk yok';

    // ── Yorum ──
    const comEl = document.getElementById('smcProComment');
    if(comEl){
      const parts=[];
      if(ms.trend==='bullish') parts.push(`<b>${sn}</b> yükseliş yapısında.`);
      else if(ms.trend==='bearish') parts.push(`<b>${sn}</b> düşüş yapısında.`);
      if(lastSw) parts.push(`Likidite sweep: ${lastSw.msg}.`);
      if(lastOB) parts.push(`${lastOB.type==='bullish'?'Kurumsal alım':'Kurumsal satış'} bölgesi tespit edildi.`);
      if(eqLevels.equalHighs.length) parts.push(`Equal highs: buy-side likidite tuzağı riski.`);
      if(displacement.length) parts.push(`Displacement hareketi — kurumsal giriş işareti.`);
      if(ms.events.length) parts.push(`${ms.events[ms.events.length-1].type} oluştu — dikkat.`);
      if(parts.length){
        comEl.style.display='block';
        comEl.innerHTML=parts.join(' ');
      }
    }

    // ── Whale detector ──
    _checkWhale(sym, candles, wsData, oiData);

    // SMC cache güncelle
    window._lastSMCData = {
      quality    : (sweeps.length?20:0)+(obs.length?20:0)+(fvgs.length?15:0)+(displacement.length?25:0)+(ms.events.length?20:0),
      sweeps     : sweeps.length>0,
      ob         : obs.length>0,
      fvg        : activeFvg.length>0,
      displacement: displacement.length>0,
      msTrend    : ms.trend,
      choch      : ms.events.some(e=>e.type==='CHOCH'),
      bos        : ms.events.some(e=>e.type==='BOS'),
      eqHighs    : eqLevels.equalHighs.length>0,
      eqLows     : eqLevels.equalLows.length>0,
    };
  }

  function _checkWhale(sym, candles, wsData, oiData){
    const wrapEl = document.getElementById('whaleAlertWrap');
    const txtEl  = document.getElementById('whaleAlertTxt');
    if(!wrapEl||!txtEl) return;

    const alerts=[];

    // Büyük likidasyon
    if(wsData&&wsData.lastLiquidation){
      const liq=wsData.lastLiquidation;
      const age=(Date.now()-liq.ts)/1000;
      if(age<120&&liq.value>200000){
        const val=liq.value>=1e6?(liq.value/1e6).toFixed(1)+'M$':(liq.value/1e3).toFixed(0)+'K$';
        alerts.push(`<b>Büyük Likidasyon:</b> ${val} ${liq.side==='BUY'?'short':'long'} pozisyon tasfiye edildi.`);
      }
    }

    // Hacim spike
    const vols=candles.slice(-10).map(c=>c.v);
    const avgV=vols.slice(0,-1).reduce((a,b)=>a+b,0)/9;
    if(vols[vols.length-1]>avgV*3){
      alerts.push(`<b>Hacim Spike:</b> Son mum ortalama hacmin ${(vols[vols.length-1]/avgV).toFixed(1)}x üstünde — whale hareketi olabilir.`);
    }

    // OI ani değişim
    if(oiData&&oiData.oiChange&&Math.abs(+oiData.oiChange)>5){
      alerts.push(`<b>OI Ani Değişim:</b> Open interest %${(+oiData.oiChange).toFixed(1)} değişti — büyük oyuncu hareketi.`);
    }

    if(alerts.length){
      wrapEl.style.display='block';
      txtEl.innerHTML=alerts[0];
    } else {
      wrapEl.style.display='none';
    }
  }

  return{render};
})();

// ── 3. RISK ENGINE PRO ───────────────────────────────────────────────
const RiskEnginePro = (() => {

  function calculate(params){
    const{closes,candles,ind,entry,regimeMode,conf,wsData,oiData}=params;
    const price  = closes[closes.length-1];
    const atr    = ind.atr||0;
    const atrPct = price>0?(atr/price*100):2;

    // ── Önerilen Kaldıraç ──
    let lev = 5;
    if(atrPct>5)       lev=2;
    else if(atrPct>3)  lev=3;
    else if(atrPct>2)  lev=5;
    else               lev=7;

    // Regime etkisi
    if(regimeMode==='VOLATILE'||regimeMode==='PANIC') lev=Math.min(lev,2);
    if(regimeMode==='TREND'&&conf>=75) lev=Math.min(lev+2,10);
    if(regimeMode==='SQUEEZE') lev=Math.min(lev,3);

    // Funding etkisi
    if(oiData&&oiData.fund&&Math.abs(oiData.fund)>0.08) lev=Math.min(lev,3);

    // WS volatilite
    if(wsData&&wsData.obImbalance!==undefined){
      const obi=wsData.obImbalance;
      if(obi>0.7||obi<0.3) lev=Math.min(lev,4); // Aşırı imbalance
    }

    // ── Risk Yüzdesi ──
    let riskPct = 1;
    if(conf>=80)       riskPct=2;
    else if(conf>=70)  riskPct=1.5;
    else if(conf>=60)  riskPct=1;
    else               riskPct=0.5;
    if(atrPct>4)       riskPct*=0.5;

    // ── Stop Genişliği ──
    const stopPct = Math.max(0.5, Math.min(8, atrPct*1.5));

    // ── Pozisyon Büyüklüğü (örnek 10.000$ portföy) ──
    const portfolio = 10000;
    const riskAmount = portfolio * (riskPct/100);
    const posSize = entry ? (riskAmount/(stopPct/100*price)).toFixed(4) : '—';

    // ── Risk Notu ──
    const grade = lev<=2?'D':lev<=3?'C':lev<=5?'B':lev<=7?'A':'A+';
    const gradeCol = lev<=2?'var(--red)':lev<=3?'var(--orange)':lev<=5?'var(--yellow)':'var(--green)';

    // ── Tavsiye ──
    let advice = '';
    if(atrPct>4)      advice += 'Yüksek volatilite — pozisyon boyutunu küçük tut. ';
    if(lev<=3)        advice += 'Düşük kaldıraç önerilir. ';
    if(conf>=75&&lev>=5) advice += `Güçlü setup: ${lev}x kaldıraç ve %${riskPct} risk ile girilebilir. `;
    else if(conf<60)  advice += 'Güven düşük — giriş için daha fazla teyit bekle. ';
    if(oiData&&oiData.fund&&Math.abs(oiData.fund)>0.08) advice += 'Yüksek funding nedeniyle kaldıraç düşürüldü. ';
    if(regimeMode==='PANIC') advice += 'Panik modu — agresif pozisyon açmaktan kaçın. ';
    if(!advice) advice = `${lev}x kaldıraç ile portföyün %${riskPct}'ini riske at. Stop: %${stopPct.toFixed(1)}.`;

    // ── UI Güncelle ──
    _render({lev,riskPct,stopPct,posSize,atrPct,grade,gradeCol,advice});
    return{lev,riskPct,stopPct,posSize,atrPct,grade};
  }

  function _render(d){
    const $=(id)=>document.getElementById(id);
    const levCol=d.lev<=3?'var(--red)':d.lev<=5?'var(--yellow)':'var(--green)';
    if($('rp-lev')){$('rp-lev').textContent=d.lev+'x';$('rp-lev').style.color=levCol;}
    if($('rp-lev-sub'))$('rp-lev-sub').textContent='maks önerilen';
    if($('rp-risk'))$('rp-risk').textContent=d.riskPct+'%';
    if($('rp-stop'))$('rp-stop').textContent=d.stopPct.toFixed(1)+'%';
    if($('rp-pos'))$('rp-pos').textContent=d.posSize!=='—'?d.posSize+' adet':d.posSize;
    if($('rp-vol')){$('rp-vol').textContent=d.atrPct.toFixed(2)+'%';$('rp-vol').style.color=d.atrPct>4?'var(--red)':d.atrPct>2?'var(--yellow)':'var(--green)';}
    if($('rp-grade')){$('rp-grade').textContent=d.grade;$('rp-grade').style.color=d.gradeCol;}
    if($('rp-grade-sub'))$('rp-grade-sub').textContent='risk notu';
    if($('rp-advice'))$('rp-advice').textContent=d.advice;
    if($('rp-lev-bar')){$('rp-lev-bar').style.width=(d.lev/10*100)+'%';$('rp-lev-bar').style.background=levCol;}
    if($('rp-lev-pct'))$('rp-lev-pct').textContent=d.lev+'x';
  }

  return{calculate};
})();

// ── updateUI hook — Phase 2 entegre ──────────────────────────────────
const _origUI_Phase2 = typeof updateUI === 'function' ? updateUI : null;
if(_origUI_Phase2){
  window.updateUI = async function(tk, candles, fund, ls){
    _origUI_Phase2(tk, candles, fund, ls);
    setTimeout(async ()=>{
      try{
        if(!window.IND||!window.KL||!window.SYM) return;
        const sym    = window.SYM;
        const closes = window.KL.map(c=>c.c);
        const ind    = window.IND;
        const ent    = calcEntry(window.KL, ind, tk);
        const wsData = typeof WSEngine!=='undefined'?WSEngine.getData(sym):{};
        const btcData= typeof MarketRegime!=='undefined'?MarketRegime.getBTC():null;
        const rMode  = typeof MarketRegime!=='undefined'?MarketRegime.getMode():null;
        const conf   = Math.round(calcConf(ind,tk));

        // OI/Fund
        let oiData=null;
        try{
          const[oiR,frR]=await Promise.allSettled([
            fetch(`${FBASE}/fapi/v1/openInterest?symbol=${sym}`).then(r=>r.json()),
            fetch(`${FBASE}/fapi/v1/fundingRate?symbol=${sym}&limit=2`).then(r=>r.json()),
          ]);
          const oi=oiR.status==='fulfilled'?oiR.value:null;
          const fr=frR.status==='fulfilled'?frR.value:null;
          let oiChange=null;
          try{
            // openInterestHist kaldırıldı (CORS)
          }catch(e){}
          oiData={oi:oi?+oi.openInterest:null,fund:fr&&Array.isArray(fr)&&fr.length?+fr[fr.length-1].fundingRate*100:null,oiChange};
        }catch(e){}

        // 1. Fake Breakout
        const fbResult = FBDetector.analyze(closes, window.KL, ind, wsData, oiData, btcData);

        // 2. SMC Pro
        SMCPro.render({sym, closes, candles:window.KL, ind, entry:ent, wsData, oiData, btcData});

        // 3. Risk Engine Pro
        RiskEnginePro.calculate({
          closes, candles:window.KL, ind, entry:ent,
          regimeMode:rMode, conf, wsData, oiData
        });

        // NC bildirim — yüksek fake breakout riski
        if(fbResult.isFake&&fbResult.riskScore>=60&&window.NC){
          NC.add({sym, dir:'fake', level:'high',
            msg:`${sym.replace('USDT','')} FAKE BREAKOUT RİSKİ YÜKSEK (%${fbResult.riskScore}/100) — ${fbResult.signals.slice(0,2).map(s=>s.type).join(', ')}. Giriş yapmadan önce teyit bekle.`
          });
        }

      }catch(e){ console.warn('Phase2 hata:', e); }
    }, 1000);
  };
}


// ════════════════════════════════════════════════════════════════════
// AŞAMA 3: MOBİL UI + PERFORMANS + PREMİUM HİS
// ════════════════════════════════════════════════════════════════════

// ── 1. ALT NAVİGASYON ────────────────────────────────────────────────
const sections = {
  home   : ['#marketSection','#scanSection','#mainPanel'],
  scan   : ['#scanSection','#longSection','#shortSection','#jokerSection'],
  signals: ['#sigCardPanel','#phase1Section'],
  ai     : ['#aiPanel','#smcProCard','#riskEngineProCard','#fbDetectorCard'],
};

function bnNav(tab){
  // Tüm tab'ları pasif yap
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  const btn = document.getElementById('bn-'+tab);
  if(btn) btn.classList.add('active');

  // Mobilde ilgili bölüme scroll et
  if(window.innerWidth>768) return; // Desktop'ta yok say

  const targets = {
    home   : document.getElementById('marketSection')||document.querySelector('.market-overview'),
    scan   : document.getElementById('scanSection')||document.querySelector('.scan-card'),
    signals: document.getElementById('sigCardPanel'),
    ai     : document.getElementById('aiPanel'),
  };
  const el = targets[tab];
  if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
}

// ── 2. SWIPE PANEL ───────────────────────────────────────────────────
function openSwipePanel(){
  const panel   = document.getElementById('swipePanel');
  const overlay = document.getElementById('swipeOverlay');
  if(panel)   panel.classList.add('open');
  if(overlay) overlay.style.display='block';
  // FAB animasyon
  const fab=document.getElementById('fabBtn');
  if(fab) fab.classList.add('scanning');
  // Scan sonuçlarını güncelle
  updateSwipeScanList();
}

function closeSwipePanel(){
  const panel   = document.getElementById('swipePanel');
  const overlay = document.getElementById('swipeOverlay');
  if(panel)   panel.classList.remove('open');
  if(overlay) overlay.style.display='none';
  const fab=document.getElementById('fabBtn');
  if(fab) fab.classList.remove('scanning');
}

function quickCoin(sym){
  // Chip'leri güncelle
  document.querySelectorAll('.qc-chip').forEach(c=>c.classList.remove('active','short-active'));
  const chip = [...document.querySelectorAll('.qc-chip')].find(c=>c.textContent===sym.replace('USDT',''));
  if(chip) chip.classList.add('active');
  // Coini yükle
  window.SYM=sym;
  const inp=document.getElementById('symInput');
  if(inp) inp.value=sym;
  if(typeof loadCoin==='function') loadCoin(sym, window.INTV||'15m');
  closeSwipePanel();
  // Analiz paneline scroll
  setTimeout(()=>{
    const el=document.getElementById('mainPanel');
    if(el) el.scrollIntoView({behavior:'smooth'});
  }, 400);
}

function swipeSearch(val){
  const sym = val.trim().toUpperCase();
  if(!sym) return;
  // Chip'leri filtrele
  document.querySelectorAll('.qc-chip').forEach(c=>{
    const show = !sym || c.textContent.startsWith(sym);
    c.style.display = show?'':'none';
  });
}

function updateSwipeScanList(){
  const el = document.getElementById('swipeScanList');
  if(!el) return;
  // Son tarama sonuçlarını al (scanMarket'ten)
  const longGrid  = document.getElementById('longGrid');
  const shortGrid = document.getElementById('shortGrid');
  if(!longGrid||!shortGrid){ el.innerHTML='<span style="color:var(--text3)">Tarama çalıştır...</span>'; return; }
  const longs  = [...longGrid.querySelectorAll('.opp-sym')].slice(0,3).map(e=>e.textContent);
  const shorts = [...shortGrid.querySelectorAll('.opp-sym')].slice(0,3).map(e=>e.textContent);
  if(!longs.length&&!shorts.length){ el.innerHTML='<span style="color:var(--text3)">Tarama bekleniyor...</span>'; return; }

  let html='';
  longs.forEach(sym=>{
    const s=sym.replace(/[^A-Z]/g,'')+'USDT';
    html+=`<div onclick="quickCoin('${s}');closeSwipePanel()" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(0,229,160,.06);border:1px solid rgba(0,229,160,.15);margin-bottom:5px;cursor:pointer;">
      <span style="font-size:11px;font-weight:700;color:var(--green)">▲ LONG</span>
      <span style="font-size:13px;font-weight:800;color:var(--text)">${sym}</span>
    </div>`;
  });
  shorts.forEach(sym=>{
    const s=sym.replace(/[^A-Z]/g,'')+'USDT';
    html+=`<div onclick="quickCoin('${s}');closeSwipePanel()" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:rgba(255,61,107,.06);border:1px solid rgba(255,61,107,.15);margin-bottom:5px;cursor:pointer;">
      <span style="font-size:11px;font-weight:700;color:var(--red)">▼ SHORT</span>
      <span style="font-size:13px;font-weight:800;color:var(--text)">${sym}</span>
    </div>`;
  });
  el.innerHTML=html||'<span style="color:var(--text3)">Sinyal bulunamadı</span>';
}

// ── 3. SECTION REVEAL OBSERVER ───────────────────────────────────────
function initReveal(){
  if(!('IntersectionObserver' in window)) return;
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, {threshold:0.05});
  document.querySelectorAll('.glass-card,.opp,.signal-card').forEach(el=>{
    el.classList.add('section-reveal');
    obs.observe(el);
  });
}

// ── 4. BOTTOM NAV BADGE GÜNCELLE ─────────────────────────────────────
function updateBnBadges(){
  // Scan badge
  const longCards  = document.querySelectorAll('#longGrid .opp').length;
  const shortCards = document.querySelectorAll('#shortGrid .opp').length;
  const scanBadge  = document.getElementById('bnScanBadge');
  if(scanBadge){
    const total=longCards+shortCards;
    if(total>0){scanBadge.textContent=total;scanBadge.classList.add('show');}
    else{scanBadge.classList.remove('show');}
  }
  // Signal badge
  const sigCards=document.querySelectorAll('#scContainer .signal-card').length;
  const sigBadge=document.getElementById('bnSigBadge');
  if(sigBadge){
    if(sigCards>0){sigBadge.textContent=sigCards;sigBadge.classList.add('show');}
    else{sigBadge.classList.remove('show');}
  }
  // Notif badge — NC'den al
  const ncBadge=document.getElementById('ncBadge');
  const bnNotif=document.getElementById('bnNotifBadge');
  if(bnNotif&&ncBadge){
    const cnt=ncBadge.textContent;
    if(ncBadge.classList.contains('show')){bnNotif.textContent=cnt;bnNotif.classList.add('show');}
    else{bnNotif.classList.remove('show');}
  }
}

// ── 5. PERFORMANS OPTİMİZASYONU ─────────────────────────────────────
// Animasyonları düşük güçlü cihazlarda devre dışı bırak
function checkPerf(){
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowEnd = navigator.hardwareConcurrency<=4||navigator.deviceMemory<=2;
  if(isMobile&&isLowEnd){
    const style=document.createElement('style');
    style.textContent=`
      .blob{display:none!important;}
      .ticker-track{animation-duration:60s!important;}
      *{transition-duration:.1s!important;}
      @keyframes skelLoad{0%,100%{opacity:.5}50%{opacity:.8}}
    `;
    document.head.appendChild(style);
  }
}

// ── 6. SWIPE GESTURE (Swipe panel için) ───────────────────────────────
let _touchStartY=0;
document.addEventListener('touchstart', e=>{
  _touchStartY=e.touches[0].clientY;
}, {passive:true});
document.addEventListener('touchend', e=>{
  const dy=e.changedTouches[0].clientY-_touchStartY;
  // Yukarı swipe → swipe panel aç (mobilde, alt 1/3'te)
  if(dy<-80&&e.changedTouches[0].clientY>window.innerHeight*0.7&&window.innerWidth<=768){
    openSwipePanel();
  }
  // Aşağı swipe → kapat
  if(dy>80){closeSwipePanel();}
}, {passive:true});

// ── 7. PREMIUM LOADING ───────────────────────────────────────────────
function showAdvLoader(){
  // Eğer login ekranı yoksa veya giriş yapıldıysa advanced loader göster
  const loginScreen=document.getElementById('loginScreen');
  if(loginScreen&&loginScreen.style.display!=='none') return;

  const msgs=['Veri motorları başlatılıyor...','WebSocket bağlanıyor...','AI modeller yükleniyor...','Piyasa analizi başlıyor...'];
  const loader=document.getElementById('advLoader');
  const fill=document.getElementById('advLoaderFill');
  const txt=document.getElementById('advLoaderTxt');
  if(!loader||!fill) return;

  let i=0;
  const intv=setInterval(()=>{
    if(fill) fill.style.width=((i+1)/msgs.length*100)+'%';
    if(txt) txt.textContent=msgs[i]||'';
    i++;
    if(i>=msgs.length){
      clearInterval(intv);
      setTimeout(()=>{
        loader.classList.add('hide');
        setTimeout(()=>loader.remove(),500);
      },400);
    }
  },400);
}

// Advanced Loader HTML oluştur
(function createAdvLoader(){
  const d=document.createElement('div');
  d.id='advLoader';
  d.innerHTML=`
    <div class="adv-loader-logo">◈</div>
    <div class="adv-loader-title">AI ANALYST PRO</div>
    <div class="adv-loader-sub">VD · Volatility Decoded</div>
    <div class="adv-loader-bar"><div class="adv-loader-fill" id="advLoaderFill"></div></div>
    <div class="adv-loader-txt" id="advLoaderTxt">Başlatılıyor...</div>
  `;
  d.style.cssText='position:fixed;inset:0;z-index:99997;background:#02070e;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,sans-serif;transition:opacity .5s ease;';
  document.body.appendChild(d);
  // Login ekranı yoksa göster
  setTimeout(()=>{
    const login=document.getElementById('loginScreen');
    if(!login||login.style.display==='none') showAdvLoader();
    else{d.remove();}
  },100);
})();

// ── 8. INIT ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded',()=>{
  checkPerf();
  setTimeout(initReveal, 1000);
  setInterval(updateBnBadges, 3000);
});

// Scan tamamlanınca badge güncelle
const _origScanComplete = typeof scanMarket === 'function' ? scanMarket : null;

// ── 2. ONBOARDING ────────────────────────────────────────────────────
const Onboarding = (() => {
  const OB_KEY = 'vd_onboarded_v1';
  let _step = 1;
  const TOTAL = 4;

  function init(){
    const done = localStorage.getItem(OB_KEY);
    if(done) return;
    // Login ekranı kapanınca göster
    setTimeout(()=>{
      const login=document.getElementById('loginScreen');
      if(!login||login.style.display==='none'||login.classList.contains('hiding')){
        show();
      }
    }, 2000);
  }

  function show(){
    const el=document.getElementById('onboardingModal');
    if(el) el.style.display='flex';
  }

  function next(){
    _step++;
    if(_step>TOTAL){ skip(); return; }
    // Adımları güncelle
    for(let i=1;i<=TOTAL;i++){
      const s=document.getElementById('ob-s'+i);
      const d=document.getElementById('ob-d'+i);
      if(s) s.classList.toggle('active', i===_step);
      if(d) d.classList.toggle('active', i===_step);
    }
    const btn=document.getElementById('obNextBtn');
    if(btn) btn.textContent = _step===TOTAL ? 'Başlayalım! →' : 'Devam Et →';
  }

  function skip(){
    localStorage.setItem(OB_KEY, '1');
    const el=document.getElementById('onboardingModal');
    if(el) el.style.display='none';
  }

  return{init, show, next, skip};
})();

// ── 3. BİLDİRİM GRUPLAMA ────────────────────────────────────────────
// ── INIT ──────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(()=>{
    Onboarding.init();
  }, 500);
});


// ════════════════════════════════════════════════════════════════════
// PHASE 7: PERFORMANCE ANALYTICS + TRADE HISTORY ENGINE
// ════════════════════════════════════════════════════════════════════
const Analytics = (() => {
  const HIST_KEY = 'vd_sig_history_v1';
  const MAX_HIST = 300;
  let _history   = [];
  let _activeTab = 'overview';
  let _loaded    = false;

  // ── LocalStorage ──────────────────────────────────────────────────
  function _load(){
    if(_loaded) return;
    try{
      const raw = localStorage.getItem(HIST_KEY);
      if(raw) _history = JSON.parse(raw);
    }catch(e){ _history=[]; }
    _loaded = true;
  }

  function _save(){
    try{ localStorage.setItem(HIST_KEY, JSON.stringify(_history.slice(-MAX_HIST))); }catch(e){}
  }

  // ── Sinyal kaydet ─────────────────────────────────────────────────
  function record(opts){
    _load();
    const sig = {
      id      : Date.now()+'_'+Math.random().toString(36).slice(2,5),
      ts      : Date.now(),
      sym     : opts.sym||'',
      dir     : opts.dir||'',        // LONG|SHORT
      entry   : opts.entry||null,
      stop    : opts.stop||null,
      tp1     : opts.tp1||null,
      tp2     : opts.tp2||null,
      rr      : opts.rr||null,
      conf    : opts.conf||null,
      setup   : opts.setup||'',      // setup türü
      result  : 'pending',           // pending|win|loss
      pnl     : null,
      session : opts.session||_getSession(),
      regime  : opts.regime||null,
    };
    _history.unshift(sig);
    _save();
    _render();
    return sig.id;
  }

  // ── Sonuç güncelle ────────────────────────────────────────────────
  function resolve(id, result, pnl){
    _load();
    const sig = _history.find(s=>s.id===id);
    if(sig){ sig.result=result; sig.pnl=pnl||null; _save(); _render(); }
  }

  // ── Session tespiti ───────────────────────────────────────────────
  function _getSession(){
    const h = new Date().getUTCHours();
    if(h>=0&&h<7)   return 'asia';
    if(h>=7&&h<12)  return 'london';
    if(h>=12&&h<21) return 'ny';
    return 'off';
  }

  // ── İstatistik hesapla ────────────────────────────────────────────
  function calcStats(){
    _load();
    const all     = _history;
    const resolved= all.filter(s=>s.result!=='pending');
    const wins    = all.filter(s=>s.result==='win');
    const losses  = all.filter(s=>s.result==='loss');
    const pending = all.filter(s=>s.result==='pending');

    const total  = all.length;
    const winRate= resolved.length ? Math.round(wins.length/resolved.length*100) : null;

    // Coin bazlı
    const coins = {};
    resolved.forEach(s=>{
      if(!coins[s.sym]) coins[s.sym]={win:0,loss:0,total:0};
      coins[s.sym].total++;
      if(s.result==='win') coins[s.sym].win++;
      else coins[s.sym].loss++;
    });
    Object.values(coins).forEach(c=>{ c.wr=Math.round(c.win/c.total*100); });

    // En iyi coin
    const bestCoin = Object.entries(coins).filter(([,v])=>v.total>=3).sort((a,b)=>b[1].wr-a[1].wr)[0];

    // Session bazlı
    const sessions = {asia:{w:0,t:0},london:{w:0,t:0},ny:{w:0,t:0}};
    resolved.forEach(s=>{
      const sess = sessions[s.session];
      if(sess){ sess.t++; if(s.result==='win') sess.w++; }
    });

    // Setup bazlı
    const setups = {};
    resolved.forEach(s=>{
      if(!s.setup) return;
      if(!setups[s.setup]) setups[s.setup]={win:0,total:0};
      setups[s.setup].total++;
      if(s.result==='win') setups[s.setup].win++;
    });
    const bestSetup = Object.entries(setups).filter(([,v])=>v.total>=2).sort((a,b)=>(b[1].win/b[1].total)-(a[1].win/a[1].total))[0];

    // Ortalama R/R
    const rrVals = all.filter(s=>s.rr).map(s=>+s.rr);
    const avgRR  = rrVals.length ? (rrVals.reduce((a,b)=>a+b,0)/rrVals.length).toFixed(1) : null;

    // Max kazanma serisi
    let maxStreak=0, cur=0;
    [...all].reverse().forEach(s=>{
      if(s.result==='win'){cur++;maxStreak=Math.max(maxStreak,cur);}
      else cur=0;
    });

    return{total,wins:wins.length,losses:losses.length,pending:pending.length,
           winRate,coins,bestCoin,sessions,bestSetup,avgRR,maxStreak};
  }

  // ── UI Render ─────────────────────────────────────────────────────
  function _render(){
    const stats = calcStats();
    _renderOverview(stats);
    _renderCoins(stats);
    _renderHistory();
  }

  function _renderOverview(stats){
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    const wr = stats.winRate;

    // Win Rate gauge
    const gEl = document.getElementById('wrGaugeRing');
    const pEl = document.getElementById('wrGaugePct');
    if(gEl&&wr!==null){
      const col = wr>=60?'var(--green)':wr>=45?'var(--yellow)':'var(--red)';
      const pct = wr;
      gEl.style.background=`conic-gradient(${col} ${pct*3.6}deg, rgba(255,255,255,.06) ${pct*3.6}deg)`;
      gEl.style.borderColor=col+'44';
      if(pEl){pEl.textContent=pct+'%';pEl.style.color=col;}
    } else if(pEl) pEl.textContent='—%';

    // Sub text
    const subEl=document.getElementById('wrGaugeSub');
    if(subEl){
      if(stats.total===0) subEl.textContent='Henüz sinyal yok. Tarama yapın.';
      else subEl.textContent=`${stats.wins} kazanan · ${stats.losses} kaybeden · ${stats.pending} beklemede`;
    }

    // Metrikler
    set('perf-total', stats.total||'—');
    set('perf-win',   stats.wins||'—');
    set('perf-loss',  stats.losses||'—');
    set('perf-pend',  stats.pending||'—');
    set('perf-avgRR', stats.avgRR?'1:'+stats.avgRR:'—');
    set('perf-bestCoin', stats.bestCoin?stats.bestCoin[0].replace('USDT',''):'—');
    set('perf-bestSetup',stats.bestSetup?stats.bestSetup[0]:'—');
    set('perf-streak', stats.maxStreak||'—');

    // Session
    const sessMap={asia:'asia',london:'london',ny:'ny'};
    Object.entries(sessMap).forEach(([key,id])=>{
      const s=stats.sessions[key];
      const wr=s.t?Math.round(s.w/s.t*100):null;
      const col=wr===null?'var(--text3)':wr>=60?'var(--green)':wr>=45?'var(--yellow)':'var(--red)';
      const wrEl=document.getElementById('sess-'+id+'-wr');
      const cntEl=document.getElementById('sess-'+id+'-cnt');
      if(wrEl){wrEl.textContent=wr!==null?wr+'%':'—%';wrEl.style.color=col;}
      if(cntEl) cntEl.textContent=s.t+' sinyal';
    });
  }

  function _renderCoins(stats){
    const el=document.getElementById('coinLeaderboard');
    if(!el) return;
    const sorted=Object.entries(stats.coins).sort((a,b)=>b[1].wr-a[1].wr).slice(0,10);
    if(!sorted.length){ el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:10px 0">Yeterli veri yok...</div>'; return; }
    el.innerHTML='';
    sorted.forEach(([sym,c],i)=>{
      const rankCls=i===0?'gold':i===1?'silver':i===2?'bronze':'';
      const col=c.wr>=60?'var(--green)':c.wr>=45?'var(--yellow)':'var(--red)';
      const d=document.createElement('div');
      d.className='coin-lb-item';
      d.innerHTML=`
        <span class="coin-lb-rank ${rankCls}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</span>
        <span class="coin-lb-sym">${sym.replace('USDT','')}</span>
        <div class="coin-lb-bar-wrap"><div class="coin-lb-bar" style="width:${c.wr}%;background:${col}"></div></div>
        <span class="coin-lb-wr" style="color:${col}">${c.wr}%</span>
        <span class="coin-lb-cnt">${c.total} sinyal</span>
      `;
      el.appendChild(d);
    });
  }

  function _renderHistory(){
    const el=document.getElementById('sigHistList');
    if(!el) return;
    _load();
    if(!_history.length){ el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:10px 0">Henüz sinyal kaydedilmedi.</div>'; return; }
    el.innerHTML='';
    _history.slice(0,50).forEach(s=>{
      const ago=_timeAgo(s.ts);
      const isLong=s.dir==='LONG';
      const resCls=s.result==='win'?'win':s.result==='loss'?'loss':'pend';
      const resLabel=s.result==='win'?'✓ WIN':s.result==='loss'?'✗ LOSS':'⏳ BEKLE';
      const d=document.createElement('div');
      d.className='sig-hist-item '+resCls;
      d.innerHTML=`
        <span class="sig-hist-sym">${s.sym.replace('USDT','')}</span>
        <span class="sig-hist-dir ${isLong?'long':'short'}">${isLong?'▲ L':'▼ S'}</span>
        ${s.rr?`<span class="sig-hist-rr">1:${s.rr}</span>`:''}
        ${s.conf?`<span style="font-size:9px;color:var(--text3)">%${s.conf}</span>`:''}
        <span class="sig-hist-result ${resCls}">${resLabel}</span>
        <span class="sig-hist-time">${ago}</span>
      `;
      el.appendChild(d);
    });
  }

  function _timeAgo(ts){
    const s=Math.floor((Date.now()-ts)/1000);
    if(s<60) return s+'sn';
    if(s<3600) return Math.floor(s/60)+'dk';
    if(s<86400) return Math.floor(s/3600)+'s';
    return Math.floor(s/86400)+'g';
  }

  // ── Tab geçişi ─────────────────────────────────────────────────────
  function tab(name){
    _activeTab=name;
    ['overview','coins','history'].forEach(t=>{
      const btn=document.getElementById('atab-'+t);
      const el =document.getElementById('analytics-'+t);
      if(btn) btn.classList.toggle('active',t===name);
      if(el)  el.style.display=t===name?'block':'none';
    });
    if(name==='coins'||name==='history') _render();
  }

  // ── Geçmişi temizle ────────────────────────────────────────────────
  function clearHistory(){
    if(!confirm('Tüm sinyal geçmişi silinsin mi?')) return;
    _history=[]; _save(); _render();
  }

  // ── Dışarıdan erişim ──────────────────────────────────────────────
  function refresh(){ _load(); _render(); }

  // İlk yüklemede render et
  setTimeout(()=>{ _load(); _render(); }, 1000);

  return{record, resolve, calcStats, tab, clearHistory, refresh};
})();

// ── AI Learning entegrasyonu — sinyalleri Analytics'e de kaydet ──────
const _origAIRecord = typeof AI !== 'undefined' ? AI.record.bind(AI) : null;
if(typeof AI !== 'undefined' && _origAIRecord){
  AI.record = function(opts){
    const id = _origAIRecord(opts);
    // Analytics'e de kaydet
    try{
      Analytics.record({
        sym    : opts.sym||window.SYM||'',
        dir    : opts.dir||'',
        entry  : opts.entry||null,
        stop   : opts.stop||null,
        tp1    : opts.tp1||null,
        rr     : opts.rr||null,
        conf   : opts.conf||null,
        setup  : opts.setup||'',
        regime : opts.regime||null,
      });
    }catch(e){}
    return id;
  };
}

// ── updateUI sonrası Analytics güncelle ──────────────────────────────
const _origUI_Phase7 = typeof updateUI === 'function' ? updateUI : null;
if(_origUI_Phase7){
  window.updateUI = function(tk, candles, fund, ls){
    _origUI_Phase7(tk, candles, fund, ls);
    setTimeout(()=>{ try{ Analytics.refresh(); }catch(e){} }, 2000);
  };
}

// INIT — sadece giriş yapılmışsa çalıştır
// ══════════════════════════════════════════
(function(){
  const _ls = localStorage.getItem('aap_access_v1');
  let _hasAccess = false;
  try{
    const _d = JSON.parse(_ls||'{}');
    _hasAccess = _d.isAdmin || (_d.bitis && Date.now() < _d.bitis);
  }catch(e){}

  if(!_hasAccess) return; // Giriş yapılmamış, bekle

  // Giriş yapılmış — uygulamayı başlat
  buildIv();
  startClock();
  loadCoin(SYM,INTV);
  setTimeout(startScan, 2000);
  updateMarketOverview();
  updateTicker();
  clearInterval(refreshTimer);
  refreshTimer=setInterval(()=>{if(TK)loadCoin(SYM,INTV);},30000);
  clearInterval(scanTimer);
  scanTimer=setInterval(startScan,120000);
  clearInterval(tickerTimer);
  tickerTimer=setInterval(()=>{updateTicker();updateMarketOverview();},20000);

  AI.load();
  renderAI();
  AI.startTracking();
})()

// Notification izni otomatik sor (1 saniye sonra)
setTimeout(()=>{
  if('Notification' in window&&Notification.permission==='granted'){
    notifPerm=true;
    document.getElementById('notifBtn').classList.add('active');
    document.getElementById('notifDot').classList.add('on');
    document.getElementById('notifTxt').textContent='Bildirim Açık 🔔';
  }
},1000);

// ── Ana uygulama başlatıcı (grantAccess tarafından çağrılır) ──
function initApp(isAdmin){
  try{ startClock(); }catch(e){}
  try{ loadCoin(SYM,INTV); }catch(e){}
  setTimeout(()=>{ try{ startScan(); }catch(e){} }, 2000);
}



// ── Window Bindings (onclick bridge) ──
window._AI = AI;
window.AI = AI;
window._LWC = LWC;
window.LWC = LWC;
window._NC = NC;
window.NC = NC;
window._ECE = ECE;
window._SMC = SMC;
window._SCE = SCE;
window.SCE = SCE;
window._WSEngine = WSEngine;
window._AIReasoning = AIReasoning;
window._AIDecisionEngine = AIDecisionEngine;
window._ECE2 = ECE2;
window._FBDetector = FBDetector;
window._SMCPro = SMCPro;
window._RiskEnginePro = RiskEnginePro;
window._Onboarding = Onboarding;
window.Onboarding = Onboarding;
window._Analytics = Analytics;
window.Analytics = Analytics;
window._startClock = startClock;
window.requestNotif = requestNotif;
window._sendNotif = sendNotif;
window._beep = beep;
window._showPopup = showPopup;
window._get = get;
window._getFuturesSymbols = getFuturesSymbols;
window._fetchCoin = fetchCoin;
window._calcEMA = calcEMA;
window._calcRSI = calcRSI;
window._calcMACD = calcMACD;
window._calcBB = calcBB;
window._calcATR = calcATR;
window._calcRisk = calcRisk;
window._drawSpark = drawSpark;
window.updateMarketOverview = updateMarketOverview;
window.updateTicker = updateTicker;
window._scoreLong = scoreLong;
window._scoreShort = scoreShort;
window._jokerScoreLong = jokerScoreLong;
window._jokerScoreShort = jokerScoreShort;
window._oppDesc = oppDesc;
window._calcSR = calcSR;
window._detectPatterns = detectPatterns;
window._calcEntry = calcEntry;
window._calcConf = calcConf;
window._loadTV = loadTV;
window._loadTVFallback = loadTVFallback;
window._setEl = setEl;
window._fmtP = fmtP;
window._fmtM = fmtM;
window._pctDiff = pctDiff;
window.updateUI = updateUI;
window.loadCoin = loadCoin;
window.openCoin = openCoin;
window.doSearch = doSearch;
window.buildIv = buildIv;
window._renderCard = renderCard;
window.startScan = startScan;
window._scanMarket = scanMarket;
window.copyPrompt = copyPrompt;
window.renderAI = renderAI;
window._fetchOIFunding = fetchOIFunding;
window._renderOIFunding = renderOIFunding;
window._calcBTCInfluence = calcBTCInfluence;
window._detectFakeBreakout = detectFakeBreakout;
window._calcAIDecision = calcAIDecision;
window._calcRiskEngine = calcRiskEngine;
window._renderTradeManagement = renderTradeManagement;
window._detectSqueeze = detectSqueeze;
window._renderAIReasoning = renderAIReasoning;
window.bnNav = bnNav;
window.openSwipePanel = openSwipePanel;
window.closeSwipePanel = closeSwipePanel;
window.quickCoin = quickCoin;
window._swipeSearch = swipeSearch;
window._updateSwipeScanList = updateSwipeScanList;
window._initReveal = initReveal;
window._updateBnBadges = updateBnBadges;
window._checkPerf = checkPerf;
window._showAdvLoader = showAdvLoader;
window.initApp = initApp;
window.SYM = typeof SYM !== "undefined" ? SYM : undefined;
window.INTV = typeof INTV !== "undefined" ? INTV : undefined;
window.TK = typeof TK !== "undefined" ? TK : undefined;
window.KL = typeof KL !== "undefined" ? KL : undefined;
window.IND = typeof IND !== "undefined" ? IND : undefined;