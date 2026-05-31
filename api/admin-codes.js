// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — Admin Code Management API
// Guard: x-admin-key (ADMIN_KEY_1 / ADMIN_KEY_2)  — telegram-send.js ile aynı model
// Service role ile Supabase'e bağlanır (RLS bypass).
// Rate limit: in-memory sliding window (per IP+key+action)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

// ── Rate limit (sliding window, in-memory) ──────────────────────────
const _rateStore = new Map(); // key → array of timestamps
const LIMITS = {
  list:          { max: 60, windowMs: 60_000 },
  create:        { max: 5,  windowMs: 60_000 },
  revoke:        { max: 10, windowMs: 60_000 },
  reset_devices: { max: 10, windowMs: 60_000 },
  extend:        { max: 10, windowMs: 60_000 },
};

function rateLimit(action, ip, keyHash) {
  const cfg = LIMITS[action];
  if (!cfg) return { ok: true };
  const bucket = `${action}|${ip}|${keyHash}`;
  const now = Date.now();
  const arr = (_rateStore.get(bucket) || []).filter(t => now - t < cfg.windowMs);
  if (arr.length >= cfg.max) {
    return { ok: false, retryInMs: cfg.windowMs - (now - arr[0]) };
  }
  arr.push(now);
  _rateStore.set(bucket, arr);
  return { ok: true };
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// ── Supabase fetch helper (PostgREST direkt, ekstra paket gerekmesin) ──
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

// ── Kod üretimi ─────────────────────────────────────────────────────
const PLANS = {
  daily:   { name: 'Daily Access',   days: 1,  price: 20,  prefix: 'DAY'   },
  weekly:  { name: 'Weekly Access',  days: 7,  price: 100, prefix: 'WEEK'  },
  monthly: { name: 'Monthly Access', days: 30, price: 300, prefix: 'MONTH' },
};

function genCodeChunk() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ambigu karakter yok (I,O,0,1)
  const bytes = crypto.randomBytes(4);
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function generateCode(planId) {
  const plan = PLANS[planId];
  return `VD-${plan.prefix}-${genCodeChunk()}-${genCodeChunk()}`;
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function makePreview(code) {
  // VD-WEEK-XXXX-YYYY → VD-WEEK-****-YYYY
  const parts = code.split('-');
  if (parts.length !== 4) return code;
  return `${parts[0]}-${parts[1]}-****-${parts[3]}`;
}

// ── HANDLER ─────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Guard 1: ENV
  const adminKey1 = process.env.ADMIN_KEY_1;
  const adminKey2 = process.env.ADMIN_KEY_2;
  const validKeys = [adminKey1, adminKey2].filter(k => typeof k === 'string' && k.length > 0);
  if (validKeys.length === 0) {
    return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  }
  if (!SB_URL || !SB_KEY) {
    return res.status(500).json({ ok: false, error: 'supabase_env_missing' });
  }

  // Guard 2: x-admin-key
  const providedKey = req.headers['x-admin-key'];
  if (typeof providedKey !== 'string' || providedKey.length === 0 || !validKeys.includes(providedKey)) {
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }

  // Action parse — GET ?action=list veya POST body
  let action, params = {};
  if (req.method === 'GET') {
    action = req.query?.action;
    params = req.query || {};
  } else if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};
    action = body.action;
    params = body;
  } else {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!action || !LIMITS[action]) {
    return res.status(400).json({ ok: false, error: 'invalid_action' });
  }

  // Guard 3: rate limit
  const ip = getClientIp(req);
  const keyHash = sha256(providedKey).slice(0, 12);
  const rl = rateLimit(action, ip, keyHash);
  if (!rl.ok) {
    return res.status(429).json({ ok: false, error: 'rate_limited', retry_in_ms: rl.retryInMs });
  }

  try {
    // ──────────────────────────────────────────────────────────────
    // LIST — sadece güvenli alanlar; code_hash ASLA dönmez
    // ──────────────────────────────────────────────────────────────
    if (action === 'list') {
      const status = (params.status || '').toString();
      const planId = (params.plan_id || '').toString();
      const source = (params.source || '').toString();
      const limit  = Math.min(parseInt(params.limit || '200', 10) || 200, 500);

      const safeCols = [
        'id','code_preview','plan_id','plan_name','duration_days','price_usd',
        'status','source','created_at','activated_at','expires_at','last_used_at',
        'used_by','assigned_to','max_devices','active_devices','notes',
        'created_by','revoked_at','revoked_reason','is_admin'
      ].join(',');

      let q = `/access_codes?select=${safeCols}&order=created_at.desc&limit=${limit}`;
      if (status) q += `&status=eq.${encodeURIComponent(status)}`;
      if (planId) q += `&plan_id=eq.${encodeURIComponent(planId)}`;
      if (source) q += `&source=eq.${encodeURIComponent(source)}`;

      const rows = await sbFetch(q, { method: 'GET' });

      // Otomatik expired işaretle (read sırasında lazy)
      const now = Date.now();
      const expiredIds = (rows || []).filter(r =>
        r.status === 'active' && r.expires_at && new Date(r.expires_at).getTime() < now
      ).map(r => r.id);
      if (expiredIds.length > 0) {
        await sbFetch(`/access_codes?id=in.(${expiredIds.join(',')})`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'expired' }),
        }).catch(() => {});
        rows.forEach(r => { if (expiredIds.includes(r.id)) r.status = 'expired'; });
      }

      return res.status(200).json({ ok: true, rows: rows || [], count: (rows || []).length });
    }

    // ──────────────────────────────────────────────────────────────
    // CREATE — tam kodlar sadece bu cevapta 1 kez döner
    // ──────────────────────────────────────────────────────────────
    if (action === 'create') {
      const planId = String(params.plan_id || '').toLowerCase();
      if (!PLANS[planId]) return res.status(400).json({ ok: false, error: 'invalid_plan' });
      const count = Math.max(1, Math.min(parseInt(params.count || '1', 10) || 1, 50));
      const source = ['manual', 'sale'].includes(params.source) ? params.source : 'manual';
      const assigned_to = (params.assigned_to || '').toString().slice(0, 200) || null;
      const notes = (params.notes || '').toString().slice(0, 500) || null;
      const created_by = keyHash; // hangi admin key oluşturdu (sadece hash kısmı)

      const plan = PLANS[planId];
      const rows = [];
      const plain = []; // sadece response'ta döner
      for (let i = 0; i < count; i++) {
        const code = generateCode(planId);
        rows.push({
          code_hash: sha256(code),
          code_preview: makePreview(code),
          plan_id: planId,
          plan_name: plan.name,
          duration_days: plan.days,
          price_usd: plan.price,
          status: 'unused',
          source,
          assigned_to,
          notes,
          created_by,
          max_devices: 2,
          active_devices: 0,
          device_ids: [],
        });
        plain.push(code);
      }

      const inserted = await sbFetch('/access_codes', {
        method: 'POST',
        body: JSON.stringify(rows),
      });

      // Response: tam kodlar + id eşleştirme
      const result = (inserted || []).map((r, i) => ({
        id: r.id,
        code: plain[i],           // TAM KOD — sadece burada, 1 kez
        code_preview: r.code_preview,
        plan_id: r.plan_id,
        plan_name: r.plan_name,
      }));

      return res.status(200).json({ ok: true, created: result });
    }

    // ──────────────────────────────────────────────────────────────
    // REVOKE
    // ──────────────────────────────────────────────────────────────
    if (action === 'revoke') {
      const id = String(params.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });
      const reason = (params.reason || '').toString().slice(0, 300) || null;

      await sbFetch(`/access_codes?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: reason,
        }),
      });
      return res.status(200).json({ ok: true });
    }

    // ──────────────────────────────────────────────────────────────
    // RESET DEVICES
    // ──────────────────────────────────────────────────────────────
    if (action === 'reset_devices') {
      const id = String(params.id || '').trim();
      if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });

      await sbFetch(`/access_codes?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ device_ids: [], active_devices: 0 }),
      });
      return res.status(200).json({ ok: true });
    }

    // ──────────────────────────────────────────────────────────────
    // EXTEND (gün ekle — mevcut expires_at üzerine)
    // ──────────────────────────────────────────────────────────────
    if (action === 'extend') {
      const id = String(params.id || '').trim();
      const days = Math.max(1, Math.min(parseInt(params.days || '0', 10) || 0, 365));
      if (!id) return res.status(400).json({ ok: false, error: 'missing_id' });
      if (days < 1) return res.status(400).json({ ok: false, error: 'invalid_days' });

      // Mevcut expires_at'i al
      const cur = await sbFetch(`/access_codes?id=eq.${encodeURIComponent(id)}&select=expires_at,status`, { method: 'GET' });
      if (!cur || !cur[0]) return res.status(404).json({ ok: false, error: 'not_found' });

      const base = cur[0].expires_at ? new Date(cur[0].expires_at) : new Date();
      const newExp = new Date(base.getTime() + days * 86400000);
      // status expired ise active'e çek
      const updates = { expires_at: newExp.toISOString() };
      if (cur[0].status === 'expired') updates.status = 'active';

      await sbFetch(`/access_codes?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return res.status(200).json({ ok: true, new_expires_at: newExp.toISOString() });
    }

    return res.status(400).json({ ok: false, error: 'unhandled_action' });
  } catch (e) {
    console.error('[admin-codes] error:', e?.message || e);
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(e?.message || e).slice(0, 200) });
  }
};
