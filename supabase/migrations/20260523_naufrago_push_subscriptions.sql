-- ──────────────────────────────────────────────────────────────────────
-- naufrago_push_subscriptions · Round 96.17 · Web Push API persistence
-- ──────────────────────────────────────────────────────────────────────
-- Persiste browser PushSubscription objects para que el server pueda
-- enviar push notifications de stage transitions al cliente sin que
-- esté con la app abierta.
--
-- Identidad · combinación de order_code + endpoint (un mismo browser
-- puede subscribirse a múltiples orders · pero un order × endpoint
-- es único · idempotent UPSERT).
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.naufrago_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  client_slug   text not null default 'naufrago',
  order_code    text not null,
  endpoint      text not null,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_sent_at  timestamptz,
  unsubscribed  boolean not null default false,

  constraint naufrago_push_subscriptions_order_endpoint_uq
    unique (order_code, endpoint)
);

create index if not exists naufrago_push_subscriptions_order_idx
  on public.naufrago_push_subscriptions (order_code)
  where unsubscribed = false;

alter table public.naufrago_push_subscriptions enable row level security;
