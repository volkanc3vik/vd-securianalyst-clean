// ════════════════════════════════════════════════════════════════════
// VD Securianalyst — Telegram Bağlantı Testi
// Vercel Serverless Function
//
// Admin'in 30 saniyede tanılama yapması için.
//
// Endpoint:  POST /api/telegram-test
// Headers:   x-admin-key: <ADMIN_KEY>
// Body:      { channel?: 'free'|'backup' }  (default: 'free')
// Response:
//   ok=true →  {
//     ok: true,
//     messageId: 1234,
//     channel: 'free',
//     resolvedChatId: '-100***6789',
//     diagnostics: { hasBotToken, freeChannelConfigured, ... }
//   }
//   ok=false → {
//     ok: false,
//     error: '<code>',
//     diagnostics: { ... },  // hata sebebini tanılamaya yarar
//     detail?: '<telegram description>'
//   }
//
// Gönderilen sabit test mesajı:
//   "✅ Telegram bağlantı testi başarılı.\n\nKanal: free\nZaman: <ISO>"
//
// Güvenlik:
//   - Aynı admin guard (ADMIN_KEY_1 / ADMIN_KEY_2)
//   - Aynı origin whitelist
//   - Aynı rate limit (per-IP)
//   - Token loglanmaz, chat_id maskelenir
// ════════════════════════════════════════════════════════════════════

// ── Origin whitelist (telegram-send ile aynı) ─────────────────────
const ALLOWED_ORIGINS = [
  'https://vd-securianalyst.com',
  'https://www.vd-securianalyst.com',
  'https://vd-securianalyst-clean.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
const PREVIEW_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (PREVIEW_PATTERN.test(origin)) return true;
  return false;
}

// ── Rate limit (test endpoint için sıkı: 3 / dakika) ──────────────
const _rateMap = new Map();
const RL_WINDOW = 60 * 1000;
const RL_LIMIT  = 3;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = _rateMap.get(ip) || { hits: [] };
  entry.hits = entry.hits.filter(t => now - t < RL_WINDOW);
  if (entry.hits.length >= RL_LIMIT) {
    return { ok: false, retryAfter: Math.ceil((RL_WINDOW - (now - entry.hits[0])) / 1000) };
  }
  entry.hits.push(now);
  _rateMap.set(ip, entry);
  return { ok: true };
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// ── Chat ID helpers (telegram-send ile aynı) ──────────────────────
function validateChatIdFormat(id) {
  if (!id || typeof id !== 'string') return { ok: false, type: 'empty' };
  if (/^-100\d{6,}$/.test(id)) return { ok: true, type: 'numeric_channel' };
  if (/^-\d{3,}$/.test(id))    return { ok: true, type: 'numeric_group' };
  if (/^\d{3,}$/.test(id))     return { ok: true, type: 'numeric_user' };
  if (/^@[A-Za-z][A-Za-z0-9_]{4,31}$/.test(id)) {
    return {
      ok: true,
      type: 'username',
      warning: 'Production ortamında username yerine -100 ile başlayan numeric chat_id kullanın.',
    };
  }
  return { ok: false, type: 'invalid_format' };
}

function maskChatId(id) {
  if (!id) return '(empty)';
  const s = String(id);
  if (s.startsWith('-100') && s.length > 7) return s.slice(0, 4) + '***' + s.slice(-4);
  if (s.startsWith('@') && s.length > 4)    return s.slice(0, 3) + '***';
  if (s.length > 6) return s.slice(0, 3) + '***' + s.slice(-3);
  return '***';
}

function resolveChannel(channelKey) {
  const key = String(channelKey || '').toLowerCase();
  if (key === 'free') {
    const id = process.env.TELEGRAM_FREE_CHANNEL_ID;
    if (!id) return { ok: false, reason: 'free_channel_not_configured' };
    return { ok: true, chatId: id, channelType: 'free' };
  }
  if (key === 'backup') {
    const id = process.env.TELEGRAM_BACKUP_CHANNEL_ID;
    if (!id) return { ok: false, reason: 'backup_channel_not_configured' };
    return { ok: true, chatId: id, channelType: 'backup' };
  }
  if (key === 'vip') return { ok: false, reason: 'vip_channel_disabled' };
  return { ok: false, reason: 'invalid_channel' };
}

function buildDiagnostics(extra = {}) {
  return {
    hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    freeChannelConfigured: Boolean(process.env.TELEGRAM_FREE_CHANNEL_ID),
    backupChannelConfigured: Boolean(process.env.TELEGRAM_BACKUP_CHANNEL_ID),
    adminKey1Configured: Boolean(process.env.ADMIN_KEY_1),
    adminKey2Configured: Boolean(process.env.ADMIN_KEY_2),
    ...extra,
  };
}

// ── Ana handler ──────────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }

  // Admin key guard
  const validAdminKeys = [process.env.ADMIN_KEY_1, process.env.ADMIN_KEY_2]
    .filter(k => typeof k === 'string' && k.length > 0);
  if (validAdminKeys.length === 0) {
    return res.status(500).json({
      ok: false,
      error: 'server_misconfigured',
      diagnostics: buildDiagnostics(),
    });
  }
  const providedKey = req.headers['x-admin-key'];
  if (typeof providedKey !== 'string' || !validAdminKeys.includes(providedKey)) {
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }

  // Rate limit
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter || 30));
    return res.status(429).json({ ok: false, error: 'rate_limited', retryAfter: rl.retryAfter });
  }

  // Token kontrolü
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({
      ok: false,
      error: 'bot_token_missing',
      diagnostics: buildDiagnostics(),
    });
  }

  // Body parse
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const channelKey = (body && typeof body === 'object' && body.channel) ? body.channel : 'free';

  // Kanal çözümle
  const resolved = resolveChannel(channelKey);
  if (!resolved.ok) {
    console.error('[TG_TEST_CONFIG]', {
      channel: channelKey,
      reason: resolved.reason,
    });
    return res.status(400).json({
      ok: false,
      error: resolved.reason,
      diagnostics: buildDiagnostics({ requestedChannel: channelKey }),
    });
  }

  const chatId = resolved.chatId;
  const chatIdMasked = maskChatId(chatId);
  const fmt = validateChatIdFormat(chatId);

  if (!fmt.ok) {
    console.error('[TG_TEST_CONFIG]', {
      channel: channelKey,
      resolvedChatId: chatIdMasked,
      reason: 'invalid_chat_id_format',
    });
    return res.status(500).json({
      ok: false,
      error: 'invalid_chat_id_format',
      diagnostics: buildDiagnostics({
        requestedChannel: channelKey,
        resolvedChatId: chatIdMasked,
      }),
    });
  }

  // Test mesajı oluştur
  const timestamp = new Date().toISOString();
  const testText =
    '✅ <b>Telegram bağlantı testi başarılı.</b>\n\n' +
    `Kanal: <code>${channelKey}</code>\n` +
    `Zaman: <code>${timestamp}</code>\n\n` +
    '<i>(Bu otomatik bir test mesajıdır.)</i>';

  console.log('[TG_TEST]', {
    channel: channelKey,
    resolvedChatId: chatIdMasked,
    chatIdType: fmt.type,
    timestamp,
  });

  // Telegram API'a gönder
  const tgUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const tgPayload = {
    chat_id: chatId,
    text: testText,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  try {
    const tgRes = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tgPayload),
    });
    const tgData = await tgRes.json();

    if (!tgRes.ok || !tgData.ok) {
      const tgDescription = tgData.description ? String(tgData.description) : 'unknown';
      console.error('[TG_TEST_ERROR]', {
        channel: channelKey,
        resolvedChatId: chatIdMasked,
        chatIdType: fmt.type,
        httpStatus: tgRes.status,
        errorCode: tgData.error_code,
        description: tgDescription.slice(0, 200),
      });

      const lowerDesc = tgDescription.toLowerCase();
      let userError = 'telegram_api_error';
      if (lowerDesc.includes('chat not found')) {
        userError = 'telegram_chat_not_found';
      } else if (
        lowerDesc.includes('not enough rights') ||
        lowerDesc.includes('chat_admin_required') ||
        lowerDesc.includes('have no rights')
      ) {
        userError = 'telegram_bot_not_admin';
      } else if (
        lowerDesc.includes('bot was kicked') ||
        lowerDesc.includes('bot is not a member')
      ) {
        userError = 'telegram_bot_kicked';
      } else if (lowerDesc.includes('blocked')) {
        userError = 'telegram_bot_blocked';
      }

      return res.status(tgRes.status >= 400 ? tgRes.status : 502).json({
        ok: false,
        error: userError,
        detail: tgDescription.slice(0, 200),
        diagnostics: buildDiagnostics({
          requestedChannel: channelKey,
          resolvedChatId: chatIdMasked,
          chatIdType: fmt.type,
          telegramErrorCode: tgData.error_code,
        }),
      });
    }

    return res.status(200).json({
      ok: true,
      messageId: tgData.result?.message_id || null,
      channel: channelKey,
      resolvedChatId: chatIdMasked,
      diagnostics: buildDiagnostics({
        requestedChannel: channelKey,
        chatIdType: fmt.type,
        ...(fmt.warning ? { warning: fmt.warning } : {}),
      }),
    });
  } catch (err) {
    console.error('[TG_TEST_EXCEPTION]', {
      channel: channelKey,
      resolvedChatId: chatIdMasked,
      message: err?.message || String(err),
    });
    return res.status(503).json({
      ok: false,
      error: 'upstream_unreachable',
      detail: err?.message ? String(err.message).slice(0, 200) : 'unknown',
      diagnostics: buildDiagnostics({
        requestedChannel: channelKey,
        resolvedChatId: chatIdMasked,
      }),
    });
  }
}
