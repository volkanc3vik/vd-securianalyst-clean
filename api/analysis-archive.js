// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — Analysis Archive Admin API (Aşama 4)
// Guard: x-admin-key (ADMIN_KEY_1 / ADMIN_KEY_2) — telegram-send.js / admin-codes.js ile AYNI model
// Service role ile Supabase'e yazar (RLS bypass). Frontend doğrudan DB'ye YAZMAZ.
//
// Actions (POST { action, ... }):
//   update_review : { id, review_status, admin_note?, internal_review? }
//   mark_shared   : { id, telegram_msg_id }
//
// Telegram GÖNDERİMİ burada YOK — o, mevcut /api/telegram-send üzerinden yapılır.
// Service role key / token ASLA client'a gitmez (yalnızca env).
// ═══════════════════════════════════════════════════════════════════

import { profileFor, OUTCOME_ENGINE_VERSION } from '../engines/outcome/outcome-config.js';

// ── CORS ────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://vd-securianalyst.com',
  'https://celadon-cannoli-323246.netlify.app',
  'https://visionary-faloodeh-4eb1dc.netlify.app',
  'http://localhost:3000',
  'http://localhost:8080',
];
function setCors(req, res) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

// ── Rate limit (in-memory sliding window) ───────────────────────────
const _rateStore = new Map();
const LIMITS = {
  create:        { max: 60, windowMs: 60_000 },
  list_pending:  { max: 60, windowMs: 60_000 },
  get_one:       { max: 120, windowMs: 60_000 },
  set_outcome:   { max: 30, windowMs: 60_000 },
  update_review: { max: 30, windowMs: 60_000 },
  mark_shared:   { max: 20, windowMs: 60_000 },
};
function rateLimit(action, ip) {
  const cfg = LIMITS[action];
  if (!cfg) return { ok: true };
  const bucket = `${action}|${ip}`;
  const now = Date.now();
  const arr = (_rateStore.get(bucket) || []).filter(t => now - t < cfg.windowMs);
  if (arr.length >= cfg.max) return { ok: false, retryInMs: cfg.windowMs - (now - arr[0]) };
  arr.push(now);
  _rateStore.set(bucket, arr);
  return { ok: true };
}
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// ── Supabase (PostgREST) service-role helper ────────────────────────
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

// ── Doğrulama yardımcıları ──────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVIEW_STATUSES = ['pending', 'validated', 'partially_validated', 'not_validated'];
// direction_bias CHECK: bullish/bearish/neutral — sinyal dir (LONG/SHORT) buraya map'lenir
const DIR_MAP = { LONG: 'bullish', SHORT: 'bearish', BULLISH: 'bullish', BEARISH: 'bearish', BUY: 'bullish', SELL: 'bearish' };
// source CHECK: ai_engine/ti_setup — telegram kökeni market_context.origin'e yazılır
const VALID_SOURCES = ['ai_engine', 'ti_setup'];
// PATCH/INSERT sonrası client'a dönülecek kolonlar (admin endpoint → admin_note/internal_review dahil)
const RETURN_COLS = 'id,sym,timeframe,direction_bias,price_at_analysis,analysis_score,source,review_status,admin_note,internal_review,reviewed_at,review_due_at,review_window_hours,price_at_review,max_move_pct,min_move_pct,end_move_pct,result_percent,direction_realized,validation_score,review_source,shared_to_telegram,telegram_msg_id,shared_at,created_at';
// Pending liste kartları için (admin) — internal alanlar dahil değil, kart için yeterli
const LIST_COLS = 'id,sym,timeframe,direction_bias,price_at_analysis,analysis_score,analysis_text,review_status,review_due_at,review_window_hours,created_at,telegram_msg_id,market_context';

// ── Outcome Tracking Faz 1: timeframe → inceleme penceresi (saat) ──
// 15m→24s · 1h→48s · 4h→72s · 1D→168s (7g). Bilinmeyen/auto → 48s.
function reviewWindowHours(tf) {
  const t = String(tf || '').toLowerCase().trim();
  if (/^(1m|3m|5m|15m|30m|45m)$/.test(t)) return 24;
  if (/^(1h|2h)$/.test(t))               return 48;
  if (/^(4h|6h|8h|12h)$/.test(t))        return 72;
  if (/^(1d|2d|3d|1w|1week|daily)$/.test(t)) return 168;
  return 48; // auto / bilinmeyen → güvenli orta
}

// ── Outcome Tracking Faz 2: pencereye göre kline interval ──
function klineInterval(winHours) {
  const h = Number(winHours) || 48;
  if (h <= 24) return '15m';
  if (h <= 72) return '1h';
  return '2h';
}

function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// ── Saf hesap motoru (test edilebilir) ──
// bias: bullish|bearish|neutral · entry · high · low · lastClose
function computeOutcome({ bias, entry, high, low, lastClose }) {
  const e = Number(entry);
  const pctHigh = (high - e) / e * 100;   // tepe (>=0 genelde)
  const pctLow  = (low - e) / e * 100;    // dip (<=0 genelde)
  const pctEnd  = (lastClose - e) / e * 100;

  let favMax, favMin, favEnd;
  if (bias === 'bearish') {
    favMax = -pctLow;   // aşağı hareket = favorable (pozitif)
    favMin = -pctHigh;  // yukarı hareket = adverse (negatif)
    favEnd = -pctEnd;
  } else { // bullish & neutral → ham yön
    favMax = pctHigh;
    favMin = pctLow;
    favEnd = pctEnd;
  }

  // Gerçekleşen yön: fiyatın GERÇEK hareketi (bias'tan bağımsız)
  let direction_realized = 'neutral';
  if (pctEnd >= 0.5) direction_realized = 'bullish';
  else if (pctEnd <= -0.5) direction_realized = 'bearish';

  // Validation score — MAX favorable hareket bazlı (işlem o noktayı GÖRÜR).
  // Volkan kararı: pencere sonu değil, pencere İÇİNDEKİ maksimum favorable hareket esas alınır.
  let score;
  if (bias === 'neutral') {
    const a = Math.abs(pctEnd);
    score = a < 1 ? 60 : a < 3 ? 50 : 42;
  } else {
    if (favMax >= 2)        score = 75 + clamp((favMax - 2) * 2.5, 0, 20);   // %2+ → validated (75..95)
    else if (favMax >= 1)   score = 58 + (favMax - 1) * 17;                  // %1-2 → 58..75
    else if (favMax >= 0.4) score = 45 + (favMax - 0.4) / 0.6 * 13;          // %0.4-1 → 45..58
    else                    score = clamp(20 + favMax * 60, 5, 45);          // zayıf/ters
  }
  score = clamp(Math.round(score), 0, 95);

  const review_status = score >= 75 ? 'validated' : score >= 50 ? 'partially_validated' : 'not_validated';

  // Phase 3: doğal dil değerlendirme metinleri (düzenlenebilir öneri)
  const biasWord = bias === 'bullish' ? 'yukarı' : bias === 'bearish' ? 'aşağı' : 'yatay';
  const dirAdj   = bias === 'bullish' ? 'bullish' : bias === 'bearish' ? 'bearish' : 'nötr';
  let adminNote, internalNote;
  if (bias === 'neutral') {
    adminNote = `Analiz nötr beklentiyle açıldı. Fiyat, inceleme penceresinde sınırlı hareket etti (pencere sonu ${r2(favEnd)}%, maksimum ${r2(favMax)}%). ${review_status === 'validated' ? 'Yatay beklenti büyük ölçüde doğrulandı.' : 'Beklenti kısmen karşılandı.'}`;
    internalNote = `Nötr kurulum; yön netliği ve volatilite düşük. Benzer durumlarda işlem önceliği azaltılabilir.`;
  } else if (review_status === 'validated') {
    adminNote = `Analiz yönü piyasa hareketiyle uyumlu gerçekleşti. Fiyat, inceleme penceresi içinde ${biasWord} yönde maksimum ${r2(favMax)}% ilerledi (pencere sonu ${r2(favEnd)}%) ve ${dirAdj} beklenti doğrulandı.`;
    internalNote = `Hareket beklenen yönde güçlü bir maksimum (%${r2(favMax)}) üretti. Benzer setup'larda confidence korunabilir.`;
  } else if (review_status === 'partially_validated') {
    adminNote = `Analiz yönü kısmen doğrulandı. Fiyat ${biasWord} yönde maksimum ${r2(favMax)}% ilerledi (pencere sonu ${r2(favEnd)}%) ancak hareketin gücü sınırlı kaldı.`;
    internalNote = `Yön doğru, maksimum hareket (%${r2(favMax)}) orta seviyede. Benzer setup'larda giriş zamanlaması/teyit gözden geçirilebilir.`;
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
    suggestion: {
      review_status,
      adminNote,
      internalNote,
      summary: `Pencere sonu ${r2(favEnd)}% · maksimum ${r2(favMax)}% · gerçekleşen yön ${direction_realized} · skor ${score}/100 · öneri ${review_status}.`,
    },
  };
}

function clampText(v, max) {
  if (v == null) return null;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

// ── Handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  // Guard 1: env
  const adminKey1 = process.env.ADMIN_KEY_1;
  const adminKey2 = process.env.ADMIN_KEY_2;
  const validKeys = [adminKey1, adminKey2].filter(Boolean);
  if (!validKeys.length) return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'supabase_env_missing' });

  // Guard 2: x-admin-key (anon ASLA buraya yazamaz)
  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || !validKeys.includes(providedKey)) {
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const action = body.action;
  if (!action || !LIMITS[action]) return res.status(400).json({ ok: false, error: 'invalid_action' });

  const rl = rateLimit(action, getClientIp(req));
  if (!rl.ok) { res.setHeader('Retry-After', String(Math.ceil((rl.retryInMs || 30000) / 1000))); return res.status(429).json({ ok: false, error: 'rate_limited' }); }

  try {
    // ── CREATE: Telegram sinyali başarıyla gönderildikten sonra otomatik kayıt ──
    // id YOK (DB üretir). İlk durum review_status='pending' (takip aşaması).
    if (action === 'create') {
      const sym = body.sym ? String(body.sym).toUpperCase().slice(0, 24) : null;
      if (!sym) return res.status(400).json({ ok: false, error: 'invalid_sym' });
      const dirRaw = String(body.direction || body.dir || '').toUpperCase();
      const direction_bias = DIR_MAP[dirRaw] || 'neutral';
      const timeframe = (body.timeframe ? String(body.timeframe).slice(0, 16) : '') || 'auto';
      const price = Number(body.price_at_analysis);
      if (isNaN(price)) return res.status(400).json({ ok: false, error: 'invalid_price' }); // price_at_analysis NOT NULL
      const source = VALID_SOURCES.includes(body.source) ? body.source : 'ai_engine';
      const msgId = (body.telegram_msg_id != null && !isNaN(Number(body.telegram_msg_id))) ? Number(body.telegram_msg_id) : null;

      // Idempotency: aynı telegram_msg_id ile kayıt varsa tekrar oluşturma
      if (msgId != null) {
        try {
          const existing = await sbFetch(`/analysis_archive?telegram_msg_id=eq.${msgId}&select=${RETURN_COLS}`, { method: 'GET' });
          if (existing && existing.length) return res.status(200).json({ ok: true, row: existing[0], deduped: true });
        } catch (e) { /* devam */ }
      }

      const mc = (body.market_context && typeof body.market_context === 'object') ? body.market_context : {};
      // Outcome Tracking Faz 1: inceleme penceresi + due zamanı (hesaplama YOK, sadece zamanlama)
      const _prof = profileFor(timeframe);
      const winHours = _prof.window;
      const dueIso = new Date(Date.now() + winHours * 3600 * 1000).toISOString();
      const row = {
        sym, timeframe, direction_bias,
        price_at_analysis: price,
        analysis_score: (body.analysis_score != null && !isNaN(Number(body.analysis_score))) ? Number(body.analysis_score) : null,
        analysis_text: clampText(body.analysis_text, 4000),
        ai_learned: clampText(body.ai_learned, 4000),
        market_context: mc,
        source,
        review_status: 'pending',
        review_window_hours: winHours,
        review_due_at: dueIso,
        // ── Build 163B: first-hit outcome damgası (yeni kayıtlar) ──
        outcome_engine_version: OUTCOME_ENGINE_VERSION,
        outcome_status: 'pending',
        confirm_threshold_pct: _prof.confirm,
        invalid_threshold_pct: _prof.invalid,
        telegram_msg_id: msgId,
      };
      const rows = await sbFetch(`/analysis_archive?select=${RETURN_COLS}`, {
        method: 'POST',
        body: JSON.stringify(row),
      });
      if (!rows || !rows.length) return res.status(502).json({ ok: false, error: 'db_error' });
      return res.status(200).json({ ok: true, row: rows[0], created: true });
    }

    // ── LIST_PENDING: admin'e özel bekleyen kayıt listesi (service-role, RLS bypass) ──
    // Anon ASLA buraya erişemez (x-admin-key guard). RLS/public feed DEĞİŞMEZ.
    if (action === 'list_pending') {
      const limit = Math.min(Math.max(parseInt(body.limit, 10) || 30, 1), 100);
      // newest=true → en yeni açılan önce (setup-tracker paneli). Aksi halde mevcut davranış (due en yakın önce).
      const order = body.newest
        ? 'created_at.desc'
        : 'review_due_at.asc.nullslast,created_at.desc';
      const rows = await sbFetch(
        `/analysis_archive?review_status=eq.pending&admin_archived=eq.false&order=${order}&limit=${limit}&select=${LIST_COLS}`,
        { method: 'GET' }
      );
      return res.status(200).json({ ok: true, rows: rows || [], count: (rows || []).length });
    }

    // ── id gerektiren işlemler ──
    const id = body.id;
    if (!id || !UUID_RE.test(String(id))) return res.status(400).json({ ok: false, error: 'invalid_id' });
    const idFilter = `?id=eq.${encodeURIComponent(id)}`;

    // ── SET_OUTCOME: Binance kline → outcome hesabı (review_status'a DOKUNMAZ) ──
    // Yalnız Outcome Ready & pending. Otomatik review/Telegram YOK; öneri döner.
    if (action === 'set_outcome') {
      const rows = await sbFetch(`/analysis_archive${idFilter}&select=*&limit=1`, { method: 'GET' });
      if (!rows || !rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      const rec = rows[0];
      if (rec.review_status !== 'pending') return res.status(409).json({ ok: false, error: 'not_pending' });
      const due = rec.review_due_at ? Date.parse(rec.review_due_at) : null;
      if (!due || due > Date.now()) return res.status(409).json({ ok: false, error: 'not_ready' });
      const startMs = Date.parse(rec.created_at);
      const endMs = due;
      const entry = Number(rec.price_at_analysis);
      if (!entry || isNaN(entry)) return res.status(422).json({ ok: false, error: 'no_entry_price' });
      const interval = klineInterval(rec.review_window_hours || (endMs - startMs) / 3_600_000);
      const symbol = String(rec.sym || '').toUpperCase();
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=1500`;
      let kr, kl;
      try {
        kr = await fetch(url, { headers: { 'Accept': 'application/json' } });
      } catch (e) { return res.status(502).json({ ok: false, error: 'price_fetch_failed' }); }
      // Coğrafi blok (ör. Vercel iad1/US → Binance fapi 451 "restricted location")
      if (kr.status === 451) return res.status(451).json({ ok: false, error: 'geo_blocked' });
      if (!kr.ok) return res.status(502).json({ ok: false, error: 'price_fetch_failed', http: kr.status });
      try { kl = await kr.json(); } catch (e) { return res.status(502).json({ ok: false, error: 'bad_price_data' }); }
      if (!Array.isArray(kl)) {
        const msg = (kl && kl.msg) ? String(kl.msg).toLowerCase() : '';
        if (msg.includes('restricted') || msg.includes('eligibility')) return res.status(451).json({ ok: false, error: 'geo_blocked' });
        return res.status(502).json({ ok: false, error: 'no_price_data' });
      }
      if (!kl.length) return res.status(502).json({ ok: false, error: 'no_price_data' });
      const highs = kl.map(k => +k[2]).filter(n => !isNaN(n));
      const lows  = kl.map(k => +k[3]).filter(n => !isNaN(n));
      const lastClose = +kl[kl.length - 1][4];
      if (!highs.length || !lows.length || isNaN(lastClose)) return res.status(502).json({ ok: false, error: 'bad_price_data' });
      const high = Math.max(...highs), low = Math.min(...lows);

      const out = computeOutcome({ bias: rec.direction_bias, entry, high, low, lastClose });
      // Outcome kolonlarını yaz — review_status DEĞİŞMEZ (admin onayı şart)
      const patch = {
        price_at_review: out.price_at_review,
        max_move_pct: out.max_move_pct,
        min_move_pct: out.min_move_pct,
        end_move_pct: out.end_move_pct,
        result_percent: out.result_percent,
        direction_realized: out.direction_realized,
        validation_score: out.validation_score,
        review_source: 'auto',
      };
      const upd = await sbFetch(`/analysis_archive${idFilter}&select=*`, { method: 'PATCH', body: JSON.stringify(patch) });
      if (!upd || !upd.length) return res.status(502).json({ ok: false, error: 'db_error' });
      return res.status(200).json({ ok: true, row: upd[0], suggestion: out.suggestion, computed: out, meta: { interval, candles: kl.length, high, low, lastClose } });
    }

    // ── GET_ONE: admin tek kayıt (pending dahil) — modal fallback için ──
    if (action === 'get_one') {
      const rows = await sbFetch(`/analysis_archive${idFilter}&select=*&limit=1`, { method: 'GET' });
      if (!rows || !rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      return res.status(200).json({ ok: true, row: rows[0] });
    }

    if (action === 'update_review') {
      const patch = {};
      if (body.review_status != null) {
        if (!REVIEW_STATUSES.includes(body.review_status)) {
          return res.status(400).json({ ok: false, error: 'invalid_review_status' });
        }
        patch.review_status = body.review_status;
      }
      if (body.admin_note != null)      patch.admin_note      = clampText(body.admin_note, 4000);
      if (body.internal_review != null) patch.internal_review = clampText(body.internal_review, 4000);
      if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: 'nothing_to_update' });

      // reviewed_at: İLK review (reviewed_at boş) VEYA review_status DEĞİŞTİ → şimdi.
      // created_at ASLA reviewed_at yerine kullanılmaz; yalnızca buradan set edilir.
      let current = null;
      try {
        const cur = await sbFetch(`/analysis_archive${idFilter}&select=review_status,reviewed_at`, { method: 'GET' });
        current = cur && cur[0] ? cur[0] : null;
      } catch (e) { current = null; }
      if (!current) return res.status(404).json({ ok: false, error: 'not_found' });
      const statusChanged = patch.review_status != null && patch.review_status !== current.review_status;
      if (!current.reviewed_at || statusChanged) {
        patch.reviewed_at = new Date().toISOString();
      }

      const rows = await sbFetch(`/analysis_archive${idFilter}&select=${RETURN_COLS}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (!rows || !rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      return res.status(200).json({ ok: true, row: rows[0] });
    }

    if (action === 'mark_shared') {
      const msgId = body.telegram_msg_id;
      if (msgId == null || isNaN(Number(msgId))) return res.status(400).json({ ok: false, error: 'invalid_msg_id' });
      const patch = {
        shared_to_telegram: true,
        telegram_msg_id: Number(msgId),
        shared_at: new Date().toISOString(),
      };
      const rows = await sbFetch(`/analysis_archive${idFilter}&select=${RETURN_COLS}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (!rows || !rows.length) return res.status(404).json({ ok: false, error: 'not_found' });
      return res.status(200).json({ ok: true, row: rows[0] });
    }

    return res.status(400).json({ ok: false, error: 'invalid_action' });
  } catch (err) {
    // Hata mesajı service-role detay sızdırmaz
    console.error('[ARCHIVE_ADMIN_ERROR]', String(err && err.message || err).slice(0, 200));
    return res.status(502).json({ ok: false, error: 'db_error' });
  }
}
