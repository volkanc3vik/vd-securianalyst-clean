// ════════════════════════════════════════════════════════════════════
// ORDERFLOW ENGINE — Depth analizi, Walls, Absorption, Spoofing
// ════════════════════════════════════════════════════════════════════
const OrderflowEngine = (() => {

  const _depthHistory = [];
  let   _lastDepth    = null;

  function onDepthUpdate(bids, asks, price) {
    if (!bids?.length || !asks?.length) return;

    const bidVol = bids.slice(0,10).reduce((s,x)=>s+(+x[0])*(+x[1]),0);
    const askVol = asks.slice(0,10).reduce((s,x)=>s+(+x[0])*(+x[1]),0);
    const total  = bidVol + askVol;
    const imbalance = total > 0 ? bidVol / total : 0.5;

    // Duvar tespiti (tek seviyede büyük hacim)
    const bidWalls = bids.slice(0,20).filter(b => +b[1]*+b[0] > total*0.15)
      .map(b => ({ price:+b[0], vol:+b[1]*+b[0], type:'BID' }));
    const askWalls = asks.slice(0,20).filter(a => +a[1]*+a[0] > total*0.15)
      .map(a => ({ price:+a[0], vol:+a[1]*+a[0], type:'ASK' }));

    _lastDepth = { bids, asks, bidVol, askVol, imbalance, bidWalls, askWalls, price, ts:Date.now() };
    _depthHistory.push({ imbalance, bidVol, askVol, ts: Date.now() });
    if (_depthHistory.length > 100) _depthHistory.shift();
  }

  function analyze(wsData) {
    const depth = _lastDepth;
    if (!depth) return {
      imbalance:0.5, obPressure:'NEUTRAL', liquidityWalls:[],
      absorption:false, spoofing:false, aggressivePressure:'NEUTRAL',
      imbalanceScore:50,
    };

    const { bidVol, askVol, imbalance, bidWalls, askWalls } = depth;
    const total = bidVol + askVol;

    // Baskı yönü
    const obPressure = imbalance > 0.65 ? 'GÜÇLÜ_ALIM' :
                       imbalance > 0.55 ? 'HAFİF_ALIM' :
                       imbalance < 0.35 ? 'GÜÇLÜ_SATIŞ' :
                       imbalance < 0.45 ? 'HAFİF_SATIŞ' : 'NÖTR';

    // Duvarlar
    const liquidityWalls = [...bidWalls, ...askWalls]
      .sort((a,b) => b.vol - a.vol)
      .slice(0,5);

    // Absorption tespiti — imbalance hızlı değişiyorsa
    let absorption = false;
    if (_depthHistory.length >= 5) {
      const recent = _depthHistory.slice(-5);
      const changes = recent.map((d,i) => i>0 ? Math.abs(d.imbalance - recent[i-1].imbalance) : 0);
      const avgChange = changes.reduce((a,b)=>a+b,0) / changes.length;
      absorption = avgChange > 0.1; // Hızlı imbalance değişimi = absorption
    }

    // Spoofing tespiti — büyük duvar var ama fiyat o yönde gitmiyor
    let spoofing = false;
    if (liquidityWalls.length > 0 && _depthHistory.length >= 10) {
      const bigWall = liquidityWalls[0];
      const recentImb = _depthHistory.slice(-10);
      const avgImb = recentImb.reduce((s,d)=>s+d.imbalance,0) / recentImb.length;
      // Büyük bid wall ama ortalama imbalance satış yönünde
      if (bigWall.type === 'BID' && avgImb < 0.4) spoofing = true;
      if (bigWall.type === 'ASK' && avgImb > 0.6) spoofing = true;
    }

    // Agresif baskı (WS aggTrade'den)
    let aggressivePressure = 'NEUTRAL';
    if (wsData?.aggressiveBuyRatio !== undefined) {
      const r = wsData.aggressiveBuyRatio;
      aggressivePressure = r > 0.7 ? 'AGRESİF_ALIM' :
                           r > 0.6 ? 'HAFİF_ALIM' :
                           r < 0.3 ? 'AGRESİF_SATIŞ' :
                           r < 0.4 ? 'HAFİF_SATIŞ' : 'NEUTRAL';
    }

    // İmbalance skoru (0-100)
    const imbalanceScore = Math.round(imbalance * 100);

    return {
      imbalance, obPressure, liquidityWalls,
      absorption, spoofing, aggressivePressure,
      imbalanceScore, bidVol, askVol, total,
    };
  }

  function renderUI(result, panelId='orderflowPanel') {
    const el = document.getElementById(panelId);
    if (!el) return;
    const { imbalance:imb, obPressure:obp, liquidityWalls:lw,
            absorption:abs, spoofing:sp, aggressivePressure:ap, imbalanceScore:is } = result;

    const col = is>=65?'var(--green)':is>=55?'var(--cyan)':is<=35?'var(--red)':is<=45?'var(--orange)':'var(--text3)';
    const fmt = v => v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':'$0';

    const wallsHtml = lw.length ? lw.slice(0,4).map(w=>`
      <div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:rgba(${w.type==='BID'?'0,229,160':'255,61,107'},.05);border-radius:5px;margin-bottom:3px">
        <span style="font-size:9px;color:${w.type==='BID'?'var(--green)':'var(--red)'};min-width:30px">${w.type}</span>
        <span style="font-size:10px;font-weight:700;color:var(--text);flex:1">$${w.price.toFixed(2)}</span>
        <span style="font-size:9px;color:var(--text3)">$${fmt(w.vol)}</span>
      </div>`).join('') : '<div style="font-size:10px;color:var(--text3)">Likidite duvarı yok</div>';

    el.innerHTML = `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px">
          <span style="color:var(--text3)">Order Book İmbalance</span>
          <span style="font-weight:700;color:${col}">${obp.replace('_',' ')}</span>
        </div>
        <div style="height:8px;background:rgba(255,61,107,.2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${is}%;background:linear-gradient(90deg,var(--green),var(--green));border-radius:4px;transition:width .3s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;margin-top:3px;color:var(--text3)">
          <span>BID $${fmt(result.bidVol||0)}</span>
          <span>ASK $${fmt(result.askVol||0)}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px">
        ${abs?`<span style="font-size:9px;padding:2px 8px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.25);border-radius:8px;color:var(--cyan)">🧲 Absorpsiyon</span>`:''}
        ${sp?`<span style="font-size:9px;padding:2px 8px;background:rgba(255,193,7,.1);border:1px solid rgba(255,193,7,.25);border-radius:8px;color:var(--yellow)">⚠ Spoofing</span>`:''}
        <span style="font-size:9px;padding:2px 8px;background:rgba(255,255,255,.06);border-radius:8px;color:var(--text3)">${ap.replace('_',' ')}</span>
      </div>
      <div style="font-size:9px;font-weight:700;letter-spacing:1px;color:var(--text3);margin-bottom:6px">LİKİDİTE DUVARLARI</div>
      ${wallsHtml}
    `;
  }

  return { onDepthUpdate, analyze, renderUI };
})();
