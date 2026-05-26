
// ════════════════════════════════════════════════════════════════════
// PHASE 10 — ELITE PRIORITY ENGINE & INSTITUTIONAL SMART MONEY CORE
// ════════════════════════════════════════════════════════════════════
const P10 = (() => {

  let _mode = 'PRO'; // COMPACT | PRO | QUANT
  let _scanResults = [];
  let _currentSym = null;
  let _currentParams = null;

  // ── 1. PRIORITY SCORE ENGINE ──────────────────────────────────────
  // Her karta 0-100 arası kurumsal öncelik skoru hesapla
  function calcPriorityScore(item){
    let score = 0;

    // Güven skoru (max 25)
    const baseScore = item.lScore || item.sScore || 50;
    score += Math.min(baseScore * 0.25, 25);

    // Onay sayısı (max 20)
    const conf9 = item.conf9 || 5;
    score += Math.min(conf9 / 9 * 20, 20);

    // ATR volatilite (max 10) — düşük ATR = daha güvenli
    const atrPct = item.atrPct || 3;
    score += atrPct < 1.5 ? 10 : atrPct < 2.5 ? 7 : atrPct < 4 ? 4 : 1;

    // Hacim (max 10)
    const volR = item.volRatio || 1;
    score += volR >= 2 ? 10 : volR >= 1.5 ? 7 : volR >= 1.2 ? 4 : 1;

    // BTC uyum (max 10)
    const btcAlign = item.btcAlign || 50;
    score += Math.min(btcAlign * 0.1, 10);

    // Fake breakout yok bonus (max 10)
    score += item.hasFake ? 0 : 10;

    // SMC konfirmasyon (max 10)
    const smcPts = (item.hasSweep?3:0) + (item.hasOB?3:0) + (item.hasCHOCH?4:0);
    score += Math.min(smcPts, 10);

    // R/R kalitesi (max 5)
    const rr = item.rr || 1.5;
    score += rr >= 3 ? 5 : rr >= 2 ? 3 : rr >= 1.5 ? 1 : 0;

    return Math.min(Math.round(score), 100);
  }

  // ── 2. SETUP GRADE (5 yıldız sistemi) ────────────────────────────
  function getSetupGrade(priorityScore, conf9, hasFake){
    if(hasFake) return { stars:'⭐', label:'AVOID', css:'p10-grade-avoid', exec:'Liquidity Trap Risk', execCss:'p10-tag-trap' };
    if(priorityScore >= 85 && conf9 >= 8) return { stars:'⭐⭐⭐⭐⭐', label:'ELITE SETUP',  css:'p10-grade-elite',  exec:'High Probability',  execCss:'p10-tag-hp'  };
    if(priorityScore >= 72 && conf9 >= 7) return { stars:'⭐⭐⭐⭐',   label:'STRONG SETUP', css:'p10-grade-strong', exec:'High Probability',  execCss:'p10-tag-hp'  };
    if(priorityScore >= 58 && conf9 >= 5) return { stars:'⭐⭐⭐',     label:'GOOD SETUP',   css:'p10-grade-good',   exec:'Aggressive Entry', execCss:'p10-tag-agg' };
    if(priorityScore >= 42 && conf9 >= 4) return { stars:'⭐⭐',       label:'WEAK SETUP',   css:'p10-grade-weak',   exec:'Late Entry',       execCss:'p10-tag-late' };
    return                                        { stars:'⭐',         label:'AVOID',         css:'p10-grade-avoid',  exec:'Liquidity Trap Risk', execCss:'p10-tag-trap' };
  }

  // ── 3. MARKET NARRATIVE ENGINE ────────────────────────────────────
  function buildNarrative(params){
    if(!params) return null;
    const { sym, dir, ind, oiData, btcData, wsData, regimeMode, smcData, fakeBreak, closes, candles } = params;
    const sn = sym ? sym.replace('USDT','') : '—';
    const isLong = dir === 'LONG';
    const price = closes ? closes[closes.length-1] : 0;
    const parts = [];

    // Session
    const h = new Date().getUTCHours();
    const session = h<8?'Asya':h<13?'Londra':h<21?'New York':'Sonrası';
    parts.push(`<b>${session} seansı aktif.</b>`);

    // SMC hikayesi
    if(smcData){
      if(smcData.sweeps) parts.push(`<span class="n-${isLong?'bull':'bear'}">Likidite süpürmesi gerçekleşti${isLong?' — reversal güçleniyor':' — düşüş momentumu arttı'}.</span>`);
      if(smcData.choch)  parts.push(`<span class="n-${isLong?'bull':'bear'}">CHoCH oluştu — market yapısı ${isLong?'pozitife':'negatife'} döndü.</span>`);
      if(smcData.ob)     parts.push(`${isLong?'Bullish':'Bearish'} order block ${isLong?'destek':'direnç'} sağlıyor.`);
    }

    // OI / Funding
    if(oiData){
      const f = oiData.fund;
      if(f !== null){
        if(f > 0.08)  parts.push(`<span class="n-warn">Funding aşırı pozitif (%${f.toFixed(3)}) — long pozisyon kalabalık.</span>`);
        else if(f < -0.08) parts.push(`<span class="n-warn">Funding aşırı negatif (%${f.toFixed(3)}) — short sıkışma riski.</span>`);
        else parts.push(`Funding dengeli (%${f.toFixed(3)}) — pozisyon dağılımı sağlıklı.`);
      }
      if(oiData.lsRatio !== null){
        if(oiData.lsRatio > 1.5) parts.push(`<span class="n-warn">Long/Short oranı ${oiData.lsRatio.toFixed(2)} — long kalabalık, sıkışma riski.</span>`);
        else if(oiData.lsRatio < 0.7) parts.push(`Short kalabalık (L/S: ${oiData.lsRatio.toFixed(2)}) — short squeeze riski.`);
      }
    }

    // BTC
    if(btcData){
      if(btcData.chg > 1.5) parts.push(`<span class="n-bull">BTC güçlü yükseliş (%${btcData.chg.toFixed(2)}) — altcoin long momentum desteği.</span>`);
      else if(btcData.chg < -1.5) parts.push(`<span class="n-bear">BTC baskı altında (%${btcData.chg.toFixed(2)}) — long pozisyon için olumsuz.</span>`);
    }

    // WS verisi
    if(wsData){
      if(wsData.lastWhale && Date.now()-wsData.lastWhale.ts < 60000){
        const w = wsData.lastWhale;
        parts.push(`<span class="n-${w.buy?'bull':'bear'}">🐋 Whale ${w.buy?'alımı':'satışı'} tespit edildi — $${(w.val/1000).toFixed(0)}K @ $${w.price?.toFixed(2)}.</span>`);
      }
      if(wsData.obImbalance !== undefined){
        const obi = wsData.obImbalance;
        if(obi > 0.65) parts.push(`<span class="n-bull">Order book alım baskısı (%${(obi*100).toFixed(0)}) — kurumsal talep görünüyor.</span>`);
        else if(obi < 0.35) parts.push(`<span class="n-bear">Order book satış baskısı (%${((1-obi)*100).toFixed(0)}) — arz baskısı yoğun.</span>`);
      }
    }

    // Fake breakout
    if(fakeBreak) parts.push(`<span class="n-warn">⚠ Fake breakout riski tespit edildi — hacimsiz kırılım, dikkatli ol.</span>`);

    // Regime
    if(regimeMode === 'TREND')    parts.push(`<span class="n-bull">Trend modu aktif — momentum sinyalleri güçlü.</span>`);
    if(regimeMode === 'PANIC')    parts.push(`<span class="n-bear">Panik satış modu — long girişlerden kaçın.</span>`);
    if(regimeMode === 'VOLATILE') parts.push(`<span class="n-warn">Volatilite yüksek — stop aralığını genişlet.</span>`);

    // Displacement
    if(wsData && wsData.aggressiveBuyRatio > 0.7) parts.push(`<span class="n-bull">Agresif alım akışı dominant (%${(wsData.aggressiveBuyRatio*100).toFixed(0)}) — kurumsal birikim ihtimali.</span>`);

    return parts.length ? parts.join(' ') : `${sn} için market analizi devam ediyor...`;
  }

  // ── 4. AI TRADE MENTOR ───────────────────────────────────────────
  function buildMentorAdvice(params, priorityResult){
    if(!params) return { msg:'Coin seçince mentor aktif olacak...', tags:[] };
    const { dir, ind, oiData, btcData, wsData, regimeMode, fakeBreak } = params;
    const isLong = dir === 'LONG';
    const advices = [], tags = [];

    // Fake breakout uyarısı
    if(fakeBreak){ advices.push('🚨 Fake breakout riski yüksek — Girişi geciktir, hacim onayı bekle.'); tags.push('fake-breakout-risk'); }

    // RSI aşırı alım/satım
    if(ind){
      if(isLong && ind.rsi > 72)  { advices.push('⚠ RSI aşırı alım bölgesinde — Kısmi pozisyon aç veya retest bekle.'); tags.push('partial-tp-recommended'); }
      if(!isLong && ind.rsi < 28) { advices.push('⚠ RSI aşırı satım bölgesinde — Short kapatmayı değerlendir.'); tags.push('momentum-weakening'); }
    }

    // Funding riski
    if(oiData && oiData.fund !== null){
      if(isLong && oiData.fund > 0.08)  { advices.push('💰 Yüksek funding maliyeti — Pozisyonu uzun süre tutma, kısa vadeli hedefle.'); tags.push('reduce-leverage'); }
      if(!isLong && oiData.fund < -0.08){ advices.push('💰 Negatif funding yüksek — Short sıkışma riski var.'); tags.push('volatility-spike-detected'); }
    }

    // BTC ters yön
    if(btcData){
      if(isLong && btcData.chg < -2)  { advices.push('📉 BTC düşüyor — Long girişini ertele, BTC toparlanmasını bekle.'); tags.push('wait-for-retest'); }
      if(!isLong && btcData.chg > 2)  { advices.push('📈 BTC güçlü — Short girişini ertele.'); tags.push('wait-for-retest'); }
    }

    // Regime
    if(regimeMode === 'PANIC' && isLong)   { advices.push('🔴 Panik satış modu — Long pozisyon açma, bekle.'); tags.push('wait-for-retest'); }
    if(regimeMode === 'VOLATILE')          { advices.push('⚡ Volatilite spike tespit edildi — Pozisyon boyutunu yarıya indir.'); tags.push('volatility-spike-detected'); }

    // WS mentor
    if(wsData){
      if(wsData.lastWhale && Date.now()-wsData.lastWhale.ts < 30000){
        const w = wsData.lastWhale;
        advices.push(`🐋 Kurumsal ${w.buy?'alım':'satış'} tespit edildi — ${w.buy&&isLong?'Setup güçlendi':'Dikkatli ol'}.`);
        tags.push('institutional-absorption-active');
      }
      if(wsData.obImbalance !== undefined){
        const obi = wsData.obImbalance;
        if(isLong && obi < 0.4) { advices.push('📚 Order book satış tarafında ağır — Giriş ertelenmeli.'); tags.push('wait-for-retest'); }
      }
    }

    // Priority score bazlı genel tavsiye
    if(priorityResult){
      const ps = priorityResult.priorityScore || 50;
      if(ps >= 80) advices.push('✅ Yüksek kalite setup — Plan dahilinde giriş yapılabilir.');
      else if(ps >= 60) advices.push('⚡ Orta kalite setup — Agresif giriş kabul edilebilir, stop sıkı tut.');
      else { advices.push('⏸ Zayıf setup — Daha güçlü konfirmasyon bekle.'); tags.push('wait-for-retest'); }
    }

    if(!advices.length) advices.push('✅ Setup normal görünüyor — Planı takip et, stop seviyeni koru.');

    return { msg: advices.join('<br>'), tags: [...new Set(tags)] };
  }

  // ── 5. LIVE LIQUIDITY MAP ────────────────────────────────────────
  function renderLiquidityMap(candles, price, wsData){
    const el = document.getElementById('p10LiqMapContent');
    if(!el || !candles || !candles.length) return;

    // Fiyat seviyelerini topla
    const levels = [];
    const n = candles.length;

    // Swing high/low pool'ları
    for(let i=3;i<n-1;i++){
      const c=candles[i];
      const prev=candles.slice(i-3,i);
      const isH=c.h>Math.max(...prev.map(p=>p.h))&&c.h>candles[i+1].h;
      const isL=c.l<Math.min(...prev.map(p=>p.l))&&c.l<candles[i+1].l;
      if(isH) levels.push({price:c.h, type:'sell_stop', label:'Sell Stop Pool', strength:2});
      if(isL) levels.push({price:c.l, type:'buy_stop',  label:'Buy Stop Pool',  strength:2});
    }

    // Equal high/low clusterları (güçlü likidite)
    for(let i=0;i<levels.length;i++){
      for(let j=i+1;j<levels.length;j++){
        if(levels[i].type===levels[j].type && Math.abs(levels[i].price-levels[j].price)/levels[i].price<0.002){
          levels[i].strength++;
          levels[j].strength = 0;
        }
      }
    }

    // WS likidasyon seviyeleri
    if(wsData && wsData.lastLiquidation && Date.now()-wsData.lastLiquidation.ts<300000){
      levels.push({
        price: wsData.lastLiquidation.price,
        type: 'liq_cluster',
        label: `Likidasyon Kümesi (${wsData.lastLiquidation.side==='BUY'?'Short':'Long'})`,
        strength: 5,
      });
    }

    // Filtrele ve sırala
    const filtered = levels
      .filter(l=>l.strength>0)
      .sort((a,b)=>a.strength!==b.strength?b.strength-a.strength:Math.abs(a.price-price)-Math.abs(b.price-price))
      .slice(0,8);

    if(!filtered.length){ el.innerHTML='<div style="font-size:10px;color:var(--text3)">Likidite seviyesi analiz ediliyor...</div>'; return; }

    const maxStr = Math.max(...filtered.map(f=>f.strength));
    const rows = filtered.map(l=>{
      const isAbove = l.price > price;
      const dist    = ((Math.abs(l.price-price)/price)*100).toFixed(2);
      const col     = l.type==='liq_cluster'?'var(--orange)':isAbove?'var(--red)':'var(--green)';
      const icon    = l.type==='liq_cluster'?'⚡':isAbove?'▲':'▼';
      const bw      = (l.strength/maxStr*100).toFixed(0);
      return `
        <div class="p10-liq-row">
          <div class="p10-liq-icon" style="background:${col}"></div>
          <span class="p10-liq-label">${icon} ${l.label}</span>
          <div class="p10-liq-bar"><div class="p10-liq-fill" style="width:${bw}%;background:${col}"></div></div>
          <span class="p10-liq-price" style="color:${col}">$${l.price.toFixed(2)}</span>
          <span style="font-size:9px;color:var(--text3);min-width:45px;text-align:right">%${dist}</span>
        </div>`;
    }).join('');

    el.innerHTML = rows;
  }

  // ── 6. SCAN SONUÇLARINI RANKLA ───────────────────────────────────
  function rankScanResults(results){
    return results.map(item => {
      const ps = calcPriorityScore(item);
      const grade = getSetupGrade(ps, item.conf9||5, item.hasFake);
      return { ...item, priorityScore: ps, grade };
    }).sort((a,b) => b.priorityScore - a.priorityScore);
  }

  // ── 7. KART ÜZERİNE OVERLAY EKLE ────────────────────────────────
  function enhanceCard(cardEl, item){
    if(!cardEl || !item) return;
    const ps = item.priorityScore || calcPriorityScore(item);
    const grade = item.grade || getSetupGrade(ps, item.conf9||5, item.hasFake);
    const col = ps>=80?'var(--green)':ps>=60?'var(--yellow)':ps>=40?'var(--orange)':'var(--red)';

    // Priority overlay
    const overlay = document.createElement('div');
    overlay.className = 'p10-priority-overlay';
    overlay.style.cssText = `border-color:${col};background:rgba(0,0,0,.6);`;
    overlay.innerHTML = `<span class="p10-prio-score" style="color:${col}">${ps}</span><span class="p10-prio-label" style="color:${col}">PRİO</span>`;
    cardEl.style.position = 'relative';
    cardEl.appendChild(overlay);

    // Grade badge — kartın üstüne ekle
    const badge = document.createElement('div');
    badge.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <span class="p10-grade-badge ${grade.css}">${grade.stars} ${grade.label}</span>
        <span class="p10-exec-tag ${grade.execCss}">${grade.exec}</span>
      </div>`;
    cardEl.insertBefore(badge, cardEl.firstChild);
  }

  // ── 8. COMPACT MODE RENDER ───────────────────────────────────────
  function renderCompact(results){
    const el = document.getElementById('p10CompactPanel');
    if(!el) return;
    const ranked = rankScanResults(results).slice(0,6);
    if(!ranked.length){ el.innerHTML='<div style="color:var(--text3);font-size:11px;padding:8px">Tarama çalıştır...</div>'; return; }

    el.innerHTML = `
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--text3);margin-bottom:8px">◈ TOP PRIORITY SETUPS</div>
      ${ranked.map((item,i)=>{
        const dir = item.lScore >= item.sScore ? 'LONG' : 'SHORT';
        const score = Math.max(item.lScore||0, item.sScore||0);
        const col = dir==='LONG'?'var(--green)':'var(--red)';
        const ps = item.priorityScore;
        const grade = item.grade;
        const rankCls = i===0?'p10-rank-1':i===1?'p10-rank-2':i===2?'p10-rank-3':'';
        return `
          <div class="compact-card" style="border-color:${col}22;position:relative;cursor:pointer"
               onclick="SYM='${item.sym}';document.getElementById('symInput').value='${item.sym}';loadCoin('${item.sym}',INTV)">
            ${i<3?`<div class="p10-rank ${rankCls}">#${i+1} PRİORİTE</div>`:''}
            <div class="compact-grade">${grade.stars.charAt(0)}</div>
            <div>
              <div class="compact-sym" style="color:${col}">${item.sym.replace('USDT','')}</div>
              <div class="compact-entry" style="color:${col}">${dir}</div>
            </div>
            <div style="flex:1"></div>
            <div style="text-align:right">
              <div class="compact-conf" style="color:${col}">${score}<span style="font-size:9px;color:var(--text3)">/100</span></div>
              <div style="font-size:9px;color:var(--text3)">Prio: ${ps}</div>
            </div>
          </div>`;
      }).join('')}`;
  }

  // ── 9. QUANT MODE RENDER ─────────────────────────────────────────
  function renderQuant(results){
    const el = document.getElementById('p10QuantPanel');
    if(!el) return;
    const ranked = rankScanResults(results).slice(0,10);
    if(!ranked.length){ el.innerHTML='<div style="color:var(--text3);font-size:11px;padding:8px">Tarama çalıştır...</div>'; return; }

    const rows = ranked.map((item,i)=>{
      const dir = item.lScore >= item.sScore ? 'LONG' : 'SHORT';
      const score = Math.max(item.lScore||0, item.sScore||0);
      const col = dir==='LONG'?'var(--green)':'var(--red)';
      const ps = item.priorityScore;
      const grade = item.grade;
      return `
        <tr style="cursor:pointer" onclick="SYM='${item.sym}';document.getElementById('symInput').value='${item.sym}';loadCoin('${item.sym}',INTV)">
          <td style="font-weight:700;color:var(--text3)">${i+1}</td>
          <td style="font-weight:800;color:${col}">${item.sym.replace('USDT','')}</td>
          <td style="color:${col};font-weight:700">${dir}</td>
          <td style="font-weight:700">${score}</td>
          <td style="color:${ps>=80?'var(--green)':ps>=60?'var(--yellow)':'var(--red)'};font-weight:700">${ps}</td>
          <td>${grade.stars}</td>
          <td style="font-size:9px;color:var(--text3)">${(item.atrPct||0).toFixed(1)}%</td>
          <td style="color:${item.chg>=0?'var(--green)':'var(--red)'};font-size:10px">${(item.chg>=0?'+':'')+item.chg.toFixed(2)}%</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;color:var(--text3);margin-bottom:8px">◈ QUANT PRIORITY TABLE</div>
      <div style="overflow-x:auto">
        <table class="p10-quant-table">
          <thead><tr>
            <th>#</th><th>SYM</th><th>DIR</th><th>SCORE</th><th>PRİO</th><th>GRADE</th><th>ATR</th><th>24S</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── 10. MODE SWITCHER ────────────────────────────────────────────
  function setMode(mode){
    _mode = mode;
    ['COMPACT','PRO','QUANT'].forEach(m=>{
      const btn = document.getElementById('mode'+m.charAt(0)+m.slice(1).toLowerCase());
      if(btn) btn.classList.toggle('active', m===mode);
    });

    // Panel visibility
    const compactPanel = document.getElementById('p10CompactPanel');
    const quantPanel   = document.getElementById('p10QuantPanel');
    const scanSec      = document.getElementById('longSection') || document.querySelector('.section');
    const allSections  = document.querySelectorAll('.section, .joker-section');

    if(mode==='COMPACT'){
      if(compactPanel){ compactPanel.style.display='block'; renderCompact(_scanResults); }
      if(quantPanel)  quantPanel.style.display='none';
      allSections.forEach(s=>s.style.display='none');
    } else if(mode==='QUANT'){
      if(compactPanel) compactPanel.style.display='none';
      if(quantPanel)  { quantPanel.style.display='block'; renderQuant(_scanResults); }
      allSections.forEach(s=>s.style.display='none');
    } else {
      if(compactPanel) compactPanel.style.display='none';
      if(quantPanel)   quantPanel.style.display='none';
      allSections.forEach(s=>s.style.display='');
    }

    // Narrative + Mentor panelleri QUANT ve PRO'da görünür
    const narPanel    = document.getElementById('p10NarrativePanel');
    const mentorPanel = document.getElementById('p10MentorPanel');
    const liqPanel    = document.getElementById('p10LiqMapPanel');
    if(narPanel)    narPanel.style.display    = (mode!=='COMPACT') ? 'block':'none';
    if(mentorPanel) mentorPanel.style.display = (mode!=='COMPACT') ? 'block':'none';
    if(liqPanel)    liqPanel.style.display    = (mode==='QUANT')   ? 'block':'none';
  }

  // ── 11. SESSION BADGE GÜNCELLE ───────────────────────────────────
  function _updateSessionBadge(){
    const h = new Date().getUTCHours();
    const sessions = [
      {start:0,  end:8,  label:'ASIA',     col:'#f0a500'},
      {start:8,  end:13, label:'LONDON',   col:'var(--cyan)'},
      {start:13, end:21, label:'NEW YORK', col:'var(--green)'},
      {start:21, end:24, label:'AFTER',    col:'var(--text3)'},
    ];
    const cur = sessions.find(s=>h>=s.start&&h<s.end)||sessions[3];
    const badge = document.getElementById('p10SessionBadge');
    if(badge){ badge.textContent='SESSION: '+cur.label; badge.style.color=cur.col; }
  }

  // ── 12. ANA GÜNCELLEME (updateUI hook) ──────────────────────────
  function onCoinUpdate(params, wsData){
    _currentParams = { ...params, wsData };
    const { sym, dir, ind, oiData, btcData, regimeMode, smcData, fakeBreak, closes, candles } = params;

    // Narrative
    const narrative = buildNarrative({ sym, dir, ind, oiData, btcData, wsData, regimeMode, smcData, fakeBreak, closes, candles });
    const narEl = document.getElementById('p10NarrativeText');
    if(narEl && narrative) narEl.innerHTML = narrative;

    // Mentor
    const mentor = buildMentorAdvice(params, null);
    const mentorEl = document.getElementById('p10MentorText');
    const tagsEl   = document.getElementById('p10MentorTags');
    if(mentorEl) mentorEl.innerHTML = mentor.msg;
    if(tagsEl)   tagsEl.innerHTML   = mentor.tags.map(t=>`<span class="p10-mentor-tag">${t.replace(/-/g,' ').toUpperCase()}</span>`).join('');

    // Liquidity map
    if(candles && candles.length) renderLiquidityMap(candles, closes[closes.length-1], wsData);

    // Market state
    const stateEl = document.getElementById('p10MarketState');
    if(stateEl && regimeMode){
      const col = regimeMode==='TREND'?'var(--green)':regimeMode==='PANIC'?'var(--red)':regimeMode==='VOLATILE'?'var(--orange)':'var(--yellow)';
      stateEl.textContent = regimeMode;
      stateEl.style.color = col;
      stateEl.style.borderColor = col+'44';
    }
  }

  // ── 13. SCAN HOOK ────────────────────────────────────────────────
  function onScanComplete(results){
    _scanResults = results;
    // Mevcut moddaki paneli güncelle
    if(_mode==='COMPACT') renderCompact(results);
    if(_mode==='QUANT')   renderQuant(results);
    // Kartlara overlay ekle
    setTimeout(()=>{
      document.querySelectorAll('#longGrid .opp, #shortGrid .opp, #jokerGrid .opp').forEach((cardEl, i)=>{
        const item = results[i] || {};
        item.priorityScore = item.priorityScore || calcPriorityScore(item);
        item.grade = item.grade || getSetupGrade(item.priorityScore, item.conf9||5, item.hasFake);
        enhanceCard(cardEl, item);
      });
    }, 500);
  }

  // Init
  _updateSessionBadge();
  setInterval(_updateSessionBadge, 60000);

  return { setMode, onCoinUpdate, onScanComplete, calcPriorityScore, getSetupGrade, buildNarrative, buildMentorAdvice, rankScanResults };
})();
