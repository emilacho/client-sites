-- R99 · Courier token cache · shared OAuth token store para PedidosYa
-- Courier (API v1 password grant · access_token dura 45 min · PedidosYa
-- BLOQUEA 10 min si se piden tokens de más). En Vercel serverless cada
-- cold-start pediría token nuevo → riesgo de bloqueo por token-storm.
-- Esta tabla es el cache compartido cross-instancia · un solo token
-- vivo por provider · se reusa hasta ~2 min antes de expirar.
--
-- Acceso solo service_role (server-only · el provider corre en Node
-- runtime con SUPABASE_SERVICE_ROLE_KEY). RLS ON sin policies públicas
-- → anon/authenticated no leen el token.
--
-- Apply via Supabase SQL editor o `supabase db push`.

------------------------------------------------------------------
-- naufrago.courier_token_cache · una fila por provider
------------------------------------------------------------------
create table if not exists naufrago.courier_token_cache (
  -- DeliveryProvider id · ej 'PEDIDOSYA_COURIER'
  provider       text primary key,
  access_token   text not null,
  -- refresh_token que devuelve /v1/token · guardado por si se usa
  -- rotación en el futuro (hoy re-autenticamos con las 4 creds).
  refresh_token  text,
  -- Momento exacto en que el access_token deja de servir.
  expires_at     timestamptz not null,
  updated_at     timestamptz not null default now()
);

-- RLS ON · sin policies → solo service_role (bypass RLS) accede.
alter table naufrago.courier_token_cache enable row level security;

grant all on table naufrago.courier_token_cache to service_role;
