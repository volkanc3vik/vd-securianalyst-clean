// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — First-Hit Outcome RUNNER (Build 163B)
//
// Yeni-motor (outcome_status='pending') & due & öğrenmeye dahil kayıtları
// işler. Binance fapi kline'ı KRONOLOJİK gezerek ilk hangi eşiğin
// (confirm / invalid) önce geldiğini bulur → outcome_status'u yazar.
//
// ÖNEMLİ:
//  • Sadece outcome_status='pending' & excluded_from_learning=false & due.
//    → Legacy ve eski-motor kayıtlarına ASLA dokunmaz, yeniden hesaplamaz.
//  • Veri yetmezse/fiyat çekilemezse kayıt PENDING kalır (uydurma yok).
//  • outcome_status → review_status köprüsü (Volkan onayı): mevcut
//    Performance/Elite/istatistik hiç değişmeden çalışmaya devam eder.
//  • Max favorable/adverse SADECE bilgi; sonucu tek başına belirlemez.
// ═══════════════════════════════════════════════════════════════════

import { profileFor, OUTCOME_ENGINE_VERSION, INTRABAR_TIE_BREAK } from './outcome-config.js';

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

function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// First-hit için kline interval — kısa pencerede ince (belirsizliği azalt)
function klineInterval(winHours) {
  const h = Number(winHours) || 24;
  if (h <= 4)  return '1m';   // 15m profili (4s) → ~240 mum
  if (h <= 24) return '5m';   // 1h profili (24s) → ~288 mum
  return '15m';               // 4h profili (72s) → ~288 mum
}

// outcome_status → review_status köprüsü (Volkan onayı)
function mapReviewStatus(outcome) {
  if (outcome === 'confirmed') return 'validated';
  if (outcome === 'partial')   return 'partially_validated';
  return 'not_validated'; // invalidated, expired
}
function mapValidationScore(outcome) {
  if (outcome === 'confirmed')   return 85;
  if (outcome === 'partial')     return 60;
  if (outcome === 'invalidated') return 25;
  return 40; // expired
}

// ── First-hit çözümleyici (saf fonksiyon) ─────────────────────────────
// klines: Binance fapi formatı [openTime, open, high, low, close, ...]
function resolveFirstHit({ bias, entry, klines, confirmPct, invalidPct, partialPct }) {
  const e = Number(entry);
  const b = (bias === 'bearish') ? 'short' : (bias === 'neutral' ? 'neutral' : 'long');

  let maxFav = 0, maxAdv = 0;
  let status = null, firstHit = null, resolvedMs = null;

  for (const k of klines) {
    const openTime = +k[0];
    const high = +k[2], low = +k[3];
    if (isNaN(high) || isNaN(low)) continue;

    const upPct   = (high - e) / e * 100;  // yukarı hareket (%)
    const downPct = (e - low) / e * 100;   // aşağı hareket (%) — pozitif

    // Max favorable / adverse (bilgi) — TÜM pencere boyunca
    if (b === 'long')       { maxFav = Math.max(maxFav, upPct);   maxAdv = Math.max(maxAdv, downPct); }
    else if (b === 'short') { maxFav = Math.max(maxFav, downPct); maxAdv = Math.max(maxAdv, upPct); }
    else                    { const m = Math.max(upPct, downPct); maxFav = Math.max(maxFav, m); maxAdv = Math.max(maxAdv, m); }

    if (status) continue; // zaten çözüldü → kalan mumlarda yalnız maxFav/Adv toplanır

    let hitConfirm = false, hitInvalid = false;
    if (b === 'long')       { hitConfirm = upPct   >= confirmPct; hitInvalid = downPct >= invalidPct; }
    else if (b === 'short') { hitConfirm = downPct >= confirmPct; hitInvalid = upPct   >= invalidPct; }
    else                    { hitInvalid = (upPct >= invalidPct) || (downPct >= invalidPct); } // neutral: yön yok

    if (hitInvalid && hitConfirm) {
      // intrabar tie-break
      status = (INTRABAR_TIE_BREAK === 'confirm') ? 'confirmed' : 'invalidated';
      firstHit = (status === 'confirmed') ? 'confirm' : 'invalid';
      resolvedMs = openTime;
    } else if (hitInvalid) {
      status = 'invalidated'; firstHit = 'invalid'; resolvedMs = openTime;
    } else if (hitConfirm) {
      status = 'confirmed'; firstHit = 'confirm'; resolvedMs = openTime;
    }
  }

  // Hiçbir eşik gelmediyse
  if (!status) {
    if (b === 'neutral') {
      status = 'confirmed'; firstHit = null;   // yatay beklenti tuttu (invalid'i hiç geçmedi)
    } else if (maxFav >= partialPct) {
      status = 'partial'; firstHit = null;     // doğru yönde kısmi hareket
    } else {
      status = 'expired'; firstHit = null;     // anlamlı hareket yok
    }
  }

  return { status, firstHit, resolvedMs, maxFav: r2(maxFav), maxAdv: r2(maxAdv) };
}

// ── Tek kaydı çöz ─────────────────────────────────────────────────────
async function resolveOne(rec, dry) {
  const entry = Number(rec.price_at_analysis);
  if (!entry || isNaN(entry)) return { state: 'skipped', reason: 'no_entry_price' };
  const startMs = Date.parse(rec.created_at);
  const endMs = rec.review_due_at ? Date.parse(rec.review_due_at) : null;
  if (!endMs || endMs > Date.now()) return { state: 'skipped', reason: 'not_due' };
  const symbol = String(rec.sym || '').toUpperCase();
  if (!symbol) return { state: 'skipped', reason: 'no_symbol' };

  const winHours = rec.review_window_hours || (endMs - startMs) / 3_600_000;
  const interval = klineInterval(winHours);
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=1500`;

  let kr;
  try { kr = await fetch(url, { headers: { 'Accept': 'application/json' } }); }
  catch (e) { return { state: 'skipped', reason: 'price_fetch_failed' }; }
  if (kr.status === 451) return { state: 'skipped', reason: 'geo_blocked' };
  if (!kr.ok) return { state: 'skipped', reason: `http_${kr.status}` };
  let kl;
  try { kl = await kr.json(); } catch (e) { return { state: 'skipped', reason: 'bad_price_data' }; }
  if (!Array.isArray(kl) || !kl.length) {
    const msg = (kl && kl.msg) ? String(kl.msg).toLowerCase() : '';
    if (msg.includes('restricted') || msg.includes('eligibility')) return { state: 'skipped', reason: 'geo_blocked' };
    return { state: 'skipped', reason: 'no_price_data' };
  }

  // Eşikler: kayıttan (yoksa config'den)
  const prof = profileFor(rec.timeframe);
  const confirmPct = (rec.confirm_threshold_pct != null) ? Number(rec.confirm_threshold_pct) : prof.confirm;
  const invalidPct = (rec.invalid_threshold_pct != null) ? Number(rec.invalid_threshold_pct) : prof.invalid;
  const partialPct = prof.partial;

  const res = resolveFirstHit({ bias: rec.direction_bias, entry, klines: kl, confirmPct, invalidPct, partialPct });
  const lastClose = +kl[kl.length - 1][4];
  const endMovePct = (!isNaN(lastClose)) ? r2((lastClose - entry) / entry * 100) : null;

  let ttr = null;
  if (res.resolvedMs && startMs) ttr = Math.max(0, Math.round((res.resolvedMs - startMs) / 60000));

  const reviewStatus = mapReviewStatus(res.status);
  const valScore = mapValidationScore(res.status);

  if (dry) return { state: 'processed', status: res.status, mapped: reviewStatus, dry: true };

  const nowIso = new Date().toISOString();
  const resolvedIso = res.resolvedMs ? new Date(res.resolvedMs).toISOString() : nowIso;

  const patch = {
    // ── YENİ first-hit alanları ──
    outcome_status: res.status,
    outcome_first_hit: res.firstHit,
    outcome_resolved_at: resolvedIso,
    outcome_time_to_result_minutes: ttr,
    max_favorable_move_pct: res.maxFav,
    max_adverse_move_pct: res.maxAdv,
    outcome_engine_version: rec.outcome_engine_version || OUTCOME_ENGINE_VERSION,
    // ── ESKİ alanlar (UI/stats köprüsü — değişmeden çalışsın) ──
    review_status: reviewStatus,
    reviewed_at: nowIso,
    review_source: 'first_hit_v1',
    price_at_review: r2(lastClose),
    validation_score: valScore,
    result_percent: res.maxFav,
    max_move_pct: res.maxFav,
    min_move_pct: r2(-res.maxAdv),
    end_move_pct: endMovePct,
    admin_note: `(first-hit) ${res.status} · eşik confirm ${confirmPct}% / invalid ${invalidPct}% · ilk değen: ${res.firstHit || '—'} · maxFav ${res.maxFav}% / maxAdv ${res.maxAdv}%${ttr != null ? ` · ${ttr} dk` : ''}.`,
    internal_review: {
      engine: 'first_hit_v1', outcome_status: res.status, first_hit: res.firstHit,
      confirm_pct: confirmPct, invalid_pct: invalidPct, partial_pct: partialPct,
      max_favorable_move_pct: res.maxFav, max_adverse_move_pct: res.maxAdv, ttr_minutes: ttr,
    },
  };

  // Yarış güvenliği: yalnız HÂLÂ outcome_status='pending' ise yaz
  const upd = await sbFetch(
    `/analysis_archive?id=eq.${encodeURIComponent(rec.id)}&outcome_status=eq.pending`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  if (!upd || !upd.length) return { state: 'skipped', reason: 'already_resolved' };
  return { state: 'processed', status: res.status, mapped: reviewStatus };
}

// ── Batch çalıştır (review-run + report-run'dan çağrılır) ──────────────
export async function runBatch({ limit = 25, dry = false } = {}) {
  const summary = {
    engine: 'first_hit_v1', processed: 0,
    confirmed: 0, invalidated: 0, partial: 0, expired: 0,
    skipped: 0, errors: 0, fetched: 0, skip_reasons: {}, dry,
  };
  if (!SB_URL || !SB_KEY) { summary.error = 'supabase_env_missing'; return summary; }

  const nowIso = new Date().toISOString();
  const lim = Math.max(1, Math.min(parseInt(limit, 10) || 25, 50));
  const cols = 'id,sym,timeframe,direction_bias,price_at_analysis,review_window_hours,review_due_at,created_at,confirm_threshold_pct,invalid_threshold_pct,outcome_engine_version';

  let rows;
  try {
    rows = await sbFetch(
      `/analysis_archive?outcome_status=eq.pending&excluded_from_learning=eq.false&review_due_at=lte.${encodeURIComponent(nowIso)}` +
      `&order=review_due_at.asc.nullslast&limit=${lim}&select=${cols}`,
      { method: 'GET' }
    );
  } catch (e) { summary.error = String(e && e.message).slice(0, 200); return summary; }

  const list = rows || [];
  summary.fetched = list.length;

  for (const rec of list) {
    try {
      const r = await resolveOne(rec, dry);
      if (r.state === 'processed') {
        summary.processed++;
        if (summary[r.status] != null) summary[r.status]++;
      } else {
        summary.skipped++;
        summary.skip_reasons[r.reason] = (summary.skip_reasons[r.reason] || 0) + 1;
      }
    } catch (e) {
      summary.errors++;
      console.error('[outcome-runner] kayıt hatası', rec && rec.id, e && e.message);
    }
  }
  return summary;
}
