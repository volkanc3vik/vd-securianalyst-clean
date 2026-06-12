// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — First-Hit Outcome RUNNER (Build 163B)
//
// Yeni-motor (outcome_status='pending') & due & öğrenmeye dahil kayıtları
// işler. Binance fapi kline'ı KRONOLOJİK gezerek ilk hangi eşiğin
// (confirm / invalid) önce geldiğini bulur → outcome_status'u yazar.
//
// ÖNEMLİ:
//  • outcome_status='pending' & due & (excluded_from_learning=false VEYA sample_type='research'). [Aşama 2]
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

// ════════════════════════════════════════════════════════════════════
// OUTCOME V3 — ÇOK-UFUKLU SNAPSHOT (saf fonksiyonlar)
// Her ufuk (1h/4h/12h/24h) için: move (kesim anı kapanışı, lehte işaretli),
// mfe, mae. Tek kline geçişinde TÜM ufuklar hesaplanır (ek çağrı yok).
// Ufuk SONUCU yalnız kesim kapanışına bakar (direktif):
//   move ≥ confirm → confirmed · ≥ partial → partial · değilse rejected
// First-Hit ana kararına ASLA dokunmaz.
// ════════════════════════════════════════════════════════════════════
export function horizonSnapshots({ bias, entry, klines, startMs, hoursList }) {
  const e = Number(entry);
  const b = (bias === 'bearish') ? 'short' : (bias === 'neutral' ? 'neutral' : 'long');
  const cuts = hoursList.map(h => ({ h, end: startMs + h * 3600_000, mfe: 0, mae: 0, move: null, seen: false }));
  for (const k of klines) {
    const t = +k[0], hi = +k[2], lo = +k[3], cl = +k[4];
    if (isNaN(hi) || isNaN(lo)) continue;
    const up = (hi - e) / e * 100, dn = (e - lo) / e * 100;
    let fav, adv;
    if (b === 'long')       { fav = up; adv = dn; }
    else if (b === 'short') { fav = dn; adv = up; }
    else                    { const m = Math.max(up, dn); fav = m; adv = m; }
    const cls = isNaN(cl) ? null : ((b === 'short') ? (e - cl) / e * 100 : (b === 'neutral') ? Math.max(up, dn) : (cl - e) / e * 100);
    for (const c of cuts) {
      if (t < c.end) {
        c.seen = true;
        if (fav > c.mfe) c.mfe = fav;
        if (adv > c.mae) c.mae = adv;
        if (cls != null) c.move = cls;
      }
    }
  }
  const out = {};
  for (const c of cuts) {
    out['h' + c.h] = c.seen
      ? { move: r2(c.move), mfe: r2(c.mfe), mae: r2(c.mae) }
      : null;   // o ufka ait hiç mum yok (henüz erken) → null, uydurma yok
  }
  return out;
}

export function horizonOutcome(snap, confirmPct, partialPct) {
  if (!snap || snap.move == null) return null;
  if (snap.move >= confirmPct) return 'confirmed';
  if (snap.move >= partialPct) return 'partial';
  return 'rejected';
}

// ── First-hit çözümleyici (saf fonksiyon) ─────────────────────────────
// klines: Binance fapi formatı [openTime, open, high, low, close, ...]
function resolveFirstHit({ bias, entry, klines, confirmPct, invalidPct, partialPct, startMs }) {
  const e = Number(entry);
  const b = (bias === 'bearish') ? 'short' : (bias === 'neutral' ? 'neutral' : 'long');

  let maxFav = 0, maxAdv = 0;
  let status = null, firstHit = null, resolvedMs = null;
  // ── OUTCOME INTELLIGENCE (first_hit_v1_oi) ek takip — karar mantığına DOKUNMAZ ──
  let mfeAtMs = null, maeAtMs = null;          // zirvelerin zamanı
  let firstConfirmTouchMs = null, firstInvalidTouchMs = null; // seviyelere İLK değme (çözümden bağımsız)
  let peakAfterResolve = 0;                    // çözümden SONRAKİ en iyi lehte hareket
  let lastClosePct = null;                     // pencere kapanışı (lehte işaretli)

  for (const k of klines) {
    const openTime = +k[0];
    const high = +k[2], low = +k[3];
    if (isNaN(high) || isNaN(low)) continue;
    const closeP = +k[4];

    const upPct   = (high - e) / e * 100;  // yukarı hareket (%)
    const downPct = (e - low) / e * 100;   // aşağı hareket (%) — pozitif

    // Max favorable / adverse (bilgi) — TÜM pencere boyunca
    let favHere, advHere;
    if (b === 'long')       { favHere = upPct;   advHere = downPct; }
    else if (b === 'short') { favHere = downPct; advHere = upPct; }
    else                    { const m = Math.max(upPct, downPct); favHere = m; advHere = m; }
    if (favHere > maxFav) { maxFav = favHere; mfeAtMs = openTime; }
    if (advHere > maxAdv) { maxAdv = advHere; maeAtMs = openTime; }

    // Pencere kapanışı (lehte işaretli %) — her mumda güncellenir, sonuncusu kalır
    if (!isNaN(closeP)) {
      lastClosePct = (b === 'short') ? (e - closeP) / e * 100 : (closeP - e) / e * 100;
    }

    // Seviyelere ilk değme zamanları (yön bazlı; karar mantığından bağımsız bilgi)
    if (b !== 'neutral') {
      const cTouch = (b === 'long') ? upPct >= confirmPct : downPct >= confirmPct;
      const iTouch = (b === 'long') ? downPct >= invalidPct : upPct >= invalidPct;
      if (cTouch && firstConfirmTouchMs == null) firstConfirmTouchMs = openTime;
      if (iTouch && firstInvalidTouchMs == null) firstInvalidTouchMs = openTime;
    }

    // Çözüm SONRASI zirve (çözüm mumunun kendisi hariç — intrabar belirsiz)
    if (status && resolvedMs != null && openTime > resolvedMs) {
      peakAfterResolve = Math.max(peakAfterResolve, favHere);
    }

    if (status) continue; // zaten çözüldü → kalan mumlarda yalnız bilgi toplanır

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

  const _min = (ms) => (ms != null && startMs != null) ? Math.max(0, Math.round((ms - startMs) / 60000)) : null;
  return {
    status, firstHit, resolvedMs, maxFav: r2(maxFav), maxAdv: r2(maxAdv),
    // ── Outcome Intelligence alanları ──
    mfeAtMs, maeAtMs,
    windowClosePct: lastClosePct != null ? r2(lastClosePct) : null,
    ttcMin: _min(firstConfirmTouchMs),
    ttiMin: _min(firstInvalidTouchMs),
    peakAfterConfirm: (status === 'confirmed') ? r2(peakAfterResolve) : null,
    peakAfterInvalid: (status === 'invalidated') ? r2(peakAfterResolve) : null,
  };
}

// ── Outcome Quality (Volkan onaylı kurallar) ──────────────────────────
//   clean_confirmed           : confirmed & close ≥ 0 (reversal yoksa)
//   confirmed_then_reversed   : confirmed & close < 0
//   invalidated_then_recovered: invalidated & (MFE ≥ confirm eşiği VEYA close ≥ +partial)
//   clean_invalidated         : kalan invalidated
//   (partial/expired/neutral → null)
function outcomeQuality(res, confirmPct, partialPct) {
  const c = res.windowClosePct;
  if (res.status === 'confirmed') {
    if (c != null && c < 0) return 'confirmed_then_reversed';
    return 'clean_confirmed';
  }
  if (res.status === 'invalidated') {
    if (res.maxFav >= confirmPct || (c != null && c >= partialPct)) return 'invalidated_then_recovered';
    return 'clean_invalidated';
  }
  return null;
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

  const res = resolveFirstHit({ bias: rec.direction_bias, entry, klines: kl, confirmPct, invalidPct, partialPct, startMs });
  const lastClose = +kl[kl.length - 1][4];
  const endMovePct = (!isNaN(lastClose)) ? r2((lastClose - entry) / entry * 100) : null;

  let ttr = null;
  if (res.resolvedMs && startMs) ttr = Math.max(0, Math.round((res.resolvedMs - startMs) / 60000));

  const reviewStatus = mapReviewStatus(res.status);
  const valScore = mapValidationScore(res.status);

  if (dry) return { state: 'processed', status: res.status, mapped: reviewStatus, dry: true };

  const nowIso = new Date().toISOString();
  const resolvedIso = res.resolvedMs ? new Date(res.resolvedMs).toISOString() : nowIso;

  // ── V3: h1 + h4 mevcut 5h mumlarından BEDAVAYA (ek çağrı yok) ──
  const snaps14 = horizonSnapshots({ bias: rec.direction_bias, entry, klines: kl, startMs, hoursList: [1, 4] });

  const patch = {
    // ── YENİ first-hit alanları ──
    outcome_status: res.status,
    first_hit_outcome: res.status,                               // V3: açık alan (direktif)
    h1_outcome: horizonOutcome(snaps14.h1, confirmPct, partialPct),
    h4_outcome: horizonOutcome(snaps14.h4, confirmPct, partialPct),
    checkpoints: { h1: snaps14.h1, h4: snaps14.h4 },             // h12/h24 Geçiş-2'de
    outcome_first_hit: res.firstHit,
    outcome_resolved_at: resolvedIso,
    outcome_time_to_result_minutes: ttr,
    max_favorable_move_pct: res.maxFav,
    max_adverse_move_pct: res.maxAdv,
    outcome_engine_version: rec.outcome_engine_version || OUTCOME_ENGINE_VERSION,
    // ── OUTCOME INTELLIGENCE (Volkan onaylı yeni alanlar) ──
    window_close_pct: res.windowClosePct,
    time_to_confirm_min: res.ttcMin,
    time_to_invalid_min: res.ttiMin,
    mfe_at: res.mfeAtMs ? new Date(res.mfeAtMs).toISOString() : null,
    mae_at: res.maeAtMs ? new Date(res.maeAtMs).toISOString() : null,
    peak_profit_after_confirm: res.peakAfterConfirm,
    peak_profit_after_invalid: res.peakAfterInvalid,
    outcome_quality: outcomeQuality(res, confirmPct, partialPct),
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
      window_close_pct: res.windowClosePct, ttc_min: res.ttcMin, tti_min: res.ttiMin,
      peak_after_confirm: res.peakAfterConfirm, peak_after_invalid: res.peakAfterInvalid,
      outcome_quality: outcomeQuality(res, confirmPct, partialPct),
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
      `/analysis_archive?outcome_status=eq.pending&or=(excluded_from_learning.eq.false,sample_type.eq.research)&review_due_at=lte.${encodeURIComponent(nowIso)}` +
      `&order=review_due_at.asc.nullslast&limit=${lim}&select=${cols}`,
      { method: 'GET' }
    );
  } catch (e) { summary.error = String(e && e.message).slice(0, 200); return summary; }

  const list = rows || [];
  summary.fetched = list.length;

  // ── PARALEL ÇÖZÜM: kayıtları küçük gruplar halinde eşzamanlı işle ──
  // 50 ardışık çağrı ~15-25sn (Vercel 10sn timeout'unu aşar). 8'erli
  // paralel gruplarla ~3-4sn'ye iner. Binance fapi 1200 req/dk limiti
  // bizden çok yüksek; 8 eşzamanlı güvenli.
  const CHUNK = 8;
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK);
    const results = await Promise.all(slice.map(async (rec) => {
      try {
        return await resolveOne(rec, dry);
      } catch (e) {
        console.error('[outcome-runner] kayıt hatası', rec && rec.id, e && e.message);
        return { state: 'error' };
      }
    }));
    for (const r of results) {
      if (r.state === 'processed') {
        summary.processed++;
        if (summary[r.status] != null) summary[r.status]++;
      } else if (r.state === 'error') {
        summary.errors++;
      } else {
        summary.skipped++;
        summary.skip_reasons[r.reason] = (summary.skip_reasons[r.reason] || 0) + 1;
      }
    }
  }
  return summary;
}

// ════════════════════════════════════════════════════════════════════
// GEÇİŞ-2 (V3): kayıt 24 saati doldurunca TEK kline çağrısıyla (1m×1440)
// h1/h4/h12/h24 + 24h-geneli MFE/MAE + quality yeniden hesaplanır,
// checkpoints_done_at damgalanır → kayıt TAM kapanır.
// First-Hit alanlarına (outcome_status / first_hit) DOKUNULMAZ.
// ════════════════════════════════════════════════════════════════════
const CP_HOURS = [1, 4, 12, 24];

async function resolveCheckpoints(rec) {
  const entry = Number(rec.price_at_analysis);
  if (isNaN(entry) || entry <= 0) return { state: 'skipped', reason: 'bad_entry' };
  const startMs = Date.parse(rec.created_at);
  if (!Number.isFinite(startMs)) return { state: 'skipped', reason: 'bad_created' };
  const endMs = startMs + 24 * 3600_000;
  if (Date.now() < endMs) return { state: 'skipped', reason: 'not_due' };

  const sym = String(rec.sym || '').toUpperCase();
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(sym)}&interval=1m&startTime=${startMs}&endTime=${endMs}&limit=1500`;
  let kr;
  try { kr = await fetch(url, { headers: { 'Accept': 'application/json' } }); }
  catch (e) { return { state: 'skipped', reason: 'kline_net' }; }
  let kl; try { kl = await kr.json(); } catch (e) { return { state: 'skipped', reason: 'bad_price_data' }; }
  if (!Array.isArray(kl) || !kl.length) {
    const msg = (kl && kl.msg) ? String(kl.msg).toLowerCase() : '';
    if (msg.includes('restricted') || msg.includes('eligibility')) return { state: 'skipped', reason: 'geo_blocked' };
    return { state: 'skipped', reason: 'no_price_data' };
  }

  const prof = profileFor(rec.timeframe);
  const confirmPct = (rec.confirm_threshold_pct != null) ? Number(rec.confirm_threshold_pct) : prof.confirm;
  const invalidPct = (rec.invalid_threshold_pct != null) ? Number(rec.invalid_threshold_pct) : prof.invalid;
  const partialPct = prof.partial;

  const snaps = horizonSnapshots({ bias: rec.direction_bias, entry, klines: kl, startMs, hoursList: CP_HOURS });
  const h24 = snaps.h24 || snaps.h12 || snaps.h4 || snaps.h1;

  // 24h-geneli quality (aynı kurallar, geniş pencere): first-hit SABİT.
  const fh = rec.outcome_status;
  let quality = rec.outcome_quality || null;
  if (h24 && (fh === 'confirmed' || fh === 'invalidated')) {
    if (fh === 'confirmed') quality = (h24.move != null && h24.move < 0) ? 'confirmed_then_reversed' : 'clean_confirmed';
    else quality = (h24.mfe >= confirmPct || (h24.move != null && h24.move >= partialPct)) ? 'invalidated_then_recovered' : 'clean_invalidated';
  }

  const patch = {
    h1_outcome:  horizonOutcome(snaps.h1,  confirmPct, partialPct),
    h4_outcome:  horizonOutcome(snaps.h4,  confirmPct, partialPct),
    h12_outcome: horizonOutcome(snaps.h12, confirmPct, partialPct),
    h24_outcome: horizonOutcome(snaps.h24, confirmPct, partialPct),
    checkpoints: snaps,
    checkpoints_done_at: new Date().toISOString(),
  };
  if (h24) {
    patch.max_favorable_move_pct = h24.mfe;   // 24h-geneli zirveler (direktif örneğiyle uyumlu)
    patch.max_adverse_move_pct = h24.mae;
    if (quality) patch.outcome_quality = quality;
  }

  const upd = await sbFetch(
    `/analysis_archive?id=eq.${encodeURIComponent(rec.id)}&checkpoints_done_at=is.null`,
    { method: 'PATCH', body: JSON.stringify(patch) }
  );
  if (!upd || !upd.length) return { state: 'skipped', reason: 'already_done' };
  return { state: 'processed' };
}

export async function runCheckpointBatch({ limit = 25 } = {}) {
  const summary = { engine: 'checkpoints_v3', processed: 0, skipped: 0, errors: 0, fetched: 0, skip_reasons: {} };
  if (!SB_URL || !SB_KEY) { summary.error = 'supabase_env_missing'; return summary; }
  const lim = Math.max(1, Math.min(parseInt(limit, 10) || 25, 50));
  const dueIso = new Date(Date.now() - 24 * 3600_000).toISOString();
  const cols = 'id,sym,timeframe,direction_bias,price_at_analysis,created_at,confirm_threshold_pct,invalid_threshold_pct,outcome_status,outcome_quality';
  let rows;
  try {
    rows = await sbFetch(
      `/analysis_archive?checkpoints_done_at=is.null&outcome_status=neq.pending&or=(excluded_from_learning.eq.false,sample_type.eq.research)` +
      `&created_at=lte.${encodeURIComponent(dueIso)}&order=created_at.asc&limit=${lim}&select=${cols}`,
      { method: 'GET' }
    );
  } catch (e) { summary.error = String(e && e.message).slice(0, 200); return summary; }
  const list = rows || [];
  summary.fetched = list.length;
  const CHUNK = 8;
  for (let i = 0; i < list.length; i += CHUNK) {
    const results = await Promise.all(list.slice(i, i + CHUNK).map(async (rec) => {
      try { return await resolveCheckpoints(rec); }
      catch (e) { console.error('[checkpoints] kayıt hatası', rec && rec.id, e && e.message); return { state: 'error' }; }
    }));
    for (const r of results) {
      if (r.state === 'processed') summary.processed++;
      else if (r.state === 'error') summary.errors++;
      else { summary.skipped++; summary.skip_reasons[r.reason] = (summary.skip_reasons[r.reason] || 0) + 1; }
    }
  }
  return summary;
}

// ════════════════════════════════════════════════════════════════════
// runDrain: TEK çağrıda zaman bütçesi dolana dek runBatch döngüsü.
// Vercel free 10sn timeout → 8sn güvenli bütçe. Birikmiş yığını (binlerce
// pending) hızla eritmek için. Cron VEYA manuel secret URL ile çağrılır.
// ════════════════════════════════════════════════════════════════════
export async function runDrain({ budgetMs = 8000, batchLimit = 40 } = {}) {
  const t0 = Date.now();
  const total = {
    engine: 'first_hit_v1', mode: 'drain', rounds: 0,
    processed: 0, confirmed: 0, invalidated: 0, partial: 0, expired: 0,
    skipped: 0, errors: 0, fetched: 0, elapsed_ms: 0,
  };
  while (Date.now() - t0 < budgetMs) {
    const s = await runBatch({ limit: batchLimit, dry: false });
    total.rounds++;
    total.processed += s.processed; total.confirmed += s.confirmed;
    total.invalidated += s.invalidated; total.partial += s.partial;
    total.expired += s.expired; total.skipped += s.skipped;
    total.errors += s.errors; total.fetched += s.fetched;
    if (s.error) { total.error = s.error; break; }
    if ((s.fetched || 0) === 0) break;          // pass-1 bitti
  }
  // V3: kalan bütçeyle Geçiş-2 (24h checkpoint) kuyruğunu da erit
  total.cp_processed = 0; total.cp_rounds = 0;
  while (Date.now() - t0 < budgetMs) {
    const c = await runCheckpointBatch({ limit: batchLimit });
    total.cp_rounds++;
    total.cp_processed += c.processed;
    if (c.error || (c.fetched || 0) === 0) break;
  }
  total.elapsed_ms = Date.now() - t0;
  return total;
}
