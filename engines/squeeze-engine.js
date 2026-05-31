// ════════════════════════════════════════════════════════════════════
// SQUEEZE ENGINE — Funding + OI + LS Ratio kombinasyonu
// ════════════════════════════════════════════════════════════════════
const SqueezeEngine = (() => {

  function analyze({ fund, oiChange, lsRatio, liqResult, wsData, closes }) {
    const signals  = [];
    let   shortSqueeze = 0;
    let   longSqueeze  = 0;

    // ── Funding extreme ──────────────────────────────────────────
    if (fund !== null) {
      if (fund < -0.1) { shortSqueeze += 35; signals.push({ type:'SHORT', reason:`Funding aşırı negatif (%${fund.toFixed(3)}) — short'lar sıkışacak`, w:35 }); }
      else if (fund < -0.05) { shortSqueeze += 20; signals.push({ type:'SHORT', reason:`Funding negatif (%${fund.toFixed(3)})`, w:20 }); }
      else if (fund > 0.1) { longSqueeze += 35; signals.push({ type:'LONG', reason:`Funding aşırı pozitif (%${fund.toFixed(3)}) — long'lar sıkışacak`, w:35 }); }
      else if (fund > 0.05) { longSqueeze += 20; signals.push({ type:'LONG', reason:`Funding pozitif (%${fund.toFixed(3)})`, w:20 }); }
    }

    // ── OI genişleme ─────────────────────────────────────────────
    if (oiChange !== null) {
      const oiNum = parseFloat(oiChange);
      if (oiNum > 8) {
        if (lsRatio < 0.7)  { shortSqueeze += 25; signals.push({ type:'SHORT', reason:`OI +%${oiNum.toFixed(1)} + short kalabalık`, w:25 }); }
        if (lsRatio > 1.5)  { longSqueeze  += 25; signals.push({ type:'LONG',  reason:`OI +%${oiNum.toFixed(1)} + long kalabalık`, w:25 }); }
      }
    }

    // ── LS Ratio ─────────────────────────────────────────────────
    if (lsRatio !== null) {
      if (lsRatio < 0.5)  { shortSqueeze += 25; signals.push({ type:'SHORT', reason:`Short kalabalık (L/S: ${lsRatio.toFixed(2)})`, w:25 }); }
      else if (lsRatio < 0.7)  { shortSqueeze += 15; signals.push({ type:'SHORT', reason:`Short ağır (L/S: ${lsRatio.toFixed(2)})`, w:15 }); }
      else if (lsRatio > 2.0)  { longSqueeze  += 25; signals.push({ type:'LONG',  reason:`Long kalabalık (L/S: ${lsRatio.toFixed(2)})`, w:25 }); }
      else if (lsRatio > 1.5)  { longSqueeze  += 15; signals.push({ type:'LONG',  reason:`Long ağır (L/S: ${lsRatio.toFixed(2)})`, w:15 }); }
    }

    // ── Likidasyon baskısı ───────────────────────────────────────
    if (liqResult) {
      if (liqResult.liquidationBias === 'SHORT_LIQ') { shortSqueeze += 15; signals.push({ type:'SHORT', reason:'Short likidasyon baskısı', w:15 }); }
      if (liqResult.liquidationBias === 'LONG_LIQ')  { longSqueeze  += 15; signals.push({ type:'LONG',  reason:'Long likidasyon baskısı',  w:15 }); }
    }

    // ── OB baskısı ───────────────────────────────────────────────
    if (wsData?.obImbalance !== undefined) {
      const obi = wsData.obImbalance;
      if (obi > 0.7 && lsRatio < 0.7)  { shortSqueeze += 10; signals.push({ type:'SHORT', reason:'OB alım baskısı + short kalabalık', w:10 }); }
      if (obi < 0.3 && lsRatio > 1.5)  { longSqueeze  += 10; signals.push({ type:'LONG',  reason:'OB satış baskısı + long kalabalık', w:10 }); }
    }

    // ── Fiyat durağanlığı (squeeze hazırlık) ─────────────────────
    if (closes?.length >= 10) {
      const last10 = closes.slice(-10);
      const hi = Math.max(...last10), lo = Math.min(...last10);
      const range = (hi - lo) / lo * 100;
      if (range < 1.5 && (shortSqueeze > 30 || longSqueeze > 30)) {
        const dominant = shortSqueeze > longSqueeze ? 'SHORT' : 'LONG';
        signals.push({ type: dominant, reason: `Fiyat sıkışık (%${range.toFixed(1)} range) — squeeze tetiklenebilir`, w:10 });
        if (dominant === 'SHORT') shortSqueeze += 10; else longSqueeze += 10;
      }
    }

    const maxRisk   = Math.max(shortSqueeze, longSqueeze);
    const riskType  = shortSqueeze >= longSqueeze ? 'SHORT_SQUEEZE' : 'LONG_SQUEEZE';
    const squeezeRisk = Math.min(100, maxRisk);
    const level     = squeezeRisk >= 70 ? 'CRITICAL' : squeezeRisk >= 50 ? 'HIGH' : squeezeRisk >= 30 ? 'MEDIUM' : 'LOW';

    return {
      squeezeRisk,
      shortSqueeze: Math.min(100, shortSqueeze),
      longSqueeze:  Math.min(100, longSqueeze),
      dominantType: riskType,
      level,
      signals: signals.filter(s => s.type === (riskType === 'SHORT_SQUEEZE' ? 'SHORT' : 'LONG')),
      allSignals: signals,
    };
  }

  function renderUI(result, panelId='squeezePanel') {
    const el = document.getElementById(panelId);
    if (!el) return;
    const { squeezeRisk:sr, shortSqueeze:ss, longSqueeze:ls, dominantType:dt, level, signals } = result;
    const col = sr>=70?'var(--red)':sr>=50?'var(--orange)':sr>=30?'var(--yellow)':'var(--green)';
    const isShort = dt === 'SHORT_SQUEEZE';

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="flex:1;background:rgba(0,0,0,.25);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">SQUEEZE RİSKİ</div>
          <div style="font-size:22px;font-weight:900;color:${col}">${sr}%</div>
          <div style="font-size:9px;color:${col}">${level}</div>
        </div>
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:4px">
            <span style="color:var(--red)">LONG SQUEEZE</span>
            <span style="color:var(--red);font-weight:700">${ls}%</span>
          </div>
          <div style="height:5px;background:rgba(0,0,0,.3);border-radius:3px;overflow:hidden;margin-bottom:6px">
            <div style="height:100%;width:${ls}%;background:var(--red);border-radius:3px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:4px">
            <span style="color:var(--green)">SHORT SQUEEZE</span>
            <span style="color:var(--green);font-weight:700">${ss}%</span>
          </div>
          <div style="height:5px;background:rgba(0,0,0,.3);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${ss}%;background:var(--green);border-radius:3px"></div>
          </div>
        </div>
      </div>
      ${sr>=50?`<div style="padding:7px 10px;background:rgba(${isShort?'0,229,160':'255,61,107'},.08);border:1px solid rgba(${isShort?'0,229,160':'255,61,107'},.3);border-radius:8px;margin-bottom:8px;font-size:10px;font-weight:700;color:${isShort?'var(--green)':'var(--red)'}">
        ⚡ ${dt.replace('_',' ')} RİSKİ YÜKSEK
      </div>`:''}
      <div style="display:flex;flex-direction:column;gap:4px">
        ${signals.map(s=>`<div style="font-size:9px;color:var(--text2);padding:4px 8px;background:rgba(0,0,0,.2);border-radius:5px">• ${s.reason}</div>`).join('')}
      </div>
    `;
  }

  return { analyze, renderUI };
})();
