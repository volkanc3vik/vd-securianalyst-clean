// ════════════════════════════════════════════════════════════════════
// TELEGRAM ERROR MAPPER
// Backend/network hatalarını kullanıcı dostu Türkçe mesajlara çevirir.
// Namespace: window.TelegramUI.errorMessage
// ════════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  window.TelegramUI = window.TelegramUI || {};

  const MESSAGES = {
    // Backend güvenlik
    unauthorized:           'Yetki yok — admin kodu hatalı veya geçersiz',
    origin_not_allowed:     'Erişim engellendi',
    server_misconfigured:   'Sunucu yapılandırma hatası',
    method_not_allowed:     'Geçersiz istek tipi',

    // Validation
    invalid_body:           'Geçersiz istek',
    channel_required:       'Kanal belirtilmedi',
    text_required:          'Mesaj metni eksik',
    text_empty:             'Mesaj metni boş',
    text_too_long:          'Mesaj çok uzun',
    invalid_channel:        'Geçersiz kanal',
    invalid_signal:         'Geçersiz analiz verisi',
    invalid_signal_shape:   'Analiz verisi eksik',
    signal_missing_fields:  'Analiz alanları eksik',

    // Rate limit
    rate_limited:           'Çok fazla istek — biraz bekleyin',

    // B.4-TG: Kanal yapılandırma hataları
    free_channel_not_configured:   'Free kanal yapılandırılmamış — TELEGRAM_FREE_CHANNEL_ID env değişkeni eksik',
    backup_channel_not_configured: 'Backup kanal yapılandırılmamış — TELEGRAM_BACKUP_CHANNEL_ID env değişkeni eksik',
    vip_channel_disabled:          'VIP kanal şu anda devre dışı',
    invalid_chat_id_format:        'Kanal ID formatı geçersiz — numeric (-100...) veya @username olmalı',
    bot_token_missing:             'Bot token yapılandırılmamış — TELEGRAM_BOT_TOKEN env değişkeni eksik',

    // Telegram API
    telegram_api_error:     'Telegram hatası',
    telegram_chat_not_found:'Telegram kanal ID bulunamadı veya bot bu kanalda admin değil',
    telegram_bot_not_admin: 'Bot kanalda admin yetkisine sahip değil',
    telegram_bot_kicked:    'Bot kanaldan çıkarılmış veya üye değil',
    telegram_bot_blocked:   'Bot bu kanaldan engellenmiş',
    telegram_rate_limited:  'Telegram tarafından oran sınırı uygulandı — biraz bekleyin',
    upstream_unreachable:   "Telegram'a ulaşılamıyor",

    // Frontend
    formatter_unavailable:  'Format motoru yüklenmedi',
    dispatcher_unavailable: 'Dispatcher yüklenmedi',
    signal_not_found:       'Analiz verisi bulunamadı',
    invalid_text:           'Geçersiz metin',
    on_cooldown:            'Bekleme süresi aktif',
    format_failed:          'Mesaj formatlanamadı',
    network_error:          'Ağ hatası',
    sym_dir_required:       'Sembol veya yön eksik',
  };

  function errorMessage(errorCode, detail) {
    if (!errorCode) return 'Bilinmeyen hata';
    const base = MESSAGES[errorCode] || errorCode;
    return base;
  }

  window.TelegramUI.errorMessage = errorMessage;
})();
