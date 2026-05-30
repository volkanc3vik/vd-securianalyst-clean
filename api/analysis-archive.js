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
// PATCH sonrası client'a dönülecek güvenli kolonlar (internal_review/admin_note dahil — admin görür)
const RETURN_COLS = 'id,sym,review_status,admin_note,internal_review,shared_to_telegram,telegram_msg_id,shared_at';

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

  const id = body.id;
  if (!id || !UUID_RE.test(String(id))) return res.status(400).json({ ok: false, error: 'invalid_id' });
  const idFilter = `?id=eq.${encodeURIComponent(id)}`;

  try {
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
