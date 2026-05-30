-- ═══════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — ANALYSIS ARCHIVE  ·  MIGRATION v20 (Aşama 2 eki)
-- ───────────────────────────────────────────────────────────────────
-- Coin filtresi için DİNAMİK distinct-coin listesi.
-- Bu dosyanın tamamını Supabase SQL Editor'a yapıştırıp BİR KEZ çalıştır.
--
-- archive_distinct_coins():
--   - SADECE public görünür (review_status != 'pending') kayıtlardaki
--     coin'leri döner. Yani filtre, halka açık veride olmayan coin'i listelemez.
--   - SECURITY DEFINER: sayım/distinct işini güvenli yapar, satır sızdırmaz.
--   - Dönen alanlar: sym + o coin'deki public kayıt sayısı (cnt) — sayıya göre sıralı.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.archive_distinct_coins()
returns table(sym text, cnt bigint)
language sql
security definer
set search_path = public
as $$
  select sym, count(*) as cnt
  from public.analysis_archive
  where review_status <> 'pending'
  group by sym
  order by cnt desc, sym asc;
$$;

grant execute on function public.archive_distinct_coins() to anon, authenticated;

-- ── Doğrulama (opsiyonel) ──────────────────────────────────────────
-- select * from public.archive_distinct_coins();
-- Beklenen: yalnızca review tamamlanmış kayıtların coin'leri + adetleri.
