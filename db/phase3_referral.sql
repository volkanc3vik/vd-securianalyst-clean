-- ════════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — TELEGRAM REFERRAL (Phase 3) Supabase migration
-- Sadece referral KAYIT altyapısı. Ödül YOK (Phase 4/5).
-- Supabase SQL Editor'da çalıştır.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ── Telegram kullanıcıları (botu açanlar) ──
create table if not exists public.tg_users (
  id                  uuid primary key default gen_random_uuid(),
  tg_id               text unique not null,           -- Telegram user id
  username            text,
  first_name          text,
  invite_link         text,                           -- createChatInviteLink çıktısı (kişiye özel)
  invite_link_name    text,                           -- "ref_<tg_id>"
  invite_count        int not null default 0,         -- linkten giren toplam kişi
  valid_invite_count  int not null default 0,         -- 48s sonra hâlâ üye olanlar (Phase 4/5 doldurur)
  reward_tier         text,                           -- Phase 5'te kullanılacak (şimdilik null)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_tg_users_invite_link on public.tg_users (invite_link);

-- ── Referral kayıtları (kim kimi getirdi) ──
create table if not exists public.tg_referrals (
  id                   uuid primary key default gen_random_uuid(),
  referrer_tg_id       text not null,                 -- davet eden
  new_member_tg_id     text not null,                 -- davet edilen
  new_member_username  text,
  invite_link          text,                          -- hangi linkle girdi
  joined_at            timestamptz not null default now(),
  left_at              timestamptz,
  still_member         boolean not null default true,
  is_valid             boolean not null default false, -- 48s + hâlâ üye → Phase 4/5'te true
  valid_after          timestamptz,                    -- joined_at + 48 saat
  created_at           timestamptz not null default now()
);

-- DEDUP: aynı (referrer, new_member) ikilisi tekrar tekrar SAYILMASIN
create unique index if not exists uq_tg_referrals_pair
  on public.tg_referrals (referrer_tg_id, new_member_tg_id);

create index if not exists idx_tg_referrals_referrer on public.tg_referrals (referrer_tg_id);
create index if not exists idx_tg_referrals_validity on public.tg_referrals (still_member, is_valid, valid_after);

-- ── updated_at otomatik güncelleme (tg_users) ──
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_tg_users_touch on public.tg_users;
create trigger trg_tg_users_touch before update on public.tg_users
  for each row execute function public.tg_touch_updated_at();

-- NOT: Bu tablolara SADECE sunucu (service_role) yazar; RLS açıp public erişimi
-- kapatmak istersen (önerilir, anon key tarayıcıdaysa):
-- alter table public.tg_users   enable row level security;
-- alter table public.tg_referrals enable row level security;
-- (service_role RLS'i bypass eder; webhook service_role kullandığı için etkilenmez.)
