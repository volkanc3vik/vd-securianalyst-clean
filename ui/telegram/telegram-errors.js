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
    invalid_signal:         'Geçersiz sinyal',
    invalid_signal_shape:   'Sinyal verisi eksik',
    signal_missing_fields:  'Sinyal alanları eksik',

    // Rate limit
    rate_limited:           'Çok fazla istek — biraz bekleyin',

    // Telegram API
    telegram_api_error:     'Telegram hatası',
    upstream_unreachable:   'Telegram\'a ulaşılamıyor',

    // Frontend
    formatter_unavailable:  'Format motoru yüklenmedi',
    dispatcher_unavailable: 'Dispatcher yüklenmedi',
    signal_not_found:       'Sinyal verisi bulunamadı',
    invalid_text:           'Geçersiz metin',
    on_cooldown:            'Cooldown aktif',
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
