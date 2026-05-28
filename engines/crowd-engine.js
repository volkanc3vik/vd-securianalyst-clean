// ════════════════════════════════════════════════════════════════════
// CROWD PSYCHOLOGY ENGINE — Kalabalık tuzak, aşırı pozisyon tespiti
// ════════════════════════════════════════════════════════════════════
const CrowdEngine = (() => {

  function analyze({ fund, lsRatio, oiChange, liqResult, smcData, wsData }) {
    const traps   = [];
    let   crowdRisk = 0;
    let   trapProb  = 0;
    let   crowdType = 'NEUTRAL';

    // ── OVERLEVERAGED LONGS ──────────────────────────────────────
    if (lsRatio > 1.8 && fund > 0.05) {
      crowdRisk += 40;
      trapProb  += 35;
      crowdType  = 'OVERLEVERAGED_LONGS';
      traps.push({
        type: 'OVERLEVERAGED_LONGS',
        confidence: 75,
        desc: `Yukarı yönlü kalabalık (L/S: ${lsRatio?.toFixed(2)}) + yüksek funding — yukarı yönlü tasfiye riski`,
        action: 'Yukarı yönlü görünüm zayıf, kısa vadeli aşağı yönlü baskı izlenebilir',
        col: 'var(--red)',
      });
    }

    // ── OVERLEVERAGED SHORTS ─────────────────────────────────────
    if (lsRatio < 0.55 && fund < -0.05) {
      crowdRisk += 40;
      trapProb  += 35;
      crowdType  = 'OVERLEVERAGED_SHORTS';
      traps.push({
        type: 'OVERLEVERAGED_SHORTS',
        confidence: 75,
        desc: `Aşağı yönlü kalabalık (L/S: ${lsRatio?.toFixed(2)}) + negatif funding — aşağı yönlü sıkışma riski`,
        action: 'Aşağı yönlü görünüm zayıf, kısa vadeli yukarı yönlü görünüm izlenebilir',
        col: 'var(--green)',
      });
    }

    // ── CROWD TRAP — SMC sweep + kalabalık ──────────────────────
    if (smcData?.sweeps?.length > 0) {
      if (lsRatio > 1.5 && fund > 0.03) {
        crowdRisk += 30;
        trapProb  += 40;
        traps.push({
          type: 'CROWD_TRAP',
          confidence: 82,
          desc: 'Likidite süpürmesi + kalabalık long — klasik bull trap',
          action: 'Long pozisyon açma, stop hunt gerçekleşiyor olabilir',
          col: 'var(--orange)',
        });
      }
      if (lsRatio < 0.65 && fund < -0.03) {
        crowdRisk += 30;
        trapProb  += 40;
        traps.push({
          type: 'CROWD_TRAP',
          confidence: 82,
          desc: 'Likidite süpürmesi + kalabalık short — klasik bear trap',
          action: 'Short pozisyon açma, stop hunt gerçekleşiyor olabilir',
          col: 'var(--cyan)',
        });
      }
    }

    // ── LIQUIDITY BAIT ───────────────────────────────────────────
    if (wsData?.obImbalance !== undefined) {
      const obi = wsData.obImbalance;
      // Görünen güçlü alım ama kalabalık long — sahte talep
      if (obi > 0.65 && lsRatio > 1.5 && fund > 0.05) {
        crowdRisk += 20;
        trapProb  += 25;
        traps.push({
          type: 'LIQUIDITY_BAIT',
          confidence: 65,
          desc: 'OB alım baskısı görünüyor ama kalabalık long — sahte talep ihtimali',
          action: 'Kırılım onaylanmadan long açma',
          col: 'var(--yellow)',
        });
      }
      // Görünen güçlü satış ama kalabalık short — sahte arz
      if (obi < 0.35 && lsRatio < 0.65 && fund < -0.05) {
        crowdRisk += 20;
        trapProb  += 25;
        traps.push({
          type: 'LIQUIDITY_BAIT',
          confidence: 65,
          desc: 'OB satış baskısı görünüyor ama kalabalık short — sahte arz ihtimali',
          action: 'Kırılım onaylanmadan short açma',
          col: 'var(--yellow)',
        });
      }
    }

    // ── PANIC ZONE ───────────────────────────────────────────────
    if (liqResult?.liquidationPressure >= 70 && lsRatio > 1.3) {
      crowdRisk += 15;
      trapProb  += 15;
      traps.push({
        type: 'PANIC_ZONE',
        confidence: 60,
        desc: 'Yüksek likidasyon baskısı + kalabalık pozisyon — panik satış riski',
        action: 'Stop seviyelerini gözden geçir',
        col: 'var(--orange)',
      });
    }

    // Crowd tipi belirleme
    if (traps.length === 0) {
      if (lsRatio > 1.2)      crowdType = 'BULLISH_CROWD';
      else if (lsRatio < 0.8) crowdType = 'BEARISH_CROWD';
      else                    crowdType = 'NEUTRAL';
    }

    return {
      crowdRisk:  Math.min(100, crowdRisk),
      trapProb:   Math.min(100, trapProb),
      crowdType,
      traps,
      dominantTrap: traps.sort((a,b)=>b.confidence-a.confidence)[0] || null,
    };
  }

  function renderUI(result, panelId='crowdPanel') {
    const el = document.getElementById(panelId);
    if (!el) return;
    const { crowdRisk:cr, trapProb:tp, crowdType:ct, traps, dominantTrap:dt } = result;

    const crCol = cr>=70?'var(--red)':cr>=50?'var(--orange)':cr>=30?'var(--yellow)':'var(--green)';
    const tpCol = tp>=70?'var(--red)':tp>=50?'var(--orange)':tp>=30?'var(--yellow)':'var(--green)';

    const trapsHtml = traps.map(t=>`
      <div style="padding:6px 10px;background:rgba(0,0,0,.2);border-left:3px solid ${t.col};border-radius:0 7px 7px 0;margin-bottom:5px">
        <div style="font-size:10px;font-weight:700;color:${t.col}">🪤 ${t.type.replace(/_/g,' ')}</div>
        <div style="font-size:9px;color:var(--text3);margin-top:2px">${t.desc}</div>
        <div style="font-size:9px;color:var(--cyan);margin-top:2px">→ ${t.action}</div>
      </div>`).join('');

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">CROWD RİSKİ</div>
          <div style="font-size:20px;font-weight:800;color:${crCol}">${cr}%</div>
        </div>
        <div style="background:rgba(0,0,0,.25);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:9px;color:var(--text3)">TUZAK OLASILIK</div>
          <div style="font-size:20px;font-weight:800;color:${tpCol}">${tp}%</div>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:var(--text3);margin-bottom:6px">
        Kalabalık Tipi: <span style="color:${cr>=50?crCol:'var(--text2)'}">${ct.replace(/_/g,' ')}</span>
      </div>
      ${trapsHtml || '<div style="font-size:10px;color:var(--text3)">Aktif tuzak sinyali yok</div>'}
    `;
  }

  return { analyze, renderUI };
})();
