-- R110.2 · 27-ago-2026 · dos tipos de evento nuevos: el aviso a la cocina
--
-- `naufrago.order_events.event_type` tiene una lista CERRADA de 17 tipos
-- permitidos. Es una buena restricción -evita que cada quien invente su
-- vocabulario- pero significa que un tipo nuevo hay que declararlo.
--
-- Al cablear el aviso a la cocina (R110) intenté guardar el resultado con
-- `KITCHEN_NOTIFIED` / `KITCHEN_NOTIFY_FAILED`, que no estaban en la lista.
-- La fila se rechazaba en silencio y el resultado del aviso no quedaba en
-- ningún lado · que es exactamente lo que el registro venía a evitar.
--
-- Por qué DOS tipos y no uno con una bandera adentro: la consulta que
-- importa es "¿de qué pedidos no se enteró la cocina?", y con tipos
-- separados es un filtro directo, sin leer el contenido de cada fila.

alter table naufrago.order_events
  drop constraint if exists naufrago_order_events_event_type_check;

alter table naufrago.order_events
  add constraint naufrago_order_events_event_type_check
  check (event_type = any (array[
    'ORDER_CREATED',
    'PAYMENT_AUTHORIZED',
    'PAYMENT_CAPTURED',
    'PAYMENT_FAILED',
    'KITCHEN_ACCEPTED',
    'KITCHEN_REJECTED',
    -- R110.2 · el local FUE avisado / NO se lo pudo avisar
    'KITCHEN_NOTIFIED',
    'KITCHEN_NOTIFY_FAILED',
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
  ]::text[]));
