-- R96.113 · Náufrago customers · vincular Supabase Auth users.
-- Login ahora es email magic link / Google OAuth · auth.users.id como
-- primary identity. WhatsApp sigue siendo business key pero opcional
-- post-login (cliente lo ingresa al hacer su primer pedido).

alter table naufrago_customers
  add column if not exists auth_user_id uuid unique;

alter table naufrago_customers
  alter column whatsapp_e164 drop not null;

create index if not exists idx_naufrago_customers_auth_user
  on naufrago_customers (auth_user_id);
create index if not exists idx_naufrago_customers_email
  on naufrago_customers (client_slug, email);

comment on column naufrago_customers.auth_user_id is
  'Supabase Auth users.id · link a sesión email/Google. Nullable mientras existen perfiles legacy whatsapp-only.';
