-- R124 · 28-ago-2026 · mandar cada venta de la web a Loyverse
--
-- POR QUE HACE FALTA UNA TABLA DE EQUIVALENCIAS
-- Loyverse NO acepta una venta con el nombre del plato escrito a mano. Su
-- API exige `variant_id`: el identificador del producto tal como existe en
-- SU catalogo (leido de su especificacion oficial: PostLineItem tiene
-- `required: [quantity, variant_id]`).
--
-- O sea que "Encebollado Naufrago" de nuestra carta tiene que quedar atado
-- al "Encebollado" que Emilio ya creo en Loyverse. Esa equivalencia vive
-- aca y NO en el codigo, por dos razones:
--   1. Si Emilio agrega un plato en Loyverse, se ata sin publicar nada.
--   2. Los identificadores son de SU cuenta · no son secretos, pero
--      tampoco son parte de nuestro programa.
--
-- El envio no es un plato pero tambien ocupa una linea en el recibo, asi
-- que usa la clave reservada `__envio__`.

create table if not exists naufrago.loyverse_item_map (
  -- El id de nuestra carta · ej "encebollado-naufrago" · o "__envio__".
  menu_item_id     text primary key,
  -- El id del producto en el catalogo de Loyverse.
  variant_id       text not null,
  -- Como se llama alla · solo para que un humano verifique la equivalencia
  -- de un vistazo, sin tener que entrar a Loyverse.
  nombre_loyverse  text,
  updated_at       timestamptz not null default now()
);

-- Permisos encendidos y sin politicas ⇒ solo la llave de servicio entra.
-- Mismo criterio que el resto del esquema.
alter table naufrago.loyverse_item_map enable row level security;
grant all on table naufrago.loyverse_item_map to service_role;

------------------------------------------------------------------
-- Dos tipos de evento nuevos · el resultado del envio a Loyverse
------------------------------------------------------------------
-- La lista de tipos permitidos es CERRADA. Ya me paso en R110: intente
-- guardar un tipo no declarado y la fila se rechazaba EN SILENCIO, que es
-- justo lo que el registro venia a evitar. Se declaran antes de usarlos.
--
-- Dos tipos y no uno con una bandera adentro, por el mismo motivo de
-- entonces: la consulta que importa es "¿que ventas no llegaron a la
-- contabilidad?" y con tipos separados es un filtro directo.

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
    -- R124 · la venta SI llego a Loyverse / NO se la pudo mandar
    'ACCOUNTING_SYNCED',
    'ACCOUNTING_SYNC_FAILED'
  ]::text[]));
