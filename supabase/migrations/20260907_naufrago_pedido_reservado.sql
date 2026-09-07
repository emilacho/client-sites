-- R164 · dos estados nuevos para el pedido pagado con tarjeta.
--
-- PENDING_PAYMENT · el cliente armó el pedido y todavía no pagó. La
--   ficha existe -para poder cobrarla- pero el pedido NO salió a la
--   calle ni le llegó a la cocina. Si el cliente abandona el pago, se
--   queda acá para siempre y no molesta a nadie.
--
-- NEEDS_ATTENTION · el cobro entró PERO el motorizado no se pudo
--   despachar (proveedor caído, cotización vencida dos veces). Es el
--   único caso en que hay plata cobrada sin comida en camino, así que
--   necesita un estado propio y visible · no puede quedar mezclado con
--   los pedidos normales ni desaparecer en un registro.
--
-- Sin este cambio la ficha del pedido NO SE PUEDE GUARDAR: la lista de
-- estados permitidos los rechaza, y el código que la guarda se traga el
-- error. El cliente pagaría un pedido que no existe en ningún lado.
alter table public.naufrago_orders
  drop constraint if exists naufrago_orders_status_check;

alter table public.naufrago_orders
  add constraint naufrago_orders_status_check
  check (status in (
    'PENDING_PAYMENT',           -- R164 · reservado · esperando el cobro
    'PENDING',
    'PENDING_LOCATION',
    'PENDING_LOCATION_DETAIL',
    'CONFIRMED',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'RIDER_PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'NEEDS_ATTENTION',           -- R164 · cobrado y sin despachar · a mano
    'CANCELLED'
  ));
