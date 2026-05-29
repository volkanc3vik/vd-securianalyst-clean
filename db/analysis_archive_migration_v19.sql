-- ═══════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — ANALYSIS ARCHIVE  ·  MIGRATION v19 (Aşama 1)
-- ───────────────────────────────────────────────────────────────────
-- Bu dosyanın TAMAMINI Supabase SQL Editor'a yapıştırıp BİR KEZ çalıştır.
-- İçerik:
--   1) analysis_archive tablosu
--   2) Immutable trigger (çekirdek alanlar UPDATE ile değişemez)
--   3) Delete-prevention trigger (kayıtlar SİLİNEMEZ)
--   4) RLS politikaları (public yalnızca review_status != 'pending' okur)
--   5) Public stats RPC (pending sayısını satır sızdırmadan döner)
--
-- NOT: Idempotent yazılmıştır — tekrar çalıştırmak güvenlidir.
-- NOT: Yazma (insert/update) yalnızca service_role ile yapılır (Aşama 3
--      backend endpoint). Anon key ile yazma RLS tarafından reddedilir.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- 1) TABLO
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.analysis_archive (
  id                  uuid primary key default gen_random_uuid(),

  -- ── ÇEKİRDEK (IMMUTABLE — insert sonrası değiştirilemez) ──────────
  sym                 text        not null,
  timeframe           text        not null,
  direction_bias      text        not null
                        check (direction_bias in ('bullish','bearish','neutral')),
  analysis_text       text,
  analysis_summary    text,
  price_at_analysis   numeric     not null,
  market_context      jsonb       not null default '{}'::jsonb,
  analysis_score      numeric,
  source              text        not null
                        check (source in ('ai_engine','ti_setup')),
  created_at          timestamptz not null default now(),

  -- ── REVIEW (mutable — review motoru/admin sonradan doldurur) ──────
  review_status       text        not null default 'pending'
                        check (review_status in
                          ('pending','validated','partially_validated','not_validated')),
  reviewed_at         timestamptz,
  review_due_at       timestamptz,           -- created_at + reviewWindows[timeframe]
  review_window_hours numeric,
  price_at_review     numeric,
  max_price_window    numeric,               -- pencere içi en yüksek
  min_price_window    numeric,               -- pencere içi en düşük
  max_move_pct        numeric,               -- analiz fiyatına göre max %
  min_move_pct        numeric,               -- analiz fiyatına göre min %
  end_move_pct        numeric,               -- pencere sonu %
  result_percent      numeric,               -- özet sonuç % (genelde end_move_pct)
  direction_realized  text
                        check (direction_realized in ('bullish','bearish','neutral')),
  validation_score    numeric,               -- 0-100 tutarlılık skoru
  review_source       text        default 'auto'
                        check (review_source in ('auto','manual')),

  -- ── ADMIN / LEARNING (mutable) ────────────────────────────────────
  admin_note          text,                  -- admin manuel not
  ai_learned          text,                  -- learning-engine mantığından üretilir
  ai_review_note      text,                  -- v1: NULL kalır (ücretli AI yok)
  admin_archived      boolean     not null default false,
                        -- SADECE admin panel görünümünü etkiler; public'i ETKİLEMEZ

  -- ── TELEGRAM (Aşama 4) ────────────────────────────────────────────
  shared_to_telegram  boolean     not null default false,
  telegram_msg_id     bigint
);

comment on table public.analysis_archive is
  'AI analiz şeffaflık arşivi. Çekirdek alanlar immutable, kayıtlar silinemez. Public yalnızca review_status != pending görür.';

-- ── Indexler ──────────────────────────────────────────────────────
create index if not exists idx_aa_review_status on public.analysis_archive(review_status);
create index if not exists idx_aa_sym           on public.analysis_archive(sym);
create index if not exists idx_aa_created        on public.analysis_archive(created_at desc);
create index if not exists idx_aa_due_pending    on public.analysis_archive(review_due_at)
                                                  where review_status = 'pending';


-- ───────────────────────────────────────────────────────────────────
-- 2) IMMUTABLE TRIGGER — çekirdek alanlar UPDATE ile değiştirilemez
--    (service_role dahil HERKES için geçerli; bütünlük garantisi)
-- ───────────────────────────────────────────────────────────────────
create or replace function public.analysis_archive_prevent_core_update()
returns trigger
language plpgsql
as $$
begin
  if  NEW.sym               is distinct from OLD.sym
   or NEW.timeframe         is distinct from OLD.timeframe
   or NEW.direction_bias    is distinct from OLD.direction_bias
   or NEW.analysis_text     is distinct from OLD.analysis_text
   or NEW.analysis_summary  is distinct from OLD.analysis_summary
   or NEW.price_at_analysis is distinct from OLD.price_at_analysis
   or NEW.market_context    is distinct from OLD.market_context
   or NEW.analysis_score    is distinct from OLD.analysis_score
   or NEW.source            is distinct from OLD.source
   or NEW.created_at        is distinct from OLD.created_at
  then
    raise exception
      'analysis_archive: cekirdek analiz alanlari degistirilemez (immutable).';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_aa_immutable on public.analysis_archive;
create trigger trg_aa_immutable
  before update on public.analysis_archive
  for each row execute function public.analysis_archive_prevent_core_update();


-- ───────────────────────────────────────────────────────────────────
-- 3) DELETE-PREVENTION TRIGGER — kayıtlar SİLİNEMEZ (hard/soft delete yok)
--    Kötü çıkan analizler de arşivde kalır = şeffaflık.
--    (service_role dahil HERKES için geçerli)
-- ───────────────────────────────────────────────────────────────────
create or replace function public.analysis_archive_prevent_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'analysis_archive: kayitlar silinemez (delete devre disi).';
end;
$$;

drop trigger if exists trg_aa_no_delete on public.analysis_archive;
create trigger trg_aa_no_delete
  before delete on public.analysis_archive
  for each row execute function public.analysis_archive_prevent_delete();


-- ───────────────────────────────────────────────────────────────────
-- 4) RLS — Row Level Security
--    Public (anon/authenticated): SADECE review_status != 'pending' SELECT.
--    INSERT/UPDATE/DELETE için anon politikası YOK → default deny.
--    service_role RLS'i bypass eder → backend yazabilir (delete trigger hariç).
-- ───────────────────────────────────────────────────────────────────
alter table public.analysis_archive enable row level security;

-- Eski politikaları temizle (idempotent)
drop policy if exists aa_public_read_reviewed on public.analysis_archive;

-- Public okuma: yalnızca review tamamlanmış kayıtlar
create policy aa_public_read_reviewed
  on public.analysis_archive
  for select
  to anon, authenticated
  using (review_status <> 'pending');

-- Bilerek INSERT/UPDATE/DELETE politikası TANIMLANMADI.
-- RLS default-deny olduğu için anon/authenticated yazamaz/silemez/güncelleyemez.
-- Tüm yazma service_role (backend) üzerinden yapılır.

-- ── Tablo-seviyesi yetkiler (Supabase varsayılanına BAĞLI KALMA) ──────
-- İki katman güvenlik: (1) anon'a SADECE SELECT grant'i, (2) RLS USING.
-- anon/authenticated'a INSERT/UPDATE/DELETE grant'i bilerek VERİLMEZ.
revoke all on public.analysis_archive from anon, authenticated;
grant  usage  on schema public to anon, authenticated, service_role;
grant  select on public.analysis_archive to anon, authenticated;
grant  all    on public.analysis_archive to service_role;


-- ───────────────────────────────────────────────────────────────────
-- 5) PUBLIC STATS RPC — istatistik kartları için
--    SECURITY DEFINER: pending SAYISINI döner ama pending SATIRLARINI sızdırmaz.
--    Sadece toplam sayılar/oranlar; satır verisi dönmez.
-- ───────────────────────────────────────────────────────────────────
create or replace function public.archive_public_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'total_all',         count(*),
    'total_reviewed',    count(*) filter (where review_status <> 'pending'),
    'validated',         count(*) filter (where review_status = 'validated'),
    'partial',           count(*) filter (where review_status = 'partially_validated'),
    'not_validated',     count(*) filter (where review_status = 'not_validated'),
    'pending',           count(*) filter (where review_status = 'pending'),
    'validated_pct',
        case when count(*) filter (where review_status <> 'pending') > 0
             then round(100.0 * count(*) filter (where review_status = 'validated')
                        / count(*) filter (where review_status <> 'pending'), 1)
             else null end,
    'partial_pct',
        case when count(*) filter (where review_status <> 'pending') > 0
             then round(100.0 * count(*) filter (where review_status = 'partially_validated')
                        / count(*) filter (where review_status <> 'pending'), 1)
             else null end,
    'top_sym',
        (select sym from public.analysis_archive
          group by sym order by count(*) desc limit 1),
    'last_validated_at',
        (select max(reviewed_at) from public.analysis_archive
          where review_status = 'validated')
  )
  from public.analysis_archive;
$$;

grant execute on function public.archive_public_stats() to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION SONU
-- Doğrulama için aşağıdaki test sorgularını ayrıca çalıştırabilirsin
-- (db/analysis_archive_test_queries.sql dosyasına bak).
-- ═══════════════════════════════════════════════════════════════════
