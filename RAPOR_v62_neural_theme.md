# RAPOR — v62 · Neural / HUD Tema Dönüşümü

**Tarih:** 31.05.2026
**Sürüm:** v61 → **v62**
**Tür:** Render-only görsel kabuk değişimi (A'dan Z'ye tema)

---

## 1) Özet

Tüm site, onayladığın **Neural / HUD** kimliğine taşındı: saf siyah + ızgara zemin,
neon cyan veri rengi, yön bazlı renk kodu (LONG = yeşil, SHORT = kırmızı, JOKER = amber),
cam paneller ve **tüm panellerde çizgi halinde kayan ışık efekti**. Eski literal
mor/pembe vurgular cyan'a çekildi.

> **Önemli:** Bu paket tamamen **render-only**'dir. Scanner, Intelligence Center
> motorları, Timeline event üretimi, Telegram botu, **Premium kod doğrulama (doLogin)**
> ve Archive/Outcome hesap mantığına **dokunulmamıştır**. Sadece görsel kabuk yenilendi.

---

## 2) Eklenen dosyalar (2)

| Dosya | Görev |
|---|---|
| `styles/theme-neural.css` | Neural tema katmanı. `theme-v2.css`'ten **sonra** yüklenir, cascade'i kazanır. Zemin, cam paneller, neon kenarlar, `.sc-*` analiz kartı stilleri, rejim/joker renkleri, yön kodu, mor temizliği, scrollbar. |
| `scripts/neural-scanline.js` | Panellere **dekoratif** `.nx-scan` kayan-ışık span'i ekleyen idempotent enjektör. `MutationObserver` ile dinamik (scanner) kartları da yakalar. Veri/motor mantığına dokunmaz. |

## 3) Değiştirilen dosyalar (7)

`index.html`, `archive.html`, `timeline.html`, `academy.html`,
`track-record.html`, `translator.html`, `premium.html`

Her birine `</head>` kapanışından **hemen önce** iki satır eklendi:

```html
<link rel="stylesheet" href="styles/theme-neural.css">
<script defer src="scripts/neural-scanline.js"></script>
```

Başka hiçbir HTML satırı değiştirilmedi.

---

## 4) Hangi sınıflar hedeflendi (gerçek koddan)

- **Paneller:** `.panel`, `.glass`, `.market-overview`, `.joker-section`, `.signal-card`, `.intel-*`, `.regime-card`, `.mc`
- **Analiz kartı:** `.sc-sym`, `.sc-stat/.sc-stat-lbl/.sc-stat-val`, `.sc-conf-bar/.sc-conf-item/.sc-conf-dot`, `.sc-ai-comment`, `.sc-missing`, `.sc-timing`, `.sc-tags/.sc-tag-item`, `.sc-grade`, `.sc-ribbon`, `.sc-priority-badge`, `.sc-action`, `.sc-sort-btn`
- **Yön:** `.sc-dir-long/.sc-dir-short`, `[data-dir]`, `.joker-long/.joker-short`
- **Rejim & Joker:** `.regime-badge/.regime-bar/.regime-dot`, `.joker-header/.joker-warning`

## 5) Kayan ışık efekti nasıl çalışıyor

`neural-scanline.js` yüklenince paneli `position:relative` yapar ve içine küçük bir
`<span class="nx-scan">` ekler. CSS'teki `@keyframes nxSweep` bu çizgiyi soldan sağa
kaydırır. Her panele küçük faz farkı verilir → dalga gibi akar. Yön bilgisine göre
renk varyantı seçilir (`nx-scan-gn/rd/am`). `prefers-reduced-motion` açıksa animasyon durur.

## 6) Mor/pembe temizliği

`theme-v2.css` zaten `--purple → cyan` remap'i yapıyordu; bu katman kalan literal
`#9d7dfa / #a78bfa / #b39dfa / #8b5cf6` ve `rgba(157,125,250,…)` metin renklerini de
cyan'a çekiyor. Markalı SVG ikonları (ör. Instagram) korunur.

---

## 7) Test notu (şeffaflık)

Tema saf CSS + küçük bir dekoratif script olduğu için tarayıcıda sorunsuz çalışır.
Bu ortamda **canlı Puppeteer ekran görüntüsü üretilemedi**, çünkü site Supabase + `/api/*`
serverless uçlarına ve gerçek veriye bağlı; sandbox'ta tam uygulama ayağa kalkmıyor ve
headless tarayıcı indirimi engelli. Bu nedenle teslimata, Neural temasındaki analiz
kartının **premium** ve **free (kilitli)** hallerini gösteren iki tasarım önizlemesi
(PNG) eklendi:

- `v62_neural_premium.png`
- `v62_neural_free.png`

Deploy sonrası (Vercel) gerçek ekran görüntülerini doğrulamanı öneririm; istersen Academy /
Track Record / Timeline / mobil için de ayrıca önizleme çıkarırım.

## 8) Geri alma

Tema tek satırla kapatılabilir: ilgili sayfadaki `theme-neural.css` ve
`neural-scanline.js` satırlarını silmek yeterli — motor/veri etkilenmez.
