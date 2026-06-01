-- ════════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — CONTENT ENGINE FORMAT REVISION (Phase 6b)
-- Analiz postunda üretilen "Beklenti Bölgesi"ni saklar ki doğrulama
-- postunda beklenen vs gerçekleşen karşılaştırılabilsin. Archive mantığına dokunmaz.
-- ════════════════════════════════════════════════════════════════════

alter table public.analysis_archive
  add column if not exists tg_exp_lo  numeric,   -- beklenti bandı alt %
  add column if not exists tg_exp_hi  numeric,   -- beklenti bandı üst %
  add column if not exists tg_exp_pct numeric;   -- işaretli orta beklenti % (doğrulamada gösterilir)
