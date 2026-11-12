-- Tarjeta de residente de Olón · GO-LENOVO 12-nov (aprobado por Emilio 02:38 Zúrich) · CC1
-- 3 tablas + 1 función de registro en un solo paso. Todo nace CERRADO: solo lo usa el servidor (service_role).
-- No toca ninguna tabla existente. Reversa: supabase/reversas/ (mismo nombre, _REVERSA).
-- ORDEN con #15 (202611101830_naufrago_cerrar_permisos_de_fondo): #15 compara contra una foto de 21 tablas,
-- 5 funciones y 0 contadores. Si esta va antes, #15 se detiene → aplicar #15 PRIMERO, o rehacer su foto.
begin;

-- 1 · códigos de un solo uso que reparte Emilio (NAU- + 6 caracteres sin 0/O/1/I/L)
create table naufrago.residente_codigos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique check (codigo ~ '^NAU-[2-9A-HJKMNP-Z]{6}$'),
  creado_en     timestamptz not null default now(),
  usado_en      timestamptz,
  residente_id  uuid,
  anulado_en    timestamptz,
  constraint residente_codigos_uso_completo check ((usado_en is null) = (residente_id is null))
);

-- 2 · vecinos con tarjeta · la ficha es lo que lleva el QR (secreta, larga, la arma el servidor)
create table naufrago.residentes (
  id             uuid primary key default gen_random_uuid(),
  numero         integer generated always as identity unique,
  nombre         text not null check (char_length(btrim(nombre)) between 2 and 60),
  whatsapp_e164  text not null check (whatsapp_e164 ~ '^[0-9]{8,15}$'),
  ficha          text not null unique check (ficha ~ '^[A-Za-z0-9_-]{24}$'),
  codigo_id      uuid not null unique references naufrago.residente_codigos(id),
  sector         text not null check (char_length(btrim(sector)) between 2 and 60),
  correo         text check (correo is null or (char_length(correo) <= 120 and correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  cumple_dia     smallint,
  cumple_mes     smallint,
  acepta_novedades_en timestamptz,
  creado_en      timestamptz not null default now(),
  baja_en        timestamptz,
  baja_motivo    text,
  -- cumpleaños sin año: día y mes juntos o ninguno, y un día que exista en ese mes (29-feb vale)
  constraint residentes_cumple_valido check (
    (cumple_dia is null and cumple_mes is null)
    or (cumple_dia is not null and cumple_mes is not null
        and cumple_mes between 1 and 12 and cumple_dia between 1 and
        case when cumple_mes = 2 then 29 when cumple_mes in (4, 6, 9, 11) then 30 else 31 end)
  )
);
-- un teléfono tiene UNA tarjeta activa (si se da de baja, puede volver con un código nuevo)
create unique index residentes_whatsapp_activo on naufrago.residentes (whatsapp_e164) where baja_en is null;

alter table naufrago.residente_codigos
  add constraint residente_codigos_residente_fk foreign key (residente_id) references naufrago.residentes(id);

-- 3 · cada escaneo en caja · «vale una vez al día» por día de Ecuador (America/Guayaquil)
create table naufrago.residente_visitas (
  id            bigint generated always as identity primary key,
  residente_id  uuid references naufrago.residentes(id),
  validado_en   timestamptz not null default now(),
  dia_ec        date not null default ((now() at time zone 'America/Guayaquil')::date),
  resultado     text not null check (resultado in ('valida', 'baja', 'ya_usada_hoy', 'no_valido'))
);
create index residente_visitas_residente on naufrago.residente_visitas (residente_id, validado_en desc);
-- dos escaneos seguidos no pueden dar «válido» los dos: una sola visita válida por tarjeta y día
create unique index residente_visitas_una_valida_por_dia on naufrago.residente_visitas (residente_id, dia_ec) where resultado = 'valida';

alter table naufrago.residente_codigos enable row level security;
alter table naufrago.residentes        enable row level security;
alter table naufrago.residente_visitas enable row level security;

-- 4 · registro en un solo paso: bloquea el código, comprueba, crea la tarjeta y marca el código
-- acepta novedades = la casilla marcada; se guarda con fecha y hora (null = no aceptó)
create function naufrago.registrar_residente(
  p_codigo text, p_nombre text, p_whatsapp text, p_ficha text,
  p_sector text, p_correo text, p_cumple_dia smallint, p_cumple_mes smallint, p_acepta_novedades boolean)
returns jsonb
language plpgsql
security invoker
set search_path = naufrago, pg_temp
as $$
declare
  v_codigo naufrago.residente_codigos%rowtype;
  v_res    naufrago.residentes%rowtype;
  v_restr  text;
begin
  select * into v_codigo from naufrago.residente_codigos c where c.codigo = p_codigo for update;
  if not found or v_codigo.usado_en is not null or v_codigo.anulado_en is not null then
    return jsonb_build_object('resultado', 'codigo_invalido');
  end if;
  if exists (select 1 from naufrago.residentes r where r.whatsapp_e164 = p_whatsapp and r.baja_en is null) then
    return jsonb_build_object('resultado', 'ya_registrado');
  end if;
  begin
    insert into naufrago.residentes
        (nombre, whatsapp_e164, ficha, codigo_id, sector, correo, cumple_dia, cumple_mes, acepta_novedades_en)
      values (btrim(p_nombre), p_whatsapp, p_ficha, v_codigo.id, btrim(p_sector), nullif(lower(btrim(p_correo)), ''),
              p_cumple_dia, p_cumple_mes, case when p_acepta_novedades then now() end)
      returning * into v_res;
  exception when unique_violation then
    get stacked diagnostics v_restr = constraint_name;
    if v_restr = 'residentes_whatsapp_activo' then
      return jsonb_build_object('resultado', 'ya_registrado');
    end if;
    raise;
  end;
  update naufrago.residente_codigos set usado_en = now(), residente_id = v_res.id where id = v_codigo.id;
  return jsonb_build_object('resultado', 'ok', 'ficha', v_res.ficha, 'numero', v_res.numero);
end
$$;

-- 5 · cerrar: afuera nada; el servidor conserva lo suyo (vale aunque #15 aún no esté aplicada)
revoke all on naufrago.residente_codigos from public, anon, authenticated;
revoke all on naufrago.residentes        from public, anon, authenticated;
revoke all on naufrago.residente_visitas from public, anon, authenticated;
grant select, insert, update, delete on naufrago.residente_codigos to service_role;
grant select, insert, update, delete on naufrago.residentes        to service_role;
grant select, insert, update, delete on naufrago.residente_visitas to service_role;
do $$
declare s text;
begin
  foreach s in array array[
    pg_get_serial_sequence('naufrago.residentes', 'numero'),
    pg_get_serial_sequence('naufrago.residente_visitas', 'id')
  ] loop
    execute format('revoke all on sequence %s from public, anon, authenticated', s);
    execute format('grant usage, select on sequence %s to service_role', s);
  end loop;
end $$;
revoke all on function naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean) from public, anon, authenticated;
grant execute on function naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean) to service_role;

-- 6 · comprobar al final; si algo quedó abierto, se deshace todo
do $$
declare t text; s text;
begin
  foreach t in array array['naufrago.residente_codigos', 'naufrago.residentes', 'naufrago.residente_visitas'] loop
    if has_table_privilege('anon', t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       or has_table_privilege('authenticated', t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'sigue abierta: %', t;
    end if;
    if not has_table_privilege('service_role', t, 'SELECT,INSERT,UPDATE') then raise exception 'el servidor no puede: %', t; end if;
  end loop;
  foreach s in array array[
    pg_get_serial_sequence('naufrago.residentes', 'numero'),
    pg_get_serial_sequence('naufrago.residente_visitas', 'id')
  ] loop
    if has_sequence_privilege('anon', s, 'USAGE,SELECT,UPDATE') or has_sequence_privilege('authenticated', s, 'USAGE,SELECT,UPDATE') then
      raise exception 'contador abierto: %', s;
    end if;
  end loop;
  if has_function_privilege('anon', 'naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean)', 'EXECUTE') then
    raise exception 'función abierta: registrar_residente';
  end if;
  if not has_function_privilege('service_role', 'naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean)', 'EXECUTE') then
    raise exception 'el servidor no puede registrar';
  end if;
end $$;

commit;
