-- R96.129 · Náufrago LOPDP Ecuador compliance · consent log + soft-delete
-- flag en customers. Cumple LOPDP art. 24 (registro de consents) +
-- right to be forgotten (soft delete con cooldown 30 días).

create table if not exists naufrago_consent_log (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null default 'naufrago',
  customer_id uuid references naufrago_customers(id) on delete set null,
  whatsapp_e164 text,
  consent_type text not null,
  accepted boolean not null,
  ip_hash text,
  user_agent text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_naufrago_consent_log_customer
  on naufrago_consent_log (client_slug, customer_id, consent_type);

alter table naufrago_customers
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists idx_naufrago_customers_deletion
  on naufrago_customers (client_slug, deletion_requested_at)
  where deletion_requested_at is not null;

comment on table naufrago_consent_log is
  'LOPDP Ecuador art. 24 · registro de consents (cookies · marketing · etc) · WHO/WHEN/WHAT/IP';
comment on column naufrago_customers.deletion_requested_at is
  'LOPDP right-to-be-forgotten · cliente pidió eliminación · soft delete 30 días cooldown';
comment on column naufrago_customers.deleted_at is
  'Hard delete cuando cron borra post-cooldown · 30+ días desde deletion_requested_at';
