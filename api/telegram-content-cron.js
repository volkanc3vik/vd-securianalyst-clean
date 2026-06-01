// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — TELEGRAM CONTENT ENGINE (Phase 6)
// analysis_archive'dan besler: (A) AI analiz paylaşımı (B) doğrulama paylaşımı.
// SİNYAL DEĞİL: Entry/SL/TP/kaldıraç/al-sat YOK. Sadece yön/confidence/risk.
//
// Tetikleme: dış cron (cron-job.org) 6 saatte bir → ?secret=<TELEGRAM_CRON_SECRET>
//   Vercel Hobby cron günde 1 kez çalışır; 4x/gün için dış cron kullan.
//
// DOKUNMAZ: referral, premium, dashboard, scanner, archive MANTIĞI (sadece REST okuma/işaretleme).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_FREE_CHANNEL_ID, TELEGRAM_CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_FREE_CHANNEL_ID;
const CRON_SECRET= process.env.TELEGRAM_CRON_SECRET;
const SB_URL     = process.env.SUPABASE_URL;
const SB_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE = 'https://vd-securianalyst.com';
const FOOTER =
  '\n\n━━━━━━━━━━━━━━\n🛡️ <b>VD SecuriAnalyst</b> AI Market Intelligence\n' +
  '🌐 vd-securianalyst.com\n' +
  '⚠️ Bu içerik eğitim ve analiz amaçlıdır. Yatırım tavsiyesi değildir.';

async function tg(method, payload) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return r.json().catch(() => ({}));
}
const post = (text) => tg('sendMessage', { chat_id: CHANNEL_ID, text, parse_mode: 'HTML', disable_web_page_preview: true });

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const h = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
  if (prefer) h.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`supabase_${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

const biasTr = (b) => b === 'bullish' ? 'Yukarı Yönlü' : b === 'bearish' ? 'Aşağı Yönlü' : 'Yatay';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const r2  = (n) => (Math.round(Number(n) * 100) / 100);

// Binance public — güncel fiyat (key gerekmez); başarısızsa null
async function currentPrice(sym) {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`);
    const d = await r.json();
    return d && d.price ? Number(d.price) : null;
  } catch (e) { return null; }
}

// ── (A) AI ANALİZ PAYLAŞIMI — archive'dan en iyi paylaşılmamış kayıt ──
async function postAnalysis() {
  const sinceIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const rows = await sb('analysis_archive?' +
    `or=(shared_to_telegram.is.null,shared_to_telegram.eq.false)` +
    `&analysis_score=gte.80&created_at=gte.${sinceIso}` +
    `&order=analysis_score.desc,created_at.desc&limit=1` +
    `&select=id,sym,direction_bias,price_at_analysis,analysis_score,market_context`);
  const r = rows && rows[0];
  if (!r) { console.log('[TG_CONTENT] paylaşılacak yeni analiz yok'); return false; }

  const mc = r.market_context || {};
  const risk = mc.risk != null ? String(mc.risk) : null;
  const cur = await currentPrice(r.sym);
  const price = cur != null ? cur : r.price_at_analysis;

  let txt = `📊 <b>${esc(r.sym)}</b>\n\n`;
  txt += `AI Beklentisi: <b>${biasTr(r.direction_bias)}</b>\n`;
  txt += `Confidence: <b>${r.analysis_score != null ? r.analysis_score : '—'}/100</b>\n`;
  if (risk) txt += `Risk: <b>${esc(risk)}</b>\n`;
  if (price != null) txt += `Mevcut Fiyat: <b>${price}</b>\n`;
  txt += `\n🔍 Detaylı Analiz: ${SITE}/?symbol=${encodeURIComponent(r.sym)}&ref=tg\n`;
  txt += `\n📌 <b>NOT</b>\nBu analiz VD SecuriAnalyst AI Market Intelligence sistemi tarafından oluşturulmuştur. ` +
         `Analiz performansı Archive sistemi üzerinden otomatik doğrulanır ve sonuçları kamuya açık paylaşılır. ` +
         `Şeffaflık politikamız gereği başarılı ve başarısız tüm analizler arşiv verileriyle kaydedilir.`;
  txt += FOOTER;

  const res = await post(txt);
  if (res && res.ok) {
    await sb(`analysis_archive?id=eq.${r.id}`, { method: 'PATCH',
      body: { shared_to_telegram: true, telegram_msg_id: res.result.message_id, shared_at: new Date().toISOString() }, prefer: 'return=minimal' });
    console.log('[TG_CONTENT] analiz paylaşıldı:', r.sym);
    return true;
  }
  console.warn('[TG_CONTENT] analiz gönderilemedi:', res && res.description);
  return false;
}

// ── (B) DOĞRULAMA PAYLAŞIMI — admin onaylı + outcome hesaplı + henüz atılmamış ──
async function postValidations() {
  const rows = await sb('analysis_archive?' +
    `tg_validation_posted=eq.false&shared_to_telegram=eq.true&result_percent=not.is.null` +
    `&review_status=in.(validated,partially_validated,not_validated)` +
    `&order=reviewed_at.desc&limit=3` +
    `&select=id,sym,direction_bias,price_at_analysis,price_at_review,result_percent,review_status`);
  if (!rows || !rows.length) { console.log('[TG_CONTENT] yeni doğrulama yok'); return 0; }

  let n = 0;
  for (const r of rows) {
    const sonuc = r.review_status === 'validated' ? '✅ Beklenti ile uyumlu hareket etti.'
      : r.review_status === 'partially_validated' ? '⚠️ Beklenti kısmen karşılandı.'
      : '❌ Beklenti ile uyumsuz hareket etti.';
    const perf = r.result_percent != null ? `${r.result_percent > 0 ? '+' : ''}${r2(r.result_percent)}%` : '—';
    let txt = `📈 <b>ANALİZ DOĞRULAMASI</b>\n\n`;
    txt += `Varlık: <b>${esc(r.sym)}</b>\n`;
    if (r.price_at_analysis != null) txt += `İlk Analiz Fiyatı: <b>${r.price_at_analysis}</b>\n`;
    if (r.price_at_review != null)   txt += `Güncel Fiyat: <b>${r.price_at_review}</b>\n`;
    txt += `Performans: <b>${perf}</b>\n`;
    txt += `AI Beklentisi: <b>${biasTr(r.direction_bias)}</b>\n`;
    txt += `Sonuç: ${sonuc}\n`;
    txt += `Kaynak: VD SecuriAnalyst Archive Sistemi`;
    txt += FOOTER;

    const res = await post(txt);
    if (res && res.ok) {
      await sb(`analysis_archive?id=eq.${r.id}`, { method: 'PATCH', body: { tg_validation_posted: true }, prefer: 'return=minimal' });
      n++;
    }
  }
  console.log('[TG_CONTENT] doğrulama paylaşıldı:', n);
  return n;
}

export default async function handler(req, res) {
  // secret doğrula (query ?secret= veya header x-cron-secret)
  const got = (req.query && req.query.secret) || req.headers['x-cron-secret'];
  if (!CRON_SECRET || got !== CRON_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!TG_TOKEN || !CHANNEL_ID || !SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'env_missing' });

  const out = { validations: 0, analysis: false };
  try { out.validations = await postValidations(); } catch (e) { console.warn('[TG_CONTENT] validation err:', e.message); }
  try { out.analysis     = await postAnalysis(); }    catch (e) { console.warn('[TG_CONTENT] analysis err:', e.message); }
  return res.status(200).json({ ok: true, ...out });
}
