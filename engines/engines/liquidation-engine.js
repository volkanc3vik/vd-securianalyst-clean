// ════════════════════════════════════════════════════════════════════
// LIQUIDATION ENGINE — Spike, Cascade, Pressure, Bias
// ════════════════════════════════════════════════════════════════════
const LiquidationEngine = (() => {

  const _history = [];   // {ts, value, side, sym}
  const MAX_HIST  = 200;
  let   _stats    = { longTotal:0, shortTotal:0, lastSpike:null };

  // WSEngine'den gelen her likidasyon buraya gelir
  function onLiquidation(liq) {
    _history.push({ ...liq, ts: liq.ts || Date.now() });
    if (_history.length > MAX_HIST) _history.shift();

    if (liq.side === 'BUY')  _stats.shortTotal += liq.value || 0; // BUY = short liq
    else                     _stats.longTotal  += liq.value || 0;

    // Spike kontrolü
    const recentWindow = _history.filter(h => Date.now() - h.ts < 60000);
    const recentTotal  = recentWindow.reduce((s,h) => s + (h.value||0), 0);
    const avgHourly    = _history.length > 10
      ? _history.reduce((s,h) => s+(h.value||0), 0) / _history.length * 60
      : recentTotal;

    if (recentTotal > avgHourly * 2.5 && recentTotal > 500000) {
      _stats.lastSpike = { ts: Date.now(), value: recentTotal, side: liq.side };
    }
  }

  // Ana analiz
  function analyze(wsData) {
    const now = Date.now();
    const win5m  = _history.filter(h => now - h.ts < 300000);
    const win1h  = _history.filter(h => now - h.ts < 3600000);

    const longLiq5m  = win5m.filter(h => h.side==='SELL').reduce((s,h)=>s+(h.value||0),0);
    const shortLiq5m = win5m.filter(h => h.side==='BUY').reduce((s,h)=>s+(h.value||0),0);
    const total5m    = longLiq5m + shortLiq5m;

    const longLiq1h  = win1h.filter(h => h.side==='SELL').reduce((s,h)=>s+(h.value||0),0);
    const shortLiq1h = win1h.filter(h => h.side==='BUY').reduce((s,h)=>s+(h.value||0),0);
    const total1h    = longLiq1h + shortLiq1h;

    // Spike tespiti
    const liqSpike = _stats.lastSpike && (now - _stats.lastSpike.ts < 120000);

    // Cascade: 3 dakika içinde birden fazla büyük likidasyon
    const bigLiqs = win5m.filter(h => (h.value||0) > 100000);
    const cascade = bigLiqs.length >= 3;

    // Pressure skoru (0-100)
    let liquidationPressure = 0;
    if (total5m > 5_000_000)  liquidationPressure = 90;
    else if (total5m > 1_000_000) liquidationPressure = 70;
    else if (total5m > 500_000)   liquidationPressure = 50;
    else if (total5m > 100_000)   liquidationPressure = 30;
    else if (total5m > 0)         liquidationPressure = 15;

    // Bias
    const liquidationBias = total5m === 0 ? 'NEUTRAL' :
      longLiq5m > shortLiq5m * 1.5 ? 'LONG_LIQ' :
      shortLiq5m > longLiq5m * 1.5 ? 'SHORT_LIQ' : 'BALANCED';

    // squeezeRisk — büyük short likidasyon → short squeeze
    const squeezeRisk = shortLiq5m > longLiq5m * 2 && total5m > 500000 ? 'SHORT_SQUEEZE' :
                        longLiq5m > shortLiq5m * 2 && total5m > 500000 ? 'LONG_SQUEEZE' : null;

    // WS'den son likidasyon
    const wsLiq = wsData?.lastLiquidation;
    const recentLiq = wsLiq && (now - wsLiq.ts < 60000) ? wsLiq : null;

    return {
      liquidationPressure,
      liquidationBias,
      squeezeRisk,
      liqSpike,
      cascade,
      longLiq5m, shortLiq5m, total5m,
      longLiq1h, shortLiq1h, total1h,
      recentLiq,
      history: _history.slice(-20),
    };
  }

  function renderUI(result, panelId='liqPanel') {
    const el = document.getElementById(panelId);
    if (!el) return;

    const { liquidationPressure:lp, liquidationBias:lb, squeezeRisk:sr,
            liqSpike, cascade, longLiq5m, shortLiq5m, total5m, recentLiq } = result;

    const lpCol = lp>=70?'var(--red)':lp>=50?'var(--orange)':lp>=30?'var(--yellow)':'var(--green)';
    const fmt   = v => v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':'$0';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">BASINÇ</div>
          <div style="font-size:20px;font-weight:800;color:${lpCol}">${lp}%</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">5dk TOPLAM</div>
          <div style="font-size:14px;font-weight:800;color:var(--cyan)">$${fmt(total5m)}</div>
        </div>
      </div>
      ${liqSpike?`<div style="padding:6px 10px;background:rgba(255,61,107,.1);border:1px solid rgba(255,61,107,.3);border-radius:8px;margin-bottom:6px;font-size:10px;font-weight:700;color:var(--red)">⚡ LİKİDASYON SPIKE TESPİT EDİLDİ</div>`:''}
      ${cascade?`<div style="padding:6px 10px;background:rgba(255,122,0,.1);border:1px solid rgba(255,122,0,.3);border-radius:8px;margin-bottom:6px;font-size:10px;font-weight:700;color:var(--orange)">🌊 CASCADE RİSKİ — Zincirleme likidasyon</div>`:''}
      ${sr?`<div style="padding:6px 10px;background:rgba(${sr==='SHORT_SQUEEZE'?'0,229,160':'255,61,107'},.1);border:1px solid rgba(${sr==='SHORT_SQUEEZE'?'0,229,160':'255,61,107'},.3);border-radius:8px;margin-bottom:6px;font-size:10px;font-weight:700;color:${sr==='SHORT_SQUEEZE'?'var(--green)':'var(--red)'}">⚡ ${sr.replace('_',' ')} BAŞLAYAB\u0130L\u0130R</div>`:''}
      <div style="display:flex;gap:8px">
        <div style="flex:1;background:rgba(255,61,107,.07);border-radius:7px;padding:6px 8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">LONG LİK.</div>
          <div style="font-size:11px;font-weight:700;color:var(--red)">$${fmt(longLiq5m)}</div>
        </div>
        <div style="flex:1;background:rgba(0,229,160,.07);border-radius:7px;padding:6px 8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">SHORT LİK.</div>
          <div style="font-size:11px;font-weight:700;color:var(--green)">$${fmt(shortLiq5m)}</div>
        </div>
      </div>
      ${recentLiq?`<div style="margin-top:8px;font-size:10px;color:var(--text3);padding:5px 8px;background:rgba(0,0,0,.2);border-radius:6px">
        Son: ${recentLiq.side==='BUY'?'🔵 Short':'🔴 Long'} likidasyon — $${fmt(recentLiq.value||0)} @ $${(+recentLiq.price||0).toFixed(2)}
      </div>`:''}
    `;
  }

  return { onLiquidation, analyze, renderUI };
})();
