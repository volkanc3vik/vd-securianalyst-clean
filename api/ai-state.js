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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
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

  // Guard 2: x-admin-key
  const providedKey = req.headers['x-admin-key'];
  if (typeof providedKey !== 'string' || providedKey.length === 0 || !validKeys.includes(providedKey)) {
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }

  // Guard 3: rate limit
  const ip = getClientIp(req);
  const keyHash = sha256(providedKey).slice(0, 12);
  const rl = rateLimit(ip, keyHash);
  if (!rl.ok) return res.status(429).json({ ok: false, error: 'rate_limited', retry_in_ms: rl.retryInMs });

  // Body
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

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
