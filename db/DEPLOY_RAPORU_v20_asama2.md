# 📦 VD SecuriAnalyst — Analysis Intelligence Center · AŞAMA 2 Deploy Raporu (v20)

**Aşama 2 kapsamı:** Public `archive.html` sayfası — Hero, Statistics, Filtreler, Archive Feed (pagination), Detail Modal, footer linki. Admin paneli ve Telegram bu aşamada YOK (mimari hazır, pasif).

---

## 1. DEĞİŞEN / YENİ DOSYALAR

| Dosya | Durum | Açıklama |
|---|---|---|
| `archive.html` | 🆕 | Analysis Intelligence Center sayfası (kök dizinde). |
| `styles/archive.css` | 🆕 | Cinematic tema (cyan/blue, mor yok), mobil öncelikli, terminal hissi. |
| `ui/archive/archive-card.js` | 🆕 | Kart render + ortak util (format, durum/yön etiketleri). İlk yüklenir. |
| `ui/archive/archive-modal.js` | 🆕 | Detay modalı (13 alan), ESC/dış tıklama/focus, Telegram slotu gizli. |
| `ui/archive/archive-stats.js` | 🆕 | 6 stat kartı (RPC). Düşük örneklemde oran "—" (yanıltıcı %100 engeli). |
| `ui/archive/archive-filters.js` | 🆕 | Dinamik coin (RPC) + durum + zaman (created_at) filtreleri. |
| `ui/archive/archive-feed.js` | 🆕 | Sayfalı feed (Daha Fazla Yükle), boş/yükleniyor durumları. |
| `ui/archive/archive-controller.js` | 🆕 | Orkestratör + deep-link (#id=). En son yüklenir. |
| `db/analysis_archive_distinct_coins_v20.sql` | 🆕 | Coin filtresi için dinamik distinct-coin RPC. |
| `services/supabase-service.js` | ✏️ | `listArchive`'e offset (pagination) + `getArchiveCoins()` eklendi. |
| `ui/legal/footer.js` | ✏️ | Ana site footer'ına "Analiz Arşivi" linki eklendi. |

> `index.html` **DEĞİŞMEDİ.** `archive.html` kendi cinematic footer'ına sahip; `footer.js` yüklemez (çift footer olmaz). Mevcut signals/learning teknik borcu uyandırılmadı — `archive.html`'de `learning-engine` yüklenmediği için `supabase-service.js` sadece arşiv okuması yapar, izole kalır.

---

## 2. SUPABASE'DE MANUEL ÇALIŞTIRMAN GEREKEN SQL

1. Supabase → **SQL Editor** → `db/analysis_archive_distinct_coins_v20.sql` içeriğini yapıştır → **Run**.
   - Bu sadece `archive_distinct_coins()` RPC'sini ekler (Aşama 1'deki tablo/trigger/RLS zaten kurulu).
2. (Opsiyonel) Doğrulama: `select * from public.archive_distinct_coins();`
   - Yalnızca `review_status != 'pending'` kayıtların coin'leri + adetleri dönmeli.

> Veri yoksa sayfa "boş durum" gösterir — bu normaldir. Test için Aşama 1'deki insert örnekleriyle birkaç kayıt ekleyip bazılarını `validated` yapabilirsin.

---

## 3. DEPLOY ADIMLARI

1. **Önce SQL'i çalıştır** (madde 2).
2. `DELTA_v20.zip` içindeki dosyaları GitHub repo'na **aynı klasör yapısıyla** yükle (üzerine yaz).
3. Commit önerisi: `Add Analysis Intelligence Center page (Phase 2): archive.html + components, dynamic coin RPC, footer link`
4. Vercel otomatik deploy'u bekle.
5. **Doğrulama (canlı):**
   - `siteadresin/archive.html` açılıyor mu?
   - Stat kartları, filtreler, feed görünüyor mu?
   - Bir karta tıkla → modal açılıyor, 13 alan + AI Learned görünüyor mu?
   - Filtre değiştir (coin/durum/zaman) → liste güncelleniyor mu?
   - Ana sayfa footer'ında "Analiz Arşivi" linki `archive.html`'e gidiyor mu?
   - Konsolda **kod hatası** olmamalı.

---

## 4. KOD KONTROLLERİ (yapıldı ✅)

Gerçek Chromium (headless) + mock veriyle test edildi:

- ✅ **Syntax:** 11 JS dosyası `node --check` ile temiz.
- ✅ **Console:** Kod hatası yok. (Tek 403 → `fonts.googleapis.com`; bu ortam sandbox'ının dış font engeli, production'da yüklenir, engellense bile sistem fontuna düşer.)
- ✅ **DOM render:** 6 stat kartı, 4 feed kartı, 2 filtre select, 4 zaman butonu, dinamik coin seçenekleri.
- ✅ **Modal:** açılıyor (10 KV hücresi + AI Learned), ESC ile kapanıyor.
- ✅ **Filtre:** durum=Doğrulanmadı → yalnızca SOLUSDT kartı.
- ✅ **Responsive:** masaüstü 6 sütun · ≤860px 3 sütun · ≤480px 2 sütun stat; mobilde filtreler dikey, modal alttan açılan tam ekran sheet, KV tek sütun.

---

## 5. TASARIM KURALLARINA UYUM

- ✅ Cinematic tema korundu (koyu zemin, cyan/blue radial ışık, holografik grid, cam paneller).
- ✅ Cyan/blue renk sistemi; **mor yok** (legal-shared.css'in mor token'ı kullanılmadı — bağımsız `--v4-*` token seti).
- ✅ Mobil öncelikli; Bloomberg/terminal hissi (mono `tabular-nums` sayılar, hizalı veri).
- ✅ Abartılı neon yok; subtle hover (hafif yukarı kayma + ince border parlaması).
- ✅ Pending public'te görünmez (RLS); Not Validated gizlenmez (şeffaflık); stat altında hukuki mikro-not.
- ✅ Pagination (Daha Fazla Yükle); infinite scroll yok.

---

## 6. GELECEK AŞAMALAR İÇİN HAZIR BIRAKILANLAR

- Modal içinde `data-aic-tg-slot` (gizli) → Aşama 4 Telegram paylaşım butonu buraya gelecek.
- `#aic-advanced-stats` (hidden section) → ileride gelişmiş istatistikler.
- Bileşenler gevşek bağlı; admin paneli (Aşama 3) eklenirken public sayfa kodu değişmeyecek.

---

## 7. SONRAKİ AŞAMA

**Aşama 3:** Admin Review Panel + `api/analysis-archive.js` (service role) — admin not ekleme, review düzeltme, kayıt yönetimi. Public sayfaya dokunmadan.

Bu aşamayı deploy edip canlı doğruladıktan sonra "Aşama 3 başla" de.
