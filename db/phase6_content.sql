-- ════════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — TELEGRAM CONTENT ENGINE (Phase 6) migration
-- analysis_archive'a SADECE dedup bayrağı ekler (archive MANTIĞINA dokunmaz).
-- ════════════════════════════════════════════════════════════════════

-- doğrulama postu bir kez atılsın diye işaret
alter table public.analysis_archive
  add column if not exists tg_validation_posted boolean not null default false;

-- (shared_to_telegram zaten var — analiz postu dedup'ı için onu kullanıyoruz)
create index if not exists idx_archive_tg_content
  on public.analysis_archive (shared_to_telegram, tg_validation_posted, analysis_score);
