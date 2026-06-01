// ════════════════════════════════════════════════════════════════════
// VD SecuriAnalyst — TELEGRAM CONTENT ENGINE (Phase 6 + format revision)
// analysis_archive'dan besler: (A) AI analiz paylaşımı (B) doğrulama paylaşımı.
// SİNYAL DEĞİL: Entry/SL/TP/kaldıraç/al-sat YOK. Yön/Confidence/Risk/Beklenti Bölgesi/Yapı/Performans.
//
// Tetikleme: dış cron (cron-job.org) 6 saatte bir → ?secret=<TELEGRAM_CRON_SECRET>
// DOKUNMAZ: referral, premium, dashboard, scanner, archive MANTIĞI (sadece REST okuma/işaretleme).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_FREE_CHANNEL_ID, TELEGRAM_CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════

const TG_TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID  = process.env.TELEGRAM_FREE_CHANNEL_ID;
const CRON_SECRET = process.env.TELEGRAM_CRON_SECRET;
const SB_URL      = process.env.SUPABASE_URL;
const SB_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE = 'https://vd-securianalyst.com';
const FOOTER =
  '\n\n━━━━━━━━━━━━━━\n🛡️ <b>VD SECURIANALYST</b>\nAI MARKET INTELLIGENCE\n' +
  '🌐 vd-securianalyst.com   📧 support@vd-securianalyst.com\n' +
  '⚠️ Bu içerik eğitim ve analiz amaçlıdır. Yatırım tavsiyesi değildir.\n━━━━━━━━━━━━━━';
const NOT_BLOCK =
  '📌 <b>NOT</b>\nBu analiz VD SecuriAnalyst AI Market Intelligence sistemi tarafından oluşturulmuştur. ' +
  'Analiz sonuçları daha sonra Archive sistemi üzerinden otomatik doğrulanır ve kamuya açık şekilde paylaşılır. ' +
  'Başarılı ve başarısız tüm analizler arşiv verileriyle kaydedilir.';

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
const r1  = (n) => Math.round(Number(n) * 10) / 10;
const r2  = (n) => Math.round(Number(n) * 100) / 100;

// created_at → "01 Haziran 2026 09:00" (Europe/Istanbul)
function trDate(iso) {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso)).replace(',', '');
  } catch (e) { return null; }
}

// Binance public — güncel fiyat (key gerekmez)
async function currentPrice(sym) {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`);
    const d = await r.json();
    return d && d.price ? Number(d.price) : null;
  } catch (e) { return null; }
}

// GERÇEK volatiliteden (günlük ATR%) beklenti bandı türet — "hedef" değil, beklenti
async function expectedBand(sym) {
  try {
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=1d&limit=15`);
    const k = await r.json();
    if (!Array.isArray(k) || k.length < 5) return null;
    let sum = 0, n = 0;
    for (const c of k) { const high = +c[2], low = +c[3], close = +c[4]; if (close > 0) { sum += (high - low) / close * 100; n++; } }
    if (!n) return null;
    const atr = sum / n;
    let lo = Math.max(0.5, r1(atr * 0.6)), hi = r1(atr * 1.2);
    if (hi <= lo) hi = r1(lo + 0.5);
    return { lo, hi, mid: r1((lo + hi) / 2) };
  } catch (e) { return null; }
}
function bandTxt(b, bias) {
  if (!b) return null;
  if (bias === 'bearish') return `-%${b.lo} ila -%${b.hi}`;
  if (bias === 'neutral') return `±%${b.lo} ila ±%${b.hi}`;
  return `+%${b.lo} ila +%${b.hi}`;
}

// "Yapı" — gerçek market_context.structure varsa onu kullan; yoksa RSI/skor/yön'den dürüst türet
function yapi(mc, bias) {
  if (mc && mc.structure) return String(mc.structure);
  const rsi = mc && mc.rsi != null ? Number(mc.rsi) : null;
  const score = mc && mc.score != null ? Number(mc.score) : null;
  if (rsi != null) {
    if (rsi >= 68) return 'Güçlü Momentum + RSI Genişlemesi';
    if (rsi <= 32) return 'Aşırı Satım Tepkisi + Dönüş Yapısı';
    if (bias === 'bullish' && rsi >= 52) return 'Trend + Momentum Uyumu';
    if (bias === 'bearish' && rsi <= 48) return 'Trend + Momentum Uyumu';
    return 'Yapısal Denge + Momentum Takibi';
  }
  if (score != null && score >= 90) return 'Çok Faktörlü Güçlü Yapı';
  return 'Çok Faktörlü AI Yapısı';
}

// ── (A) AI ANALİZ PAYLAŞIMI ──
async function postAnalysis() {
  const sinceIso = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const rows = await sb('analysis_archive?' +
    `or=(shared_to_telegram.is.null,shared_to_telegram.eq.false)` +
    `&analysis_score=gte.80&created_at=gte.${sinceIso}` +
    `&order=analysis_score.desc,created_at.desc&limit=1` +
    `&select=id,sym,direction_bias,price_at_analysis,analysis_score,market_context,created_at`);
  const r = rows && rows[0];
  if (!r) { console.log('[TG_CONTENT] paylaşılacak yeni analiz yok'); return false; }

  const mc = r.market_context || {};
  const bias = r.direction_bias || 'neutral';
  const risk = mc.risk != null ? String(mc.risk) : null;
  const cur = await currentPrice(r.sym);
  const price = cur != null ? cur : r.price_at_analysis;
  const band = await expectedBand(r.sym);
  const bt = bandTxt(band, bias);

  let txt = `📊 <b>${esc(r.sym)}</b>\n\n`;
  txt += `AI Beklentisi: <b>${biasTr(bias)}</b>\n`;
  txt += `Confidence: <b>${r.analysis_score != null ? r.analysis_score : '—'}/100</b>\n`;
  if (risk) txt += `Risk: <b>${esc(risk)}</b>\n`;
  if (price != null) txt += `Mevcut Fiyat: <b>${price}</b>\n`;
  if (bt) txt += `Beklenti Bölgesi: <b>${bt}</b>\n`;
  txt += `Yapı: <b>${esc(yapi(mc, bias))}</b>\n`;
  const zaman = trDate(r.created_at);
  if (zaman) txt += `\n🕒 Analiz Zamanı:\n<b>${zaman}</b>\n`;
  txt += `\n🔍 Detaylı Analizi Gör: ${SITE}/?symbol=${encodeURIComponent(r.sym)}&ref=tg\n\n`;
  txt += NOT_BLOCK + FOOTER;

  const res = await post(txt);
  if (res && res.ok) {
    const patch = { shared_to_telegram: true, telegram_msg_id: res.result.message_id, shared_at: new Date().toISOString(),
      market_context: Object.assign({}, mc, { posted_via: 'telegram_auto_analysis' }) };
    if (band) {
      patch.tg_exp_lo = band.lo; patch.tg_exp_hi = band.hi;
      patch.tg_exp_pct = bias === 'bearish' ? -band.mid : bias === 'neutral' ? 0 : band.mid;
    }
    await sb(`analysis_archive?id=eq.${r.id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
    console.log('[TG_CONTENT] analiz paylaşıldı:', r.sym);
    return true;
  }
  console.warn('[TG_CONTENT] analiz gönderilemedi:', res && res.description);
  return false;
}

// ── (B) DOĞRULAMA PAYLAŞIMI ──
async function postValidations() {
  const rows = await sb('analysis_archive?' +
    `tg_validation_posted=eq.false&shared_to_telegram=eq.true&result_percent=not.is.null` +
    `&review_status=in.(validated,partially_validated,not_validated)` +
    `&order=reviewed_at.desc&limit=3` +
    `&select=id,sym,direction_bias,price_at_analysis,price_at_review,result_percent,review_status,tg_exp_pct,tg_exp_hi`);
  if (!rows || !rows.length) { console.log('[TG_CONTENT] yeni doğrulama yok'); return 0; }

  let n = 0;
  for (const r of rows) {
    const realized = Number(r.result_percent);
    const expPct = r.tg_exp_pct != null ? Number(r.tg_exp_pct) : null;
    const expHi  = r.tg_exp_hi  != null ? Number(r.tg_exp_hi)  : null;

    // Sonuç senaryosu: beklenti yönü vs gerçekleşen
    let sonuc;
    if (expPct != null && expHi != null) {
      const sameDir = (expPct > 0 && realized > 0) || (expPct < 0 && realized < 0) || expPct === 0;
      if (!sameDir && Math.abs(realized) >= 0.5) sonuc = '❌ Beklenti ile uyumsuz hareket etti.';
      else if (Math.abs(realized) >= expHi)      sonuc = '✅ Beklentiyi aştı.';
      else                                       sonuc = '✅ Beklenti ile uyumlu hareket etti.';
    } else {
      sonuc = r.review_status === 'not_validated' ? '❌ Beklenti ile uyumsuz hareket etti.'
            : '✅ Beklenti ile uyumlu hareket etti.';
    }

    const perf = `${realized > 0 ? '+' : realized < 0 ? '-' : ''}%${Math.abs(r2(realized))}`;
    let txt = `📈 <b>ANALİZ DOĞRULAMASI</b>\n\n`;
    txt += `Varlık: <b>${esc(r.sym)}</b>\n`;
    if (r.price_at_analysis != null) txt += `İlk Analiz Fiyatı: <b>${r.price_at_analysis}</b>\n`;
    if (r.price_at_review != null)   txt += `Güncel Fiyat: <b>${r.price_at_review}</b>\n`;
    if (expPct != null) txt += `AI Beklentisi: <b>${expPct > 0 ? '+' : expPct < 0 ? '-' : '±'}%${Math.abs(r1(expPct))}</b>\n`;
    txt += `Gerçekleşen Hareket: <b>${perf}</b>\n`;
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
  const got = (req.query && req.query.secret) || req.headers['x-cron-secret'];
  if (!CRON_SECRET || got !== CRON_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (!TG_TOKEN || !CHANNEL_ID || !SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'env_missing' });

  const out = { validations: 0, analysis: false };
  try { out.validations = await postValidations(); } catch (e) { console.warn('[TG_CONTENT] validation err:', e.message); }
  try { out.analysis     = await postAnalysis(); }    catch (e) { console.warn('[TG_CONTENT] analysis err:', e.message); }
  return res.status(200).json({ ok: true, ...out });
}
