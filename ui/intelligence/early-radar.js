// ════════════════════════════════════════════════════════════════════
// EARLY OPPORTUNITY RADAR  (Phase / build 86)
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
    if (s < 60) return s + ' sn önce';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' dk önce';
    return Math.round(m / 60) + ' sa önce';
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

  // ── Aşama ──
  function classify(s, rd) {
    if (s.volConfirmed && s.align >= 0.99 && s.conf >= 0.6) return 'CONFIRMED';
    if (rd.structBase >= CFG.structFloorArmed && s.align >= 2 / 3 && s.riskInv >= CFG.riskInvArmed
        && s.volFiring && rd.value >= CFG.ARMED_MIN) return 'ARMED';
    if ((s.score || 0) >= 60 && rd.structBase >= CFG.structFloorWatch
        && ((s.squeeze || 0) >= 0.5 || (s.compress || 0) >= 0.5)
        && !s.volConfirmed && rd.value >= CFG.WATCH_MIN) return 'WATCH';
    return null;
  }
  const RANK = { WATCH: 1, ARMED: 2, CONFIRMED: 3 };

  // ── Neden / Eksik ──
  function reasons(s, stage) {
    const why = [], miss = [];
    if (s.align >= 2 / 3) why.push('Yapı hizalı'); else miss.push('Yapı tam hizalı değil');
    if (s.conf >= 0.6) why.push('Confidence güçlü'); else if (stage) miss.push('Confidence düşük');
    if (s.riskInv >= 0.6) why.push('Risk düşük'); else miss.push('Risk yüksek');
    if ((s.squeeze || 0) >= 0.5) why.push('Sıkışma yüksek');
    if ((s.compress || 0) >= 0.5) why.push('Range daralıyor');
    if (s.volFiring) why.push('Hacim uyanıyor');
    else if (!s.volConfirmed) miss.push('Hacim henüz uyanmadı');
    if (s.okRsi === false) miss.push('RSI band dışı');
    return { why: why.slice(0, 3).join(' · ') || '—', miss: miss.slice(0, 2).join(' · ') || '—' };
  }

  // ── Olay (Son Değişim) tespiti — yükselen kenar ──
  function detectEvent(prevSt, s, stage) {
    // öncelik: aşama yükselişi > hacim uyanışı > sıkışma > daralma
    const wasStage = prevSt ? prevSt.stage : null;
    if (stage && RANK[stage] > (RANK[wasStage] || 0)) {
      return { label: stage === 'ARMED' ? "ARMED'a yükseldi" : stage === 'CONFIRMED' ? "CONFIRMED oldu" : "İzlemeye alındı", at: Date.now() };
    }
    const had = prevSt && prevSt._flags ? prevSt._flags : {};
    if (s.volFiring && !had.vol) return { label: 'Volume Awakening başladı', at: Date.now() };
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
    const cand = classify(s, rd);

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

  function render(rows) {
    const mount = document.getElementById('earlyRadar');
    if (!mount) return;
    rows = rows.filter(r => r.stage).sort((a, b) =>
      (RANK[b.stage] - RANK[a.stage]) || (b.value - a.value)).slice(0, CFG.maxRows);

    const stale = Date.now() - _lastScanAt > CFG.staleMs;
    const head = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700;color:#e6edf6">⚡ Early Opportunity Radar</span>
        <span style="font-size:10px;color:#8b98ac">${stale ? '· bayat veri' : '· canlı'}</span>
      </div>
      <div style="font-size:10.5px;color:#8b98ac;margin-bottom:8px">
        İzleme katmanıdır; işlem önerisi değildir. Yön, olasılık veya hedef içermez — yalnız yapı olgunluğu.
      </div>`;

    if (!rows.length) {
      mount.innerHTML = head + `<div style="font-size:12px;color:#8b98ac;padding:10px 0">Henüz erken fırsat yok — tarama biriktikçe burada görünecek.</div>`;
      return;
    }

    const rowsHtml = rows.map(r => {
      const rs = reasons(r.s, r.stage);
      const dcol = r.dir === 'LONG' ? '#36d399' : '#f87272';
      const dtxt = r.dir === 'LONG' ? '▲ LONG' : '▼ SHORT';
      const ev = r.lastEvent ? `${esc(r.lastEvent.label)}<br><span style="color:#8b98ac">${relTime(r.lastEvent.at)}</span>` : '—';
      return `<tr style="border-top:1px solid #1e2836">
        <td style="padding:7px 6px;font-weight:700">${esc(r.sym.replace('USDT', ''))}</td>
        <td style="padding:7px 6px;color:${dcol};font-weight:600">${dtxt}</td>
        <td style="padding:7px 6px">${badge(r.stage)}</td>
        <td style="padding:7px 6px;text-align:center">${r.s.score != null ? r.s.score : '—'}</td>
        <td style="padding:7px 6px;text-align:center">${r.s.risk != null ? r.s.risk : '—'}</td>
        <td style="padding:7px 6px;text-align:center;font-weight:700">${r.value} ${arrow(r.value, r.prevReadiness)}</td>
        <td style="padding:7px 6px;text-align:center;white-space:nowrap">${chip((r.s.squeeze || 0) >= 0.5, 'Squeeze')}${chip((r.s.compress || 0) >= 0.5, 'Compression')}${chip(r.s.volFiring, 'Volume Awakening')}</td>
        <td style="padding:7px 6px;font-size:11px"><span style="color:#9fe0c0">${esc(rs.why)}</span>${rs.miss !== '—' ? `<br><span style="color:#c79a6a">Eksik: ${esc(rs.miss)}</span>` : ''}</td>
        <td style="padding:7px 6px;font-size:11px">${ev}</td>
        <td style="padding:7px 6px;font-size:11px;color:#8b98ac">${relTime(r.stageSince)}</td>
      </tr>`;
    }).join('');

    mount.innerHTML = head + `
      <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;color:#e6edf6">
        <thead><tr style="color:#8b98ac;font-size:10px;text-transform:uppercase;letter-spacing:.04em">
          <th style="padding:6px;text-align:left">Coin</th><th style="padding:6px;text-align:left">Yön</th>
          <th style="padding:6px;text-align:left">Aşama</th><th style="padding:6px">Conf</th><th style="padding:6px">Risk</th>
          <th style="padding:6px">Readiness</th><th style="padding:6px">S·C·V</th>
          <th style="padding:6px;text-align:left">Neden / Eksik</th><th style="padding:6px;text-align:left">Son Değişim</th>
          <th style="padding:6px;text-align:left">Aşama Yaşı</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table></div>`;
  }

  // ── Elite kapısı: radar yalnız Elite (veya admin) için görünür ──
  function isElite() {
    try { return !!(window.VDAccess && typeof window.VDAccess.isElite === 'function' && window.VDAccess.isElite()); }
    catch (e) { return false; }
  }

  // ── Tarama tetikleyici ──
  function run() {
    const mount = document.getElementById('earlyRadar');
    if (!mount) return;
    if (!isElite()) { mount.style.display = 'none'; return; }  // free/premium → gizli
    mount.style.display = '';
    const results = (window.VD_STATE && window.VD_STATE.scanResults) || window._lastScanResults || [];
    if (!Array.isArray(results) || !results.length) return;
    _lastScanAt = Date.now();
    const rows = [];
    for (const item of results) {
      try { if (item && item.sym) rows.push(process(item)); } catch (e) { /* bir coin hata verirse diğerleri devam */ }
    }
    render(rows);
  }
  function schedule() { if (_t) return; _t = setTimeout(() => { _t = null; try { run(); } catch (e) {} }, 300); }

  window.addEventListener('vd:scan:complete', schedule);
  // ilk yüklemede mevcut sonuç varsa göster
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  // access-levels.js radar'dan sonra yüklenebildiği için birkaç gecikmeli yeniden-kontrol
  setTimeout(schedule, 1500);
  setTimeout(schedule, 4000);

  window.VDEarlyRadar = { run, _state: ST, _cfg: CFG };
})();
