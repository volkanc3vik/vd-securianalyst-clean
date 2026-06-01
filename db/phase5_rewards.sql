-- ════════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — TELEGRAM ÖDÜL GEÇMİŞİ (Phase 5) Supabase migration
-- Ödül motorunun çift ödül vermesini engeller + denetim kaydı tutar.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.tg_rewards (
  id              uuid primary key default gen_random_uuid(),
  referrer_tg_id  text not null,                 -- ödülü kazanan
  tier            int  not null,                 -- 3 / 10 / 25 (geçerli davet eşiği)
  reward_label    text,                          -- "7 Gün Premium" / "30 Gün Premium" / "Elite Adayı"
  plan_id         text,                          -- weekly / monthly / null (Elite)
  access_code_id  uuid,                          -- access_codes.id (üretilen premium kod) — Elite'te null
  code_preview    text,                          -- KOD ÖNİZLEME (tam kod ASLA tutulmaz)
  granted_at      timestamptz not null default now()
);

-- ÇİFT ÖDÜL ENGELİ: aynı kişi aynı kademeyi 2 kez ALAMAZ
create unique index if not exists uq_tg_rewards_tier
  on public.tg_rewards (referrer_tg_id, tier);

create index if not exists idx_tg_rewards_referrer on public.tg_rewards (referrer_tg_id);

-- service_role yetkisi (tg_users/tg_referrals ile aynı; 403 yaşamayalım)
GRANT ALL ON public.tg_rewards TO service_role, anon, authenticated;
alter table public.tg_rewards disable row level security;

-- (opsiyonel) kullanıcının son kazandığı kademe — hızlı gösterim için
alter table public.tg_users add column if not exists last_reward_tier int;
