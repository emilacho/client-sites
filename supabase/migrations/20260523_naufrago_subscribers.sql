-- ──────────────────────────────────────────────────────────────────────
-- naufrago_subscribers · Round 96.10 · lite opt-in pattern
-- ──────────────────────────────────────────────────────────────────────
-- Persistence de suscriptores que se anotan desde la landing para
-- recibir promociones WhatsApp + seguimiento de pedidos. No es auth
-- formal · es solo un opt-in list. Idempotent por whatsapp_e164.
--
-- Multi-tenant · client_slug match al cliente piloto (`naufrago`).
-- Plataforma agnostic · mismo schema sirve para otros clientes con
-- slug distinto.
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.naufrago_subscribers (
  id                uuid primary key default gen_random_uuid(),
  client_slug       text not null default 'naufrago',

  -- Identifiers · whatsapp es el canonical key (Náufrago opera vía WA)
  whatsapp_e164     text not null,
  name              text not null,
  email             text,

  -- Opt-in flags · explicit consent capture
  opt_in_promos     boolean not null default false,
  opt_in_tracking   boolean not null default false,

  -- Source attribution · qué CTA del hero o flow disparó el signup
  source            text,

  -- Timestamps
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint naufrago_subscribers_whatsapp_per_client_uq
    unique (client_slug, whatsapp_e164)
);

create index if not exists naufrago_subscribers_client_idx
  on public.naufrago_subscribers (client_slug, created_at desc);

create index if not exists naufrago_subscribers_email_idx
  on public.naufrago_subscribers (email)
  where email is not null;

-- updated_at auto-refresh on UPSERT
create or replace function public.naufrago_subscribers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists naufrago_subscribers_touch on public.naufrago_subscribers;
create trigger naufrago_subscribers_touch
  before update on public.naufrago_subscribers
  for each row execute function public.naufrago_subscribers_touch_updated_at();

-- RLS · solo lectura/escritura por service role · clientes anónimos
-- nunca leen esta tabla directo (la lista es PII).
alter table public.naufrago_subscribers enable row level security;
