// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — ARCHIVE INTELLIGENCE STATS (Phase 7, READ-ONLY)
// analysis_archive'dan performans istatistikleri hesaplar. Modeli DEĞİŞTİRMEZ, sadece ölçer.
// DOKUNMAZ: scanner, telegram gönderim, referral, premium, kod sistemi.
// GET /api/archive-stats  → JSON aggregate (public transparency verisi)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path) {
  const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: h });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`supabase_${r.status}`);
  return data;
}

const r1 = (n) => Math.round(Number(n) * 10) / 10;
const pct = (num, den) => den > 0 ? r1((num / den) * 100) : null;

// "Yapı" — market_context.structure varsa onu kullan; yoksa rsi/score/dir'den dürüst türet
function yapi(mc, bias) {
  if (mc && mc.structure) return String(mc.structure);
  const rsi = mc && mc.rsi != null ? Number(mc.rsi) : null;
  const score = mc && mc.score != null ? Number(mc.score) : null;
  if (rsi != null) {
    if (rsi >= 68) return 'Güçlü Momentum + RSI Genişlemesi';
    if (rsi <= 32) return 'Aşırı Satım Tepkisi + Dönüş Yapısı';
    if (bias === 'bullish' && rsi >= 52) return 'Trend + Momentum Uyumu';
    if (bias === 'bearish' && rsi <= 48) return 'Trend + Momentum Uyumu';
    return 'Yapısal Denge + Momentum Takibi';
  }
  if (score != null && score >= 90) return 'Çok Faktörlü Güçlü Yapı';
  return 'Çok Faktörlü AI Yapısı';
}

function riskBucket(mc) {
  const v = mc && mc.risk != null ? String(mc.risk).toLowerCase() : '';
  if (/düş|dus|low/.test(v)) return 'Düşük Risk';
  if (/orta|med/.test(v))    return 'Orta Risk';
  if (/yük|yuk|high/.test(v))return 'Yüksek Risk';
  return 'Bilinmiyor';
}
const confBand = (s) => s == null ? 'Bilinmiyor' : s >= 90 ? '90+' : s >= 80 ? '80-90' : s >= 70 ? '70-80' : '<70';
const rsiBand  = (mc) => {
  const v = mc && mc.rsi != null ? Number(mc.rsi) : null;
  if (v == null) return null;
  if (v >= 65) return 'RSI Yüksek (≥65)';
  if (v <= 35) return 'RSI Düşük (≤35)';
  return 'RSI Orta (35-65)';
};

const MIN_SAMPLE = 20; // öğrenme için min örnek — altı "Yetersiz Veri"

// grup sayacı: {grup: {v,p,f}} → oran tablosu
function groupRates(rows, keyFn) {
  const g = {};
  for (const r of rows) {
    const k = keyFn(r); if (!k) continue;
    g[k] = g[k] || { v: 0, p: 0, f: 0 };
    if (r.review_status === 'validated') g[k].v++;
    else if (r.review_status === 'partially_validated') g[k].p++;
    else if (r.review_status === 'not_validated') g[k].f++;
  }
  return Object.entries(g).map(([key, c]) => {
    const n = c.v + c.p + c.f;
    return { key, total: n, success: c.v, partial: c.p, fail: c.f,
      successRate: pct(c.v, n), weightedRate: pct(c.v + c.p * 0.5, n),
      lowSample: n < 5 };
  }).sort((a, b) => (b.successRate || 0) - (a.successRate || 0));
}

export default async function handler(req, res) {
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'env_missing' });
  try {
    // değerlendirilmiş (pending hariç) kayıtlar
    const cols = 'sym,direction_bias,analysis_score,review_status,result_percent,direction_realized,tg_exp_pct,tg_exp_hi,market_context,created_at';
    const rows = await sb(`analysis_archive?review_status=in.(validated,partially_validated,not_validated)` +
      `&select=${cols}&order=created_at.desc&limit=2000`);

    const reviewed = rows || [];
    const v = reviewed.filter(r => r.review_status === 'validated').length;
    const p = reviewed.filter(r => r.review_status === 'partially_validated').length;
    const f = reviewed.filter(r => r.review_status === 'not_validated').length;
    const n = v + p + f;

    // GENEL
    const overall = { total: n, success: v, partial: p, fail: f,
      successRate: pct(v, n), weightedRate: pct(v + p * 0.5, n) };

    // COIN / YAPI / CONFIDENCE / RİSK
    const byCoin       = groupRates(reviewed, r => r.sym).slice(0, 20);
    const byStructure  = groupRates(reviewed, r => yapi(r.market_context, r.direction_bias));
    const byConfidence = groupRates(reviewed, r => confBand(r.analysis_score))
      .sort((a, b) => ['90+', '80-90', '70-80', '<70', 'Bilinmiyor'].indexOf(a.key) - ['90+', '80-90', '70-80', '<70', 'Bilinmiyor'].indexOf(b.key));
    const byRisk       = groupRates(reviewed, r => riskBucket(r.market_context))
      .sort((a, b) => ['Düşük Risk', 'Orta Risk', 'Yüksek Risk', 'Bilinmiyor'].indexOf(a.key) - ['Düşük Risk', 'Orta Risk', 'Yüksek Risk', 'Bilinmiyor'].indexOf(b.key));

    // AI BEKLENTİ PERFORMANSI (exp kayıtlı olanlar)
    const exp = reviewed.filter(r => r.tg_exp_pct != null && r.result_percent != null);
    let uyumlu = 0, asti = 0, uyumsuz = 0;
    for (const r of exp) {
      const e = Number(r.tg_exp_pct), real = Number(r.result_percent), hi = r.tg_exp_hi != null ? Number(r.tg_exp_hi) : null;
      const sameDir = (e > 0 && real > 0) || (e < 0 && real < 0) || e === 0;
      if (!sameDir && Math.abs(real) >= 0.5) uyumsuz++;
      else if (hi != null && Math.abs(real) >= hi) asti++;
      else uyumlu++;
    }
    const expectation = { sampled: exp.length, uyumlu, asti, uyumsuz,
      uyumOrani: pct(uyumlu + asti, exp.length), note: exp.length < 5 ? 'Yeterli beklenti-kayıtlı veri yok (engine paylaşımları biriktikçe dolar).' : null };

    // HAFTALIK (son 7 gün)
    const wk = new Date(Date.now() - 7 * 864e5).toISOString();
    const w = reviewed.filter(r => r.created_at >= wk);
    const wv = w.filter(r => r.review_status === 'validated').length;
    const wAll = w.length;
    const topKey = (arr) => arr.length ? arr[0].key : null;
    const weekly = {
      total: wAll, success: wv, successRate: pct(wv, wAll),
      topCoin: topKey(groupRates(w, r => r.sym)),
      topStructure: topKey(groupRates(w, r => yapi(r.market_context, r.direction_bias))),
      topRisk: topKey(groupRates(w, r => riskBucket(r.market_context))),
    };

    // ACADEMY = yapı bazlı (örnek + başarı). TIMELINE = veri yok (dürüst).
    const academy = byStructure.map(s => ({ yapi: s.key, ornek: s.total, basari: s.successRate }));
    const timeline = (learnTimeline && learnTimeline.length)
      ? { available: true, byEvent: learnTimeline, note: 'Timeline olay-başarı verisi birikiyor (Phase 9).' }
      : { available: false,
          note: 'Timeline olay etiketi (timeline_event) YENİ kayıtlardan toplanıyor (Phase 9). Scanner gerçek olay tespitini market_context.timeline_event olarak yayınladıkça dolacak — şu an tespit edilemediğinde null yazılıyor (uydurma yok).' };

    // ════════ PHASE 8 — ÖĞRENME KATMANI (sadece gözlem, karar YOK) ════════
    // min örnek 20 altı = Yetersiz Veri (yanıltıcı istatistik üretme)
    const flagMin = (arr) => arr.map(g => Object.assign({}, g, {
      insufficient: g.total < MIN_SAMPLE,
      displayRate: g.total < MIN_SAMPLE ? null : g.successRate,
    }));

    const learnStructure  = flagMin(byStructure);
    const learnConfidence = flagMin(byConfidence);
    const learnRisk       = flagMin(byRisk);
    const learnCoin       = flagMin(byCoin);
    const learnRsi        = flagMin(groupRates(reviewed, r => rsiBand(r.market_context)));

    // ── PHASE 9 zenginleştirme alanları (veri geldikçe otomatik dolar) ──
    const fundBand = (mc) => { const f = mc && mc.funding_rate != null ? Number(mc.funding_rate) : null;
      if (f == null) return null; if (f < 0) return 'Negatif Funding'; if (f < 0.0005) return 'Düşük Funding'; return 'Yüksek Funding'; };
    const mcv = (r, k) => (r.market_context && r.market_context[k] != null) ? r.market_context[k] : null;
    const learnFunding   = flagMin(groupRates(reviewed, r => fundBand(r.market_context)));
    const learnRegime    = flagMin(groupRates(reviewed, r => mcv(r, 'market_regime')));
    const learnVol       = flagMin(groupRates(reviewed, r => mcv(r, 'volatility_band')));
    const learnTimeline  = flagMin(groupRates(reviewed, r => mcv(r, 'timeline_event')));
    const learnLiquidity = flagMin(groupRates(reviewed, r => mcv(r, 'liquidity_event')));
    const hasCond = learnFunding.length || learnRegime.length || learnVol.length;

    // Coin: en iyi / en zayıf (yalnız yeterli örnek)
    const sufficientCoins = learnCoin.filter(c => !c.insufficient);
    const topCoins  = sufficientCoins.slice(0, 5);
    const weakCoins = [...sufficientCoins].sort((a, b) => (a.successRate || 0) - (b.successRate || 0)).slice(0, 5);

    // Düşük risk + 90+ confidence kombinasyonu
    const combo = reviewed.filter(r => riskBucket(r.market_context) === 'Düşük Risk' && (r.analysis_score || 0) >= 90);
    const comboV = combo.filter(r => r.review_status === 'validated').length;
    const comboRate = combo.length >= MIN_SAMPLE ? pct(comboV, combo.length) : null;

    // ── AI GÖZLEMLERİ (öneri DEĞİL, sadece gözlem) — yalnız yeterli örnekte ──
    const observations = [];
    const avg = overall.successRate;
    if (comboRate != null) observations.push(`Düşük risk + 90 üzeri confidence kombinasyonu ${combo.length} analizde %${comboRate} başarı göstermiştir.`);
    const bestStruct = learnStructure.find(s => !s.insufficient);
    if (bestStruct && avg != null) {
      const diff = r1(bestStruct.successRate - avg);
      if (diff > 0) observations.push(`${bestStruct.key} yapısı, sistem ortalamasının %${diff} üzerinde performans göstermektedir (${bestStruct.total} örnek).`);
    }
    if (weakCoins.length && avg != null) {
      const w = weakCoins[0];
      if (w.successRate != null && w.successRate < avg) observations.push(`${w.key} analizleri sistem ortalamasının altında performans göstermektedir (%${w.successRate}, ${w.total} örnek).`);
    }
    const obsNote = observations.length ? null : `Henüz ${MIN_SAMPLE}+ örnekli yeterli veri yok — gözlemler doğrulanmış analizler biriktikçe otomatik üretilecek.`;

    // ── TELEGRAM AI LEARNING REPORT (veri hazır, gönderim YOK) ──
    const pick = (arr) => { const x = arr.find(g => !g.insufficient); return x ? { key: x.key, rate: x.successRate, n: x.total } : null; };
    const learningReport = {
      ready: observations.length > 0,
      enIyiYapi: pick(learnStructure),
      enIyiCoin: topCoins[0] ? { key: topCoins[0].key, rate: topCoins[0].successRate, n: topCoins[0].total } : null,
      enIyiRisk: pick(learnRisk),
      enIyiKosul: pick(learnRsi), // ölçülebilen koşul = RSI bandı (funding/OI yok)
    };

    const learning = {
      minSample: MIN_SAMPLE,
      byStructure: learnStructure, byConfidence: learnConfidence, byRisk: learnRisk,
      byRsi: learnRsi, topCoins, weakCoins,
      byFunding: learnFunding, byRegime: learnRegime, byVolatility: learnVol,
      byTimeline: learnTimeline, byLiquidity: learnLiquidity,
      combo: { total: combo.length, success: comboV, rate: comboRate, insufficient: combo.length < MIN_SAMPLE },
      observations, obsNote, learningReport,
      marketConditions: { available: !!hasCond,
        note: hasCond ? 'Market koşulu verisi birikiyor (Phase 9 zenginleştirme).'
          : 'Funding / Open Interest / Volatilite YENİ kayıtlardan itibaren toplanıyor (Phase 9). Yeterli veri birikince koşul-başarı analizi otomatik açılır. Eski kayıtlarda bu alanlar yok.' },
    };

    return res.status(200).json({
      ok: true, generated_at: new Date().toISOString(),
      overall, byCoin, byStructure, byConfidence, byRisk, expectation, weekly, academy, timeline, learning,
      gaps: {
        structure_persisted: false,
        structure_note: 'Yapı kalıcı kolon değil; rsi/score/yön ile türetiliyor. Tam doğruluk için scanner market_context.structure yazmalı.',
        timeline_linkage: false,
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
