# AUTO-TRACK — Scanner setup'ları otomatik arşiv takibine

## Sorunun kök sebebi
`engines/archive/archive-signal-bridge.js` SADECE `vd:telegram:sent` olayını dinliyordu.
Yani arşive takip kaydı YALNIZCA sen manuel Telegram'a gönderince açılıyordu. Scanner
otomatik setup bulunca Telegram'a gönderim olmadığı için o olay hiç ateşlenmiyor → takip yok.
(Bu bilinçli bir tasarımdı: sadece yayınlanan sinyaller izleniyordu.)

## Eklenen çözüm (motor/scanner/outcome mantığına DOKUNULMADI)
Yeni dosya: `engines/archive/archive-autotrack-bridge.js`
- `vd:scan:complete` olayını dinler (scanner her 2 dk'da bunu yayıyor: `{detail:{results}}`).
- Eşik üstü (varsayılan **skor ≥ 90**) LONG/SHORT setup'ları, manuel yolun kullandığı
  **AYNI** `adminFetch('/api/analysis-archive',{action:'create',...})` ile pending kayıt açar.
- `index.html`'de signal-bridge'in hemen ardına eklendi (1 satır script).

## Güvenlik / arşivi temiz tutma
- **Sadece admin oturumunda** çalışır (`TelegramDispatcher.hasAdminKey()`). Ziyaretçi tetikleyemez.
- **Skor eşiği** + **tarama başına en çok 4** + **sym|dir cooldown (180 dk)** + endpoint dedup
  → arşiv çöple dolmaz.
- Otomatik kayıtlar `source:'ai_engine_auto'`, `origin:'auto_scan'` ile işaretli → manuelden ayrılır.

## Canlı ayar (Console'dan)
```
window.VD_AUTOTRACK_MIN_SCORE = 85;   // eşiği düşür/yükselt (vars. 90)
window.VD_AUTOTRACK_MAX = 6;          // tarama başına azami (vars. 4)
window.VD_AUTOTRACK_ENABLED = false;  // tamamen kapat
VDArchiveAutoTrack.forceRun();        // son tarama sonucuyla hemen dene (test)
```

## Nasıl test edersin (deploy + admin key sonrası)
1. Deploy et, Ctrl+Shift+R.
2. Admin key'i gir (Telegram admin mode aktif olsun) — auto-track yalnız o zaman çalışır.
3. Console'da bir tarama sonrası `[ARCHIVE_AUTOTRACK]` log'larına bak:
   - "N setup takibe alınıyor → ..." ve "YENİ pending ✓ SYM DIR" görmelisin.
   - "eşik üstü yeni setup yok" görürsen → o taramada 90+ setup çıkmamış, eşiği düşür.
4. Archive sayfasında bekleyen sayısının arttığını gör.

## Önemli notlar (dürüst)
- **Admin key aktif değilse otomatik takip çalışmaz** (güvenlik). Sürekli istiyorsan admin
  oturumunun açık kalması gerekir.
- Otomatik takip arşive daha çok kayıt ekler → doğrulama oranı istatistiğini etkileyebilir.
  Yüksek eşik (90) bunu azaltır; `ai_engine_auto` etiketiyle ayırt edebilirsin.
- Bu ortamda canlı tarayıcı yok; sözdizimi + mantık doğrulandı, gerçek API yanıtı deploy'da görünür.
