// ════════════════════════════════════════════════════════════════════
// VD Securianalyst — Telegram Send Proxy
// Vercel Serverless Function
//
// Frontend bu endpoint'e POST atar; bu fonksiyon TOKEN'i koruyarak
// Telegram Bot API'a yönlendirir. Token frontend'e ASLA sızdırılmaz.
//
// Endpoint:  POST /api/telegram-send
// Body:      { channel: 'free'|'vip', text: string }
// Response:  { ok: true, messageId: number } | { ok: false, error: string }
//
// Environment Variables (Vercel):
//   TELEGRAM_BOT_TOKEN      (zorunlu) — BotFather'dan alınan token
//   TELEGRAM_FREE_CHANNEL   (ops.)    — varsayılan: '@vdaisignals'
//   TELEGRAM_VIP_CHANNEL    (ops.)    — varsayılan: '@vdaisignalsvip'
// ════════════════════════════════════════════════════════════════════

// ── Origin whitelist ────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://vd-securianalyst.com',
  'https://www.vd-securianalyst.com',
  'https://vd-securianalyst-clean.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
// Vercel preview build pattern (örn: vd-securianalyst-git-main-volkanc3vik.vercel.app)
const PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (PREVIEW_PATTERN.test(origin)) return true;
  return false;
}

// ── Rate limit (in-memory, B opsiyonu) ──────────────────────────────
// Vercel cold start'larda sıfırlanır — kasıtlı: kalıcı limit istemiyoruz,
// sadece basit kötüye kullanım korumasıdır.
const _rateMap = new Map(); // ip -> { recent: [ts, ts, ...], minute: [ts, ts, ...] }
const RL_WINDOW_SHORT = 10 * 1000;  // 10 saniye
const RL_LIMIT_SHORT  = 5;
const RL_WINDOW_LONG  = 60 * 1000;  // 1 dakika
const RL_LIMIT_LONG   = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = _rateMap.get(ip) || { recent: [], minute: [] };
  // Eski timestamp'leri at
  entry.recent = entry.recent.filter(t => now - t < RL_WINDOW_SHORT);
  entry.minute = entry.minute.filter(t => now - t < RL_WINDOW_LONG);

  if (entry.recent.length >= RL_LIMIT_SHORT) {
    return { ok: false, reason: 'short_window', retryAfter: Math.ceil((RL_WINDOW_SHORT - (now - entry.recent[0])) / 1000) };
  }
  if (entry.minute.length >= RL_LIMIT_LONG) {
    return { ok: false, reason: 'long_window', retryAfter: Math.ceil((RL_WINDOW_LONG - (now - entry.minute[0])) / 1000) };
  }
  // Kayıt
  entry.recent.push(now);
  entry.minute.push(now);
  _rateMap.set(ip, entry);

  // Map büyümesin: 1 dakikada bir temizlik (yaklaşık)
  if (_rateMap.size > 1000) {
    for (const [k, v] of _rateMap) {
      v.minute = v.minute.filter(t => now - t < RL_WINDOW_LONG);
      if (v.minute.length === 0) _rateMap.delete(k);
    }
  }
  return { ok: true };
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// ── Kanal çözümleme — sadece beyaz liste ────────────────────────────
function resolveChannel(channelKey) {
  const key = String(channelKey || '').toLowerCase();
  if (key === 'free') {
    return process.env.TELEGRAM_FREE_CHANNEL || '@vdaisignals';
  }
  if (key === 'vip') {
    return process.env.TELEGRAM_VIP_CHANNEL || '@vdaisignalsvip';
  }
  return null;
}

// ── Body validasyonu ────────────────────────────────────────────────
const MAX_TEXT_LEN = 4000; // Telegram limiti 4096, güvenlik payı 96

function validateBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_body' };
  }
  if (!body.channel) return { ok: false, error: 'channel_required' };
  if (!body.text || typeof body.text !== 'string') return { ok: false, error: 'text_required' };
  if (body.text.trim().length === 0) return { ok: false, error: 'text_empty' };
  if (body.text.length > MAX_TEXT_LEN) return { ok: false, error: 'text_too_long' };
  return { ok: true };
}

// ── Error mesajları sızıntı içermez ─────────────────────────────────
function safeErrorMessage(err) {
  const msg = err?.message || String(err || 'unknown');
  // Token kazara mesaja sızmasın
  if (msg.includes('bot') && msg.match(/\d{8,}:[A-Za-z0-9_-]{30,}/)) {
    return 'upstream_error';
  }
  return msg.slice(0, 200);
}

// ── Ana handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS preflight
  const origin = req.headers.origin || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 1. Method check
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // 2. Origin check (preflight değil ana istek)
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }

  // 3. Admin key guard
  //   - ADMIN_KEY_1 ve ADMIN_KEY_2 env'de tanımlı değilse endpoint kapalı
  //   - x-admin-key header'ı yoksa veya hiçbiriyle eşleşmiyorsa 403
  //   - Hata mesajları hangi key'in beklendiğini ifşa etmez
  const adminKey1 = process.env.ADMIN_KEY_1;
  const adminKey2 = process.env.ADMIN_KEY_2;
  const validAdminKeys = [adminKey1, adminKey2].filter(
    k => typeof k === 'string' && k.length > 0
  );
  if (validAdminKeys.length === 0) {
    return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  }
  const providedKey = req.headers['x-admin-key'];
  if (typeof providedKey !== 'string' || providedKey.length === 0) {
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }
  if (!validAdminKeys.includes(providedKey)) {
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }

  // 4. Rate limit
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 30));
    return res.status(429).json({
      ok: false,
      error: 'rate_limited',
      reason: rl.reason,
      retryAfter: rl.retryAfter,
    });
  }

  // 5. Token env var kontrolü
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ ok: false, error: 'server_misconfigured' });
  }

  // 6. Body parse + validation
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const v = validateBody(body);
  if (!v.ok) {
    return res.status(400).json({ ok: false, error: v.error });
  }

  // 7. Kanal çözümle
  const chatId = resolveChannel(body.channel);
  if (!chatId) {
    return res.status(400).json({ ok: false, error: 'invalid_channel' });
  }

  // 8. Telegram API'a gönder
  const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;

  // parse_mode mantığı:
  //   - body.parseMode = 'HTML' veya undefined  → HTML (varsayılan, en esnek)
  //   - body.parseMode = 'MarkdownV2'           → MarkdownV2 (strict escape gerekir)
  //   - body.parseMode = 'none'                 → ham metin, parse yok
  let parseMode;
  if (body.parseMode === 'MarkdownV2') parseMode = 'MarkdownV2';
  else if (body.parseMode === 'none')   parseMode = undefined;
  else                                   parseMode = 'HTML';

  const tgPayload = {
    chat_id:  chatId,
    text:     body.text,
    disable_web_page_preview: true,
  };
  if (parseMode) tgPayload.parse_mode = parseMode;

  try {
    const tgRes = await fetch(tgUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(tgPayload),
    });
    const tgData = await tgRes.json();

    if (!tgRes.ok || !tgData.ok) {
      // Telegram'ın kendi hata kodları
      return res.status(tgRes.status >= 400 ? tgRes.status : 502).json({
        ok:    false,
        error: 'telegram_api_error',
        // Telegram'dan dönen description (token içermez)
        detail: tgData.description ? String(tgData.description).slice(0, 200) : null,
      });
    }

    return res.status(200).json({
      ok:        true,
      messageId: tgData.result?.message_id || null,
      channel:   body.channel,
    });
  } catch (err) {
    return res.status(503).json({
      ok:    false,
      error: 'upstream_unreachable',
      detail: safeErrorMessage(err),
    });
  }
}
