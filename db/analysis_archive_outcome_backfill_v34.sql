-- ════════════════════════════════════════════════════════════════════
-- OUTCOME TRACKING Faz 1 — OPSİYONEL BACKFILL (mevcut pending kayıtlar)
--
-- YENİ kayıtlar review_window_hours + review_due_at'ı create sırasında
-- otomatik alıyor (endpoint). Bu betik, BU DEĞİŞİKLİKTEN ÖNCE oluşmuş ve
-- review_due_at'ı NULL olan pending kayıtlara aynı zamanlamayı geriye dönük
-- uygular. ZORUNLU DEĞİL — çalıştırmazsan eski kayıtlar "⏳ Beklemede" kalır.
--
-- Migration YOK (kolonlar v19'da zaten var). Yalnızca UPDATE.
-- review_window_hours/review_due_at immutable trigger kapsamı DIŞINDA → güvenli.
-- Hesaplama YOK (Binance/move/score yok). Sadece pencere + due zamanı.
-- ════════════════════════════════════════════════════════════════════

-- ── ÖNİZLEME (önce çalıştır) ──
-- select id, sym, timeframe, created_at, review_due_at
--   from public.analysis_archive
--  where review_status = 'pending' and review_due_at is null;

-- ── BACKFILL ──
-- timeframe → pencere (saat): 15m/kısa→24, 1h→48, 4h→72, 1D+→168, diğer→48
update public.analysis_archive
set
  review_window_hours = w.hrs,
  review_due_at       = created_at + (w.hrs || ' hours')::interval
from (
  select id,
    case
      when lower(coalesce(timeframe,'')) ~ '^(1m|3m|5m|15m|30m|45m)$' then 24
      when lower(coalesce(timeframe,'')) ~ '^(1h|2h)$'                then 48
      when lower(coalesce(timeframe,'')) ~ '^(4h|6h|8h|12h)$'        then 72
      when lower(coalesce(timeframe,'')) ~ '^(1d|2d|3d|1w|1week|daily)$' then 168
      else 48
    end as hrs
  from public.analysis_archive
  where review_status = 'pending' and review_due_at is null
) w
where public.analysis_archive.id = w.id;

-- ── DOĞRULAMA ──
-- select sym, timeframe, review_window_hours, review_due_at,
--        (review_due_at <= now()) as outcome_ready
--   from public.analysis_archive
--  where review_status = 'pending' order by review_due_at asc nulls last;
