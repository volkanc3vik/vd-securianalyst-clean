// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — REPORT ENGINE (Phase 11.1)  [READ-ONLY]
// TEK motor: daily / weekly / (monthly / elite ileride) AYNI çekirdeği kullanır.
//   veri çek (analysis_archive) → metrik hesapla → metni render et → (gönder)
//
// SİNYAL DEĞİL: Entry / SL / TP / kaldıraç / al-sat YOK. Sadece retrospektif özet.
// DOKUNMAZ: scanner, risk/confidence engine, premium, referral, telegram-analiz
//   gönderimi (telegram-content-cron), archive doğrulama mantığı, archive-stats.js.
// Veri yoksa: "Veri Toplanıyor" / "Yetersiz Veri" (uydurma YOK).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_FREE_CHANNEL_ID
// ════════════════════════════════════════════════════════════════════

const SB_URL     = process.env.SUPABASE_URL;
const SB_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_FREE_CHANNEL_ID;
const TZ = 'Europe/Istanbul';

async function sb(path) {
  const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: h });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`supabase_${r.status}`);
  return Array.isArray(data) ? data : [];
}

const r1  = (n) => Math.round(Number(n) * 10) / 10;
const pct = (num, den) => den > 0 ? r1((num / den) * 100) : null;
const mcv = (r, k) => (r.market_context && r.market_context[k] != null) ? r.market_context[k] : null;

// ════════ Istanbul zaman pencereleri (UTC+3, DST yok) ════════
function istanbulYMD(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function dayWindow(now = new Date()) {
  const ymd = istanbulYMD(now);
  const start = new Date(`${ymd}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 3600e3);
  return { startISO: start.toISOString(), endISO: end.toISOString(), label: ymd };
}
function weekWindow(now = new Date()) {
  const today = dayWindow(now);
  const start = new Date(new Date(today.startISO).getTime() - 6 * 24 * 3600e3); // son 7 gün
  return { startISO: start.toISOString(), endISO: today.endISO, label: 'Son 7 gün' };
}
// 11.6 — ileri hazır (henüz kullanılmıyor)
function monthWindow(now = new Date()) {
  const today = dayWindow(now);
  const start = new Date(new Date(today.startISO).getTime() - 29 * 24 * 3600e3);
  return { startISO: start.toISOString(), endISO: today.endISO, label: 'Son 30 gün' };
}

// ════════ Kurumsal alt bilgi ════════
const FOOTER =
  '\n\n━━━━━━━━━━━━━━━━━━\n🛡️ <b>VD SECURIANALYST</b>\nAI MARKET INTELLIGENCE\n\n' +
  '🌐 vd-securianalyst.com\n📧 support@vd-securianalyst.com\n\n' +
  '⚠️ Bu içerik eğitim ve analiz amaçlıdır.\nYatırım tavsiyesi değildir.\n━━━━━━━━━━━━━━━━━━';

// ════════ Veri çek (pending DAHİL → review_status filtresi YOK) ════════
const COLS = 'sym,source,analysis_score,review_status,result_percent,tg_exp_pct,tg_exp_hi,market_context,created_at';
async function fetchRows(win) {
  const q = `analysis_archive?created_at=gte.${encodeURIComponent(win.startISO)}` +
    `&created_at=lt.${encodeURIComponent(win.endISO)}` +
    `&select=${COLS}&order=created_at.desc&limit=5000`;
  return sb(q);
}

const REVIEWED = new Set(['validated', 'partially_validated', 'not_validated']);

function baseMetrics(rows) {
  const total      = rows.length;
  const validated  = rows.filter(r => r.review_status === 'validated').length;
  const partial    = rows.filter(r => r.review_status === 'partially_validated').length;
  const notv       = rows.filter(r => r.review_status === 'not_validated').length;
  const pending    = rows.filter(r => !REVIEWED.has(r.review_status)).length;
  const reviewed   = validated + partial + notv;
  // Uyumlu / Uyumsuz — archive-stats expectation mantığıyla birebir
  const exp = rows.filter(r => r.tg_exp_pct != null && r.result_percent != null && REVIEWED.has(r.review_status));
  let uyumlu = 0, uyumsuz = 0;
  for (const r of exp) {
    const e = Number(r.tg_exp_pct), real = Number(r.result_percent);
    const sameDir = (e > 0 && real > 0) || (e < 0 && real < 0) || e === 0;
    if (!sameDir && Math.abs(real) >= 0.5) uyumsuz++; else uyumlu++;
  }
  return { total, validated, partial, notv, pending, reviewed,
    successRate: pct(validated, reviewed), uyumlu, uyumsuz, expSampled: exp.length };
}

// grup oranı — en iyi (yeterli örnekli) anahtarı bul. MIN_SAMPLE altında "Yetersiz Veri".
const MIN_SAMPLE = 20;
function topGroup(rows, keyFn) {
  const g = {};
  for (const r of rows) {
    if (!REVIEWED.has(r.review_status)) continue;
    const k = keyFn(r); if (k == null || k === '') continue;
    g[k] = g[k] || { v: 0, n: 0 };
    g[k].n++; if (r.review_status === 'validated') g[k].v++;
  }
  const arr = Object.entries(g).map(([key, c]) => ({ key, n: c.n, rate: pct(c.v, c.n) }))
    .sort((a, b) => (b.rate || 0) - (a.rate || 0));
  const best = arr.find(x => x.n >= MIN_SAMPLE);
  if (best) return { state: 'ok', key: best.key, rate: best.rate, n: best.n };
  if (arr.length) return { state: 'insufficient' };  // veri var ama < MIN_SAMPLE
  return { state: 'collecting' };                     // hiç veri yok
}
function showTop(t) {
  if (!t || t.state === 'collecting') return 'Veri Toplanıyor';
  if (t.state === 'insufficient') return 'Yetersiz Veri';
  return `${t.key} (%${t.rate}, n=${t.n})`;
}

// ════════ RENDER: DAILY (11.2) ════════
function buildDaily(rows, win) {
  const m = baseMetrics(rows);
  let body;
  if (m.total === 0) {
    body = `📅 ${win.label}\n\nBugün kayıtlı analiz bulunmuyor.\n<i>Veri Toplanıyor</i>`;
  } else {
    body =
`📅 ${win.label}

Bugün:
• Toplam analiz: <b>${m.total}</b>
• Doğrulanan: <b>${m.validated}</b>
• Bekleyen: <b>${m.pending}</b>
• Uyumlu: <b>${m.uyumlu}</b>
• Uyumsuz: <b>${m.uyumsuz}</b>

<i>Bu rapor geçmiş analizlerin retrospektif özetidir.</i>`;
  }
  return { text: `<b>VD SECURIANALYST</b>\nDAILY AI SUMMARY\n\n${body}${FOOTER}`, meta: m };
}

// ════════ RENDER: WEEKLY (11.3) — sıradaki adımda doldurulacak ════════
function buildWeekly(rows, win) {
  // Foundation hazır; tam render Daily doğrulandıktan SONRA aktif edilecek.
  return {
    text: `<b>VD SECURIANALYST</b>\nAI WEEKLY REPORT\n\n<i>Haftalık rapor bir sonraki adımda aktifleşecek.</i>${FOOTER}`,
    meta: { stub: true },
  };
}

// ════════ Tip kayıt defteri (11.1 + 11.6 hazırlık) ════════
const REPORTS = {
  daily:  { window: dayWindow,  build: buildDaily },
  weekly: { window: weekWindow, build: buildWeekly },
  // monthly: { window: monthWindow, build: buildMonthly },  // 11.6 ileride
  // elite:   { window: monthWindow, build: buildElite },     // 11.6 ileride
};
export const SUPPORTED_TYPES = Object.keys(REPORTS);

// ════════ Telegram gönderici (kendi içinde — content engine'e dokunmaz) ════════
async function sendTelegram(text) {
  if (!TG_TOKEN || !CHANNEL_ID) throw new Error('telegram_env_missing');
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHANNEL_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const d = await r.json().catch(() => null);
  if (!d || !d.ok) throw new Error('telegram_' + ((d && d.description) || r.status));
  return d.result && d.result.message_id;
}

export async function buildReport(type) {
  const def = REPORTS[type];
  if (!def) throw new Error('unknown_report_type');
  if (!SB_URL || !SB_KEY) throw new Error('env_missing');
  const win = def.window();
  const rows = await fetchRows(win);
  const { text, meta } = def.build(rows, win);
  return { type, window: { startISO: win.startISO, endISO: win.endISO, label: win.label }, text, meta };
}

// dry=true → SADECE önizleme (gönderim yok). Stub raporlar ASLA gönderilmez.
export async function runReport(type, { dry = true } = {}) {
  const built = await buildReport(type);
  const isStub = built.meta && built.meta.stub;
  if (dry || isStub) {
    return { ...built, sent: false, dry: true, ...(isStub ? { note: 'stub_not_sent' } : {}) };
  }
  const message_id = await sendTelegram(built.text);
  return { ...built, sent: true, dry: false, message_id };
}

export const _internals = { dayWindow, weekWindow, monthWindow, baseMetrics, topGroup, showTop, buildDaily };
