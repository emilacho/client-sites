-- Round 96 · Náufrago orders schema · single source of truth for
-- every order placed on the landing. Orders ALWAYS originate from
-- the landing (no marketplace listings); delivery providers vary
-- (PedidosYa Courier today, Rappi/UberEats/own delivery future).
-- Payment processed in-checkout (Google Pay, card, PayPhone, etc.).
--
-- Supersedes the R74 `courier_orders` scaffold (which assumed an
-- outbound rider-only model). The R74 table stays in place for
-- backwards compat but no new writes after R97; it can be dropped
-- once production has migrated off it (handled in a later round).
--
-- Apply via Supabase SQL editor or `supabase db push`.

------------------------------------------------------------------
-- naufrago_orders · the order itself · one row per purchase
------------------------------------------------------------------
create table if not exists public.naufrago_orders (
  id                            uuid primary key default gen_random_uuid(),
  client_slug                   text not null default 'naufrago',
  -- Human-friendly short code · printed on the parchment + tracker
  -- e.g. "NF-2026-A8F3". Generated server-side at insert.
  order_code                    text unique not null,

  -- ── Source channel · always landing for now; field kept so the
  -- table can host other clients with marketplace listings later.
  source                        text not null
    default 'NAUFRAGO_LANDING'
    check (source in ('NAUFRAGO_LANDING')),

  -- ── Status · single enum across all channels.
  status                        text not null
    default 'PENDING'
    check (status in (
      'PENDING',          -- created, awaiting payment / kitchen ack
      'ACCEPTED',         -- kitchen confirmed receipt
      'PREPARING',        -- in the kitchen
      'READY',            -- packed, awaiting pickup
      'RIDER_PICKED_UP',  -- rider has the package
      'IN_TRANSIT',       -- en route to customer
      'DELIVERED',        -- arrived
      'CANCELLED'
    )),

  -- ── Customer info captured at checkout
  customer_name                 text not null,
  customer_phone                text not null,
  customer_email                text,

  -- ── Drop-off (where the rider needs to bring it)
  dropoff_address               text not null,
  dropoff_detail                text,
  dropoff_lat                   numeric(9,6),
  dropoff_lng                   numeric(9,6),
  dropoff_country_code          text not null default 'EC',

  -- ── Cart contents · jsonb so we can store rich item objects
  -- with name, qty, priceUsd, options, etc. without schema drift.
  cart_lines                    jsonb not null,
  -- Money math · captured at order time so a later price change
  -- doesn't retroactively shift this order.
  subtotal_usd                  numeric(10,2) not null,
  discount_code                 text,
  discount_usd                  numeric(10,2) not null default 0,
  delivery_fee_usd              numeric(10,2) not null default 0,
  total_usd                     numeric(10,2) not null,

  -- ── Delivery
  delivery_provider             text not null default 'PEDIDOSYA_COURIER'
    check (delivery_provider in (
      'PEDIDOSYA_COURIER',
      'RAPPI_COURIER',
      'UBER_EATS_COURIER',
      'NAUFRAGO_OWN_DELIVERY',
      'PICKUP'
    )),
  delivery_provider_order_id    text,    -- provider's tracking id
  delivery_provider_tracking_url text,
  delivery_quote_token          text,    -- saved during the quote phase
  delivery_eta_minutes          int,
  -- Latest known rider position / info from the provider · pulled
  -- via webhook + status polling.
  rider_info                    jsonb,

  -- ── Payment
  payment_method                text not null
    check (payment_method in (
      'GOOGLE_PAY',
      'APPLE_PAY',
      'CARD_CREDIT',
      'CARD_DEBIT',
      'PAYPHONE',
      'CASH_ON_DELIVERY',
      'WHATSAPP_MANUAL',
      'BANK_TRANSFER'
    )),
  payment_status                text not null default 'PENDING'
    check (payment_status in (
      'PENDING',
      'AUTHORIZED',
      'CAPTURED',
      'FAILED',
      'REFUNDED',
      'PARTIAL_REFUND'
    )),
  payment_provider              text,           -- 'KUSHKI' | 'PAYPHONE' | 'STRIPE' | 'GHL'
  payment_provider_intent_id    text,
  payment_currency              text not null default 'USD',

  -- ── Customer-facing notes (optional)
  customer_notes                text,

  -- ── Lifecycle timestamps · written by the API on each state
  -- transition. Useful for SLA reports + tracker UI animations.
  created_at                    timestamptz not null default now(),
  accepted_at                   timestamptz,
  preparing_at                  timestamptz,
  ready_at                      timestamptz,
  rider_picked_up_at            timestamptz,
  in_transit_at                 timestamptz,
  delivered_at                  timestamptz,
  cancelled_at                  timestamptz,
  cancellation_reason           text,

  -- ── Raw responses kept for forensic debugging
  raw_dispatch_response         jsonb,
  raw_last_status_response      jsonb
);

create index if not exists naufrago_orders_client_slug_status_idx
  on public.naufrago_orders (client_slug, status, created_at desc);
create index if not exists naufrago_orders_order_code_idx
  on public.naufrago_orders (order_code);
create index if not exists naufrago_orders_delivery_provider_order_id_idx
  on public.naufrago_orders (delivery_provider, delivery_provider_order_id);
create index if not exists naufrago_orders_customer_phone_idx
  on public.naufrago_orders (customer_phone, created_at desc);

------------------------------------------------------------------
-- naufrago_order_events · append-only audit log
------------------------------------------------------------------
-- One row per significant lifecycle event · status transitions,
-- webhook receipts, payment status changes, manual overrides.
-- Useful for debugging "why is this order stuck" + SLA reporting
-- + Realtime UI updates (tracker subscribes to this table filtered
-- by order_id and re-renders on each insert).
create table if not exists public.naufrago_order_events (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.naufrago_orders(id)
                       on delete cascade,
  event_type        text not null
    check (event_type in (
      'ORDER_CREATED',
      'PAYMENT_AUTHORIZED',
      'PAYMENT_CAPTURED',
      'PAYMENT_FAILED',
      'KITCHEN_ACCEPTED',
      'KITCHEN_REJECTED',
      'PREPARING_STARTED',
      'READY_FOR_PICKUP',
      'COURIER_DISPATCHED',
      'COURIER_ASSIGNED',
      'COURIER_PICKED_UP',
      'COURIER_IN_TRANSIT',
      'COURIER_NEAR_DESTINATION',
      'DELIVERED',
      'CANCELLED',
      'STATUS_OVERRIDE_MANUAL',
      'WEBHOOK_RECEIVED'
    )),
  -- Optional payload from the source (provider webhook body,
  -- staff note, etc.). Captures the WHY, not just the WHAT.
  payload           jsonb,
  -- Origin of this event · who triggered it.
  actor             text not null default 'system'
    check (actor in (
      'system',
      'customer',
      'staff',
      'webhook:pedidosya-courier',
      'webhook:rappi',
      'webhook:uber-eats',
      'webhook:payment'
    )),
  created_at        timestamptz not null default now()
);

create index if not exists naufrago_order_events_order_id_idx
  on public.naufrago_order_events (order_id, created_at desc);
create index if not exists naufrago_order_events_event_type_idx
  on public.naufrago_order_events (event_type, created_at desc);

------------------------------------------------------------------
-- Row-level security · OFF · these tables are only touched by the
-- service-role client from server-side API routes. Anon role has
-- no access. Service role bypasses RLS so explicit policies aren't
-- needed; the `enable` is here as documentation that public
-- traffic must not reach these rows directly.
------------------------------------------------------------------
alter table public.naufrago_orders          enable row level security;
alter table public.naufrago_order_events    enable row level security;
-- Intentionally no policies.

------------------------------------------------------------------
-- Helper function · generate the human-friendly order_code
-- "NF-{year}-{6 hex chars}". Used by the API insert path · the
-- DB default doesn't reference it so the API can still pre-compute
-- the code for the response.
------------------------------------------------------------------
create or replace function public.gen_naufrago_order_code()
returns text
language plpgsql
volatile
as $$
declare
  yr text;
  rand_hex text;
begin
  yr := to_char(now() at time zone 'America/Guayaquil', 'YYYY');
  rand_hex := upper(substring(encode(gen_random_bytes(3), 'hex') from 1 for 6));
  return 'NF-' || yr || '-' || rand_hex;
end;
$$;
