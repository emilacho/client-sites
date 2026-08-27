-- ──────────────────────────────────────────────────────────────────────
-- naufrago_loyalty_balance · Round 96.21 · "Perlas del náufrago"
-- ──────────────────────────────────────────────────────────────────────
-- Loyalty program lite. Identity = phone (no auth required en MVP).
-- 1 perla = $0.01. Earn rate · 10% del total_usd al stage DELIVERED.
-- Spend cap · 50% del subtotal del próximo pedido.
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.naufrago_loyalty_balance (
  phone         text not null,
  client_slug   text not null default 'naufrago',
  perlas        integer not null default 0 check (perlas >= 0),
  earned_total  integer not null default 0 check (earned_total >= 0),
  spent_total   integer not null default 0 check (spent_total >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (client_slug, phone)
);

create index if not exists naufrago_loyalty_balance_perlas_idx
  on public.naufrago_loyalty_balance (client_slug, perlas desc)
  where perlas > 0;

create or replace function public.naufrago_loyalty_balance_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists naufrago_loyalty_balance_touch_t
  on public.naufrago_loyalty_balance;
create trigger naufrago_loyalty_balance_touch_t
  before update on public.naufrago_loyalty_balance
  for each row execute function public.naufrago_loyalty_balance_touch();

alter table public.naufrago_loyalty_balance enable row level security;

-- ──────────────────────────────────────────────────────────────────────
-- naufrago_loyalty_ledger · audit log de earn/spend events
-- ──────────────────────────────────────────────────────────────────────
create table if not exists public.naufrago_loyalty_ledger (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  client_slug   text not null default 'naufrago',
  delta         integer not null,         -- positive = earn · negative = spend
  reason        text not null,            -- "earn:order:NF-..." / "spend:order:NF-..."
  order_code    text,
  created_at    timestamptz not null default now()
);

create index if not exists naufrago_loyalty_ledger_phone_idx
  on public.naufrago_loyalty_ledger (client_slug, phone, created_at desc);

alter table public.naufrago_loyalty_ledger enable row level security;
