-- R96.106 · Náufrago customers + Easy Order (estilo Domino's).
--
-- `naufrago_customers` · perfil silencioso · creado al primer pedido.
--   whatsapp_e164 = business key UNIQUE · nombre + email opcional.
--   addresses jsonb · array de direcciones del cliente (default + adicionales).
--
-- `naufrago_easy_orders` · "Hambre de Náufrago" · 1 por cliente.
--   cart_lines + dropoff + payment_method default · re-ordenable cross-device.
--   Se actualiza con el último pedido confirmado (UPSERT por customer_id).

create table if not exists naufrago_customers (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null default 'naufrago',
  whatsapp_e164 text not null,
  name text,
  email text,
  addresses jsonb not null default '[]'::jsonb,
  total_orders int not null default 0,
  total_spend_usd numeric(10,2) not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_slug, whatsapp_e164)
);

create index if not exists idx_naufrago_customers_whatsapp
  on naufrago_customers (client_slug, whatsapp_e164);

create table if not exists naufrago_easy_orders (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null default 'naufrago',
  customer_id uuid not null references naufrago_customers(id) on delete cascade,
  whatsapp_e164 text not null,
  nickname text not null default 'Hambre de Náufrago',
  cart_lines jsonb not null,
  dropoff jsonb,
  payment_method text,
  delivery_provider text,
  total_usd numeric(10,2),
  source_order_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_slug, customer_id)
);

create index if not exists idx_naufrago_easy_orders_whatsapp
  on naufrago_easy_orders (client_slug, whatsapp_e164);

comment on table naufrago_customers is
  'Náufrago · perfil cliente cross-device · key by whatsapp_e164. Domino''s Pizza Profile pattern.';
comment on table naufrago_easy_orders is
  'Náufrago · Easy Order del cliente (UI label "Hambre de Náufrago"). 1 por cliente. Re-ordenable cross-device.';
