# 📦 VD SecuriAnalyst — Analysis Archive · AŞAMA 1 Deploy Raporu (v19)

**Aşama 1 kapsamı:** Yalnızca **veri katmanı**. UI yok, Telegram yok, footer yok, disclaimer yok.
Hedef: `analysis_archive` tablosu + bütünlük kuralları + RLS + config + okuma fonksiyonları.

---

## 1. DEĞİŞEN / YENİ DOSYALAR

| Dosya | Durum | Açıklama |
|---|---|---|
| `db/analysis_archive_migration_v19.sql` | 🆕 YENİ | Tablo + 2 trigger + RLS + grants + stats RPC. Supabase'de 1 kez çalıştırılır. |
| `db/analysis_archive_test_queries.sql` | 🆕 YENİ | Doğrulama sorguları (immutable, delete-prevent, RLS, stats). |
| `modules/archive-config.js` | 🆕 YENİ | Merkezi config (eşikler, cooldown, review pencereleri, sabitler). Derin dondurulmuş. |
| `services/supabase-service.js` | ✏️ DEĞİŞTİ | `listArchive`, `getArchiveById`, `getArchiveStats` okuma fonksiyonları eklendi. |

> `index.html` **DEĞİŞMEDİ.** Aşama 1'de hiçbir script tag/UI eklenmedi (talimat gereği).

---

## 2. SUPABASE'DE MANUEL ÇALIŞTIRMAN GEREKEN SQL

1. Supabase paneli → **SQL Editor** → **New query**
2. `db/analysis_archive_migration_v19.sql` dosyasının **tamamını** yapıştır → **Run**.
   - Idempotent yazıldı; tekrar çalıştırmak güvenli. `NOTICE ... skipping` mesajları normaldir.
3. Doğrulama için `db/analysis_archive_test_queries.sql` içindeki testleri **tek tek** çalıştır.
   - TEST 3 (immutable) ve TEST 4 (delete) **HATA vermeli** — bu beklenen ve doğru davranıştır.
   - RLS'i gerçek anon ile test etmek için dosyadaki **curl (TEST 6)** komutlarını kullan.

**Migration ne kuruyor:**
- `analysis_archive` tablosu (çekirdek + review + admin + telegram alanları)
- **Immutable trigger:** `sym, timeframe, direction_bias, analysis_text, analysis_summary, price_at_analysis, market_context, analysis_score, source, created_at` UPDATE ile değişemez (service_role dahil).
- **Delete-prevention trigger:** hiçbir kayıt silinemez (service_role dahil).
- **RLS:** public (anon/authenticated) yalnızca `review_status != 'pending'` SELECT eder.
- **Grants:** anon'a SADECE SELECT; yazma yalnızca service_role.
- **`archive_public_stats()` RPC:** pending sayısı dahil istatistikleri satır sızdırmadan döner.

---

## 3. DEPLOY ADIMLARI

> ⚠ Aşama 1 öncelikle **veritabanı** aşamasıdır. Site kodu davranışı değişmez.

1. **Önce SQL'i çalıştır** (yukarıdaki 2. madde). Bu en kritik adım.
2. `DELTA_v19.zip` içindeki dosyaları GitHub repo'na **aynı klasör yapısıyla** yükle:
   - `db/analysis_archive_migration_v19.sql`
   - `db/analysis_archive_test_queries.sql`
   - `modules/archive-config.js`
   - `services/supabase-service.js` (üzerine yaz)
3. Commit önerisi: `Add analysis_archive data layer (Phase 1): table, RLS, immutable/delete triggers, config`
4. Vercel otomatik deploy'u bekle.
5. **Doğrulama:** Site açılışında konsol hatası **olmamalı** (yeni dosyalar henüz hiçbir yerden çağrılmıyor, bu normal). `modules/archive-config.js` ve güncellenmiş `services/supabase-service.js` repo'da görünmeli.

> Not: `archive-config.js` ve arşiv okuma fonksiyonları Aşama 1'de **hiçbir sayfadan yüklenmiyor**. Bunlar Aşama 2'de `archive.html` tarafından kullanılacak. Bu bilinçli bir tercih — Aşama 1 sadece temeli atar.

---

## 4. TEST LİSTESİ (yapıldı ✅ / senin yapman gereken ☐)

**Yerel PostgreSQL 16'da kanıtlandı:**
- ✅ Tablo + indexler + 2 trigger + RLS + RPC hatasız kuruldu.
- ✅ review alanı güncelleme **başarılı** (mutable).
- ✅ Çekirdek alan güncelleme **reddedildi** (immutable trigger).
- ✅ DELETE **reddedildi** (delete-prevention trigger).
- ✅ Anon SELECT yalnızca `validated` kaydı gördü; pending'ler **görünmedi**.
- ✅ Anon INSERT/UPDATE/DELETE **reddedildi** (grant + RLS, iki katman).
- ✅ Anon stats RPC `pending=2` döndü ama pending **satırları** sızmadı.
- ✅ service_role hepsini (3 kayıt) gördü.
- ✅ `archive-config.js` JS syntax + derin dondurma (mutasyon engellendi) doğrulandı.
- ✅ `supabase-service.js` JS syntax temiz.

**Senin Supabase'de yapman gereken (☐):**
- ☐ Migration'ı çalıştır, hata almadığını gör.
- ☐ Test sorgularını çalıştır; TEST 3 ve 4'ün hata verdiğini doğrula.
- ☐ Dosyadaki curl komutlarıyla gerçek anon RLS davranışını doğrula (anon pending göremez, yazamaz).
- ☐ Vercel deploy sonrası konsolda hata olmadığını kontrol et.

---

## 5. SONRAKİ AŞAMA (önizleme — henüz yapılmadı)

**Aşama 2:** `archive.html` public sayfa (filtre, liste, stats kartları, modal detay) + footer linki.
Aşama 2'ye geçmeden önce: bu aşamayı deploy et, SQL'i çalıştır, testleri onayla → sonra "Aşama 2 başla" de.
