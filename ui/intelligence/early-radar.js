// ════════════════════════════════════════════════════════════════════
// EARLY OPPORTUNITY RADAR  (Phase / build 96 — Teyit Yolu: hacim→1.30 takibi)
// 9/9 setup ÖNCESİ kademeli erken-uyarı katmanı: WATCH → ARMED → CONFIRMED.
//
// SALT-OKUNUR: yalnız window.VD_STATE.scanResults okunur. Scanner çekirdeği,
// 9/9 SCE, telegram, archive, review, elite — HİÇBİRİNE dokunulmaz.
// Sinyal DEĞİL: yön/olasılık/hedef üretmez. Readiness = "yapı olgunluğu".
//
// Structure Readiness = yapısal çekirdek (%65) + enerji katmanı (%35),
//   enerji yapısal tabanla ölçeklenir → enerji TEK BAŞINA ARMED yapamaz.
// ════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  function _L(k,v,f){return (window.VDt)?window.VDt(k,v,f):(f!=null?f:k);}
  if (window.VDEarlyRadar) return;

  // ── CONFIG (tek yerden ayarlanır; ileride validated veriyle kalibre) ──
  const CFG = {
    W: { align: 28, conf: 22, riskInv: 15, squeeze: 12, compress: 10, volWake: 13 }, // 65 / 35
    WATCH_MIN: 50, ARMED_MIN: 65,
    structFloorWatch: 0.45, structFloorArmed: 0.65, riskInvArmed: 0.60,
    volDead: 0.80, volWakeLo: 1.00, volWakeHi: 1.30, // hacim uyanma bandı
    bbWindow: 30, rangeRecent: 5, rangeBase: 20,
    hysteresis: 2,          // üst aşamaya çıkmak için ardışık tarama
    arrowEps: 2,            // readiness oku eşiği
    staleMs: 6 * 60 * 1000, // bu süre tarama gelmezse "bayat"
    maxRows: 8,
  };

  const ST = new Map();      // sym → { readiness, stage, stageSince, prev, pend:{stage,count}, lastEvent }
  let _lastScanAt = 0, _t = null;

  // ── Yardımcılar ──
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const num = (x) => (x == null || isNaN(+x)) ? null : +x;
  function calcBB(closes, p = 20) {
    if (!closes || closes.length < p) return null;
    const sl = closes.slice(-p), m = sl.reduce((a, b) => a + b, 0) / p;
    const std = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / p);
    return { upper: m + 2 * std, mid: m, lower: m - 2 * std };
  }
  function bbWidthAt(closes, endIdx, p = 20) {
    const bb = calcBB(closes.slice(0, endIdx), p);
    if (!bb || !bb.mid) return null;
    return (bb.upper - bb.lower) / bb.mid;
  }
  function relTime(ts) {
    if (!ts) return '—';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 10) return _L('er.justNow', null, 'az önce');
    if (s < 60) return s + _L('er.secAgo', null, ' sn önce');
    const m = Math.round(s / 60);
    if (m < 60) return m + _L('er.minAgo', null, ' dk önce');
    return Math.round(m / 60) + _L('er.hourAgo', null, ' sa önce');
  }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── Alt-skorlar (0–1) ──
  function subScores(item, dir) {
    const isLong = dir === 'LONG';
    const ind = item.ind || {};
    const rsi = num(ind.rsi != null ? ind.rsi : item.rsi);
    const ema9 = num(ind.ema9), ema21 = num(ind.ema21);
    const mh = num(ind.macd && ind.macd.histogram != null ? ind.macd.histogram : item.mh);
    const score = num(isLong ? item.lScore : item.sScore);
    const risk = (item.risk && typeof item.risk === 'object' && item.risk.score != null)
      ? num(item.risk.score) : num(item.risk);
    const closes = Array.isArray(item.closes) ? item.closes : null;
    const candles = Array.isArray(item.candles) ? item.candles : null;

    // align (yönlü): EMA / MACD / RSI
    let okEma = null, okMacd = null, okRsi = null;
    if (ema9 != null && ema21 != null) okEma = isLong ? ema9 > ema21 : ema9 < ema21;
    else if (item.lEma || item.sEma) { const e = isLong ? (item.lEma || '') : (item.sEma || ''); okEma = e.indexOf('▲') >= 0 ? isLong : (e.indexOf('▼') >= 0 ? !isLong : null); }
    if (mh != null) okMacd = isLong ? mh > 0 : mh < 0;
    if (rsi != null) okRsi = isLong ? (rsi >= 42 && rsi <= 68) : (rsi >= 32 && rsi <= 58);
    const okArr = [okEma, okMacd, okRsi].filter(v => v !== null);
    const align = okArr.length ? okArr.filter(Boolean).length / okArr.length : 0;

    const conf = score != null ? clamp((score - 50) / 50, 0, 1) : 0;
    const riskInv = risk != null ? 1 - clamp(risk / 100, 0, 1) : 0.5;

    // squeeze (yönsüz): BB genişliği son W periyot içindeki yüzdelik tersi
    let squeeze = null;
    if (closes && closes.length >= 20 + 2) {
      const cur = bbWidthAt(closes, closes.length, 20);
      if (cur != null) {
        const widths = [];
        for (let i = 0; i < CFG.bbWindow; i++) {
          const w = bbWidthAt(closes, closes.length - i, 20);
          if (w != null) widths.push(w);
        }
        if (widths.length >= 5) {
          const geq = widths.filter(w => w >= cur).length;
          squeeze = clamp(geq / widths.length, 0, 1); // cur en düşükse → çoğu >= cur → yüksek
        }
      }
    }

    // compress (yönsüz): son range / baseline range
    let compress = null;
    if (candles && candles.length >= CFG.rangeBase + 1) {
      const px = num(item.price) || (candles[candles.length - 1].c);
      const rc = candles.slice(-CFG.rangeRecent), rb = candles.slice(-CFG.rangeBase);
      const recR = (Math.max(...rc.map(c => c.h)) - Math.min(...rc.map(c => c.l))) / px;
      const baseR = (Math.max(...rb.map(c => c.h)) - Math.min(...rb.map(c => c.l))) / px;
      if (baseR > 0) compress = clamp(1 - recR / baseR, 0, 1);
    }

    // volWake (yönsüz) + durum bayrakları
    let volWake = null, volRatio = null, volRising = false, volConfirmed = false, volFiring = false;
    if (candles && candles.length >= 13) {
      const v = candles.map(c => +c.v).filter(n => !isNaN(n));
      if (v.length >= 13) {
        const volNow = (v.slice(-3).reduce((a, b) => a + b, 0)) / 3;
        const volBase = (v.slice(-13, -3).reduce((a, b) => a + b, 0)) / 10;
        if (volBase > 0) {
          volRatio = volNow / volBase;
          volRising = volNow > volBase;
          volConfirmed = volRatio >= CFG.volWakeHi;
          if (volRatio < CFG.volDead) volWake = 0;
          else if (volRatio <= CFG.volWakeHi) volWake = clamp((volRatio - CFG.volDead) / (CFG.volWakeHi - CFG.volDead), 0, 1);
          else volWake = clamp(1 - (volRatio - CFG.volWakeHi) / 0.7, 0, 1);
          volFiring = volRising && volRatio >= CFG.volWakeLo && volRatio < CFG.volWakeHi;
        }
      }
    }

    return { align, conf, riskInv, squeeze, compress, volWake,
             volRatio, volRising, volConfirmed, volFiring,
             okEma, okMacd, okRsi, rsi, score, risk };
  }

  // ── Readiness + enerji tavanı ──
  function readiness(s) {
    const W = CFG.W;
    const structPart = W.align * s.align + W.conf * s.conf + W.riskInv * s.riskInv; // 0–65
    const structBase = structPart / (W.align + W.conf + W.riskInv);                 // 0–1
    const sq = s.squeeze == null ? 0 : s.squeeze;
    const cp = s.compress == null ? 0 : s.compress;
    const vw = s.volWake == null ? 0 : s.volWake;
    const energyPart = W.squeeze * sq + W.compress * cp + W.volWake * vw;            // 0–35
    const energyEff = energyPart * structBase;                                       // yapı yoksa erir
    return { value: Math.round(structPart + energyEff), structBase };
  }

  // ── Aşama — HYBRID V2 (Volkan direktifi: final karar YALNIZ Final Hybrid Score'dan) ──
  // Eski yapısal kapılar (hacim/hizalama/conf) kaldırıldı; o sinyaller zaten
  // PriceScore tarafına yansıyor. Deriv değerlendirilmemişse hybrid=price.
  function classify(s, rd, sym, dir) {
    const p = (s.score != null && Number.isFinite(+s.score)) ? +s.score : null;
    if (p == null) return null;
    const HE = window.VDHybridEngine;
    const rec = (HE && HE.get) ? HE.get(sym, dir) : null;
    const hybrid = rec ? rec.hybrid : Math.round(p);
    if (HE && HE.verdictOf) return HE.verdictOf(hybrid);
    return hybrid >= 80 ? 'CONFIRMED' : hybrid >= 65 ? 'ARMED' : hybrid >= 50 ? 'WATCH' : null;
  }
  const RANK = { WATCH: 1, ARMED: 2, CONFIRMED: 3 };

  // ── Neden / Eksik ──
  function reasons(s, stage) {
    const why = [], miss = [];
    if (s.align >= 2 / 3) why.push(_L('er.structAligned', null, 'Yapı hizalı')); else miss.push(_L('er.structNotAligned', null, 'Yapı tam hizalı değil'));
    if (s.conf >= 0.6) why.push(_L('er.confStrong', null, 'Confidence güçlü')); else if (stage) miss.push(_L('er.confLow', null, 'Confidence düşük'));
    if (s.riskInv >= 0.6) why.push(_L('er.riskLow2', null, 'Risk düşük')); else miss.push(_L('er.riskHigh2', null, 'Risk yüksek'));
    if ((s.squeeze || 0) >= 0.5) why.push(_L('er.squeezeHigh', null, 'Sıkışma yüksek'));
    if ((s.compress || 0) >= 0.5) why.push(_L('er.rangeTight', null, 'Range daralıyor'));
    if (s.volFiring) why.push(_L('er.volWaking', null, 'Hacim uyanıyor'));
    else if (!s.volConfirmed) miss.push(_L('er.volNotAwake', null, 'Hacim henüz uyanmadı'));
    if (s.okRsi === false) miss.push(_L('er.rsiOut', null, 'RSI band dışı'));
    return { why: why.slice(0, 3).join(' · ') || '—', miss: miss.slice(0, 2).join(' · ') || '—' };
  }

  // ── Olay (Son Değişim) tespiti — yükselen kenar ──
  function detectEvent(prevSt, s, stage) {
    // öncelik: aşama yükselişi > hacim uyanışı > sıkışma > daralma
    const wasStage = prevSt ? prevSt.stage : null;
    if (stage && RANK[stage] > (RANK[wasStage] || 0)) {
      return { label: stage === 'ARMED' ? _L('er.roseArmed', null, "ARMED'a yükseldi") : stage === 'CONFIRMED' ? _L('er.becameConf', null, 'CONFIRMED oldu') : _L('er.addedWatch', null, 'İzlemeye alındı'), at: Date.now() };
    }
    const had = prevSt && prevSt._flags ? prevSt._flags : {};
    if (s.volFiring && !had.vol) return { label: _L('er.volAwakeStart', null, 'Volume Awakening başladı'), at: Date.now() };
    if ((s.squeeze || 0) >= 0.6 && !had.sq) return { label: 'Volatility Squeeze tespit edildi', at: Date.now() };
    if ((s.compress || 0) >= 0.6 && !had.cp) return { label: 'Range Compression tespit edildi', at: Date.now() };
    return prevSt ? prevSt.lastEvent : null;
  }

  // ── Bir coin'i işle (state + histerezis) ──
  function process(item) {
    const lS = num(item.lScore) || 0, sS = num(item.sScore) || 0;
    const dir = lS >= sS ? 'LONG' : 'SHORT';
    const s = subScores(item, dir);
    const rd = readiness(s);
    const cand = classify(s, rd, item.sym, dir);

    const prev = ST.get(item.sym);
    let stage = prev ? prev.stage : null;
    let pend = prev && prev.pend ? prev.pend : { stage: null, count: 0 };

    if (!prev) { stage = cand; pend = { stage: null, count: 0 }; }   // ilk görülüş → anında sınıfla
    else if (cand === stage) { pend = { stage: null, count: 0 }; }
    else if (cand && RANK[cand] > (RANK[stage] || 0)) {
      // YÜKSELİŞ → histerezis
      pend = (pend.stage === cand) ? { stage: cand, count: pend.count + 1 } : { stage: cand, count: 1 };
      if (pend.count >= CFG.hysteresis) { stage = cand; pend = { stage: null, count: 0 }; }
    } else {
      // DÜŞÜŞ / kayboluş → anında uygula
      stage = cand; pend = { stage: null, count: 0 };
    }

    const stageSince = (prev && prev.stage === stage && prev.stageSince) ? prev.stageSince : Date.now();
    const prevReadiness = prev ? prev.value : rd.value;
    const lastEvent = detectEvent(prev, s, stage);
    const flags = { vol: s.volFiring, sq: (s.squeeze || 0) >= 0.6, cp: (s.compress || 0) >= 0.6 };

    const row = { sym: item.sym, dir, s, value: rd.value, structBase: rd.structBase,
                  price: num(item.price), chg: num(item.chg),
                  btcChg: (item.btcData && item.btcData.chg!=null) ? num(item.btcData.chg) : null,
                  btcAlign: num(item.btcAlign),
                  stage, stageSince, prevReadiness, lastEvent, pend, _flags: flags };
    ST.set(item.sym, row);
    return row;
  }

  // ── Render ──
  function arrow(cur, prev) {
    if (cur - prev > CFG.arrowEps) return '<span style="color:#36d399">↑</span>';
    if (prev - cur > CFG.arrowEps) return '<span style="color:#f87272">↓</span>';
    return '<span style="color:#8b98ac">→</span>';
  }
  function badge(stage) {
    const m = { WATCH: ['#fbbd23', 'WATCH'], ARMED: ['#ff8a3d', 'ARMED'], CONFIRMED: ['#36d399', 'CONFIRMED'] };
    const c = m[stage] || ['#8b98ac', '—'];
    return `<span style="font-weight:700;font-size:10px;padding:2px 8px;border-radius:10px;color:${c[0]};background:${c[0]}1a;border:1px solid ${c[0]}55">${c[1]}</span>`;
  }
  function chip(on, label) {
    const col = on ? '#7c5cff' : '#3a4658';
    return `<span title="${label}" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${col};margin-right:3px"></span>`;
  }

  // ── Teyit Yolu: CONFIRMED'in 3 şartı (Hacim≥1.30 · Hizalama tam · Skor≥0.60) ──
  function confirmCell(s) {
    const vr = s.volRatio;
    // Hacim oranı → 1.30 hedefi
    let volTxt, volCol, pct;
    if (vr == null) { volTxt = '—'; volCol = '#8b98ac'; pct = 0; }
    else {
      volTxt = vr.toFixed(2) + '×';
      pct = Math.max(0, Math.min(100, (vr / 1.30) * 100));
      volCol = vr >= 1.30 ? '#36d399' : vr >= 1.00 ? '#ff8a3d' : '#8b98ac';
    }
    const bar = `<div style="height:4px;background:#1e2836;border-radius:3px;margin-top:3px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${volCol}"></div></div>`;
    // 3 şart durumu (CONFIRMED eşikleri)
    const okVol = vr != null && vr >= 1.30;
    const okAlign = s.align >= 0.99;
    const okConf = s.conf >= 0.60;
    const pip = (ok, lbl, full) => `<span title="${lbl}: ${ok ? _L('er.pipOk', null, 'tamam') : _L('er.pipPending', null, 'bekliyor')} (hedef ${full})" style="font-size:9px;font-weight:700;color:${ok ? '#36d399' : '#5b6677'}">${ok ? '✓' : '○'}${lbl}</span>`;
    return `<div style="min-width:96px">
      <div style="font-size:11px;font-weight:700;color:${volCol}">Hacim ${volTxt} <span style="color:#5b6677;font-weight:500">/ 1.30</span></div>
      ${bar}
      <div style="display:flex;gap:6px;margin-top:4px">${pip(okAlign, _L('er.pipAlign', null, 'Hiza'), '3/3')}${pip(okConf, _L('er.pipScore', null, 'Skor'), '≥80')}${pip(okVol, _L('er.pipConfirm', null, 'Teyit'), '1.30×')}</div>
    </div>`;
  }

  // ── Erişim yardımcıları ──
  function canSeeRadar(){ try{ var A=window.VDAccess; return !!(A && ((A.isPremium&&A.isPremium())||(A.isElite&&A.isElite()))); }catch(e){return false;} }
  function canSeeArchive(){ try{ return !!(window.VDAccess && window.VDAccess.isElite && window.VDAccess.isElite()); }catch(e){return false;} }

  var _lastRows=null, _wsOpen=false, _stale=false;

  // ── Arşiv verisi (premium+ çeker; premium oran+örnek görür, detay bulanık) ──
  var _archMap = null, _archTried = false;
  function archFor(sym){ if(!_archMap) return null; return _archMap[sym] || _archMap[String(sym).replace('USDT','')] || null; }
  function loadArchive(then){
    if (_archMap || _archTried){ then(); return; }
    _archTried = true;
    try {
      fetch('/api/archive-stats').then(function(r){return r.json();}).then(function(d){
        var m={}, arr=(d&&d.byCoin)||[]; arr.forEach(function(x){ if(x&&x.key) m[x.key]=x; });
        _archMap=m; then();
      }).catch(function(){ _archMap={}; then(); });
    } catch(e){ _archMap={}; then(); }
  }

  // ── Biçim + bağlam yardımcıları ──
  function fmtPrice(p){ if(p==null) return ''; var n=+p; if(isNaN(n)) return ''; if(n>=1000) return '$'+n.toLocaleString('en-US',{maximumFractionDigits:2}); if(n>=1) return '$'+n.toFixed(3); return '$'+n.toPrecision(4); }
  function chgHtml(c){ if(c==null||isNaN(+c)) return ''; var up=(+c)>=0; return '<span style="color:'+(up?'#36d399':'#f87272')+';font-weight:700;font-size:11px">'+(up?'▲':'▼')+' '+Math.abs(+c).toFixed(2)+'%</span>'; }
  function stageWord(st){ return st==='CONFIRMED'?_L('rr.stageConfirmed',null,'Teyitli'):st==='ARMED'?_L('rr.stageArmed',null,'Hazır'):_L('rr.stageWatch',null,'İzleme'); }
  function tierClsOf(st){ return st==='CONFIRMED'?'er-gold':st==='ARMED'?'er-orange':'er-gray'; }
  function ctxLabel(c){ if(c==null||isNaN(+c)) return {txt:'—',col:'#5b6677'}; c=+c; if(c>=1.5)return{txt:_L('er.ctxStrong', null, 'Güçlü ▲'),col:'#36d399'}; if(c>=0.3)return{txt:_L('er.ctxPositive', null, 'Pozitif ▲'),col:'#36d399'}; if(c<=-1.5)return{txt:_L('er.ctxWeak', null, 'Zayıf ▼'),col:'#f87272'}; if(c<=-0.3)return{txt:_L('er.ctxNegative', null, 'Negatif ▼'),col:'#f87272'}; return{txt:_L('er.ctxNeutral', null, 'Nötr'),col:'#8b98ac'}; }
  function ethCtx(){ try{ if(window._ethData&&window._ethData.chg!=null) return +window._ethData.chg; if(window.MarketRegime&&MarketRegime._ethData&&MarketRegime._ethData.chg!=null) return +MarketRegime._ethData.chg; var el=document.getElementById('ethChg'); if(el){ var v=parseFloat((el.textContent||'').replace('%','').replace(',','.')); if(!isNaN(v)) return v; } }catch(e){} return null; }
  function reasonChips(s){ var w=[]; if(s.align>=2/3)w.push(_L('er.emaAligned', null, 'EMA/yapı hizalı')); if(s.conf>=0.6)w.push(_L('er.confStrong', null, 'Confidence güçlü')); if(s.riskInv>=0.6)w.push(_L('er.riskLow2', null, 'Risk düşük')); if(s.volFiring)w.push(_L('er.momRising', null, 'Momentum artıyor')); if((s.squeeze||0)>=0.5)w.push(_L('er.squeezeHigh', null, 'Sıkışma yüksek')); else if((s.compress||0)>=0.5)w.push(_L('er.rangeTight', null, 'Range daralıyor')); return w.slice(0,4); }

  function archBox(title, inner, color){ return '<div style="border:1px solid #1f2c45;border-radius:9px;padding:9px;background:rgba(56,189,248,.04);margin-top:9px"><div style="font-size:8.5px;color:'+color+';font-weight:800;letter-spacing:.05em;margin-bottom:4px">'+title+'</div><div style="font-size:10.5px;color:#cfe0f5">'+inner+'</div></div>'; }
  function archiveBlock(sym, elite){
    var a=archFor(sym);
    if (!a || !a.total) return archBox(_L('er.archTitle', null, '⬡ ARŞİV TUTARLILIĞI'), '<span style="color:#8b98ac">'+_L('er.archNone', null, 'Bu coin için arşiv kaydı henüz yok.')+'</span>', '#9d7dfa');
    if (a.total<5) return archBox(_L('er.archTitle', null, '⬡ ARŞİV TUTARLILIĞI'), '<span style="color:#fbbd23">'+_L('er.smallSample', null, 'Henüz az örneklem · ')+''+a.total+''+_L('er.observations', null, ' gözlem')+'</span>', '#9d7dfa');
    var rate=(a.weightedRate!=null?a.weightedRate:a.successRate)||0, rc=rate>=75?'#36d399':rate>=60?'#fbbd23':'#f87272';
    var head='<b style="color:'+rc+'">%'+Math.round(rate)+''+_L('er.consistency', null, ' tutarlılık')+'</b> <span style="color:#8b98ac">· '+a.total+''+_L('er.observations', null, ' gözlem')+'</span>';
    var brk=(a.success||0)+_L('er.correct', null, ' doğru · ')+(a.partial||0)+_L('er.partialB', null, ' kısmi · ')+(a.fail||0)+_L('er.misleading', null, ' yanıltıcı');
    if (elite) return archBox(_L('er.archTitle', null, '⬡ ARŞİV TUTARLILIĞI'), head+'<div style="font-size:10px;color:#9fb4d6;margin-top:3px">'+brk+'</div>', '#9d7dfa');
    return archBox(_L('er.eliteArch', null, '🔒 ELİTE · ARŞİV'), head
      +'<div style="filter:blur(4px);user-select:none;font-size:10px;color:#9fb4d6;margin-top:3px">'+brk+'</div>'
      +'<a href="/legal/premium.html" style="display:inline-block;margin-top:6px;font-size:9px;font-weight:800;color:#04101f;background:linear-gradient(90deg,#9d7dfa,#38bdf8);padding:3px 9px;border-radius:6px;text-decoration:none">Elite ile detay</a>', '#b39dfa');
  }

  // ── YÖN görünürlüğü (build 133): olgunluktan AYRI bilgi ──
  function dirInfo(r){
    var d=(r.dir||'').toUpperCase();
    if(d==='LONG')  return {key:'long',  txt:'LONG',  emo:'🟢', col:'#36d399', glow:'rgba(54,211,153,.22)'};
    if(d==='SHORT') return {key:'short', txt:'SHORT', emo:'🔴', col:'#f87272', glow:'rgba(248,114,114,.22)'};
    return {key:'watch', txt:_L('rr.watch', null, 'İZLE'), emo:'⚪', col:'#8b98ac', glow:'rgba(139,152,172,.14)'};
  }
  function computeBias(rows){
    var L=0,S=0,N=0;
    rows.forEach(function(r){ var d=(r.dir||'').toUpperCase(); if(d==='LONG')L++; else if(d==='SHORT')S++; else N++; });
    var tot=L+S; var lp=tot?Math.round(L/tot*100):0; var sp=tot?100-lp:0;
    var dom=(L>S)?'LONG':((S>L)?'SHORT':'DENGEDE');
    return {L:L,S:S,N:N,lp:lp,sp:sp,dom:dom,tot:tot};
  }
  function biasHtml(b){
    var domCol=b.dom==='LONG'?'#36d399':(b.dom==='SHORT'?'#f87272':'#8b98ac');
    var domTxt=b.dom==='LONG'?_L('er.longDom', null, '🟢 LONG BASKIN'):(b.dom==='SHORT'?_L('er.shortDom', null, '🔴 SHORT BASKIN'):_L('er.balanced', null, '⚪ DENGEDE'));
    return '<div class="er-bias"><div class="er-bias-h">'+_L('er.biasHeader', null, '⚡ AI Market Bias — bugün sistem ne tarafta?')+'</div>'
      + '<div class="er-bias-bar"><div class="er-bias-l" style="width:'+b.lp+'%"></div><div class="er-bias-s" style="width:'+b.sp+'%"></div></div>'
      + '<div class="er-bias-row"><span class="er-bias-cnt" style="color:#36d399">🟢 LONG '+b.L+' <span style="color:#8b98ac;font-weight:600">(%'+b.lp+')</span></span>'
      + '<span class="er-bias-cnt" style="color:#f87272">🔴 SHORT '+b.S+' <span style="color:#8b98ac;font-weight:600">(%'+b.sp+')</span></span>'
      + '<span class="er-bias-dom" style="color:'+domCol+';background:'+domCol+'1a;border:1px solid '+domCol+'55">'+domTxt+'</span></div>'
      + '<div class="er-micro" style="margin-top:8px">'+_L('er.biasMicro2', null, 'Yön dağılımı'+_L('er.observations', null, ' gözlem')+'i — olgunluk katmanından (Altın/Turuncu/Gri) ayrı bilgidir. Yatırım tavsiyesi değildir.')+'</div></div>';
  }

  // ── HYBRID V2 kart bloğu: Price / Derivative / FINAL üçlüsü + faktör rozetleri ──
  function vWord(v){ return v==='CONFIRMED'?_L('hy.conf',null,'Confirmed'):v==='ARMED'?_L('hy.armed',null,'Armed'):v==='WATCH'?_L('hy.watch',null,'Watch'):'—'; }
  function vCol(v){ return v==='CONFIRMED'?'#e8b84b':v==='ARMED'?'#ff8a3d':v==='WATCH'?'#9aa6b8':'#5b6678'; }
  // ── HYBRID BLOK — ASLA GİZLENMEZ (Volkan kural 6) ──────────────────
  // 5 durum: FULL (deriv var) · NOT_REQUESTED (top-N dışı) · WARMING
  // (istendi, bekliyor) · LOW_DATA (<2 faktör) · CG_OFF · ENGINE_MISSING.
  // Hata bile olsa kart kırılmaz; blok durumunu söyler.
  var _hyWarned = {};
  // Tembel değerlendirme tamamlanınca kartları BİR KEZ tazele (fırtına yok)
  var _hyRrT = null;
  function _hyRerender(){
    if(_hyRrT) return;
    _hyRrT = setTimeout(function(){
      _hyRrT = null;
      try { if(_lastRows && _lastRows.length){ renderSummary(_lastRows); if(_wsOpen) renderWorkspace(_lastRows); } } catch(e){}
    }, 900);
  }
  function _hyWarn(code, msg){
    if(_hyWarned[code]) return; _hyWarned[code]=1;
    try { console.error('[Hybrid] '+msg); } catch(e){}
  }
  function hybridBlock(r){
    try { return _hybridBlockInner(r); }
    catch(e){
      try { console.warn('[Hybrid] blok render hatası:', e); } catch(_e){}
      return '<div class="er-hy"><div class="er-hy-na">'+_L('hy.naErr',null,'Hybrid blok hatası — konsola bakın')+'</div></div>';
    }
  }
  function _hybridBlockInner(r){
    var HE=window.VDHybridEngine;
    var p=(r&&r.s&&r.s.score!=null&&isFinite(+r.s.score))?Math.round(+r.s.score):null;

    function line(lbl,sc,v,strong,tag){
      var c=vCol(v);
      return '<div class="er-hy-line'+(strong?' er-hy-final':'')+'"><span class="er-hy-lbl">'+lbl+'</span>'
        + '<b class="er-hy-sc">'+(sc!=null?sc:'—')+'</b>'
        + '<span class="er-hy-v" style="color:'+c+';border-color:'+c+'66;background:'+c+'14">'+(strong?'★ ':'')+vWord(v)+(tag?' <i class="er-hy-fb">'+tag+'</i>':'')+'</span></div>';
    }

    // Motor dosyası yüklenmemiş → blok YİNE görünür + console.error (bir kez)
    if(!HE || !HE.get){
      _hyWarn('engine', 'VDHybridEngine yok — engines/intelligence/hybrid-deriv-score.js yüklenmemiş olabilir (404 / script etiketi eksik). Kartlar price-fallback gösteriyor.');
      var pv0 = p==null?null:(p>=80?'CONFIRMED':p>=65?'ARMED':p>=50?'WATCH':null);
      return '<div class="er-hy">'
        + line(_L('hy.price',null,'Price Structure'), p, pv0, false)
        + line(_L('hy.deriv',null,'Derivative Intel'), null, null, false)
        + '<div class="er-hy-na">'+_L('hy.naEngine',null,'Hybrid motoru yüklenmedi — konsolu kontrol et')+'</div>'
        + line(_L('hy.final',null,'FINAL HYBRID'), p, pv0, true, _L('hy.fb',null,'price fallback'))
        + '</div>';
    }

    var rec=HE.get(r.sym, r.dir);
    var price=rec?rec.price:p;
    var pv=rec?rec.priceVerdict:(HE.verdictOf?HE.verdictOf(price):null);
    var dAvail=!!(rec&&rec.deriv&&rec.deriv.available);
    var d=dAvail?rec.deriv.score:null, dv=dAvail?rec.derivVerdict:null;
    var h=rec?rec.hybrid:price, hv=rec?rec.hybridVerdict:pv;

    // Deriv N/A nedeni — kullanıcı HANGİ durumda olduğunu görür (Volkan kural 3+5)
    var naMsg='';
    if(!dAvail){
      var cgOn=false;
      try { cgOn=!!(window.CoinGlassService&&window.CoinGlassService.isEnabled&&window.CoinGlassService.isEnabled()); } catch(e){}
      // ── TEMBEL ÖZ-İYİLEŞME: hangi render yolundan gelirsek gelelim,
      // rec yoksa burada iste (inflight+TTL tekrarları korur; görünür kart ≤9 → limit-güvenli).
      // Tamamlanınca kartlar debounce ile BİR KEZ tazelenir.
      if(!rec && cgOn && p!=null && HE.evaluate){
        try { HE.evaluate(r.sym, r.dir, p).then(function(){ _hyRerender(); }).catch(function(){}); } catch(e){}
      }
      if(!cgOn){
        naMsg=_L('hy.naCgOff',null,'CoinGlass kapalı/erişilemez — konsoldaki [CoinGlass] hatasına bak');
        _hyWarn('cgoff','CoinGlass servis kapalı/erişilemez — DerivScore üretilemiyor (price fallback aktif).');
      } else if(rec && rec.deriv && rec.deriv.nFactors!=null && HE.CFG && rec.deriv.nFactors < HE.CFG.MIN_FACTORS){
        naMsg=_L('hy.naLow',{n:rec.deriv.nFactors},'Deriv verisi yetersiz ('+rec.deriv.nFactors+'/4 faktör)');
      } else if(HE.requested && HE.requested(r.sym, r.dir)){
        naMsg=_L('hy.naWarm',null,'Deriv verisi ısınıyor — sonraki taramada dolar');
      } else {
        naMsg=_L('hy.naNotReq',null,'Deriv bu setup için istenmedi (price top-10 dışı)');
      }
    }

    var chips='';
    if(dAvail&&rec.deriv.factors){
      var f=rec.deriv.factors, cs=[];
      if(f.funding) cs.push((f.funding.aligned?'✓ ':'✗ ')+_L('hy.fFund',null,'Funding'));
      if(f.oi) cs.push((f.oi.expanding?'✓ ':'· ')+_L('hy.fOi',null,'OI'));
      if(f.positioning) cs.push((f.positioning.context==='SMART_WITH'?'✓ ':f.positioning.context==='SMART_AGAINST'?'✗ ':'· ')+_L('hy.fPos',null,'Smart $'));
      if(f.liquidation) cs.push((f.liquidation.context==='CLEAN'?'✓ ':f.liquidation.context==='STORM'?'✗ ':'· ')+_L('hy.fLiq',null,'Liq'));
      chips='<div class="er-hy-chips">'+cs.map(function(t){return '<span class="er-hy-chip'+(t.charAt(0)==='✓'?' ok':t.charAt(0)==='✗'?' bad':'')+'">'+esc(t)+'</span>';}).join('')+'</div>';
    }

    return '<div class="er-hy">'
      + line(_L('hy.price',null,'Price Structure'), price, pv, false)
      + line(_L('hy.deriv',null,'Derivative Intel'), d, dv, false, dAvail?null:_L('hy.naTag',null,'N/A'))
      + (naMsg?'<div class="er-hy-na">'+naMsg+'</div>':'')
      + line(_L('hy.final',null,'FINAL HYBRID'), h, hv, true, dAvail?null:_L('hy.fb',null,'price fallback'))
      + chips + '</div>';
  }

  function radarCard(r, tierCls, big, elite, ethC){
    var sym=esc(r.sym.replace('USDT','')), score=(r.s.score!=null?r.s.score:'—'), rsi=(r.s.rsi!=null?(+r.s.rsi).toFixed(1):'—'), sw=(typeof score==='number'?score:0);
    var btc=ctxLabel(r.btcChg), col=(tierCls==='er-gold')?'#e8b84b':(tierCls==='er-orange')?'#ff8a3d':'#9aa6b8';
    var chips=reasonChips(r.s).map(function(t){return '<span class="er-chip">'+esc(t)+'</span>';}).join('');
    var di=dirInfo(r);
    return '<div class="er-card er-d-'+di.key+' '+tierCls+(big?' er-big':'')+'" data-sym="'+esc(r.sym).replace(/\'/g,'')+'" data-dir="'+di.txt+'" data-score="'+score+'" style="box-shadow:0 0 0 1px '+di.glow+',0 10px 26px -16px '+di.glow+'">'
      + '<div class="er-dirbadge" style="color:'+di.col+';border-color:'+di.col+'66;background:'+di.col+'1a">'+di.emo+' '+di.txt+'</div>'
      + '<div class="er-c-top"><div class="er-logo'+(big?'':' er-logo-sm')+'" style="box-shadow:0 0 0 2px '+di.col+',0 0 12px '+di.glow+'">'+sym.slice(0,3)+'</div>'
      + '<div style="flex:1;min-width:0"><div class="er-sym"'+(big?'':' style="font-size:13px"')+'>'+sym+' '+chgHtml(r.chg)+'</div><div class="er-price">'+fmtPrice(r.price)+'</div></div>'
      + '<span class="er-stage" style="color:'+col+';border:1px solid '+col+'80;background:'+col+'1a">'+stageWord(r.stage)+'</span></div>'
      + '<div class="er-scrow"><span>'+_L('er.confScoreLbl', null, 'Güven Skoru')+'</span><b style="color:'+col+'">'+score+'<span style="color:#8b98ac;font-size:9px">/100</span></b></div>'
      + '<div class="er-bar"><i style="width:'+sw+'%;background:linear-gradient(90deg,'+col+'88,'+col+')"></i></div>'
      + hybridBlock(r)
      + '<div class="er-tech"><span>RSI <b>'+rsi+'</b></span><span>EMA <b style="color:'+(r.s.okEma?'#36d399':'#8b98ac')+'">'+(r.s.okEma?'▲▲▲':'—')+'</b></span><span>MACD <b style="color:'+(r.s.okMacd?'#36d399':'#8b98ac')+'">'+(r.s.okMacd?'▲':'—')+'</b></span><span>Readiness <b>'+r.value+'</b></span></div>'
      + '<div class="er-ctx"><span>BTC <b style="color:'+btc.col+'">'+btc.txt+'</b></span><span>ETH <b style="color:'+ethC.col+'">'+ethC.txt+'</b></span></div>'
      + (chips?'<div class="er-why"><span class="er-why-h">Neden burada?</span><div class="er-chips">'+chips+'</div></div>':'')
      + '<div class="er-foot"><span class="er-fresh">● '+relTime(r.stageSince)+'</span><span class="er-link">'+_L('er.viewChart', null, 'Grafikte İncele →')+'</span></div>'
      + archiveBlock(r.sym, elite)
      + '<div class="er-micro">'+_L('er.matObs', null, 'Yapı olgunluğu'+_L('er.observations', null, ' gözlem')+'i — işlem/yön önerisi değildir.')+'</div></div>';
  }

  // ── TEK DEV HERO KART: en olgun fırsat (göz buraya gider) ──
  function heroCard(r, elite, ethC){
    var sym=esc(r.sym.replace('USDT','')), score=(r.s.score!=null?r.s.score:'—');
    try {
      var _hh = (window.VDHybridEngine && window.VDHybridEngine.get) ? window.VDHybridEngine.get(r.sym, r.dir) : null;
      if (_hh && _hh.hybrid != null) score = _hh.hybrid;
    } catch (e) {}
    var sw=(typeof score==='number'?score:0);
    var col=(r.stage==='CONFIRMED')?'#e8b84b':(r.stage==='ARMED')?'#ff8a3d':'#9aa6b8';
    var chips=reasonChips(r.s).map(function(t){return '<span class="er-hchip">✓ '+esc(t)+'</span>';}).join('');
    var dir=(r.dir||'').toUpperCase();
    var dirTxt=dir==='LONG'?_L('er.upBias', null, 'Yukarı eğilim'):(dir==='SHORT'?_L('er.downBias', null, 'Aşağı eğilim'):'—');
    var dirCol=dir==='LONG'?'#36d399':(dir==='SHORT'?'#f87272':'#8b98ac');
    var di=dirInfo(r);
    return '<div class="er-card er-hero er-d-'+di.key+'" data-sym="'+esc(r.sym).replace(/\'/g,'')+'" data-dir="'+di.txt+'" data-score="'+score+'" style="box-shadow:0 0 0 1px '+di.glow+',0 16px 40px -20px '+di.glow+'">'
      + '<div class="er-hero-badges"><span class="er-hero-dirbadge" style="color:'+di.col+';border-color:'+di.col+'66;background:'+di.col+'1a">'+di.emo+' '+di.txt+'</span><span class="er-hero-tag" style="color:'+col+';border-color:'+col+'66;background:'+col+'14">'+_L('er.mostMature', null, '🥇 En Olgun Fırsat')+'</span></div>'
      + '<div class="er-hero-top"><div class="er-hero-logo" style="box-shadow:0 0 0 3px '+di.col+',0 0 16px '+di.glow+'">'+sym.slice(0,4)+'</div>'
      + '<div style="flex:1;min-width:0"><div class="er-hero-sym">'+sym+' '+chgHtml(r.chg)+'</div><div class="er-hero-price">'+fmtPrice(r.price)+'</div></div>'
      + '<div class="er-hero-score"><div class="er-hero-num" style="color:'+col+'">'+score+'<span>/100</span></div><div class="er-hero-slbl">Analiz skoru</div></div></div>'
      + '<div class="er-hero-bar"><i style="width:'+sw+'%;background:linear-gradient(90deg,'+col+'88,'+col+')"></i></div>'
      + '<div class="er-hero-meta"><span class="er-hero-stage" style="color:'+col+';border-color:'+col+'80;background:'+col+'1a">'+stageWord(r.stage)+'</span>'
      + '<span class="er-hero-dir" style="color:'+dirCol+'">'+_L('er.dirBias', null, 'Yön eğilimi: ')+''+dirTxt+'</span>'
      + '<span class="er-hero-ctx">BTC '+ctxLabel(r.btcChg).txt+' · ETH '+ethC.txt+'</span></div>'
      + hybridBlock(r)
      + (chips?'<div class="er-hero-why"><span class="er-hero-whyh">'+_L('er.whyStood', null, 'Neden öne çıktı?')+'</span><div class="er-hchips">'+chips+'</div></div>':'')
      + '<button class="er-hero-cta">'+_L('er.goChart', null, 'Grafiğe Git →')+'</button>'
      + '<div class="er-micro">'+_L('er.matObs2', null, 'Yapı olgunluğu'+_L('er.observations', null, ' gözlem')+'i — işlem/yön önerisi değildir, yatırım tavsiyesi değildir.')+'</div></div>';
  }

  var STYLE_CSS=''
  + '.vd-radar .er-hy{margin:7px 0 4px;padding:7px 8px;background:#0a111e;border:1px solid #1a2434;border-radius:9px}'
  + '.vd-radar .er-hy-line{display:flex;align-items:center;gap:7px;font-size:10px;color:#8b98ac;padding:2px 0}'
  + '.vd-radar .er-hy-lbl{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.vd-radar .er-hy-sc{color:#e6edf6;font-size:11px;min-width:22px;text-align:right;font-variant-numeric:tabular-nums}'
  + '.vd-radar .er-hy-v{font-size:9px;font-weight:700;padding:1px 7px;border-radius:8px;border:1px solid}'
  + '.vd-radar .er-hy-final{border-top:1px dashed #223046;margin-top:3px;padding-top:5px}'
  + '.vd-radar .er-hy-final .er-hy-lbl{color:#cfd9e6;font-weight:700}'
  + '.vd-radar .er-hy-final .er-hy-sc{font-size:13px}'
  + '.vd-radar .er-hy-na{font-size:9px;color:#5b6678;padding:1px 0 3px}'
  + '.vd-radar .er-hy-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}'
  + '.vd-radar .er-hy-chip{font-size:8.5px;color:#8b98ac;border:1px solid #223046;border-radius:7px;padding:1px 6px}'
  + '.vd-radar .er-hy-chip.ok{color:#36d399;border-color:#36d39955}'
  + '.vd-radar .er-hy-chip.bad{color:#f87272;border-color:#f8727255}'
  + '.vd-radar .er-hy-fb{font-style:normal;font-size:7.5px;opacity:.75;font-weight:600}'
  + '.vd-radar .er-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}'
  + '.vd-radar .er-title{font-size:14px;font-weight:800;color:#e6edf6}'
  + '.vd-radar .er-live{font-size:10px;color:#36d399}'
  + '.vd-radar .er-scan{margin-left:auto;font-size:10.5px;color:#8b98ac;font-variant-numeric:tabular-nums}'
  + '.vd-radar .er-note{font-size:10.5px;color:#8b98ac;line-height:1.5;margin-bottom:12px;border-left:2px solid #1e2836;padding-left:9px}'
  + '.vd-radar .er-tier{margin-bottom:14px}'
  + '.vd-radar .er-tier-h{font-size:11px;font-weight:800;letter-spacing:.05em;margin:0 0 8px}'
  + '.vd-radar .er-gold-h{color:#e8b84b}.vd-radar .er-orange-h{color:#ff8a3d}.vd-radar .er-gray-h{color:#9aa6b8}'
  + '.vd-radar .er-grid{display:grid;gap:11px}'
  + '.vd-radar .er-grid-g{grid-template-columns:repeat(auto-fit,minmax(238px,1fr))}'
  + '.vd-radar .er-grid-c{grid-template-columns:repeat(auto-fit,minmax(196px,1fr))}'
  + '.vd-radar .er-card{background:#0e1626;border:1px solid #1e2836;border-radius:13px;padding:12px;cursor:pointer;transition:transform .15s ease,border-color .15s ease}'
  + '.vd-radar .er-card:hover{transform:translateY(-2px);border-color:#2b3a52}'
  + '.vd-radar .er-big{padding:15px}'
  + '.vd-radar .er-gold{border-top:2px solid #e8b84b;box-shadow:0 0 0 1px rgba(232,184,75,.12)}'
  + '.vd-radar .er-orange{border-top:2px solid #ff8a3d}'
  + '.vd-radar .er-gray{border-top:2px solid #6b7686}'
  + '.vd-radar .er-c-top{display:flex;align-items:center;gap:9px;margin-bottom:9px}'
  + '.vd-radar .er-logo{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#e8b84b,#a9791f);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;color:#1a1305;flex-shrink:0}'
  + '.vd-radar .er-orange .er-logo{background:linear-gradient(135deg,#ff8a3d,#b85a1a);color:#1a0f05}'
  + '.vd-radar .er-gray .er-logo{background:linear-gradient(135deg,#9aa6b8,#5c6675);color:#10151d}'
  + '.vd-radar .er-logo-sm{width:26px;height:26px;font-size:9px}'
  + '.vd-radar .er-sym{font-weight:800;font-size:15px;color:#e6edf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.vd-radar .er-price{font-size:11px;color:#8b98ac}'
  + '.vd-radar .er-stage{font-size:8.5px;font-weight:800;letter-spacing:.04em;padding:3px 7px;border-radius:6px;white-space:nowrap}'
  + '.vd-radar .er-scrow{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#8b98ac;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}'
  + '.vd-radar .er-scrow b{font-family:ui-monospace,Menlo,monospace;font-size:13px}'
  + '.vd-radar .er-bar{height:5px;background:#1a2330;border-radius:4px;overflow:hidden;margin-bottom:10px}.vd-radar .er-bar>i{display:block;height:100%}'
  + '.vd-radar .er-tech{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:11px;color:#8b98ac;margin-bottom:8px}.vd-radar .er-tech b{color:#e6edf6}'
  + '.vd-radar .er-ctx{display:flex;justify-content:space-between;gap:10px;font-size:10.5px;color:#8b98ac;border-top:1px solid #18212f;border-bottom:1px solid #18212f;padding:6px 0;margin-bottom:8px}'
  + '.vd-radar .er-why{margin-bottom:8px}.vd-radar .er-why-h{font-size:9px;color:#8b98ac;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:5px}'
  + '.vd-radar .er-chips{display:flex;gap:5px;flex-wrap:wrap}'
  + '.vd-radar .er-chip{font-size:9.5px;color:#9fb4d6;background:rgba(255,255,255,.03);border:1px solid #1e2836;border-radius:5px;padding:2px 7px}'
  + '.vd-radar .er-foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #1e2836;padding-top:8px}'
  + '.vd-radar .er-fresh{font-size:10px;color:#36d399;font-weight:700}'
  + '.vd-radar .er-link{font-size:10px;color:#3b9eff;font-weight:700}'
  + '.vd-radar .er-micro{font-size:9px;color:#8b98ac;font-style:italic;margin-top:8px}'
  + '.vd-radar .er-empty{font-size:11px;color:#8b98ac;padding:10px;border:1px dashed #1e2836;border-radius:10px}'
  + '.vd-radar .er-sum-counts{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 12px}'
  + '.vd-radar .er-sum-count{font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;border:1px solid #1e2836;background:#0e1626}'
  + '.vd-radar .er-openbtn{display:block;width:100%;margin-top:12px;text-align:center;font-size:13px;font-weight:800;color:#04101f;background:linear-gradient(90deg,#3b9eff,#38bdf8);border:none;border-radius:11px;padding:12px;cursor:pointer}'
  + '.vd-radar .er-openbtn:hover{filter:brightness(1.07)}'
  + '.vd-radar .er-hero{background:linear-gradient(160deg,#121b2c,#0d1421);border:1px solid #243349;padding:18px;cursor:pointer}'
  + '.vd-radar .er-hero:hover{transform:translateY(-2px);border-color:#33455f}'
  + '.vd-radar .er-hero-tag{display:inline-block;font-size:11px;font-weight:800;border:1px solid;border-radius:8px;padding:4px 10px;margin-bottom:12px}'
  + '.vd-radar .er-hero-top{display:flex;align-items:center;gap:13px;margin-bottom:12px}'
  + '.vd-radar .er-hero-logo{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#e8b84b,#a9791f);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#1a1305;flex-shrink:0}'
  + '.vd-radar .er-hero-sym{font-weight:800;font-size:22px;color:#e6edf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.vd-radar .er-hero-price{font-size:12px;color:#8b98ac;margin-top:1px}'
  + '.vd-radar .er-hero-score{text-align:right;flex-shrink:0}'
  + '.vd-radar .er-hero-num{font-family:ui-monospace,Menlo,monospace;font-size:30px;font-weight:900;line-height:1}.vd-radar .er-hero-num span{font-size:12px;color:#8b98ac;font-weight:700}'
  + '.vd-radar .er-hero-slbl{font-size:9px;color:#8b98ac;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}'
  + '.vd-radar .er-hero-bar{height:7px;background:#1a2330;border-radius:5px;overflow:hidden;margin-bottom:13px}.vd-radar .er-hero-bar>i{display:block;height:100%}'
  + '.vd-radar .er-hero-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}'
  + '.vd-radar .er-hero-stage{font-size:10px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:7px;border:1px solid}'
  + '.vd-radar .er-hero-dir{font-size:12px;font-weight:700}'
  + '.vd-radar .er-hero-ctx{margin-left:auto;font-size:10.5px;color:#8b98ac}'
  + '.vd-radar .er-hero-why{margin-bottom:14px}.vd-radar .er-hero-whyh{font-size:10px;color:#8b98ac;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:7px}'
  + '.vd-radar .er-hchips{display:flex;gap:7px;flex-wrap:wrap}'
  + '.vd-radar .er-hchip{font-size:11px;color:#9fe6c4;background:rgba(54,211,153,.1);border:1px solid rgba(54,211,153,.22);border-radius:7px;padding:4px 10px}'
  + '.vd-radar .er-hero-cta{display:block;width:100%;font-size:14px;font-weight:800;color:#04101f;background:linear-gradient(90deg,#3b9eff,#38bdf8);border:none;border-radius:12px;padding:14px;cursor:pointer}'
  + '.vd-radar .er-hero-cta:hover{filter:brightness(1.08)}'
  + '.vd-radar .er-more{text-align:center;margin-top:11px}.vd-radar .er-more-link{font-size:12px;font-weight:700;color:#3b9eff;cursor:pointer}'
  + '.vd-radar .er-dirbadge{display:inline-block;font-size:11px;font-weight:900;letter-spacing:.06em;border:1px solid;border-radius:7px;padding:3px 9px;margin-bottom:9px}'
  + '.vd-radar .er-hero-badges{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px}'
  + '.vd-radar .er-hero-dirbadge{font-size:15px;font-weight:900;letter-spacing:.06em;border:1px solid;border-radius:9px;padding:6px 14px}'
  + '.vd-radar .er-d-long{border-top-color:#36d399 !important}'
  + '.vd-radar .er-d-short{border-top-color:#f87272 !important}'
  + '.vd-radar .er-bias{background:linear-gradient(160deg,#101a2a,#0d1421);border:1px solid #243349;border-radius:13px;padding:14px 15px;margin-bottom:15px}'
  + '.vd-radar .er-bias-h{font-size:11px;font-weight:800;letter-spacing:.08em;color:#9fb4d6;text-transform:uppercase;margin-bottom:10px}'
  + '.vd-radar .er-bias-bar{height:11px;border-radius:6px;overflow:hidden;display:flex;background:#1a2330;margin-bottom:10px}'
  + '.vd-radar .er-bias-l{background:linear-gradient(90deg,#1d9e75,#36d399);height:100%;transition:width .4s}'
  + '.vd-radar .er-bias-s{background:linear-gradient(90deg,#f87272,#b83232);height:100%;transition:width .4s}'
  + '.vd-radar .er-bias-row{display:flex;align-items:center;gap:13px;flex-wrap:wrap;font-size:13px}'
  + '.vd-radar .er-bias-cnt{font-weight:800}'
  + '.vd-radar .er-bias-dom{margin-left:auto;font-size:13px;font-weight:900;letter-spacing:.04em;padding:5px 13px;border-radius:9px}'
  + '.er-ws-overlay{position:fixed;inset:0;background:#0a0e17;z-index:9000;overflow-y:auto;display:none}'
  + '.er-ws-overlay.open{display:block}'
  + '.er-ws-bar{position:sticky;top:0;background:rgba(10,14,23,.96);border-bottom:1px solid #1e2836;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 16px;z-index:2}'
  + '.er-ws-back{font-size:13px;font-weight:700;color:#e6edf6;background:#111722;border:1px solid #1e2836;border-radius:9px;padding:8px 14px;cursor:pointer}'
  + '.er-ws-back:hover{border-color:#2b3a52}'
  + '.er-ws-title{font-size:14px;font-weight:800;color:#e6edf6}'
  + '.er-ws-live{font-size:10.5px;color:#36d399}'
  + '.er-ws-scan{margin-left:auto;font-size:10.5px;color:#8b98ac;font-variant-numeric:tabular-nums}'
  + '.er-ws-body{padding:16px;max-width:1100px;margin:0 auto}';

  function injectStyle(){ if(document.getElementById('vd-radar-style')) return; var st=document.createElement('style'); st.id='vd-radar-style'; st.textContent=STYLE_CSS; (document.head||document.documentElement).appendChild(st); }

  function bindClicks(mount){
    try {
      mount.querySelectorAll('.er-card').forEach(function(c){
        c.addEventListener('click', function(e){
          if (e.target && e.target.closest && e.target.closest('a')) return;
          var sym=c.getAttribute('data-sym'); if(!sym) return;
          var _dir=c.getAttribute('data-dir')||'', _sc=c.getAttribute('data-score')||'';
          function _toDetail(){ if(window.VDControlCenter&&VDControlCenter.coinDetail){ setTimeout(function(){ try{ VDControlCenter.coinDetail(sym, _dir, _sc); }catch(e){} },120); } else { var el=document.getElementById('mainPanel'); if(el) setTimeout(function(){ el.scrollIntoView({behavior:'smooth'}); },200); } }
          if (typeof window.openCoin==='function'){ window.openCoin(sym); if(_wsOpen) closeWS(); _toDetail(); return; }
          if (typeof window.loadCoin==='function'){ window.SYM=sym; var inp=document.getElementById('symInput'); if(inp) inp.value=sym; try{ window.loadCoin(sym, window.INTV||'15m'); }catch(e){} if(_wsOpen) closeWS(); _toDetail(); }
        });
      });
    } catch(e){}
  }

  // ── Veriyi 3 katmana böl (yön değil; olgunluk+güven+arşiv+tazelik) ──
  function computeTiers(rows){
    var elite=canSeeArchive(), ethC=ctxLabel(ethCtx());
    var staged=rows.filter(function(r){return r.stage;});
    function comp(r){ var a=archFor(r.sym); var ar=(a&&a.total>=5)?((a.weightedRate!=null?a.weightedRate:a.successRate)||0):0; var ageMin=Math.max(0,(Date.now()-(r.stageSince||Date.now()))/60000); var fresh=Math.max(0,1-ageMin/30)*8; return (r.s.score||0)+ar*0.5+fresh; }
    function pick(st){ return staged.filter(function(r){return r.stage===st;}).sort(function(a,b){return comp(b)-comp(a);}).slice(0,3); }
    var scanned=(window.VD_STATE&&window.VD_STATE.scanResults&&window.VD_STATE.scanResults.length)||rows.length||0;
    return { gold:pick('CONFIRMED'), orange:pick('ARMED'), gray:pick('WATCH'), elite:elite, ethC:ethC, scanned:scanned, stale:(Date.now()-_lastScanAt>CFG.staleMs) };
  }
  function tierHtml(title,cls,list,big,elite,ethC){
    var cards=list.length?list.map(function(r){return radarCard(r,cls,big,elite,ethC);}).join('') : '<div class="er-empty">'+_L('er.noStageSetup', null, 'Bu taramada bu aşamada setup yok.')+'</div>';
    return '<div class="er-tier"><div class="er-tier-h '+cls+'-h">'+title+'</div><div class="er-grid '+(big?'er-grid-g':'er-grid-c')+'">'+cards+'</div></div>';
  }

  // ── ANA EKRAN: ÖZET (en güçlü 3 + sayım + "Tüm Radarı Aç") ──
  function renderSummary(rows){
    var mount=document.getElementById('earlyRadar'); if(!mount) return;
    injectStyle(); mount.classList.add('vd-radar');
    var t=computeTiers(rows);
    var preview=t.gold.concat(t.orange,t.gray).slice(0,3);
    var total=t.gold.length+t.orange.length+t.gray.length;
    var head='<div class="er-head"><span class="er-title">'+_L('er.radarTitle', null, '⚡ AI Piyasa Radarı')+'</span>'
      + '<span class="er-live">'+(_stale?_L('er.prevScan', null, '· önceki tarama · yenileniyor…'):(t.stale?_L('er.staleData', null, '· bayat veri'):_L('er.liveScan', null, '· canlı tarama')))+'</span>'
      + '<span class="er-scan">Son tarama: '+relTime(_lastScanAt)+' · '+t.scanned+' coin</span></div>'
      + '<div class="er-note">'+_L('er.dashSummary', null, 'Dashboard özeti — en güçlü yapılar. Tam 9 kart için workspace. İşlem/yön önerisi değildir; yatırım tavsiyesi değildir.')+'</div>'
      + '<div class="er-sum-counts"><span class="er-sum-count" style="color:#e8b84b">'+_L('er.confirmedCnt', null, '🥇 Teyitli ')+''+t.gold.length+'</span><span class="er-sum-count" style="color:#ff8a3d">'+_L('er.readyCnt', null, '🟠 Hazır ')+''+t.orange.length+'</span><span class="er-sum-count" style="color:#9aa6b8">'+_L('er.watchCnt', null, '⚪ İzleme ')+''+t.gray.length+'</span></div>';
    var body = preview.length
      ? heroCard(preview[0], t.elite, t.ethC) + (total>1 ? '<div class="er-more"><span class="er-more-link" id="erMoreLink">+ '+(total-1)+''+_L('er.moreOpps', null, ' fırsat daha · Tümünü Aç →')+'</span></div>' : '')
      : '<div class="er-empty">'+_L('er.noSuitable', null, 'Bu taramada uygun yapı bulunmadı — sonraki taramada güncellenecek.')+'</div>';
    var btn = total ? '<button class="er-openbtn" id="erOpenWs">'+_L('er.openRadar9', null, 'Tüm Radarı Aç · 9 kart →')+'</button>' : '';
    var bias = computeBias(rows.filter(function(r){return r.stage;}));
    var biasBlock = (bias.tot>0) ? biasHtml(bias) : '';
    mount.innerHTML=biasBlock+head+body+btn;
    bindClicks(mount);
    var ob=document.getElementById('erOpenWs'); if(ob) ob.addEventListener('click', function(e){ e.stopPropagation(); openWS(); });
    var ml=document.getElementById('erMoreLink'); if(ml) ml.addEventListener('click', function(e){ e.stopPropagation(); openWS(); });
  }

  // ── WORKSPACE OVERLAY: tam 9 kart (Altın/Turuncu/Gri 3'er) ──
  function ensureWS(){
    injectStyle();
    var ov=document.getElementById('vdRadarWS');
    if(ov) return { overlay:ov, body:ov.querySelector('.er-ws-body'), live:ov.querySelector('.er-ws-live'), scan:ov.querySelector('.er-ws-scan') };
    ov=document.createElement('div'); ov.id='vdRadarWS'; ov.className='er-ws-overlay vd-radar';
    ov.innerHTML='<div class="er-ws-bar"><button class="er-ws-back" id="erWsBack">'+_L('er.backDash', null, '← Dashboard’a Dön')+'</button><span class="er-ws-title">'+_L('er.radarFullView', null, ''+_L('er.radarTitle', null, '⚡ AI Piyasa Radarı')+' — Tüm Görünüm')+'</span><span class="er-ws-live"></span><span class="er-ws-scan"></span></div><div class="er-ws-body"></div>';
    document.body.appendChild(ov);
    var bk=ov.querySelector('#erWsBack'); if(bk) bk.addEventListener('click', closeWS);
    if(!window._vdRadarEsc){ window._vdRadarEsc=1; document.addEventListener('keydown', function(e){ if(e.key==='Escape'&&_wsOpen) closeWS(); }); }
    return { overlay:ov, body:ov.querySelector('.er-ws-body'), live:ov.querySelector('.er-ws-live'), scan:ov.querySelector('.er-ws-scan') };
  }
  function renderWorkspace(rows){
    var refs=ensureWS(); var t=computeTiers(rows);
    if(refs.live) refs.live.textContent=t.stale?_L('er.staleData', null, '· bayat veri'):_L('er.liveScan', null, '· canlı tarama');
    if(refs.scan) refs.scan.textContent=_L('er.lastScan', null, 'Son tarama: ')+relTime(_lastScanAt)+' · '+t.scanned+_L('er.coinsScanned', null, ' coin tarandı');
    var note='<div class="er-note">'+_L('er.ranking', null, 'Sıralama: yapı olgunluğu + güven skoru + arşiv tutarlılığı + tazelik (yön değil). İzleme → Hazır → Teyitli — işlem/yön önerisi değildir; yatırım tavsiyesi değildir.')+'</div>';
    if(!t.gold.length && !t.orange.length && !t.gray.length){ refs.body.innerHTML=note+'<div style="font-size:12px;color:#8b98ac;padding:10px 0">'+_L('er.noSuitable2', null, 'Bu taramada uygun yapı bulunmadı.')+'</div>'; return; }
    refs.body.innerHTML=note
      + tierHtml(_L('er.tierGold', null, '🥇 ALTIN · Confirmed'),'er-gold',t.gold,true,t.elite,t.ethC)
      + tierHtml(_L('er.tierOrange', null, '🟠 TURUNCU · Armed'),'er-orange',t.orange,false,t.elite,t.ethC)
      + tierHtml(_L('er.tierGray', null, '⚪ GRİ · Watch'),'er-gray',t.gray,false,t.elite,t.ethC);
    bindClicks(refs.body);
  }
  function openWS(){ var r=ensureWS(); r.overlay.classList.add('open'); _wsOpen=true; try{document.body.style.overflow='hidden';}catch(e){} renderWorkspace(_lastRows||[]); }
  function closeWS(){ var ov=document.getElementById('vdRadarWS'); if(ov) ov.classList.remove('open'); _wsOpen=false; try{document.body.style.overflow='';}catch(e){} }
  window.VDRadarWorkspace = { open:openWS, close:closeWS };

  // ── Elite olmayanlar için: panel kaybolmaz, kilitli görünür (premium.html ELITE GATE stili) ──
  function renderLocked() {
    var mount=document.getElementById('earlyRadar'); if(!mount) return;
    mount.style.display='';
    mount.innerHTML =
      '<div style="position:relative;border:1px solid rgba(56,189,248,.4);background:linear-gradient(180deg,rgba(56,189,248,.08),rgba(56,189,248,.02));border-radius:16px;padding:22px;overflow:hidden">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:13px;font-weight:700;color:#e6edf6">'+_L('er.radarTitle', null, '⚡ AI Piyasa Radarı')+'</span>'
      + '<span style="font-size:11px;color:#9fdfff;border:1px solid rgba(56,189,248,.5);border-radius:20px;padding:2px 9px">🔒 Premium</span></div>'
      + _L('er.lockedDesc', null, '<div style="color:#cdd6e4;font-size:13.5px;line-height:1.6;margin:0 0 14px">AI Piyasa Radarı, hacim henüz girmeden yapı olgunlaşırken coinleri <b style="color:#9fdfff">İzleme → Hazır → Teyitli</b> güç katmanlarında gösterir. Bu katman <b style="color:#9fdfff">Premium ve Elite</b> üyelere açıktır.</div>')
      + '<ul style="display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;padding:0;list-style:none">'
      + '<li style="font-size:12px;color:#a9c7e8;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);border-radius:20px;padding:5px 12px">'+_L('er.featReadiness', null, 'Yapı Olgunluğu (Readiness)')+'</li>'
      + '<li style="font-size:12px;color:#a9c7e8;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);border-radius:20px;padding:5px 12px">'+_L('er.featCards', null, '9 kart · 3 güç katmanı')+'</li>'
      + '<li style="font-size:12px;color:#a9c7e8;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);border-radius:20px;padding:5px 12px">'+_L('er.featStage', null, 'Aşama Geçiş Takibi')+'</li></ul>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
      + '<a href="/legal/premium.html" style="text-decoration:none;font-weight:700;font-size:13px;padding:9px 16px;border-radius:10px;color:#9fdfff;border:1px solid rgba(56,189,248,.5);background:transparent">Detaylar</a>'
      + '<a href="/legal/premium.html" style="text-decoration:none;font-weight:700;font-size:13px;padding:9px 16px;border-radius:10px;color:#04101f;background:linear-gradient(135deg,#38bdf8,#3b9eff)">'+_L('er.getAccess2', null, 'Erişim Al')+'</a></div>'
      + '</div>';
  }

  // ── Elite kapısı: radar yalnız Elite (veya admin) için açılır ──
  function isElite() {
    try { return !!(window.VDAccess && typeof window.VDAccess.isElite === 'function' && window.VDAccess.isElite()); }
    catch (e) { return false; }
  }

  // ── Tarama tetikleyici ──
  // ── Önceki tarama önbelleği (yenilemede ekran boş kalmasın) ──
  var CACHE_KEY='vd_radar_cache_v1';
  function _saveCache(rows){
    try{ localStorage.setItem(CACHE_KEY, JSON.stringify({rows:rows, ts:Date.now()})); }catch(e){}
  }
  function _hydrateFromCache(){
    if(_lastRows && _lastRows.length) return;            // zaten bir şey gösteriliyor
    try{
      var raw=localStorage.getItem(CACHE_KEY); if(!raw) return;
      var d=JSON.parse(raw); if(!d||!Array.isArray(d.rows)||!d.rows.length) return;
      _stale=true; _lastRows=d.rows;
      loadArchive(function(){ renderSummary(d.rows); if(_wsOpen) renderWorkspace(d.rows); });
    }catch(e){}
  }

  function run() {
    var mount=document.getElementById('earlyRadar'); if(!mount) return;
    if (!canSeeRadar()){ renderLocked(); return; }   // free/teaser → kilitli tanıtım
    mount.style.display='';
    var results=(window.VD_STATE&&window.VD_STATE.scanResults)||window._lastScanResults||[];
    if (!Array.isArray(results)||!results.length) { _hydrateFromCache(); return; }  // taze yok → önceki taramayı göster
    _lastScanAt=Date.now(); _stale=false;
    var rows=[];
    for (var i=0;i<results.length;i++){ var item=results[i]; try{ if(item&&item.sym) rows.push(process(item)); }catch(e){} }
    // ── HYBRID V2 Stage-2: price-top-N + BTC/ETH için DerivScore (rate-limit dostu) ──
    try {
      var HE = window.VDHybridEngine;
      if (HE && HE.evaluate) {
        var topN = rows.slice().filter(function(r){ return r && r.s && r.s.score != null; })
          .sort(function(a,b){ return (+b.s.score||0) - (+a.s.score||0); })
          .slice(0, (HE.CFG && HE.CFG.TOP_N) || 10);
        var seen = {};
        topN.forEach(function(r){ seen[r.sym]=1; HE.evaluate(r.sym, r.dir, +r.s.score).catch(function(){}); });
        ['BTCUSDT','ETHUSDT'].forEach(function(sym){
          if (seen[sym]) return;
          var rr=null; for (var j=0;j<rows.length;j++){ if(rows[j]&&rows[j].sym===sym){ rr=rows[j]; break; } }
          if (rr && rr.s && rr.s.score != null) HE.evaluate(sym, rr.dir, +rr.s.score).catch(function(){});
        });
      }
    } catch (e) {}
    _saveCache(rows);
    loadArchive(function(){ _lastRows=rows; renderSummary(rows); if(_wsOpen) renderWorkspace(rows); });
  }

  function schedule() { if (_t) return; _t = setTimeout(() => { _t = null; try { run(); } catch (e) {} }, 300); }

  window.addEventListener('vd:scan:complete', schedule);
  // ilk yüklemede mevcut sonuç varsa göster
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  // access-levels.js radar'dan sonra yüklenebildiği için birkaç gecikmeli yeniden-kontrol
  setTimeout(schedule, 1500);
  setTimeout(schedule, 4000);

  window.VDEarlyRadar = {
    run: run, _state: ST, _cfg: CFG,
    // Aşama 2b — SALT-OKUNUR: son taramanın TÜM sınıflanmış (stage'li) satırları (top-N DEĞİL).
    // Araştırma örnekleyici buradan TEMSİLİ örnek seçer; render/CSS/scoring DEĞİŞMEZ.
    classified: function () {
      return (_lastRows || []).filter(function (r) { return r && r.sym && r.stage; });
    },
    // BUILD 153 — SALT-OKUNUR özet (sağ rail için). Hesaplama YOK; yalnız
    // halihazırda hesaplanmış sıralı fırsatları + bias'ı dışa verir.
    summary: function () {
      var rows = _lastRows || [];
      var staged = rows.filter(function (r) { return r.stage; });
      var t = computeTiers(rows);
      return {
        top: t.gold.concat(t.orange, t.gray),
        counts: { gold: t.gold.length, orange: t.orange.length, gray: t.gray.length },
        scanned: t.scanned,
        bias: computeBias(staged),
        lastScanAt: _lastScanAt,
        canSee: (typeof canSeeRadar === 'function') ? canSeeRadar() : true
      };
    }
  };
})();
