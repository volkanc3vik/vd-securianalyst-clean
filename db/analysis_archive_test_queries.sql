-- ═══════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — ANALYSIS ARCHIVE  ·  TEST SORGULARI (Aşama 1)
-- ───────────────────────────────────────────────────────────────────
-- Migration'ı çalıştırdıktan SONRA bunları Supabase SQL Editor'da
-- TEK TEK çalıştırarak doğrula. Her testin beklenen sonucu yazılıdır.
-- ═══════════════════════════════════════════════════════════════════


-- ── TEST 1: Örnek kayıtlar ekle (service role / SQL editor) ─────────
-- Beklenen: 3 satır eklenir. (SQL editor service_role ile çalışır.)
insert into public.analysis_archive
  (sym, timeframe, direction_bias, analysis_text, analysis_summary,
   price_at_analysis, analysis_score, source, market_context)
values
  ('BTCUSDT','15m','bullish',
   'BTC kisa vadede satis baskisi azaldi, likidite alt seviyelerde toplandi.',
   'BTC satis baskisi azaldi', 73500, 82, 'ai_engine',
   '{"regime":"range","vol_score":61}'::jsonb),
  ('ETHUSDT','1h','bearish',
   'ETH momentum zayifliyor, ust direncte tepki riski.',
   'ETH momentum zayif', 3850, 88, 'ai_engine',
   '{"regime":"down","vol_score":54}'::jsonb),
  ('SOLUSDT','4h','neutral',
   'SOL yatay sikisma, yon netlesene kadar bekleme.',
   'SOL yatay sikisma', 168, 91, 'ti_setup',
   '{"regime":"range","maturity":92}'::jsonb);


-- ── TEST 2: review_status'u güncelle (mutable alan — İZİN VERİLMELİ) ─
-- Beklenen: BAŞARILI. review alanları güncellenebilir.
update public.analysis_archive
set review_status = 'validated',
    reviewed_at = now(),
    price_at_review = 75200,
    max_move_pct = 3.1, min_move_pct = -0.4, end_move_pct = 2.3,
    direction_realized = 'bullish', validation_score = 87,
    ai_learned = 'Momentum ve likidite gostergeleri daha guclu dogrulandi.'
where sym = 'BTCUSDT';


-- ── TEST 3: ÇEKİRDEK alan güncelleme (immutable — REDDEDİLMELİ) ──────
-- Beklenen: HATA → 'cekirdek analiz alanlari degistirilemez (immutable).'
update public.analysis_archive
set price_at_analysis = 99999
where sym = 'BTCUSDT';


-- ── TEST 4: DELETE (yasak — REDDEDİLMELİ) ───────────────────────────
-- Beklenen: HATA → 'kayitlar silinemez (delete devre disi).'
delete from public.analysis_archive where sym = 'SOLUSDT';


-- ── TEST 5: Public stats RPC ────────────────────────────────────────
-- Beklenen: JSON döner (total_all, validated, pending, validated_pct, ...).
select public.archive_public_stats();


-- ═══════════════════════════════════════════════════════════════════
-- TEST 6: RLS (anon) — Supabase SQL Editor service_role olduğu için
-- RLS'i BYPASS eder. RLS'i gerçekten test etmek için terminal'den curl:
--
--   ANON_KEY="<supabase anon key>"
--   URL="https://affgbrpwuikpqgsapuvh.supabase.co"
--
--   # 6a) Public okuma → SADECE review_status != 'pending' dönmeli
--   curl -s "$URL/rest/v1/analysis_archive?select=sym,review_status" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--   # Beklenen: yalnızca 'validated' BTCUSDT görünür; ETH/SOL (pending) GÖRÜNMEZ.
--
--   # 6b) Anon INSERT → REDDEDİLMELİ (RLS)
--   curl -s -X POST "$URL/rest/v1/analysis_archive" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--        -H "Content-Type: application/json" \
--        -d '{"sym":"XRPUSDT","timeframe":"15m","direction_bias":"bullish","price_at_analysis":1,"source":"ai_engine"}'
--   # Beklenen: 401/403 veya boş — satır EKLENMEZ.
--
--   # 6c) Anon stats RPC → çalışmalı (aggregate, satır sızdırmaz)
--   curl -s -X POST "$URL/rest/v1/rpc/archive_public_stats" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--        -H "Content-Type: application/json" -d '{}'
--   # Beklenen: pending sayısı dahil JSON; ama pending SATIRLARI dönmez.
-- ═══════════════════════════════════════════════════════════════════
