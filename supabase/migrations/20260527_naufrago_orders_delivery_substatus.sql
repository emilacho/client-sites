-- R96.155 · sub-status del delivery para tracker WhatsApp granular.
-- Mientras orders.status sigue siendo OUT_FOR_DELIVERY · delivery_substatus
-- se actualiza con NEARING_DESTINATION o AT_DESTINATION cuando el rider
-- pasa thresholds de distancia (500m + 50m). Cada transición dispara
-- WhatsApp template (📍 + 🚪) y se loggea idempotente vía event log.

alter table naufrago_orders
  add column if not exists delivery_substatus text;

comment on column naufrago_orders.delivery_substatus is
  'Sub-status del delivery while status=OUT_FOR_DELIVERY · derivado de geofencing rider→dropoff · valores · NEARING_DESTINATION · AT_DESTINATION.';
