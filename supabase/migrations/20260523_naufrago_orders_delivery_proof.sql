-- ──────────────────────────────────────────────────────────────────────
-- naufrago_orders · Round 96.18 · delivery proof columns
-- ──────────────────────────────────────────────────────────────────────
-- Photo proof of delivery · pattern Amazon adaptado. Webhook PedidosYa
-- entrega · si trae foto + GPS · persiste en estas columns. UI tracker
-- stage 4 (cofre del tesoro) renderiza.
-- ──────────────────────────────────────────────────────────────────────

alter table public.naufrago_orders
  add column if not exists delivery_photo_url   text,
  add column if not exists delivery_photo_lat   double precision,
  add column if not exists delivery_photo_lng   double precision,
  add column if not exists delivery_photo_at    timestamptz;
