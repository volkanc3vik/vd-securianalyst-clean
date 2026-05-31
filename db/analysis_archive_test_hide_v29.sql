-- ════════════════════════════════════════════════════════════════════
-- TEST DATA SOFT-HIDE (v29) — eski SQL seed kayıtlarını gizle
--
-- NEDEN: ETHUSDT $3850 / SOLUSDT $168 gibi kayıtlar eski test seed'leri.
--   Gerçek Telegram kaydı DEĞİLLER. Ayırt edici: gerçek otomatik kayıtlarda
--   market_context.origin = 'telegram_signal' VE telegram_msg_id dolu.
--   Test seed'lerinde ikisi de yok.
--
-- YÖNTEM (en güvenli): YENİ KOLON YOK, DELETE YOK (no-delete trigger korunur).
--   Mevcut `admin_archived boolean` (v19) soft-hide bayrağı olarak kullanılır.
--   admin_archived immutable trigger kapsamı DIŞINDA → UPDATE edilebilir.
--
-- ETKİ: admin_archived=true olan kayıtlar
--   - Bekleyen İncelemeler panelinde GÖRÜNMEZ (endpoint filtresi)
--   - Public feed'de GÖRÜNMEZ (client filtresi)
--   - Stats (Toplam/Bekleyen) SAYMAZ (aşağıdaki RPC güncellemesi)
--   - Satır SİLİNMEZ (geri alınabilir: admin_archived=false)
-- ════════════════════════════════════════════════════════════════════

-- ── ADIM 0 (ÖNİZLEME — önce bunu çalıştırıp hangi satırların etkileneceğini gör) ──
-- select id, sym, price_at_analysis, review_status, telegram_msg_id,
--        market_context->>'origin' as origin, created_at
--   from public.analysis_archive
--  where review_status = 'pending'
--    and telegram_msg_id is null
--    and coalesce(market_context->>'origin','') <> 'telegram_signal';

-- ── ADIM 1: Test/seed PENDING kayıtları soft-hide ──
-- Yalnızca: pending + telegram_msg_id YOK + origin 'telegram_signal' DEĞİL
-- (Gerçek Telegram pending kayıtları origin='telegram_signal' taşıdığı için ETKİLENMEZ.
--  Gerçek 'validated' BTC kaydı pending OLMADIĞI için ETKİLENMEZ.)
update public.analysis_archive
set admin_archived = true
where review_status = 'pending'
  and telegram_msg_id is null
  and coalesce(market_context->>'origin','') <> 'telegram_signal';

-- (İsteğe bağlı) Belirli ID'leri elle gizlemek istersen:
-- update public.analysis_archive set admin_archived = true
--   where id in ('<eth-test-id>','<sol-test-id>');

-- ── ADIM 2: Stats RPC'si archived kayıtları SAYMASIN ──
-- CREATE OR REPLACE — tablo/trigger/şema DEĞİŞMEZ, yalnızca fonksiyon gövdesi.
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
          where admin_archived is not true
          group by sym order by count(*) desc limit 1),
    'last_validated_at',
        (select max(reviewed_at) from public.analysis_archive
          where review_status = 'validated' and admin_archived is not true)
  )
  from public.analysis_archive
  where admin_archived is not true;   -- ← archived/test kayıtlar sayıma girmez
$$;

grant execute on function public.archive_public_stats() to anon, authenticated;

-- ── DOĞRULAMA ──
-- select archive_public_stats();   -- total_all / pending artık test'siz sayar
-- Geri almak için: update public.analysis_archive set admin_archived=false where ...;
