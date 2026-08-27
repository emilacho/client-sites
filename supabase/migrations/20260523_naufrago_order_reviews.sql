-- ──────────────────────────────────────────────────────────────────────
-- naufrago_order_reviews · Round 96.16 · post-delivered feedback loop
-- ──────────────────────────────────────────────────────────────────────
-- Capture cliente review post-entrega · 1-5 stars + comentario opcional.
-- 1 review por order · idempotent (UPSERT por order_id). Datos feed
-- los coquitos hover de la isla 3D + dashboards de cocina.
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.naufrago_order_reviews (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null unique
                  references public.naufrago_orders(id) on delete cascade,
  client_slug   text not null default 'naufrago',
  stars         smallint not null check (stars between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);

create index if not exists naufrago_order_reviews_client_stars_idx
  on public.naufrago_order_reviews (client_slug, stars, created_at desc);

alter table public.naufrago_order_reviews enable row level security;
