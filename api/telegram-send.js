// ════════════════════════════════════════════════════════════════════
// VD Securianalyst — Telegram Send Proxy
// Vercel Serverless Function
//
// Frontend bu endpoint'e POST atar; bu fonksiyon TOKEN'i koruyarak
// Telegram Bot API'a yönlendirir. Token frontend'e ASLA sızdırılmaz.
//
// Endpoint:  POST /api/telegram-send
// Body:      { channel: 'free'|'backup', text: string, parseMode?: 'HTML'|'MarkdownV2'|'none' }
// Response:  { ok: true, messageId: number } | { ok: false, error: string }
//
// Environment Variables (Vercel):
//   TELEGRAM_BOT_TOKEN              (zorunlu) — BotFather'dan alınan token
//   TELEGRAM_FREE_CHANNEL_ID        (zorunlu) — numeric -100... (NOT @username)
//   TELEGRAM_BACKUP_CHANNEL_ID      (opsiyonel) — backup/private kanal
//   ADMIN_KEY_1, ADMIN_KEY_2        (zorunlu)  — admin guard
//
// B.4-TG düzeltmesi (Mayıs 2026):
//   - Eski TELEGRAM_FREE_CHANNEL / TELEGRAM_VIP_CHANNEL env'leri ARTIK okunmaz
//   - VIP kanalı disabled (frontend zaten VIP göndermez)
//   - Numeric chat_id zorunlu, @username uyarı ile (production önerilmez)
//   - Debug log + telegram description user-friendly hata mapping
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

// ── Chat ID format validasyonu ───────────────────────────────────────
// Production'da numeric -100... önerilir.
// @username destekli ama uyarı verir.
function validateChatIdFormat(id) {
  if (!id || typeof id !== 'string') {
    return { ok: false, type: 'empty' };
  }
  // -100 ile başlayan numeric (channel/supergroup) — ÖNERİLEN
  if (/^-100\d{6,}$/.test(id)) {
    return { ok: true, type: 'numeric_channel' };
  }
  // Diğer negative numeric (basic group)
  if (/^-\d{3,}$/.test(id)) {
    return { ok: true, type: 'numeric_group' };
  }
  // Positive numeric (user/private chat)
  if (/^\d{3,}$/.test(id)) {
    return { ok: true, type: 'numeric_user' };
  }
  // @username — destekleniyor ama uyarı
  if (/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(id)) {
    return {
      ok: true,
      type: 'username',
      warning: 'Production ortamında username yerine -100 ile başlayan numeric chat_id kullanın.',
    };
  }
  return { ok: false, type: 'invalid_format' };
}

// ── Chat ID maskeleme (loglar için) ──────────────────────────────────
// "-1001234567890" → "-100***7890"
// "@username"       → "@us***"
function maskChatId(id) {
  if (!id) return '(empty)';
  const s = String(id);
  if (s.startsWith('-100') && s.length > 7) {
    return s.slice(0, 4) + '***' + s.slice(-4);
  }
  if (s.startsWith('@') && s.length > 4) {
    return s.slice(0, 3) + '***';
  }
  if (s.length > 6) {
    return s.slice(0, 3) + '***' + s.slice(-3);
  }
  return '***';
}

// ── Kanal çözümleme — B.4-TG yeni davranış ───────────────────────────
// Geriye uyumluluk: yok. Eski TELEGRAM_FREE_CHANNEL / TELEGRAM_VIP_CHANNEL
// env'leri ARTIK okunmaz. Sadece *_ID suffix'li env'ler kullanılır.
function resolveChannel(channelKey) {
  const key = String(channelKey || '').toLowerCase();

  if (key === 'free') {
    const id = process.env.TELEGRAM_FREE_CHANNEL_ID;
    if (!id) {
      return { ok: false, reason: 'free_channel_not_configured' };
    }
    return { ok: true, chatId: id, channelType: 'free' };
  }

  if (key === 'backup') {
    const id = process.env.TELEGRAM_BACKUP_CHANNEL_ID;
    if (!id) {
      return { ok: false, reason: 'backup_channel_not_configured' };
    }
    return { ok: true, chatId: id, channelType: 'backup' };
  }

  if (key === 'vip') {
    // Strateji gereği VIP kanal devre dışı (Aşama A — dil dönüşümü).
    // Frontend zaten VIP göndermez. Backend gelirse açıkça reddedilir.
    return { ok: false, reason: 'vip_channel_disabled' };
  }

  return { ok: false, reason: 'invalid_channel' };
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

  // 7. Kanal çözümle (B.4-TG: yeni davranış)
  const resolved = resolveChannel(body.channel);
  if (!resolved.ok) {
    console.error('[TG_SEND_CONFIG]', {
      channel: body.channel,
      reason: resolved.reason,
      hasBotToken: Boolean(token),
      freeChannelConfigured: Boolean(process.env.TELEGRAM_FREE_CHANNEL_ID),
      backupChannelConfigured: Boolean(process.env.TELEGRAM_BACKUP_CHANNEL_ID),
    });
    return res.status(400).json({ ok: false, error: resolved.reason });
  }

  const chatId = resolved.chatId;
  const chatIdMasked = maskChatId(chatId);

  // Chat ID format validate (production önerisi için uyarı)
  const fmt = validateChatIdFormat(chatId);
  if (!fmt.ok) {
    console.error('[TG_SEND_CONFIG]', {
      channel: body.channel,
      resolvedChatId: chatIdMasked,
      reason: 'invalid_chat_id_format',
    });
    return res.status(500).json({ ok: false, error: 'invalid_chat_id_format' });
  }

  // Debug log — her gönderim için (token YOK, chat_id MASKED)
  console.log('[TG_SEND]', {
    channel: body.channel,
    resolvedChatId: chatIdMasked,
    chatIdType: fmt.type,
    channelType: resolved.channelType,
    hasBotToken: Boolean(token),
    textLength: body.text.length,
    timestamp: new Date().toISOString(),
  });

  if (fmt.warning) {
    console.warn('[TG_SEND_WARN]', { warning: fmt.warning });
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
      const tgDescription = tgData.description ? String(tgData.description) : 'unknown';

      // Sunucu tarafı detay log (token yok, chat_id masked)
      console.error('[TG_SEND_ERROR]', {
        channel: body.channel,
        resolvedChatId: chatIdMasked,
        chatIdType: fmt.type,
        httpStatus: tgRes.status,
        errorCode: tgData.error_code,
        description: tgDescription.slice(0, 200),
      });

      // Telegram description'a göre user-friendly hata kodu seç
      const lowerDesc = tgDescription.toLowerCase();
      let userError = 'telegram_api_error';

      if (lowerDesc.includes('chat not found')) {
        userError = 'telegram_chat_not_found';
      } else if (
        lowerDesc.includes('not enough rights') ||
        lowerDesc.includes('chat_admin_required') ||
        lowerDesc.includes('have no rights') ||
        lowerDesc.includes('need administrator rights')
      ) {
        userError = 'telegram_bot_not_admin';
      } else if (
        lowerDesc.includes('bot was kicked') ||
        lowerDesc.includes('bot is not a member')
      ) {
        userError = 'telegram_bot_kicked';
      } else if (lowerDesc.includes('blocked')) {
        userError = 'telegram_bot_blocked';
      } else if (lowerDesc.includes('too many requests')) {
        userError = 'telegram_rate_limited';
      }

      return res.status(tgRes.status >= 400 ? tgRes.status : 502).json({
        ok:     false,
        error:  userError,
        detail: tgDescription.slice(0, 200),
      });
    }

    return res.status(200).json({
      ok:        true,
      messageId: tgData.result?.message_id || null,
      channel:   body.channel,
    });
  } catch (err) {
    console.error('[TG_SEND_EXCEPTION]', {
      channel: body.channel,
      resolvedChatId: chatIdMasked,
      message: safeErrorMessage(err),
    });
    return res.status(503).json({
      ok:    false,
      error: 'upstream_unreachable',
      detail: safeErrorMessage(err),
    });
  }
}
