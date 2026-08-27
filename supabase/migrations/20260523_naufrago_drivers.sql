-- ──────────────────────────────────────────────────────────────────────
-- naufrago_drivers · Round 96.19 · motorizado registry · auto-fill
-- ──────────────────────────────────────────────────────────────────────
-- Pattern Domino's driver profile · cliente ve foto + rating + tenure
-- antes que llegue el motorizado · aumenta trust + reduce ansiedad.
-- Identity = phone (PedidosYa entrega rider phone en webhook payload).
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.naufrago_drivers (
  id                      uuid primary key default gen_random_uuid(),
  client_slug             text not null default 'naufrago',
  phone                   text not null,
  name                    text,
  photo_url               text,
  rating                  numeric(2,1),         -- 0.0 to 5.0
  platform_tenure_months  integer,              -- meses en la plataforma
  plate                   text,
  vehicle_type            text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint naufrago_drivers_phone_per_client_uq
    unique (client_slug, phone),
  constraint naufrago_drivers_rating_range_chk
    check (rating is null or (rating >= 0 and rating <= 5))
);

create index if not exists naufrago_drivers_phone_idx
  on public.naufrago_drivers (client_slug, phone);

create or replace function public.naufrago_drivers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists naufrago_drivers_touch on public.naufrago_drivers;
create trigger naufrago_drivers_touch
  before update on public.naufrago_drivers
  for each row execute function public.naufrago_drivers_touch_updated_at();

alter table public.naufrago_drivers enable row level security;
