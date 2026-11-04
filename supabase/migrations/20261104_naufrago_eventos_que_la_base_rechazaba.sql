-- R190 · La base rechazaba 4 tipos de evento que el código sí escribe.
-- Se perdían sin aviso, y dos de ellos son el control para no repetir
-- WhatsApp al cliente. Solo admite más valores: no toca ninguna fila.
-- Lista de partida leída de la base viva el 2026-11-04; coincide con
-- 20260828_naufrago_loyverse.sql.
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
    'WEBHOOK_RECEIVED',
    'ACCOUNTING_SYNCED',
    'ACCOUNTING_SYNC_FAILED',
    'ORDER_RESERVED',
    'DISPATCH_FAILED_AFTER_PAYMENT',
    'WHATSAPP_CONFIRM_SENT',
    'WHATSAPP_STATUS_NOTIFIED'
  ]::text[]));
