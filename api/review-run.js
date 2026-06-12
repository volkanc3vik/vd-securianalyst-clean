// ═══════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — AUTO OUTCOME REVIEW ENDPOINT (Build 163B — First-Hit)
//
// /api/review-run — first-hit outcome motorunu tetikler.
//   Çekirdek mantık engines/outcome/outcome-runner.js içinde (paylaşımlı;
//   report-run da aynı runner'ı kullanır → tek doğruluk kaynağı).
//
//  • Sadece outcome_status='pending' & excluded_from_learning=false & due
//    kayıtları işlenir. Legacy / eski-motor kayıtlarına DOKUNMAZ.
//  • Guard: ?secret=REVIEW_CRON_SECRET (fallback TELEGRAM_CRON_SECRET)
//           veya x-admin-key (ADMIN_KEY_1/2) — manuel test için.
//  • ?dry=1 → hesaplar, YAZMAZ.   ?limit=N → max kayıt (varsayılan 25, tavan 50).
// ═══════════════════════════════════════════════════════════════════

import { runBatch, runDrain, runCheckpointBatch } from '../engines/outcome/outcome-runner.js';

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // ── Guard ──
  const q = req.query || {};
  const provided = (q.secret || '').toString();
  const cronSecret = process.env.REVIEW_CRON_SECRET || process.env.TELEGRAM_CRON_SECRET || '';
  const adminKeys = [process.env.ADMIN_KEY_1, process.env.ADMIN_KEY_2].filter(Boolean);
  const adminHdr = (req.headers['x-admin-key'] || '').toString();
  const okCron = cronSecret && provided && provided === cronSecret;
  const okAdmin = adminKeys.length > 0 && adminHdr && adminKeys.includes(adminHdr);
  if (!okCron && !okAdmin) return res.status(403).json({ ok: false, error: 'unauthorized' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'supabase_env_missing' });

  const dry = q.dry === '1' || q.dry === 'true';
  const drain = q.drain === '1' || q.drain === 'true';
  const limit = Math.max(1, Math.min(parseInt(q.limit || '25', 10) || 25, 50));
  const at = new Date().toISOString();

  try {
    // drain=1 → tek çağrıda zaman bütçesi (8sn) dolana dek tekrar tekrar çöz.
    // Birikmiş yığını eritmek için; sık cron yerine birkaç manuel çağrı yeter.
    let summary;
    if (drain) summary = await runDrain({ budgetMs: 8000, batchLimit: 40 });
    else {
      summary = await runBatch({ limit, dry });
      // V3: normal koşuda 24h checkpoint kuyruğundan da bir parti çöz
      if (!dry) { const cp = await runCheckpointBatch({ limit }); summary.cp_processed = cp.processed; summary.cp_fetched = cp.fetched; }
    }
    return res.status(200).json({ ok: true, ...summary, at });
  } catch (e) {
    console.error('[review-run] genel hata:', e && e.message);
    return res.status(500).json({ ok: false, error: 'server_error', detail: String(e && e.message).slice(0, 200), at });
  }
}
