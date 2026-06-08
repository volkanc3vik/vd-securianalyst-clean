// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — Online Heartbeat (ping) API (build 161)
// AMAÇ: Ziyaretçi tarayıcısı her ~45sn'de bir buraya dokunur; sunucu
//   online_sessions tablosuna (service-role) session_id + last_seen yazar.
//   ANON çağrılabilir (giriş gerektirmez) ama IP başına rate-limit'li.
//   Tablo anon'a KAPALI; sadece bu endpoint service-role ile yazar.
// GİZLİLİK: yalnızca rastgele session_id + zaman saklanır. IP/kişisel veri yok.
// ═══════════════════════════════════════════════════════════════════

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

// ── Rate limit (IP başına, sliding window, in-memory) ───────────────
const _rateStore = new Map();
const LIMIT = { max: 40, windowMs: 60_000 }; // 45sn ping için bol

function rateLimit(ip) {
  const now = Date.now();
  const arr = (_rateStore.get(ip) || []).filter(t => now - t < LIMIT.windowMs);
  if (arr.length >= LIMIT.max) return false;
  arr.push(now);
  _rateStore.set(ip, arr);
  return true;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

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
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'supabase_env_missing' });

  const ip = getClientIp(req);
  if (!rateLimit(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const sid = body.sid;
  if (typeof sid !== 'string' || sid.length < 8 || sid.length > 64 || !/^[A-Za-z0-9_-]+$/.test(sid)) {
    return res.status(400).json({ ok: false, error: 'invalid_sid' });
  }

  try {
    const row = { session_id: sid, last_seen: new Date().toISOString() };
    await sbFetch('/online_sessions?on_conflict=session_id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'ping_failed' });
  }
};
