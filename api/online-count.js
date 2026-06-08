// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — Online Count API (build 161)
// AMAÇ: Son ~90 sn içinde 'ping' atmış oturum sayısını döner (= online).
//   Guard: x-admin-key (ADMIN_KEY_1/2). Sadece admin panelinde gösterilir.
//   Ek bakım: ara sıra eski (1 günden eski) satırları siler (tablo şişmesin).
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

// ── Rate limit ──────────────────────────────────────────────────────
const _rateStore = new Map();
const LIMIT = { max: 120, windowMs: 60_000 }; // panel 20sn'de bir sorar → bol

function rateLimit(ip, keyHash) {
  const bucket = `count|${ip}|${keyHash}`;
  const now = Date.now();
  const arr = (_rateStore.get(bucket) || []).filter(t => now - t < LIMIT.windowMs);
  if (arr.length >= LIMIT.max) return false;
  arr.push(now);
  _rateStore.set(bucket, arr);
  return true;
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
const ONLINE_WINDOW_S = 90;

async function sbFetch(path, options = {}) {
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

// Content-Range header'dan toplam sayıyı okur (satırları indirmeden)
async function countOnline(sinceIso) {
  const url = `${SB_URL.replace(/\/$/, '')}/rest/v1/online_sessions?select=session_id&last_seen=gte.${encodeURIComponent(sinceIso)}`;
  const r = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Prefer': 'count=exact',
      'Range-Unit': 'items',
      'Range': '0-0',
    },
  });
  if (!r.ok) throw new Error(`supabase_${r.status}`);
  const cr = r.headers.get('content-range') || '';      // örn: "0-0/5"
  const total = parseInt((cr.split('/')[1] || '0'), 10);
  return Number.isFinite(total) ? total : 0;
}

async function cleanupOld() {
  const oldIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  try {
    await sbFetch(`/online_sessions?last_seen=lt.${encodeURIComponent(oldIso)}`, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });
  } catch (e) { /* bakım hatası yutulur */ }
}

// ── HANDLER ─────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const adminKey1 = process.env.ADMIN_KEY_1;
  const adminKey2 = process.env.ADMIN_KEY_2;
  const validKeys = [adminKey1, adminKey2].filter(k => typeof k === 'string' && k.length > 0);
  if (validKeys.length === 0) return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'supabase_env_missing' });

  const providedKey = req.headers['x-admin-key'];
  if (typeof providedKey !== 'string' || providedKey.length === 0 || !validKeys.includes(providedKey)) {
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }

  const ip = getClientIp(req);
  const keyHash = sha256(providedKey).slice(0, 12);
  if (!rateLimit(ip, keyHash)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  try {
    const sinceIso = new Date(Date.now() - ONLINE_WINDOW_S * 1000).toISOString();
    const count = await countOnline(sinceIso);
    if (Math.random() < 0.1) await cleanupOld(); // ara sıra bakım
    return res.status(200).json({ ok: true, count, window_s: ONLINE_WINDOW_S });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'count_failed', detail: String(e.message || e).slice(0, 200) });
  }
};
