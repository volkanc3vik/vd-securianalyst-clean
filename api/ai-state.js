// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — AI Engine State Save API (build 159)
// AMAÇ: ai_engine_state (global AI öğrenme hafızası) YAZMA işlemini
//   SUNUCUYA taşır. Anon yazma kapatılınca yalnızca admin (x-admin-key)
//   bu endpoint üzerinden service-role ile yazabilir.
// Guard: x-admin-key (ADMIN_KEY_1 / ADMIN_KEY_2) — admin-codes.js ile aynı model.
// OKUMA DEĞİŞMEZ: client hâlâ anon SELECT ile okur (ai_engine_state_sel policy kalır).
// ═══════════════════════════════════════════════════════════════════

const crypto = require('crypto');

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-elite-code');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

// ── Rate limit (sliding window, in-memory) ──────────────────────────
const _rateStore = new Map();
const LIMIT = { max: 30, windowMs: 60_000 }; // dakikada 30 yazma (8sn'lik sync için bol)

function rateLimit(ip, keyHash) {
  const bucket = `save|${ip}|${keyHash}`;
  const now = Date.now();
  const arr = (_rateStore.get(bucket) || []).filter(t => now - t < LIMIT.windowMs);
  if (arr.length >= LIMIT.max) return { ok: false, retryInMs: LIMIT.windowMs - (now - arr[0]) };
  arr.push(now);
  _rateStore.set(bucket, arr);
  return { ok: true };
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// ── Supabase (PostgREST direkt, service-role) ───────────────────────
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// ── ELITE erişimi (9. iş): access_codes tablosundan SUNUCU doğrulaması ──
// Kod düz gelir, sha256 hash'i tabloyla eşleştirilir (tablo düz kod TUTMAZ).
// Pozitif sonuç 5 dk, negatif 60 sn cache'lenir. Brute-force: IP başına
// 5 dakikada en çok 10 doğrulama denemesi.
const _eliteCache = new Map();   // hash → { ok, until }
const ELITE_POS_TTL = 5 * 60_000, ELITE_NEG_TTL = 60_000;
const ELITE_CODE_RE = /^[A-Za-z0-9-]{8,64}$/;

function _slidingHit(bucket, max, windowMs) {
  const now = Date.now();
  const arr = (_rateStore.get(bucket) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) return false;
  arr.push(now);
  _rateStore.set(bucket, arr);
  return true;
}

async function verifyEliteCode(code, ip) {
  if (typeof code !== 'string' || !ELITE_CODE_RE.test(code)) return { ok: false, why: 'format' };
  const hash = sha256(code);
  const c = _eliteCache.get(hash);
  if (c && Date.now() < c.until) return { ok: c.ok, hash };
  // Brute-force koruması: cache ISKALARI sayılır (geçerli kullanıcı cache'ten döner)
  if (!_slidingHit(`evrf|${ip}`, 10, 5 * 60_000)) return { ok: false, why: 'verify_rate' };
  let ok = false;
  try {
    const rows = await sbFetch(
      `/access_codes?code_hash=eq.${hash}&select=plan_id,status,expires_at,is_admin&limit=1`,
      { method: 'GET' }
    );
    const r = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (r) {
      const active = r.status === 'active';
      const notExpired = !r.expires_at || new Date(r.expires_at).getTime() > Date.now();
      const eliteTier = String(r.plan_id || '').toLowerCase().startsWith('elite') || r.is_admin === true;
      ok = active && notExpired && eliteTier;
    }
  } catch (e) { ok = false; }
  _eliteCache.set(hash, { ok, until: Date.now() + (ok ? ELITE_POS_TTL : ELITE_NEG_TTL) });
  return { ok, hash };
}

// ── HANDLER ─────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  // Guard 1: ENV
  const adminKey1 = process.env.ADMIN_KEY_1;
  const adminKey2 = process.env.ADMIN_KEY_2;
  const validKeys = [adminKey1, adminKey2].filter(k => typeof k === 'string' && k.length > 0);
  if (validKeys.length === 0) return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'supabase_env_missing' });

  // Body (guard'lardan ÖNCE — action'a göre elite yolu açılır)
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Guard 2: kimlik — admin (x-admin-key) VEYA elite (x-elite-code, yalnız sınırlı action'lar)
  const providedKey = req.headers['x-admin-key'];
  const isAdmin = typeof providedKey === 'string' && providedKey.length > 0 && validKeys.includes(providedKey);
  const ip = getClientIp(req);
  let keyHash;

  if (isAdmin) {
    keyHash = sha256(providedKey).slice(0, 12);
    // Guard 3 (admin): mevcut rate limit AYNEN
    const rl = rateLimit(ip, keyHash);
    if (!rl.ok) return res.status(429).json({ ok: false, error: 'rate_limited', retry_in_ms: rl.retryInMs });
  } else {
    // ── ELITE YOLU (9. iş): yalnız ai_chat + elite_verify; gerisi 403 ──
    const ELITE_ACTIONS = ['ai_chat', 'elite_verify'];
    if (!ELITE_ACTIONS.includes(body.action)) {
      return res.status(403).json({ ok: false, error: 'unauthorized' });
    }
    const v = await verifyEliteCode(req.headers['x-elite-code'], ip);
    if (v.why === 'verify_rate') return res.status(429).json({ ok: false, error: 'verify_rate_limited' });
    if (!v.ok) return res.status(403).json({ ok: false, error: 'unauthorized' });   // jenerik — kod sızdırmaz
    keyHash = 'el_' + v.hash.slice(0, 12);
    // Elite rate limitleri: 6/dk + 80/gün (kod başına)
    if (!_slidingHit(`echat_m|${keyHash}`, 6, 60_000))
      return res.status(429).json({ ok: false, error: 'chat_rate_limited' });
    if (!_slidingHit(`echat_d|${keyHash}`, 80, 24 * 3600_000))
      return res.status(429).json({ ok: false, error: 'daily_limit' });
    if (body.action === 'elite_verify') {
      return res.status(200).json({ ok: true, tier: 'elite' });
    }
  }

  // elite_verify (admin de çağırabilir — UI tek akış kullansın)
  if (body.action === 'elite_verify') {
    return res.status(200).json({ ok: true, tier: 'admin' });
  }

  // ════════════════════════════════════════════════════════════════
  // AI CHAT DALI (4. iş — AI Terminal): action:'ai_chat'
  // Anthropic key SUNUCUDA kalır (ANTHROPIC_API_KEY env). Mevcut
  // state-save yoluna dokunmaz; aynı admin-key guard'ını kullanır.
  // ════════════════════════════════════════════════════════════════
  if (body.action === 'ai_chat') {
    // Chat'e ayrı (daha sıkı) rate limit: dakikada 10
    const cBucket = `chat|${ip}|${keyHash}`;
    const cNow = Date.now();
    const cArr = (_rateStore.get(cBucket) || []).filter(t => cNow - t < 60_000);
    if (cArr.length >= 10) return res.status(429).json({ ok: false, error: 'chat_rate_limited' });
    cArr.push(cNow); _rateStore.set(cBucket, cArr);

    const akey = process.env.ANTHROPIC_API_KEY;
    if (!akey) return res.status(503).json({ ok: false, error: 'ai_not_configured' });

    const question = typeof body.question === 'string' ? body.question.trim().slice(0, 600) : '';
    const context  = typeof body.context  === 'string' ? body.context.trim().slice(0, 4000) : '';
    const lang     = body.lang === 'en' ? 'en' : 'tr';
    if (question.length < 3) return res.status(400).json({ ok: false, error: 'invalid_question' });

    const sys = lang === 'en'
      ? 'You are the market analysis assistant of VD SecuriAnalyst, a crypto ANALYSIS platform (not a signal service). '
        + 'Rules: NEVER give buy/sell/entry/stop/target advice, never promise profit or guarantee outcomes. '
        + 'Provide objective technical observation and education only. Answer in English, concise (max ~8 short lines), '
        + 'use the provided live market context when relevant. End with: "Not investment advice."'
      : 'VD SecuriAnalyst kripto ANALİZ platformunun piyasa analiz asistanısın (sinyal servisi değil). '
        + 'Kurallar: ASLA al/sat/giriş/stop/hedef tavsiyesi verme, kâr vaadi veya garanti sunma. '
        + 'Yalnızca nesnel teknik gözlem ve eğitim amaçlı açıklama yap. Türkçe ve öz yanıtla (en çok ~8 kısa satır), '
        + 'verilen canlı piyasa bağlamını ilgiliyse kullan. Sonunda şunu ekle: "Yatırım tavsiyesi değildir."';

    const userMsg = (context ? ('CANLI PİYASA BAĞLAMI:\n' + context + '\n\n') : '') + 'SORU: ' + question;

    try {
      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': akey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 700,
          system: sys,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      const aText = await ar.text();
      let aData; try { aData = JSON.parse(aText); } catch { aData = null; }
      if (!ar.ok) {
        return res.status(502).json({ ok: false, error: 'anthropic_' + ar.status });
      }
      const out = (aData && Array.isArray(aData.content))
        ? aData.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
        : '';
      if (!out) return res.status(502).json({ ok: false, error: 'empty_response' });
      return res.status(200).json({ ok: true, text: out });
    } catch (e) {
      return res.status(502).json({ ok: false, error: 'anthropic_unreachable' });
    }
  }

  const data = body.data;
  let v = body.v;

  // Doğrulama: data bir nesne olmalı
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ ok: false, error: 'invalid_data' });
  }
  // Boyut sınırı (kötüye kullanımı engelle) — ~3MB
  let serialized;
  try { serialized = JSON.stringify(data); } catch { return res.status(400).json({ ok: false, error: 'unserializable' }); }
  if (serialized.length > 3_000_000) return res.status(413).json({ ok: false, error: 'too_large' });

  if (typeof v !== 'number' || !Number.isFinite(v)) v = Date.now();

  // Upsert: tek 'global' satırı (PostgREST merge-duplicates, PK=id)
  try {
    const row = { id: 'global', data, v, updated_at: new Date().toISOString() };
    const out = await sbFetch('/ai_engine_state?on_conflict=id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row),
    });
    return res.status(200).json({ ok: true, v, saved: Array.isArray(out) ? out.length : 1 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'save_failed', detail: String(e.message || e).slice(0, 200) });
  }
};
