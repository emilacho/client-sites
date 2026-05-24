-- R96.111 · Náufrago OTP codes · step-up auth para canje de perlas.
-- 4-digit code · expira 5 min · 1 código activo por phone+purpose.

create table if not exists naufrago_otp_codes (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null default 'naufrago',
  phone_e164 text not null,
  purpose text not null,
  code_hash text not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_naufrago_otp_phone_purpose
  on naufrago_otp_codes (client_slug, phone_e164, purpose, expires_at desc);

comment on table naufrago_otp_codes is
  'Náufrago step-up OTP · 4-digit codes via Twilio WhatsApp · purpose ej "loyalty_redeem".';
