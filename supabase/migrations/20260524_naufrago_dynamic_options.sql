-- ──────────────────────────────────────────────────────────────────────
-- naufrago_dynamic_options · Round 96.25 · catálogos editables runtime
-- ──────────────────────────────────────────────────────────────────────
-- Cliente edita opciones de variants dinámicos (jugos del día · etc.)
-- via Supabase Studio · sin redeploy. UI cliente lee con TTL 5min.
--
-- Schema · {key, options[], updated_at}. `options` es array de objetos
-- {id, label, available?} para flexibilidad futura.
-- ──────────────────────────────────────────────────────────────────────

create table if not exists public.naufrago_dynamic_options (
  client_slug   text not null default 'naufrago',
  key           text not null,
  label         text,
  options       jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),

  primary key (client_slug, key)
);

create or replace function public.naufrago_dynamic_options_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists naufrago_dynamic_options_touch_t
  on public.naufrago_dynamic_options;
create trigger naufrago_dynamic_options_touch_t
  before update on public.naufrago_dynamic_options
  for each row execute function public.naufrago_dynamic_options_touch();

alter table public.naufrago_dynamic_options enable row level security;

-- Seed inicial · jugos del día Náufrago · típicos costa EC
insert into public.naufrago_dynamic_options (client_slug, key, label, options)
values (
  'naufrago',
  'juice_flavors',
  'Sabor del día',
  '[
    {"id":"naranja","label":"Naranja"},
    {"id":"limon","label":"Limón"},
    {"id":"maracuya","label":"Maracuyá"},
    {"id":"mora","label":"Mora"},
    {"id":"tamarindo","label":"Tamarindo"}
  ]'::jsonb
)
on conflict (client_slug, key) do nothing;
