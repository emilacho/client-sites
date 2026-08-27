-- R96.139 · audit log para updates de jugos del día via WhatsApp.
-- Persiste texto original + lista parseada + número origen para debug
-- si el parser falla o admite un texto que no debería.

create table if not exists naufrago_juice_admin_log (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null default 'naufrago',
  inbound_text text,
  parsed_juices text[] not null default '{}',
  parse_ok boolean not null default false,
  from_number text,
  source text not null default 'whatsapp',
  created_at timestamptz not null default now()
);

create index if not exists idx_naufrago_juice_log_created
  on naufrago_juice_admin_log (client_slug, created_at desc);

comment on table naufrago_juice_admin_log is
  'Audit log · updates de jugos via WhatsApp parser · sirve para debug si Emilio responde y no entiende';
