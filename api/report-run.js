// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — REPORT RUN ENDPOINT (Phase 11.5)
// GET /api/report-run?type=daily|weekly[&dry=1|0]
//
// Yetki:
//   • CRON  → Vercel Cron "Authorization: Bearer <CRON_SECRET>"  (veya ?secret=<TELEGRAM_CRON_SECRET> = cron-job.org alternatifi)
//   • ADMIN → header "x-admin-key: <ADMIN_KEY>"  (veya ?admin_key=...)
//
// dry kuralı (11.4 zorunlu önizleme):
//   • Manuel admin çağrısı → VARSAYILAN dry=1 (göndermez, önizler). Göndermek için açıkça &dry=0.
//   • Cron çağrısı         → VARSAYILAN dry=0 (gerçekten gönderir).
//   • Stub rapor (weekly)  → her hâlükârda gönderilmez.
//
// DOKUNMAZ: scanner, risk/confidence, premium, referral, telegram-analiz gönderimi, archive doğrulama.
// ════════════════════════════════════════════════════════════════════
import { runReport, SUPPORTED_TYPES } from '../engines/report/report-engine.js';

const ADMIN_KEYS  = [process.env.ADMIN_KEY_1, process.env.ADMIN_KEY_2].filter(Boolean);
const CRON_SECRET = process.env.CRON_SECRET || process.env.TELEGRAM_CRON_SECRET;

function q(req, key) {
  if (req.query && req.query[key] != null) return req.query[key];
  try { return new URL(req.url, 'http://x').searchParams.get(key); } catch (e) { return null; }
}
function header(req, key) {
  const h = req.headers || {};
  return h[key] || h[key.toLowerCase()] || null;
}
function isCron(req) {
  const auth = header(req, 'authorization') || '';
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  if (CRON_SECRET && q(req, 'secret') === CRON_SECRET) return true;
  return false;
}
function isAdmin(req) {
  const k = header(req, 'x-admin-key') || q(req, 'admin_key');
  return !!(k && ADMIN_KEYS.includes(k));
}

export default async function handler(req, res) {
  try {
    const type = String(q(req, 'type') || 'daily').toLowerCase();
    if (!SUPPORTED_TYPES.includes(type)) {
      return res.status(400).json({ ok: false, error: 'unknown_type', supported: SUPPORTED_TYPES });
    }

    const cron = isCron(req);
    const admin = isAdmin(req);
    if (!cron && !admin) return res.status(401).json({ ok: false, error: 'unauthorized' });

    // dry çözümü
    const dryParam = q(req, 'dry');
    let dry;
    if (dryParam != null) dry = !(dryParam === '0' || dryParam === 'false');
    else dry = cron ? false : true;   // cron → gönder; manuel admin → önizle (zorunlu)

    const out = await runReport(type, { dry });
    return res.status(200).json({ ok: true, caller: cron ? 'cron' : 'admin', ...out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
