-- Round 74 · PedidosYa Courier integration · table + audit log.
--
-- Run via the Supabase dashboard SQL editor or via the CLI:
--   supabase db push   (if migrations are tracked in this repo)
-- Otherwise paste the file body into the SQL editor.

create table if not exists public.courier_orders (
  id                    uuid primary key default gen_random_uuid(),
  client_slug           text not null,
  pedidosya_order_id    text unique not null,
  quote_token           text not null,
  status                text not null default 'CREATED',
  customer_name         text,
  customer_phone        text,
  customer_email        text,
  dropoff_address       text,
  cart_lines            jsonb,
  notes                 text,
  tracking_url          text,
  raw_create_response   jsonb,
  last_webhook_at       timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists courier_orders_client_slug_idx
  on public.courier_orders (client_slug, created_at desc);
create index if not exists courier_orders_status_idx
  on public.courier_orders (status, created_at desc);

-- Audit log · every webhook event captured for debugging and SLA
-- analysis. Tied to the order via pedidosya_order_id (not FK so
-- early events that arrive before the create row aren't blocked).
create table if not exists public.courier_order_events (
  id                    uuid primary key default gen_random_uuid(),
  pedidosya_order_id    text not null,
  event                 text not null,
  status                text not null,
  timestamp             timestamptz not null default now(),
  payload               jsonb,
  received_at           timestamptz not null default now()
);

create index if not exists courier_order_events_order_idx
  on public.courier_order_events (pedidosya_order_id, received_at desc);

-- RLS off · these tables are only touched by the service-role
-- client from the API routes. Anon role has no access.
alter table public.courier_orders         enable row level security;
alter table public.courier_order_events   enable row level security;
-- Intentionally no policies · service_role bypasses RLS.
