-- R106 · 25-ago-2026 · pedidos al repartidor · REEMPLAZA a
-- 20260518_courier_orders.sql, que nunca se aplicó.
--
-- Por qué se reescribe en vez de aplicar la vieja · la de mayo creaba las
-- dos tablas en el esquema `public` y SIN permisos por fila. Esas filas
-- guardan nombre, teléfono, correo y dirección del cliente, y el esquema
-- `public` está publicado hacia afuera: cualquiera con la llave anónima
-- (que viaja en el navegador) las habría leído. Se creó el mismo agujero
-- que ya existe en otras 7 tablas y que está anotado como pendiente.
--
-- Acá van en `naufrago` (donde vive el resto del cliente, R97.2) y con
-- permisos por fila ENCENDIDOS y sin políticas · sólo la llave de
-- servicio del servidor entra. El navegador no las toca nunca: estas
-- tablas sólo las escribe el servidor.

------------------------------------------------------------------
-- naufrago.courier_orders · un envío pedido a PedidosYa
------------------------------------------------------------------
create table if not exists naufrago.courier_orders (
  id                    uuid primary key default gen_random_uuid(),
  client_slug           text not null,
  -- id del envío que devuelve PedidosYa (shippingId) · único para que
  -- un webhook que llegue antes que el insert no duplique la fila.
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
  on naufrago.courier_orders (client_slug, created_at desc);
create index if not exists courier_orders_status_idx
  on naufrago.courier_orders (status, created_at desc);

------------------------------------------------------------------
-- naufrago.courier_order_events · cada aviso que manda PedidosYa
------------------------------------------------------------------
-- Sin llave foránea a propósito: un evento que llegue antes que la fila
-- del envío no debe rebotar.
create table if not exists naufrago.courier_order_events (
  id                    uuid primary key default gen_random_uuid(),
  pedidosya_order_id    text not null,
  event                 text not null,
  status                text not null,
  timestamp             timestamptz not null default now(),
  payload               jsonb,
  received_at           timestamptz not null default now()
);

create index if not exists courier_order_events_order_idx
  on naufrago.courier_order_events (pedidosya_order_id, received_at desc);

------------------------------------------------------------------
-- Permisos · encendidos y sin políticas ⇒ sólo la llave de servicio
------------------------------------------------------------------
alter table naufrago.courier_orders       enable row level security;
alter table naufrago.courier_order_events enable row level security;

grant all on table naufrago.courier_orders       to service_role;
grant all on table naufrago.courier_order_events to service_role;
