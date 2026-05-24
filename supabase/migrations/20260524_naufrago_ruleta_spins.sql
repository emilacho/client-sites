-- R96.98 · Náufrago ruleta del cofre · 1 spin por IP/fingerprint
-- por día. Premios · chifle · pan · cola · siga participando.

create table if not exists naufrago_ruleta_spins (
  id uuid primary key default gen_random_uuid(),
  client_slug text not null default 'naufrago',
  fingerprint text,
  ip_hash text,
  prize text not null,
  prize_index int not null,
  spun_at timestamptz not null default now()
);

create index if not exists idx_naufrago_ruleta_ip
  on naufrago_ruleta_spins (ip_hash, spun_at desc);
create index if not exists idx_naufrago_ruleta_fp
  on naufrago_ruleta_spins (fingerprint, spun_at desc);

comment on table naufrago_ruleta_spins is
  'Náufrago landing · cofre ruleta spins · 1 por IP/fingerprint/24h.';
