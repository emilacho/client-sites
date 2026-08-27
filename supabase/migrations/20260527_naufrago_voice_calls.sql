-- R97.1 · Voice AI + Kushki Hybrid · Fase 1
--
-- Tabla naufrago_voice_calls · una fila por llamada de voz iniciada
-- desde el botón "Llamame" del landing. Vapi (provider de voz IA)
-- coordina STT + LLM + TTS · el cliente dicta el pedido · function
-- calls (search_menu · add_to_cart · confirm_order · cancel_order)
-- van mutando el carrito · al final crea/actualiza naufrago_orders
-- en status PENDING_LOCATION para que el cliente comparta la ubicación
-- vía WhatsApp (flow hybrid del Sprint).
--
-- ALTER complementaria · extender el CHECK de naufrago_orders.status
-- para aceptar PENDING_LOCATION + PENDING_LOCATION_DETAIL + CONFIRMED
-- (referenciados por R96.156 webhook + voice flow Fase 3). El statu
-- enum original solo tenía PENDING → DELIVERED · faltaba estado
-- intermedio para esperar share de ubicación post-confirmación.

create table if not exists public.naufrago_voice_calls (
  id                        uuid primary key default gen_random_uuid(),
  client_slug               text not null default 'naufrago',

  -- ── Identificación cliente (capturado del modal · pre-rellenado
  -- desde useAccount() si está logueado · editable manual)
  customer_name             text not null,
  customer_phone            text not null,
  -- Si el cliente está logueado · guardamos el auth_user_id para
  -- linkear el voice call con el customer canonical post-pedido.
  auth_user_id              uuid,

  -- ── Estado de la llamada
  status                    text not null
    default 'INITIATING'
    check (status in (
      'INITIATING',         -- request recibido · llamando Vapi API
      'DIALING',            -- Vapi marcando al cliente
      'IN_PROGRESS',        -- cliente respondió · IA conversando
      'COMPLETED',          -- llamada terminó OK · pedido capturado
      'NO_ANSWER',          -- cliente no contestó (timeout Vapi)
      'CUSTOMER_HANGUP',    -- cliente colgó antes de confirmar
      'FAILED',             -- error técnico (Vapi · LLM · TTS)
      'PENDING_OPERATOR'    -- Vapi no configurado · fallback humano
    )),

  -- ── Vapi tracking
  vapi_call_id              text,
  vapi_assistant_id         text,
  vapi_phone_number_id      text,

  -- ── Resultado de la llamada · transcript + items extraídos
  transcript                jsonb,
  cart_lines_extracted      jsonb,
  subtotal_usd_extracted    numeric(10,2),

  -- ── Link al pedido creado (si la llamada llegó a confirm_order)
  order_id                  uuid references public.naufrago_orders(id)
                                on delete set null,

  -- ── Lifecycle timestamps
  created_at                timestamptz not null default now(),
  dialing_at                timestamptz,
  answered_at               timestamptz,
  ended_at                  timestamptz,
  duration_seconds          int,

  -- ── Raw payloads de Vapi para debug
  raw_initiate_response     jsonb,
  raw_end_payload           jsonb,

  -- ── Costos · Vapi cobra por minuto (LLM + TTS + STT bundled)
  cost_usd                  numeric(10,4)
);

create index if not exists naufrago_voice_calls_phone_idx
  on public.naufrago_voice_calls (customer_phone, created_at desc);
create index if not exists naufrago_voice_calls_status_idx
  on public.naufrago_voice_calls (status, created_at desc);
create index if not exists naufrago_voice_calls_vapi_call_id_idx
  on public.naufrago_voice_calls (vapi_call_id);
create index if not exists naufrago_voice_calls_order_id_idx
  on public.naufrago_voice_calls (order_id);

alter table public.naufrago_voice_calls enable row level security;
-- Sin políticas · service-role only desde API routes.

------------------------------------------------------------------
-- ALTER naufrago_orders.status · agregar PENDING_LOCATION +
-- PENDING_LOCATION_DETAIL + CONFIRMED. Necesario para flow hybrid
-- voice→WhatsApp (R96.156 + R97.1).
------------------------------------------------------------------
alter table public.naufrago_orders
  drop constraint if exists naufrago_orders_status_check;

alter table public.naufrago_orders
  add constraint naufrago_orders_status_check
  check (status in (
    'PENDING',
    'PENDING_LOCATION',          -- voice IA confirmó items · esperando GPS share
    'PENDING_LOCATION_DETAIL',   -- GPS recibido · esperando texto del detalle
    'CONFIRMED',                 -- ubicación + detalle OK · ready para cotizar
    'ACCEPTED',
    'PREPARING',
    'READY',
    'RIDER_PICKED_UP',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED'
  ));

------------------------------------------------------------------
-- ALTER naufrago_orders · link al voice_call que lo creó (si aplica)
------------------------------------------------------------------
alter table public.naufrago_orders
  add column if not exists voice_call_id uuid
    references public.naufrago_voice_calls(id) on delete set null;

create index if not exists naufrago_orders_voice_call_id_idx
  on public.naufrago_orders (voice_call_id);

comment on table public.naufrago_voice_calls is
  'R97.1 · Voice AI calls iniciadas vía Vapi desde botón Llamame · flow hybrid voice→WhatsApp · cliente dicta items por voz · WhatsApp recibe ubicación nativa + detalle.';
