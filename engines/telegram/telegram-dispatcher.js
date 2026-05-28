// ════════════════════════════════════════════════════════════════════
// TELEGRAM DISPATCHER
// Frontend → /api/telegram-send güvenli istek katmanı.
//
// Public API:
//   await TelegramDispatcher.send(text, channel)
//   await TelegramDispatcher.sendSignal(signalObj, channel)
//   TelegramDispatcher.isOnCooldown(symbol, dir, channel) → boolean
//   TelegramDispatcher.getCooldownRemaining(symbol, dir, channel) → seconds
//   TelegramDispatcher.clearCooldown(symbol?, dir?, channel?)  // debug
//
// Davranış:
//   - Cooldown: (sym + dir + channel) tuple bazlı, 30dk (yön bazlı, D opsiyonu)
//     → BTC LONG ve BTC SHORT ayrı sayılır
//     → Free ve VIP cooldown da ayrı (kullanıcı bilinçli karar)
//   - Retry: backend 429 dönerse 1 kere otomatik retry (Retry-After'a göre)
//   - Logging: [TG] öneki ile console
// ════════════════════════════════════════════════════════════════════
window.TelegramDispatcher = (() => {
  'use strict';

  const ENDPOINT = '/api/telegram-send';
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 dakika (D opsiyonu)
  const MAX_RETRY = 1;
  const _cooldownMap = new Map(); // key: 'BTCUSDT|LONG|free' → timestamp

  // ── Session-only admin key ────────────────────────────────────────
  // Modül scope'unda tutulur, dışarıdan _adminKey olarak erişilemez.
  // localStorage/sessionStorage'a YAZILMAZ — sayfa kapanınca uçar.
  // console.log'da hiç görünmez.
  let _adminKey = null;

  function _log(...args) { console.log('[TG]', ...args); }
  function _warn(...args) { console.warn('[TG]', ...args); }

  function _cooldownKey(sym, dir, channel) {
    return `${(sym || '').toUpperCase()}|${(dir || '').toUpperCase()}|${(channel || '').toLowerCase()}`;
  }

  // ── Admin Key API ─────────────────────────────────────────────────
  function setAdminKey(key) {
    if (typeof key !== 'string' || key.length === 0) {
      _adminKey = null;
      return false;
    }
    _adminKey = key;
    return true;
  }
  function hasAdminKey() {
    return typeof _adminKey === 'string' && _adminKey.length > 0;
  }
  function clearAdminKey() {
    _adminKey = null;
  }

  // ── Admin API sarmalı (key private kalır, dışarı sızmaz) ──────────
  // Kullanım: TelegramDispatcher.adminFetch('/api/admin-codes', { action:'list' })
  async function adminFetch(endpoint, payload, opts) {
    opts = opts || {};
    if (typeof _adminKey !== 'string' || _adminKey.length === 0) {
      throw new Error('admin_key_missing');
    }
    const method = opts.method || (payload && payload.action === 'list' && opts.useGet !== false ? 'GET' : 'POST');
    let url = endpoint;
    let body;
    if (method === 'GET') {
      const qs = new URLSearchParams();
      Object.keys(payload || {}).forEach(k => {
        if (payload[k] != null) qs.set(k, String(payload[k]));
      });
      url = endpoint + (qs.toString() ? '?' + qs.toString() : '');
    } else {
      body = JSON.stringify(payload || {});
    }
    const r = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': _adminKey,
      },
      body,
    });
    const text = await r.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { ok: false, error: 'invalid_response' }; }
    if (!r.ok && !data.error) data.error = 'http_' + r.status;
    if (!('ok' in data)) data.ok = r.ok;
    return data;
  }

  // ── Cooldown API ──────────────────────────────────────────────────
  function isOnCooldown(sym, dir, channel) {
    const key = _cooldownKey(sym, dir, channel);
    const expires = _cooldownMap.get(key);
    if (!expires) return false;
    if (Date.now() >= expires) {
      _cooldownMap.delete(key);
      return false;
    }
    return true;
  }

  function getCooldownRemaining(sym, dir, channel) {
    const key = _cooldownKey(sym, dir, channel);
    const expires = _cooldownMap.get(key);
    if (!expires) return 0;
    const remain = expires - Date.now();
    return remain > 0 ? Math.ceil(remain / 1000) : 0;
  }

  function clearCooldown(sym, dir, channel) {
    if (!sym) {
      _cooldownMap.clear();
      _log('all cooldowns cleared');
      return;
    }
    if (!dir && !channel) {
      // Belirtilen sembolün tüm cooldown'larını temizle
      let n = 0;
      for (const k of _cooldownMap.keys()) {
        if (k.startsWith(sym.toUpperCase() + '|')) { _cooldownMap.delete(k); n++; }
      }
      _log(`cleared ${n} cooldown(s) for ${sym}`);
      return;
    }
    const key = _cooldownKey(sym, dir, channel);
    _cooldownMap.delete(key);
    _log('cleared cooldown:', key);
  }

  function _setCooldown(sym, dir, channel) {
    const key = _cooldownKey(sym, dir, channel);
    _cooldownMap.set(key, Date.now() + COOLDOWN_MS);
  }

  // ── Tek tarafa istek (cooldown yok, raw send) ──────────────────────
  async function send(text, channel, opts = {}) {
    if (!text || typeof text !== 'string') {
      return { ok: false, error: 'invalid_text' };
    }
    const ch = (channel || '').toLowerCase();
    if (ch !== 'free' && ch !== 'vip') {
      return { ok: false, error: 'invalid_channel' };
    }

    const body = { channel: ch, text };
    if (opts.parseMode) body.parseMode = opts.parseMode;

    return _doFetch(body, 0);
  }

  // ── Sinyal gönderimi (cooldown kontrolü dahil) ────────────────────
  async function sendSignal(signal, channel) {
    if (!signal || typeof signal !== 'object') {
      return { ok: false, error: 'invalid_signal' };
    }
    const sym = signal.sym;
    const dir = (signal.dir || '').toUpperCase();
    const ch  = (channel || '').toLowerCase();

    if (!sym || !dir) {
      return { ok: false, error: 'signal_missing_fields' };
    }
    if (ch !== 'free' && ch !== 'vip') {
      return { ok: false, error: 'invalid_channel' };
    }

    // Cooldown kontrolü
    if (isOnCooldown(sym, dir, ch)) {
      const remain = getCooldownRemaining(sym, dir, ch);
      _warn(`cooldown active: ${sym} ${dir} ${ch} (${remain}s left)`);
      return {
        ok: false,
        error: 'on_cooldown',
        cooldownRemaining: remain,
        message: `${sym} ${dir} için ${ch} kanalında ${Math.ceil(remain/60)} dk cooldown var.`,
      };
    }

    // Formatla
    const Formatter = window.TelegramFormatter;
    if (!Formatter) {
      return { ok: false, error: 'formatter_unavailable' };
    }
    const formatted = Formatter.format(signal, ch);
    if (!formatted.text) {
      return { ok: false, error: formatted.error || 'format_failed' };
    }

    _log(`sending: ${sym} ${dir} → ${ch}`);
    const result = await _doFetch({ channel: ch, text: formatted.text }, 0);

    // Başarılıysa cooldown'a koy
    if (result.ok) {
      _setCooldown(sym, dir, ch);
      _log(`sent ✓ msgId=${result.messageId}, cooldown set for ${sym} ${dir} ${ch}`);
      // Event yayını — VIP Tracker veya diğer modüller dinleyebilir
      try {
        window.dispatchEvent(new CustomEvent('vd:telegram:sent', {
          detail: {
            signal,
            channel: ch,
            messageId: result.messageId,
          }
        }));
      } catch (e) { /* yut */ }
    } else {
      _warn(`send failed: ${result.error}`, result.detail || '');
    }

    return result;
  }

  // ── Düşük seviye fetch + retry ────────────────────────────────────
  async function _doFetch(body, attempt) {
    try {
      // Header'lar — admin key varsa eklenir, asla loglanmaz
      const headers = { 'Content-Type': 'application/json' };
      if (_adminKey) {
        headers['x-admin-key'] = _adminKey;
      }

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // 429 rate limit → backend yeniden denenebilir der
      if (res.status === 429 && attempt < MAX_RETRY) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
        _warn(`rate limited, retry in ${retryAfter}s (attempt ${attempt+1})`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        return _doFetch(body, attempt + 1);
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        return {
          ok: false,
          error: data.error || 'http_' + res.status,
          detail: data.detail || null,
          status: res.status,
        };
      }

      return {
        ok: true,
        messageId: data.messageId,
        channel: data.channel,
      };
    } catch (e) {
      _warn('network error:', e.message);
      return {
        ok: false,
        error: 'network_error',
        detail: e.message,
      };
    }
  }

  return {
    send,
    sendSignal,
    isOnCooldown,
    getCooldownRemaining,
    clearCooldown,
    setAdminKey,
    hasAdminKey,
    clearAdminKey,
    adminFetch,
  };
})();
