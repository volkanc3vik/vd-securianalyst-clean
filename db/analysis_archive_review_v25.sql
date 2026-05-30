-- ════════════════════════════════════════════════════════════════════
-- analysis_archive · Aşama 4 migration (v25)
--   1) Eksik kolonlar: internal_review, shared_at
--   2) Güvenlik: anon SADECE public-güvenli kolonları okuyabilsin
--      (admin_note / internal_review / ai_review_note anon'a KAPALI)
--
-- NOT: review_status check'i DEĞİŞMEZ. UI "Rejected" → 'not_validated' map'lenir.
-- NOT: Yazma yalnızca service_role (api/analysis-archive.js) ile yapılır.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) Eksik kolonlar (immutable trigger kapsamı DIŞINDA → güncellenebilir) ──
alter table public.analysis_archive
  add column if not exists internal_review text,
  add column if not exists shared_at        timestamptz;

comment on column public.analysis_archive.internal_review is
  'Admin iç değerlendirme notu. ANON OKUYAMAZ (yalnızca service_role).';
comment on column public.analysis_archive.shared_at is
  'Telegram paylaşım zaman damgası (mark_shared ile set edilir).';

-- ── 2) Kolon-seviyesi okuma güvenliği ───────────────────────────────
-- Önce tablo-seviyesi anon SELECT'i kaldır, sonra yalnızca public-güvenli
-- kolonlar için SELECT ver. Böylece anon hiçbir koşulda admin_note /
-- internal_review / ai_review_note OKUYAMAZ (RLS satır filtresi de ayrıca geçerli).
revoke select on public.analysis_archive from anon;

grant select (
  id, sym, timeframe, direction_bias,
  analysis_text, analysis_summary,
  price_at_analysis, market_context, analysis_score, source, created_at,
  review_status, reviewed_at, review_due_at, review_window_hours,
  price_at_review, max_price_window, min_price_window,
  max_move_pct, min_move_pct, end_move_pct, result_percent,
  direction_realized, validation_score, review_source,
  ai_learned, admin_archived,
  shared_to_telegram, telegram_msg_id, shared_at
) on public.analysis_archive to anon;

-- (authenticated rolüne de aynı güvenli kolon setini vermek istersen:)
-- revoke select on public.analysis_archive from authenticated;
-- grant select ( ...aynı liste... ) on public.analysis_archive to authenticated;

-- ── DOĞRULAMA SORGULARI (manuel) ────────────────────────────────────
-- 1) Kolonlar eklendi mi?
--    select column_name from information_schema.columns
--      where table_name='analysis_archive'
--        and column_name in ('internal_review','shared_at');
-- 2) anon admin_note OKUYAMAMALI:
--    set role anon;
--    select admin_note from public.analysis_archive limit 1;   -- permission denied beklenir
--    reset role;
-- 3) anon güvenli kolonları OKUYABİLMELİ:
--    set role anon;
--    select id, sym, review_status from public.analysis_archive
--      where review_status <> 'pending' limit 1;               -- çalışmalı
--    reset role;
