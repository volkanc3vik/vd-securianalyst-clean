// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — AUTO OUTCOME REVIEW PIPELINE  (Phase 13.0-R)
//
// /api/review-run  — cron-job.org ile tetiklenir (Vercel cron DEĞİL).
//   due olan pending kayıtları batch işler, Binance fapi kline'dan
//   outcome hesaplar ve review_status'u OTOMATİK uygular.
//
// ÖNEMLİ:
//  • Kriter, analysis-archive.js'teki computeOutcome ile BİREBİR AYNI
//    (skor ≥75 validated · ≥50 partially_validated · <50 not_validated).
//    Yeni kriter İCAT EDİLMEDİ — aynalandı (manuel akış bozulmasın diye
//    analysis-archive.js'e dokunulmadı; senkron tutulmalı).
//  • Sadece review_status='pending' & review_due_at<=now işlenir.
//    İncelenmiş kayıtlara ASLA dokunmaz → manuel kararları ezmez.
//  • Veri yetmezse / fiyat çekilemezse kayıt PENDING kalır (uydurma yok).
//  • Karar = retrospektif analiz tutarlılığı; yatırım performansı DEĞİL.
//  • Guard: ?secret=REVIEW_CRON_SECRET (fallback TELEGRAM_CRON_SECRET)
//           veya x-admin-key (ADMIN_KEY_1/2) — manuel test için.
//  • ?dry=1 → hesaplar, YAZMAZ (geo-block testi için).
//  • ?limit=N → bu çalışmada max kayıt (varsayılan 25, tavan 50).
// ═══════════════════════════════════════════════════════════════════

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sbFetch(path, options = {}) {
  if (!SB_URL || !SB_KEY) throw new Error('supabase_env_missing');
  const url = `${SB_URL.replace(/\/$/, '')}/rest/v1${path}`;
  const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {}),
  };
  const r = await fetch(url, { ...options, headers });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`supabase_${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

// ── analysis-archive.js ile BİREBİR AYNI (ayna — senkron tut) ──────────
function klineInterval(winHours) {
  const h = Number(winHours) || 48;
  if (h <= 24) return '15m';
  if (h <= 72) return '1h';
  return '2h';
}
function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function computeOutcome({ bias, entry, high, low, lastClose }) {
  const e = Number(entry);
  const pctHigh = (high - e) / e * 100;
  const pctLow  = (low - e) / e * 100;
  const pctEnd  = (lastClose - e) / e * 100;

  let favMax, favMin, favEnd;
  if (bias === 'bearish') {
    favMax = -pctLow; favMin = -pctHigh; favEnd = -pctEnd;
  } else {
    favMax = pctHigh; favMin = pctLow; favEnd = pctEnd;
  }

  let direction_realized = 'neutral';
  if (pctEnd >= 0.5) direction_realized = 'bullish';
  else if (pctEnd <= -0.5) direction_realized = 'bearish';

  let score;
  if (bias === 'neutral') {
    const a = Math.abs(pctEnd);
    score = a < 1 ? 60 : a < 3 ? 50 : 42;
  } else {
    // MAX favorable hareket bazlı (analysis-archive.js ile BİREBİR — Volkan kararı)
    if (favMax >= 2)        score = 75 + clamp((favMax - 2) * 2.5, 0, 20);
    else if (favMax >= 1)   score = 58 + (favMax - 1) * 17;
    else if (favMax >= 0.4) score = 45 + (favMax - 0.4) / 0.6 * 13;
    else                    score = clamp(20 + favMax * 60, 5, 45);
  }
  score = clamp(Math.round(score), 0, 95);

  const review_status = score >= 75 ? 'validated' : score >= 50 ? 'partially_validated' : 'not_validated';
  const biasWord = bias === 'bullish' ? 'yukarı' : bias === 'bearish' ? 'aşağı' : 'yatay';
  const dirAdj   = bias === 'bullish' ? 'bullish' : bias === 'bearish' ? 'bearish' : 'nötr';
  let adminNote, internalNote;
  if (bias === 'neutral') {
    adminNote = `Analiz nötr beklentiyle açıldı. Fiyat, inceleme penceresinde sınırlı hareket etti (pencere sonu ${r2(favEnd)}%, maksimum ${r2(favMax)}%). ${review_status === 'validated' ? 'Yatay beklenti büyük ölçüde doğrulandı.' : 'Beklenti kısmen karşılandı.'}`;
    internalNote = `Nötr kurulum; yön netliği ve volatilite düşük. Benzer durumlarda işlem önceliği azaltılabilir.`;
  } else if (review_status === 'validated') {
    adminNote = `Analiz yönü piyasa hareketiyle uyumlu gerçekleşti. Fiyat, inceleme penceresi içinde ${biasWord} yönde ilerledi (pencere sonu ${r2(favEnd)}%, maksimum ${r2(favMax)}%) ve ${dirAdj} beklenti büyük ölçüde doğrulandı.`;
    internalNote = `Momentum ve trend uyumu bu kurulumda pozitif sonuç verdi. Benzer setup'larda confidence korunabilir.`;
  } else if (review_status === 'partially_validated') {
    adminNote = `Analiz yönü kısmen doğrulandı. Fiyat ${biasWord} yönde bir miktar ilerledi (pencere sonu ${r2(favEnd)}%) ancak beklenen güç tam oluşmadı.`;
    internalNote = `Yön doğru ancak hareketin gücü sınırlıydı. Benzer setup'larda giriş zamanlaması ve teyit sinyalleri gözden geçirilebilir.`;
  } else {
    adminNote = `Analiz yönü piyasa hareketiyle uyuşmadı. Fiyat beklenenin aksine/zayıf hareket etti (pencere sonu ${r2(favEnd)}%) ve ${dirAdj} beklenti doğrulanmadı.`;
    internalNote = `Bu kurulum beklenen yönü vermedi. Benzer koşullarda confidence düşürülebilir veya ek teyit aranabilir.`;
  }

  return {
    price_at_review: r2(lastClose),
    max_move_pct: r2(favMax),
    min_move_pct: r2(favMin),
    end_move_pct: r2(favEnd),
    result_percent: r2(favEnd),
    direction_realized,
    validation_score: score,
    review_status,
    adminNote,
    internalNote,
    summary: `Pencere sonu ${r2(favEnd)}% · maksimum ${r2(favMax)}% · gerçekleşen yön ${direction_realized} · skor ${score}/100 · (otomatik) ${review_status}.`,
  };
}

// ── Tek kaydı işle (hata kaydı bozsa diğerleri devam etsin) ───────────
async function reviewOne(rec, dry) {
  const entry = Number(rec.price_at_analysis);
  if (!entry || isNaN(entry)) return { state: 'skipped', reason: 'no_entry_price' };
  const startMs = Date.parse(rec.created_at);
  const endMs = rec.review_due_at ? Date.parse(rec.review_due_at) : null;
  if (!endMs || endMs > Date.now()) return { state: 'skipped', reason: 'not_due' };
  const interval = klineInterval(rec.review_window_hours || (endMs - startMs) / 3_600_000);
  const symbol = String(rec.sym || '').toUpperCase();
  if (!symbol) return { state: 'skipped', reason: 'no_symbol' };

  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=1500`;
  let kr;
  try { kr = await fetch(url, { headers: { 'Accept': 'application/json' } }); }
  catch (e) { return { state: 'skipped', reason: 'price_fetch_failed' }; }
  if (kr.status === 451) return { state: 'skipped', reason: 'geo_blocked' };
  if (!kr.ok) return { state: 'skipped', reason: `http_${kr.status}` };
  let kl;
  try { kl = await kr.json(); } catch (e) { return { state: 'skipped', reason: 'bad_price_data' }; }
  if (!Array.isArray(kl)) {
    const msg = (kl && kl.msg) ? String(kl.msg).toLowerCase() : '';
    if (msg.includes('restricted') || msg.includes('eligibility')) return { state: 'skipped', reason: 'geo_blocked' };
    return { state: 'skipped', reason: 'no_price_data' };
  }
  if (!kl.length) return { state: 'skipped', reason: 'no_price_data' };
  const highs = kl.map(k => +k[2]).filter(n => !isNaN(n));
  const lows  = kl.map(k => +k[3]).filter(n => !isNaN(n));
  const lastClose = +kl[kl.length - 1][4];
  if (!highs.length || !lows.length || isNaN(lastClose)) return { state: 'skipped', reason: 'bad_price_data' };
  const high = Math.max(...highs), low = Math.min(...lows);

  const out = computeOutcome({ bias: rec.direction_bias, entry, high, low, lastClose });

  if (dry) return { state: 'processed', status: out.review_status, dry: true };

  const patch = {
    review_status: out.review_status,
    reviewed_at: new Date().toISOString(),
    review_source: 'auto',
    price_at_review: out.price_at_review,
    max_move_pct: out.max_move_pct,
    min_move_pct: out.min_move_pct,
    end_move_pct: out.end_move_pct,
    result_percent: out.result_percent,
    direction_realized: out.direction_realized,
    validation_score: out.validation_score,
    admin_note: out.adminNote,
    internal_review: { review_status: out.review_status, summary: out.summary, internalNote: out.internalNote, auto: true },
  };
  // Yarış güvenliği: yalnız HÂLÂ pending ise yaz (başka süreç onayladıysa dokunma)
  const upd = await sbFetch(
    `/analysis_archive?id=eq.${encodeURIComponent(rec.id)}&review_status=eq.pending`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  if (!upd || !upd.length) return { state: 'skipped', reason: 'already_reviewed' };
  return { state: 'processed', status: out.review_status };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // ── Guard ──
  const q = req.query || {};
  const provided = (q.secret || '').toString();
  const cronSecret = process.env.REVIEW_CRON_SECRET || process.env.TELEGRAM_CRON_SECRET || '';
  const adminKeys = [process.env.ADMIN_KEY_1, process.env.ADMIN_KEY_2].filter(Boolean);
  const adminHdr = (req.headers['x-admin-key'] || '').toString();
  const okCron = cronSecret && provided && provided === cronSecret;
  const okAdmin = adminKeys.length > 0 && adminHdr && adminKeys.includes(adminHdr);
  if (!okCron && !okAdmin) return res.status(403).json({ ok: false, error: 'unauthorized' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'supabase_env_missing' });

  const dry = q.dry === '1' || q.dry === 'true';
  const limit = Math.max(1, Math.min(parseInt(q.limit || '25', 10) || 25, 50));
  const nowIso = new Date().toISOString();

  const summary = { processed: 0, validated: 0, partially_validated: 0, not_validated: 0, skipped: 0, errors: 0, dry, limit, fetched: 0, skip_reasons: {} };

  try {
    const cols = 'id,sym,direction_bias,price_at_analysis,review_window_hours,review_due_at,created_at';
    const rows = await sbFetch(
      `/analysis_archive?review_status=eq.pending&admin_archived=eq.false&review_due_at=lte.${encodeURIComponent(nowIso)}` +
      `&order=review_due_at.asc.nullslast&limit=${limit}&select=${cols}`,
      { method: 'GET' }
    );
    const list = rows || [];
    summary.fetched = list.length;

    for (const rec of list) {
      try {
        const r = await reviewOne(rec, dry);
        if (r.state === 'processed') {
          summary.processed++;
          if (r.status === 'validated') summary.validated++;
          else if (r.status === 'partially_validated') summary.partially_validated++;
          else if (r.status === 'not_validated') summary.not_validated++;
        } else {
          summary.skipped++;
          summary.skip_reasons[r.reason] = (summary.skip_reasons[r.reason] || 0) + 1;
        }
      } catch (e) {
        summary.errors++;
        console.error('[review-run] kayıt hatası', rec && rec.id, e && e.message);
      }
    }

    return res.status(200).json({ ok: true, ...summary, at: nowIso });
  } catch (e) {
    console.error('[review-run] genel hata:', e && e.message);
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(e && e.message).slice(0, 200), ...summary });
  }
}
