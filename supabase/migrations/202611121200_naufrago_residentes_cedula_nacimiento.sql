-- Tarjeta de residente · cédula OBLIGATORIA + fecha de nacimiento (día, mes y año) · ADENDA 1 de
-- GO-LENOVO-a-CC1-residentes-quitar-te-lo-dio-emilio (Emilio 12:15 Zúrich) · CC1 · 12-nov
-- Va ENCIMA de 202611120300_naufrago_residentes (aplicada 03:39Z). Reversa: supabase/reversas/ (mismo nombre, _REVERSA).
-- Datos que ya existen (pruebas): quedan SIN cédula y sin fecha. Las columnas viejas cumple_dia/cumple_mes NO se
-- borran: un día y mes sin año no se pueden convertir en una fecha sin inventar el año; quedan como estaban y
-- ya nadie las escribe. Así no se pierde nada y la reversa es exacta.
begin;

-- 1 · columnas nuevas (nulas para las filas viejas; el registro nuevo exige la cédula)
alter table naufrago.residentes
  add column cedula text check (cedula ~ '^[0-9]{6,15}$'),
  add column fecha_nacimiento date check (fecha_nacimiento >= date '1900-01-01');

-- una cédula tiene UNA tarjeta activa (igual que el teléfono)
create unique index residentes_cedula_activa on naufrago.residentes (cedula) where baja_en is null and cedula is not null;

-- 2 · la función de registro: se cambia la firma (fuera cumpleaños día/mes, entran cédula y fecha)
drop function naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean);

create function naufrago.registrar_residente(
  p_codigo text, p_nombre text, p_whatsapp text, p_ficha text,
  p_sector text, p_correo text, p_cedula text, p_fecha_nacimiento date, p_acepta_novedades boolean)
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
  if p_cedula is null then
    raise exception 'cédula obligatoria';
  end if;
  if p_fecha_nacimiento is not null and p_fecha_nacimiento > (now() at time zone 'America/Guayaquil')::date then
    raise exception 'fecha de nacimiento en el futuro';
  end if;
  select * into v_codigo from naufrago.residente_codigos c where c.codigo = p_codigo for update;
  if not found or v_codigo.usado_en is not null or v_codigo.anulado_en is not null then
    return jsonb_build_object('resultado', 'codigo_invalido');
  end if;
  if exists (select 1 from naufrago.residentes r where r.whatsapp_e164 = p_whatsapp and r.baja_en is null) then
    return jsonb_build_object('resultado', 'ya_registrado');
  end if;
  if exists (select 1 from naufrago.residentes r where r.cedula = p_cedula and r.baja_en is null) then
    return jsonb_build_object('resultado', 'cedula_registrada');
  end if;
  begin
    insert into naufrago.residentes
        (nombre, whatsapp_e164, ficha, codigo_id, sector, correo, cedula, fecha_nacimiento, acepta_novedades_en)
      values (btrim(p_nombre), p_whatsapp, p_ficha, v_codigo.id, btrim(p_sector), nullif(lower(btrim(p_correo)), ''),
              p_cedula, p_fecha_nacimiento, case when p_acepta_novedades then now() end)
      returning * into v_res;
  exception when unique_violation then
    get stacked diagnostics v_restr = constraint_name;
    if v_restr = 'residentes_whatsapp_activo' then
      return jsonb_build_object('resultado', 'ya_registrado');
    end if;
    if v_restr = 'residentes_cedula_activa' then
      return jsonb_build_object('resultado', 'cedula_registrada');
    end if;
    raise;
  end;
  update naufrago.residente_codigos set usado_en = now(), residente_id = v_res.id where id = v_codigo.id;
  return jsonb_build_object('resultado', 'ok', 'ficha', v_res.ficha, 'numero', v_res.numero);
end
$$;

-- 3 · cerrar la función nueva: afuera nada, el servidor sí (la tabla ya estaba cerrada y sigue igual)
revoke all on function naufrago.registrar_residente(text, text, text, text, text, text, text, date, boolean) from public, anon, authenticated;
grant execute on function naufrago.registrar_residente(text, text, text, text, text, text, text, date, boolean) to service_role;

-- 4 · comprobar al final; si algo quedó abierto, se deshace todo
do $$
begin
  if has_table_privilege('anon', 'naufrago.residentes', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'naufrago.residentes', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'sigue abierta: naufrago.residentes';
  end if;
  if has_column_privilege('anon', 'naufrago.residentes', 'cedula', 'SELECT,INSERT,UPDATE,REFERENCES')
     or has_column_privilege('authenticated', 'naufrago.residentes', 'cedula', 'SELECT,INSERT,UPDATE,REFERENCES') then
    raise exception 'columna abierta: cedula';
  end if;
  if has_function_privilege('anon', 'naufrago.registrar_residente(text, text, text, text, text, text, text, date, boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'naufrago.registrar_residente(text, text, text, text, text, text, text, date, boolean)', 'EXECUTE') then
    raise exception 'función abierta: registrar_residente';
  end if;
  if not has_function_privilege('service_role', 'naufrago.registrar_residente(text, text, text, text, text, text, text, date, boolean)', 'EXECUTE') then
    raise exception 'el servidor no puede registrar';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'naufrago'::regnamespace and proname = 'registrar_residente') <> 1 then
    raise exception 'quedó más de una registrar_residente';
  end if;
end $$;

commit;
