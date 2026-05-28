-- ═══════════════════════════════════════════════════════════════════
-- VD SecuriAnalyst — ACCESS CODE V2 — Parça 1 Migration
-- Supabase SQL Editor'de TEK SEFERDE çalıştır.
-- Eski 'sifre' tablosu SİLİNMEZ — yedek + manuel kullanım için kalır,
-- ve modern (gir-çık) mantık kazanır.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1) YENİ TABLO: access_codes (paket bazlı, hash'li, süreli, cihazlı)
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.access_codes (
  id              uuid primary key default gen_random_uuid(),
  code_hash       text not null unique,          -- SHA-256(kod) — düz kod ASLA saklanmaz
  code_preview    text not null,                 -- örn "VD-WEEK-****-7K9Q"
  plan_id         text not null,                 -- 'daily' | 'weekly' | 'monthly'
  plan_name       text not null,                 -- 'Daily Access' ...
  duration_days   numeric not null,              -- 1 | 7 | 30
  price_usd       numeric,                        -- 20 | 100 | 300
  status          text not null default 'unused',-- unused|active|expired|revoked|assigned
  source          text default 'manual',         -- manual | sale | system
  created_at      timestamptz not null default now(),
  activated_at    timestamptz,
  expires_at      timestamptz,
  last_used_at    timestamptz,
  used_by         text,                           -- ilk aktive eden device_id
  assigned_to     text,                           -- satış/manuel: kime verildi
  max_devices     int not null default 2,
  active_devices  int not null default 0,
  device_ids      jsonb not null default '[]'::jsonb, -- aktive olan cihaz id listesi
  notes           text,
  created_by      text,                           -- admin etiketi
  revoked_at      timestamptz,
  revoked_reason  text,
  is_admin        boolean not null default false  -- admin kodu (sınırsız)
);

create index if not exists idx_access_codes_status   on public.access_codes(status);
create index if not exists idx_access_codes_plan      on public.access_codes(plan_id);
create index if not exists idx_access_codes_hash      on public.access_codes(code_hash);
create index if not exists idx_access_codes_expires   on public.access_codes(expires_at);

-- ───────────────────────────────────────────────────────────────────
-- 2) ESKİ TABLO: sifre — modern mantık için kolon ekle (SİLME yok)
--    Eski kodlar artık süre dolana kadar gir-çık yapabilecek.
-- ───────────────────────────────────────────────────────────────────
alter table public.sifre add column if not exists activated_at  timestamptz;
alter table public.sifre add column if not exists expires_at    timestamptz;
alter table public.sifre add column if not exists device_ids    jsonb default '[]'::jsonb;
alter table public.sifre add column if not exists max_devices   int default 2;
-- not: mevcut 'kullanildi' kolonu artık "aktive edildi mi" olarak yorumlanır,
-- giriş engellemez; expires_at dolmadıkça erişim sürer.

-- ───────────────────────────────────────────────────────────────────
-- 3) ONLINE TRACKING tablosu (Parça 3'te kullanılacak — şimdi hazır dursun)
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.user_sessions (
  session_id      text primary key,
  device_id       text,
  access_code_id  uuid,
  plan_id         text,
  is_premium      boolean default false,
  current_symbol  text,
  user_agent      text,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_sessions_lastseen on public.user_sessions(last_seen_at);

-- ───────────────────────────────────────────────────────────────────
-- 4) RLS — normal kullanıcı tabloları GÖREMEZ. Sadece service_role erişir.
--    (Edge Function service key kullanır, RLS'i bypass eder.)
-- ───────────────────────────────────────────────────────────────────
alter table public.access_codes enable row level security;
alter table public.user_sessions enable row level security;
alter table public.sifre        enable row level security;

-- anon/authenticated için HİÇBİR policy yok = erişim yok (sadece service_role bypass eder)
-- (Mevcut sifre policy'leri varsa kalsın; yeni tablolarda policy eklemiyoruz = kapalı.)

-- ───────────────────────────────────────────────────────────────────
-- 5) OPSİYONEL — 3 test kodu (admin panel Parça 2'de üreteceğiz).
--    İstersen şimdi elle test için aç. code_hash = sha256(kod).
--    Aşağıdaki örnekler PLACEHOLDER — gerçek hash admin panelde üretilecek.
--    Şimdilik yorumda bırakıyorum:
-- insert into public.access_codes (code_hash, code_preview, plan_id, plan_name, duration_days, price_usd, status, source, notes)
-- values
--  ('<sha256-of-VD-DAY-TEST-0001>',  'VD-DAY-****-0001',  'daily',   'Daily Access',   1,  20,  'unused','manual','test'),
--  ('<sha256-of-VD-WEEK-TEST-0001>', 'VD-WEEK-****-0001', 'weekly',  'Weekly Access',  7,  100, 'unused','manual','test'),
--  ('<sha256-of-VD-MONTH-TEST-001>', 'VD-MONTH-****-001', 'monthly', 'Monthly Access', 30, 300, 'unused','manual','test');

-- BİTTİ. Hata almazsan migration başarılı.
