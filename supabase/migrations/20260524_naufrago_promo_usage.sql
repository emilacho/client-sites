-- R96.105 · Náufrago promo code re-use tracking. Aplica al código
-- SurfBollado (5% off) y a cualquier código futuro.
--
-- Reglas (Emilio decisión 2026-05-24) · cada cliente puede usar UN
-- código una vez · para volverlo a usar debe cumplir DOS variables ·
--   (1) han pasado >= 24h desde el último uso
--   (2) ha acumulado >= $25 en pedidos confirmados desde el último uso
-- qualifying_spend_since_last_use se incrementa con cada pedido del
-- cliente (con o sin código) · se resetea a 0 cuando aplica de nuevo.

create table if not exists naufrago_promo_usage (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null default 'naufrago',
  whatsapp_e164 text not null,
  code text not null,
  last_used_at timestamptz not null default now(),
  qualifying_spend_since_last_use numeric(10,2) not null default 0,
  use_count int not null default 1,
  created_at timestamptz not null default now(),
  unique (client_slug, whatsapp_e164, code)
);

create index if not exists idx_naufrago_promo_usage_whatsapp
  on naufrago_promo_usage (client_slug, whatsapp_e164);

comment on table naufrago_promo_usage is
  'Náufrago landing · tracking re-uso de códigos promo · 24h + $25 spend rules.';
