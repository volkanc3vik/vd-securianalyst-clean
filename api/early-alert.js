// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — PERSONAL EARLY ALERT ENGINE  (Phase 13.2)
//
// /api/early-alert  — cron-job.org ile her ~5 dk tetiklenir.
//   Site/PC kapalı olsa bile sunucu tarafında radar matematiğini çalıştırır,
//   ALTIN ARMED (Readiness ≥ 88 & Stage = ARMED) fırsatlarını bulur ve
//   SADECE kişisel Telegram DM olarak gönderir (KANALA GÖNDERMEZ).
//
// İZOLASYON: Yeni ve yalıtık endpoint. Scanner, radar UI, Telegram kanal
//   akışı, Elite, Archive — HİÇBİRİNE dokunmaz. Yalnız Binance'i OKUR,
//   kendi durum tablosuna (early_alert_state) YAZAR, kişisel DM atar.
//
// FAITHFULNESS (ayna — senkron tut): calcEMA/RSI/MACD/BB/ATR, scoreLong,
//   scoreShort, calcRisk, entryLevels  → index.html scanner ile BİREBİR.
//   subScores/readiness/classify/CFG  → ui/intelligence/early-radar.js ile
//   BİREBİR. Tarama: interval=15m, limit=100, evren=ticker/24hr USDT top-N
//   (scanMarket ile aynı). Scanner/radar mantığı değişirse burası da
//   güncellenmeli (yeni kriter İCAT EDİLMEDİ — aynalandı).
//
// DİL KURALI: Mesajda "Entry/TP/SL/Al/Sat/Long aç/Short aç" YOK. Yalnız
//   "Referans Seviye / Hedef Bölge 1-2-3 / Risk Seviyesi". Seviyeler
//   scanner'ın zaten ürettiği ATR referanslarıdır; radar seviye ÜRETMEZ;
//   scanner seviyesi yoksa o bölüm hiç görünmez.
//
//   Guard: ?secret=EARLY_ALERT_SECRET (fallback TELEGRAM_CRON_SECRET)
//          veya x-admin-key (ADMIN_KEY_1/2) — manuel test için.
//   ?dry=1 → hesaplar, MESAJ ATMAZ, durum YAZMAZ (güvenli test).
// ═══════════════════════════════════════════════════════════════════

export const config = { maxDuration: 60 };

const FBASE   = 'https://fapi.binance.com';
const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID  = process.env.EARLY_ALERT_CHAT_ID || '1148433599';
const TOP_N    = Math.max(10, Math.min(300, +(process.env.EARLY_ALERT_TOP_N || 150)));
const COOLDOWN_MIN = Math.max(0, +(process.env.EARLY_ALERT_COOLDOWN_MIN || 20));
const GOLD_MIN = Math.max(50, +(process.env.EARLY_ALERT_MIN || 88)); // 88 = SADECE altın GÜÇLÜ (turuncu/kırmızı hariç)
const STATE_TABLE = 'early_alert_state';

// ── Supabase REST ───────────────────────────────────────────────────
async function sbFetch(path, options = {}) {
  if (!SB_URL || !SB_KEY) throw new Error('supabase_env_missing');
  const url = `${SB_URL.replace(/\/$/, '')}/rest/v1${path}`;
  const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const r = await fetch(url, { ...options, headers });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`supabase_${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

// ════════════════════════════════════════════════════════════════════
// PORTED MATH — index.html scanner ile BİREBİR (ayna, senkron tut)
// ════════════════════════════════════════════════════════════════════
function calcEMA(c, p) { if (c.length < p) return []; const k = 2 / (p + 1); let e = c.slice(0, p).reduce((a, b) => a + b, 0) / p; const r = [e]; for (let i = p; i < c.length; i++) { e = c[i] * k + e * (1 - k); r.push(e); } return r; }
function calcRSI(c, p = 14) { if (c.length < p + 2) return 50; let g = 0, l = 0; for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; d > 0 ? (g += d) : (l -= d); } let ag = g / p, al = l / p; for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; ag = (ag * (p - 1) + Math.max(d, 0)) / p; al = (al * (p - 1) + Math.max(-d, 0)) / p; } return al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2); }
function calcMACD(c) { const e12 = calcEMA(c, 12), e26 = calcEMA(c, 26); if (!e12.length || !e26.length) return { line: 0, signal: 0, hist: 0, hArr: [] }; const len = Math.min(e12.length, e26.length); const ml = Array.from({ length: len }, (_, i) => e12[e12.length - len + i] - e26[e26.length - len + i]); const sig = calcEMA(ml, 9); const hArr = ml.slice(ml.length - sig.length).map((v, i) => v - sig[i]); const last = ml[ml.length - 1], s = sig[sig.length - 1] || 0; return { line: last, signal: s, hist: last - s, hArr }; }
function calcBBscan(c, p = 20) { if (c.length < p) return null; const sl = c.slice(-p), m = sl.reduce((a, b) => a + b, 0) / p, std = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / p); return { upper: m + 2 * std, mid: m, lower: m - 2 * std }; }
function calcATR(candles, p = 14) { if (candles.length < 2) return 0; const trs = candles.slice(1).map((c, i) => Math.max(c.h - c.l, Math.abs(c.h - candles[i].c), Math.abs(c.l - candles[i].c))); const sl = trs.slice(-p); return sl.reduce((a, b) => a + b, 0) / sl.length; }

function scoreLong(closes, chg) {
  const e9 = calcEMA(closes, 9), e21 = calcEMA(closes, 21), e50 = calcEMA(closes, 50);
  const e9v = e9[e9.length - 1], e21v = e21[e21.length - 1], e50v = e50[e50.length - 1];
  const r = calcRSI(closes), m = calcMACD(closes), b = calcBBscan(closes);
  const p = closes[closes.length - 1]; let s = 0;
  if (e9v > e21v) s += 20; if (e21v > e50v) s += 15; if (e9v > e21v && e21v > e50v) s += 10;
  if (r >= 45 && r <= 65) s += 20; else if (r >= 30 && r < 45) s += 10; else if (r > 65) s -= 5;
  if (m.hist > 0) s += 20; if (m.line > 0 && m.hist > 0) s += 5;
  if (b) { if (p > b.mid) s += 10; if (p <= b.lower * 1.005) s += 10; if (p > b.upper) s -= 10; }
  if (chg > 0) s += 5; if (chg > 3) s += 5;
  return { score: Math.max(0, Math.min(100, s)), rsi: r, mh: m.hist, ema: e9v > e21v ? (e21v > e50v ? '▲▲▲' : '▲▲') : '▼', p, e9v, e21v, e50v, macdObj: m };
}
function scoreShort(closes, chg) {
  const e9 = calcEMA(closes, 9), e21 = calcEMA(closes, 21), e50 = calcEMA(closes, 50);
  const e9v = e9[e9.length - 1], e21v = e21[e21.length - 1], e50v = e50[e50.length - 1];
  const r = calcRSI(closes), m = calcMACD(closes), b = calcBBscan(closes);
  const p = closes[closes.length - 1]; let s = 0;
  if (e9v < e21v) s += 20; if (e21v < e50v) s += 15; if (e9v < e21v && e21v < e50v) s += 10;
  if (r >= 35 && r <= 55) s += 20; else if (r > 70) s += 15; else if (r > 55 && r <= 70) s += 8;
  if (m.hist < 0) s += 20; if (m.line < 0 && m.hist < 0) s += 5;
  if (b) { if (p < b.mid) s += 10; if (p >= b.upper * 0.995) s += 10; if (p < b.lower) s -= 10; }
  if (chg < 0) s += 5; if (chg < -3) s += 5;
  return { score: Math.max(0, Math.min(100, s)), rsi: r, mh: m.hist, ema: e9v < e21v ? (e21v < e50v ? '▼▼▼' : '▼▼') : '▲', p, e9v, e21v, e50v, macdObj: m };
}
function calcRisk(closes, chg, atr, price) {
  const atrPct = (atr / price) * 100, absChg = Math.abs(chg), r = calcRSI(closes);
  const rR = r > 75 || r < 25 ? 30 : r > 70 || r < 30 ? 20 : r > 65 || r < 35 ? 10 : 0;
  const aR = atrPct > 5 ? 40 : atrPct > 3 ? 30 : atrPct > 2 ? 20 : atrPct > 1 ? 10 : 5;
  const cR = absChg > 10 ? 30 : absChg > 5 ? 20 : absChg > 3 ? 10 : 5;
  const t = Math.min(100, rR + aR + cR);
  let label;
  if (t <= 25) label = 'DÜŞÜK'; else if (t <= 50) label = 'ORTA'; else if (t <= 75) label = 'YÜKSEK'; else label = 'ÇOK YÜKSEK';
  return { score: t, label };
}
// Scanner ATR referans seviyeleri — index.html ile BİREBİR (3787-3788).
// Radar seviye ÜRETMEZ; bu fonksiyon scanner'ın aynısıdır. Yön uymazsa null.
function entryLevels(price, e9, e21, mhist, rsi, atr) {
  const isLong  = e9 > e21 && mhist > 0 && rsi < 70;
  const isShort = e9 < e21 && mhist < 0 && rsi > 30;
  if (isLong)  { const entry = price, stop = entry - atr * 1.5, tp1 = entry + atr * 2, tp2 = entry + atr * 3.5, tp3 = entry + atr * 5.5; return { dir: 'LONG', entry, stop, tp1, tp2, tp3 }; }
  if (isShort) { const entry = price, stop = entry + atr * 1.5, tp1 = entry - atr * 2, tp2 = entry - atr * 3.5, tp3 = entry - atr * 5.5; return { dir: 'SHORT', entry, stop, tp1, tp2, tp3 }; }
  return null;
}

// ════════════════════════════════════════════════════════════════════
// PORTED RADAR — ui/intelligence/early-radar.js ile BİREBİR (ayna)
// ════════════════════════════════════════════════════════════════════
const CFG = {
  W: { align: 28, conf: 22, riskInv: 15, squeeze: 12, compress: 10, volWake: 13 },
  WATCH_MIN: 50, ARMED_MIN: 65,
  structFloorWatch: 0.45, structFloorArmed: 0.65, riskInvArmed: 0.60,
  volDead: 0.80, volWakeLo: 1.00, volWakeHi: 1.30,
  bbWindow: 30, rangeRecent: 5, rangeBase: 20,
};
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

  let okEma = null, okMacd = null, okRsi = null;
  if (ema9 != null && ema21 != null) okEma = isLong ? ema9 > ema21 : ema9 < ema21;
  if (mh != null) okMacd = isLong ? mh > 0 : mh < 0;
  if (rsi != null) okRsi = isLong ? (rsi >= 42 && rsi <= 68) : (rsi >= 32 && rsi <= 58);
  const okArr = [okEma, okMacd, okRsi].filter(v => v !== null);
  const align = okArr.length ? okArr.filter(Boolean).length / okArr.length : 0;

  const conf = score != null ? clamp((score - 50) / 50, 0, 1) : 0;
  const riskInv = risk != null ? 1 - clamp(risk / 100, 0, 1) : 0.5;

  let squeeze = null;
  if (closes && closes.length >= 20 + 2) {
    const cur = bbWidthAt(closes, closes.length, 20);
    if (cur != null) {
      const widths = [];
      for (let i = 0; i < CFG.bbWindow; i++) { const w = bbWidthAt(closes, closes.length - i, 20); if (w != null) widths.push(w); }
      if (widths.length >= 5) { const geq = widths.filter(w => w >= cur).length; squeeze = clamp(geq / widths.length, 0, 1); }
    }
  }
  let compress = null;
  if (candles && candles.length >= CFG.rangeBase + 1) {
    const px = num(item.price) || (candles[candles.length - 1].c);
    const rc = candles.slice(-CFG.rangeRecent), rb = candles.slice(-CFG.rangeBase);
    const recR = (Math.max(...rc.map(c => c.h)) - Math.min(...rc.map(c => c.l))) / px;
    const baseR = (Math.max(...rb.map(c => c.h)) - Math.min(...rb.map(c => c.l))) / px;
    if (baseR > 0) compress = clamp(1 - recR / baseR, 0, 1);
  }
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
  return { align, conf, riskInv, squeeze, compress, volWake, volRatio, volRising, volConfirmed, volFiring, okEma, okMacd, okRsi, rsi, score, risk };
}
function readiness(s) {
  const W = CFG.W;
  const structPart = W.align * s.align + W.conf * s.conf + W.riskInv * s.riskInv;
  const structBase = structPart / (W.align + W.conf + W.riskInv);
  const sq = s.squeeze == null ? 0 : s.squeeze;
  const cp = s.compress == null ? 0 : s.compress;
  const vw = s.volWake == null ? 0 : s.volWake;
  const energyPart = W.squeeze * sq + W.compress * cp + W.volWake * vw;
  const energyEff = energyPart * structBase;
  return { value: Math.round(structPart + energyEff), structBase };
}
function classify(s, rd) {
  if (s.volConfirmed && s.align >= 0.99 && s.conf >= 0.6) return 'CONFIRMED';
  if (rd.structBase >= CFG.structFloorArmed && s.align >= 2 / 3 && s.riskInv >= CFG.riskInvArmed
    && s.volFiring && rd.value >= CFG.ARMED_MIN) return 'ARMED';
  if ((s.score || 0) >= 60 && rd.structBase >= CFG.structFloorWatch
    && ((s.squeeze || 0) >= 0.5 || (s.compress || 0) >= 0.5)
    && !s.volConfirmed && rd.value >= CFG.WATCH_MIN) return 'WATCH';
  return null;
}

// Neden / Eksik — radar reasons() ile aynı ruhta, mesaj için etiketlenmiş
function buildReasons(s) {
  const why = [], miss = [];
  if (s.okEma) why.push('✓ EMA Hizalama');
  if (s.okMacd) why.push('✓ MACD Yönü');
  if (s.okRsi) why.push('✓ RSI Bandı Uygun'); else miss.push('RSI band dışı');
  if ((s.squeeze || 0) >= 0.5) why.push('✓ Volatilite Sıkışması');
  if ((s.compress || 0) >= 0.5) why.push('✓ Range Daralması');
  if (s.volFiring) why.push('✓ Hacim Uyanışı');
  if (s.riskInv >= 0.6) why.push('✓ Risk Düşük');
  if (s.conf >= 0.6) why.push('✓ Confidence Güçlü');
  if (!s.volConfirmed) miss.push('Hacim Teyidi');     // ARMED → teyit henüz yok (beklenen)
  if (s.align < 2 / 3) miss.push('Yapı tam hizalı değil');
  return { why, miss };
}

// ── Tek coin'i değerlendir (durumsuz; alert için "şu an altın mı?") ──
function evaluate(item) {
  const lS = num(item.lScore) || 0, sS = num(item.sScore) || 0;
  const dir = lS >= sS ? 'LONG' : 'SHORT';
  const s = subScores(item, dir);
  const rd = readiness(s);
  const stage = classify(s, rd);
  return { sym: item.sym, dir, stage, value: rd.value, s };
}

// ── Fiyat biçimlendirme ──
function fmtP(p) {
  p = +p;
  if (!isFinite(p)) return '—';
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(5);
  return p.toPrecision(4);
}
const DIR_TR = { LONG: 'Yukarı Yönlü', SHORT: 'Aşağı Yönlü' };

// ── Mesaj kur (B seçeneği — uyumlu dil) ──
function buildMessage(ev, item) {
  const { why, miss } = buildReasons(ev.s);
  const conf = ev.dir === 'LONG' ? (num(item.lScore) || 0) : (num(item.sScore) || 0);
  const riskLabel = (item.risk && item.risk.label) ? item.risk.label
    : (item.risk && item.risk.score != null ? labelFromScore(item.risk.score) : '—');

  // Kademe (anlık Readiness'e göre): 88+ GÜÇLÜ (altın), 77-87 HAZIR (turuncu)
  const tier = ev.value >= 88 ? '🥇 GÜÇLÜ' : '🟠 HAZIR';

  // Anlaşılır hacim satırı (o anki gerçek değer)
  const vr = ev.s.volRatio;
  let volLine;
  if (vr == null) volLine = 'Hacim verisi yok';
  else {
    const pctOfBase = Math.round(vr * 100);              // tabanın %'si
    const toTarget = vr >= 1.30 ? 'teyit eşiği geçildi'  // 1.30+
      : `teyide ${Math.round((1.30 - vr) * 100)} puan kaldı`;
    const durum = vr >= 1.30 ? 'TEYİT' : vr >= 1.00 ? 'UYANIYOR' : 'düşük';
    volLine = `${vr.toFixed(2)}× (normalin %${pctOfBase}'i) · ${durum} · ${toTarget}`;
  }

  let msg = `⚡ ARMED RADAR — ${tier}\n\n`;
  msg += `Coin:\n${item.sym}\n\n`;
  msg += `Yön:\n${DIR_TR[ev.dir] || ev.dir}\n\n`;
  msg += `Stage:\nARMED (${ev.value >= 88 ? 'Altın' : 'Turuncu'})\n\n`;
  msg += `Structure Readiness:\n${ev.value}/100\n\n`;
  msg += `Zaman Uyumu:\n✓ 15m kurulum + 1h trend aynı yönde\n\n`;
  // Piyasa lideri uyumu (BTC/ETH)
  const mk = ev.market;
  if (mk) {
    const q = Math.max(0, Math.min(100, ev.value + (mk.bonus || 0)));
    msg += `Piyasa Uyumu:\nBTC: ${mk.btcTxt}\nETH: ${mk.ethTxt}\nKalite: ${mk.label}\nKalite Skoru: ${q}/100\n\n`;
  }
  msg += `Hacim Durumu:\n${volLine}\n\n`;
  msg += `Neden:\n${why.length ? why.join('\n') : '—'}\n\n`;
  msg += `Eksik:\n${miss.length ? miss.map(m => '• ' + m).join('\n') : '—'}\n`;

  // Scanner referans seviyeleri — yalnız scanner üretmişse ve yön uyuyorsa
  const ind = item.ind || {};
  const lv = entryLevels(num(item.price), num(ind.ema9), num(ind.ema21),
    num(ind.macd && ind.macd.histogram), num(ind.rsi != null ? ind.rsi : item.rsi), num(ind.atr || item.atr));
  if (lv && lv.dir === ev.dir) {
    msg += '\n━━━━━━━━━━\n';
    msg += 'Scanner Referans Seviyeleri\n\n';
    msg += `Confidence:\n${Math.round(conf)}/100\n\n`;
    msg += `Risk:\n${riskLabel}\n\n`;
    msg += `Referans Seviye:\n${fmtP(lv.entry)}\n\n`;
    msg += `Hedef Bölge 1:\n${fmtP(lv.tp1)}\n\n`;
    msg += `Hedef Bölge 2:\n${fmtP(lv.tp2)}\n\n`;
    msg += `Hedef Bölge 3:\n${fmtP(lv.tp3)}\n\n`;
    msg += `Risk Seviyesi:\n${fmtP(lv.stop)}\n`;
  }
  msg += '\n━━━━━━━━━━\n';
  msg += `📈 Canlı Grafik:\n${tvLink(item.sym)}\n`;
  msg += '\n━━━━━━━━━━\n';
  msg += 'Bu sadece kişisel izleme uyarısıdır.\nYatırım tavsiyesi değildir.';
  return msg;
}
function labelFromScore(t) { return t <= 25 ? 'DÜŞÜK' : t <= 50 ? 'ORTA' : t <= 75 ? 'YÜKSEK' : 'ÇOK YÜKSEK'; }

// ── Grafik: kendi mum verimizden QuickChart MUM (candlestick) PNG ──
function chartUrl(sym, candles, dir, tf) {
  if (!Array.isArray(candles) || candles.length < 10) return null;
  const cs = candles.slice(-40).map((c, i) => ({
    x: i,
    o: +(+c.o).toPrecision(6), h: +(+c.h).toPrecision(6),
    l: +(+c.l).toPrecision(6), c: +(+c.c).toPrecision(6),
  }));
  const cfg = {
    type: 'candlestick',
    data: { datasets: [{
      data: cs,
      color: { up: '#36d399', down: '#f87272', unchanged: '#8b98ac' },
      borderColor: { up: '#36d399', down: '#f87272', unchanged: '#8b98ac' },
    }] },
    options: {
      plugins: { legend: { display: false }, title: { display: true, text: `${sym} · ${tf || '15m'}`, color: '#e6edf6', font: { size: 16 } } },
      scales: { x: { display: false }, y: { position: 'right', ticks: { color: '#8b98ac' }, grid: { color: '#1e2836' } } },
    },
  };
  return `https://quickchart.io/chart?bkg=%23111722&w=520&h=300&v=4&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}
// ── Canlı TradingView linki ──
function tvLink(sym) {
  const base = sym.replace('USDT', '');
  return `https://www.tradingview.com/chart/?symbol=BINANCE:${base}USDT.P&interval=15`;
}

// ── Piyasa lideri uyumu (BTC katı, ETH yumuşak) ──
// btcDir/ethDir: 'LONG' | 'SHORT' | null(nötr/yatay).  dir: setup yönü.
// Not: BTC açıkça ters olanlar zaten ELENDİ (buraya gelmez). Burada yalnız bonus/uyarı/etiket.
function marketInfo(dir, btcDir, ethDir) {
  const arrow = (d) => d === 'LONG' ? 'Yukarı' : d === 'SHORT' ? 'Aşağı' : null;
  let btcTxt, ethTxt, bonus = 0, ethWarn = false;
  if (btcDir === dir) { btcTxt = `✓ Uyumlu (${arrow(btcDir)})`; bonus += 5; }
  else { btcTxt = '• Nötr / Yatay'; }
  if (ethDir === dir) { ethTxt = `✓ Uyumlu (${arrow(ethDir)}) · bonus`; bonus += 3; }
  else if (ethDir && ethDir !== dir) { ethTxt = `⚠ Ters (${arrow(ethDir)}) · uyarı`; bonus -= 4; ethWarn = true; }
  else { ethTxt = '• Nötr / Yatay'; }
  let label;
  if (btcDir === dir && ethDir === dir) label = '🟢 Yüksek Uyum';
  else if (btcDir === dir && ethWarn) label = '🟡 BTC uyumlu · ETH uyarısı';
  else if (btcDir === dir) label = '🟢 İyi (BTC uyumlu)';
  else if (ethDir === dir) label = '🟡 Nötr piyasa · ETH destekli';
  else if (ethWarn) label = '🟡 Nötr piyasa · ETH uyarısı';
  else label = '⚪ Nötr piyasa';
  return { btcTxt, ethTxt, bonus, ethWarn, label };
}

// ── Binance JSON çekme yardımcısı ──
async function getJSON(url) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`binance_${r.status}`);
  return r.json();
}

// ── 1 saatlik trend yönü (filtre için) — yalnız ARMED adaylarına çağrılır ──
async function htfTrend(sym) {
  try {
    const kl = await getJSON(`${FBASE}/fapi/v1/klines?symbol=${sym}&interval=1h&limit=100`);
    if (!Array.isArray(kl) || kl.length < 55) return { dir: null, candles: null };
    const closes = kl.map(k => +k[4]);
    const candles = kl.map(k => ({ h: +k[2], l: +k[3], c: +k[4], o: +k[1], v: +k[5] }));
    const e9 = calcEMA(closes, 9), e21 = calcEMA(closes, 21), e50 = calcEMA(closes, 50);
    const e9v = e9.at(-1), e21v = e21.at(-1), e50v = e50.at(-1);
    const m = calcMACD(closes), r = calcRSI(closes);
    // LONG eğilimi: EMA dizilimi yukarı + MACD pozitif + RSI 50 üstü
    const longTrend = e9v > e21v && e21v > e50v && m.hist > 0 && r >= 50;
    const shortTrend = e9v < e21v && e21v < e50v && m.hist < 0 && r <= 50;
    const dir = longTrend ? 'LONG' : shortTrend ? 'SHORT' : null;
    return { dir, candles };
  } catch (e) { return { dir: null, candles: null }; }
}
async function getTopSymbols(n) {
  const tickers = await getJSON(`${FBASE}/fapi/v1/ticker/24hr`);
  const map = {};
  const syms = tickers
    .filter(t => t.symbol.endsWith('USDT'))
    .sort((a, b) => +b.quoteVolume - +a.quoteVolume)
    .slice(0, n)
    .map(t => { map[t.symbol] = { chg: +t.priceChangePercent, price: +t.lastPrice }; return t.symbol; });
  return { syms, map };
}
async function buildItem(sym, meta) {
  const kl = await getJSON(`${FBASE}/fapi/v1/klines?symbol=${sym}&interval=15m&limit=100`);
  if (!Array.isArray(kl) || kl.length < 30) return null;
  const closes = kl.map(k => +k[4]);
  const candles = kl.map(k => ({ h: +k[2], l: +k[3], c: +k[4], o: +k[1], v: +k[5] }));
  const chg = meta.chg, price = meta.price;
  const atr = calcATR(candles);
  const risk = calcRisk(closes, chg, atr, price);
  const lSc = scoreLong(closes, chg), sSc = scoreShort(closes, chg);
  return {
    sym, chg, price, rsi: lSc.rsi, mh: lSc.mh, risk, atr,
    lScore: lSc.score, sScore: sSc.score, lEma: lSc.ema, sEma: sSc.ema,
    closes, candles,
    ind: {
      rsi: lSc.rsi, ema9: lSc.e9v ?? null, ema21: lSc.e21v ?? null, ema50: lSc.e50v ?? null,
      atr, macd: lSc.macdObj ? { histogram: lSc.macdObj.hist, line: lSc.macdObj.line } : null,
    },
  };
}

// ── Telegram kişisel DM ──
async function sendDM(text) {
  if (!TG_TOKEN) throw new Error('telegram_token_missing');
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data.ok, error: data.description || (r.ok ? null : `http_${r.status}`) };
}
// ── Telegram grafik fotoğrafı (kısa başlıkla) ──
async function sendPhoto(photoUrl, caption) {
  if (!TG_TOKEN || !photoUrl) return { ok: false, error: 'no_photo' };
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, photo: photoUrl, caption: (caption || '').slice(0, 1000) }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data.ok, error: data.description || (r.ok ? null : `http_${r.status}`) };
}
// ── Telegram albüm: birden çok grafiği TEK mesajda yan yana gönderir ──
async function sendMediaGroup(photoUrls, caption) {
  if (!TG_TOKEN || !photoUrls || !photoUrls.length) return { ok: false, error: 'no_photos' };
  const media = photoUrls.filter(Boolean).map((url, i) => (
    i === 0 ? { type: 'photo', media: url, caption: (caption || '').slice(0, 1000) }
            : { type: 'photo', media: url }
  ));
  if (media.length === 1) return sendPhoto(media[0].media, caption); // tek foto → normal
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMediaGroup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, media }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && data.ok, error: data.description || (r.ok ? null : `http_${r.status}`) };
}

// ── Guard ──
function authorized(req) {
  const q = req.query || {};
  const provided = (q.secret || '').toString();
  const want = process.env.EARLY_ALERT_SECRET || process.env.TELEGRAM_CRON_SECRET || '';
  if (want && provided && provided === want) return true;
  const ak = (req.headers['x-admin-key'] || '').toString();
  if (ak && (ak === process.env.ADMIN_KEY_1 || ak === process.env.ADMIN_KEY_2)) return true;
  return false;
}

// ════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const q = req.query || {};
  const dry = q.dry === '1' || q.dry === 'true';
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const t0 = Date.now();
  try {
    // 1) Evren
    const { syms, map } = await getTopSymbols(TOP_N);

    // 2) Mumları batch'le çek + değerlendir
    const BATCH = 15;
    const armed = [];   // 15m'de ARMED + eşik üstü adaylar
    const items = {};
    for (let i = 0; i < syms.length; i += BATCH) {
      const slice = syms.slice(i, i + BATCH);
      const built = await Promise.allSettled(slice.map(s => buildItem(s, map[s])));
      built.forEach((res2, j) => {
        if (res2.status !== 'fulfilled' || !res2.value) return;
        const item = res2.value;
        items[item.sym] = item;
        const ev = evaluate(item);
        if (ev.stage === 'ARMED' && ev.value >= GOLD_MIN) armed.push(ev);
      });
    }

    // 2b) 1H TREND FİLTRESİ — yalnız 15m yönü ile 1h trendi AYNI olanlar geçer.
    //     (Sadece az sayıdaki ARMED adayına 1h çekilir → hız/limit korunur.)
    // + PİYASA LİDERİ UYUMU: BTC açıkça ters → ele · BTC nötr → geç · BTC uyumlu → kalite+
    //   ETH ikinci teyit: uyumlu → bonus · ters → uyarı (elemez) · nötr → etkisiz.
    let btcDir = null, ethDir = null;
    if (armed.length) {
      try { btcDir = (await htfTrend('BTCUSDT')).dir; } catch (e) {}
      try { ethDir = (await htfTrend('ETHUSDT')).dir; } catch (e) {}
    }
    const gold = [];          // filtreden geçen güçlü adaylar
    const htfCandles = {};     // sym → 1h mumlar (grafik için)
    for (let i = 0; i < armed.length; i += BATCH) {
      const slice = armed.slice(i, i + BATCH);
      const trends = await Promise.allSettled(slice.map(ev => htfTrend(ev.sym)));
      trends.forEach((tr, j) => {
        const ev = slice[j];
        if (tr.status !== 'fulfilled') return;
        const { dir: htfDir, candles } = tr.value;
        if (candles) htfCandles[ev.sym] = candles;
        if (!(htfDir && htfDir === ev.dir)) return;            // 15m ↔ 1h uyumu yoksa elenir
        // BTC kapısı: açıkça ters yönde ise ELE (piyasa liderine tamamen ters sinyal alma)
        if (btcDir && btcDir !== ev.dir) return;
        ev.market = marketInfo(ev.dir, btcDir, ethDir);          // uyum + kalite bilgisi
        gold.push(ev);
      });
    }

    // 3) Durum (spam koruması) — Supabase
    let state = [];
    try { state = await sbFetch(`/${STATE_TABLE}?select=symbol,dir,active,notified_at,last_readiness`); }
    catch (e) { if (!dry) throw e; }
    const stMap = {};
    (Array.isArray(state) ? state : []).forEach(r => { stMap[r.symbol] = r; });
    const now = Date.now();
    const cooldownMs = COOLDOWN_MIN * 60 * 1000;

    const toSend = [], toUpsert = [];
    for (const ev of gold) {
      const row = stMap[ev.sym];
      let send = false;
      if (!row) send = true;                                   // hiç görülmemiş
      else if (row.dir !== ev.dir) send = true;                // yön değişti
      else if (!row.active) {                                  // önce çıkmış, geri gelmiş
        const since = row.notified_at ? (now - Date.parse(row.notified_at)) : Infinity;
        send = since >= cooldownMs;                            // soğuma geçtiyse tekrar
      } else if ((row.last_readiness || 0) < 88 && ev.value >= 88) {
        send = true;                                           // turuncu → ALTIN yükselişi (önemli)
      } // (active && aynı yön & kademe değişmedi) → gönderme
      if (send) {
        toSend.push(ev);
        toUpsert.push({ symbol: ev.sym, dir: ev.dir, last_readiness: ev.value, active: true, notified_at: new Date().toISOString() });
      }
    }
    // Altından düşenleri pasifle (geri gelirse yeniden tetiklensin)
    const goldSyms = new Set(gold.map(g => g.sym));
    const toDeactivate = (Array.isArray(state) ? state : [])
      .filter(r => r.active && !goldSyms.has(r.symbol))
      .map(r => r.symbol);

    // 4) Gönder + durum yaz (dry değilse)
    const sent = [];
    if (!dry) {
      for (let k = 0; k < toSend.length; k++) {
        const ev = toSend[k];
        const item = items[ev.sym];
        const msg = buildMessage(ev, item);
        const tier = ev.value >= 88 ? '🥇 GÜÇLÜ' : '🟠 HAZIR';
        const cap = `${tier} · ${item.sym}\n${DIR_TR[ev.dir] || ev.dir} · Readiness ${ev.value}/100\n⏱ Üst: 15m · Alt: 1h (trend onayı)`;
        // İki grafiği TEK albümde gönder (15m + 1h yan yana)
        const cu15 = chartUrl(item.sym, item.candles, ev.dir, '15m');
        const c1h = htfCandles[ev.sym];
        const cu1h = c1h ? chartUrl(item.sym, c1h, ev.dir, '1h') : null;
        let photoOk = false;
        const p = await sendMediaGroup([cu15, cu1h], cap);
        photoOk = p.ok;
        // Detay metin
        const r = await sendDM(msg);
        sent.push({ sym: ev.sym, dir: ev.dir, readiness: ev.value, photo: photoOk, photoErr: p.error, ok: r.ok, error: r.error });
        if (k < toSend.length - 1) await new Promise(res => setTimeout(res, 500)); // sohbet kısıtlamasını önle
      }
      if (toUpsert.length) {
        await sbFetch(`/${STATE_TABLE}?on_conflict=symbol`, {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(toUpsert.map(u => ({ ...u, updated_at: new Date().toISOString() }))),
        });
      }
      if (toDeactivate.length) {
        await sbFetch(`/${STATE_TABLE}?symbol=in.(${toDeactivate.join(',')})`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }),
        });
      }
    }

    return res.status(200).json({
      ok: true, dry, tookMs: Date.now() - t0,
      scanned: syms.length, goldArmed: gold.length,
      sent: dry ? toSend.map(e => ({ sym: e.sym, dir: e.dir, readiness: e.value })) : sent,
      deactivated: toDeactivate,
      topGold: gold.sort((a, b) => b.value - a.value).slice(0, 10).map(e => ({ sym: e.sym, dir: e.dir, readiness: e.value })),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e), tookMs: Date.now() - t0 });
  }
}

// Test için iç fonksiyonlar (Vercel handler'ı etkilemez)
export const _engine = { evaluate, readiness, subScores, classify, buildMessage, entryLevels, buildItem, getTopSymbols, calcEMA, calcRSI, calcMACD, scoreLong, scoreShort, calcRisk, CFG };
