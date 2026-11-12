-- REVERSA de 202611121200_naufrago_residentes_cedula_nacimiento.sql · CC1 · 12-nov
-- Vuelve a la función de 9 parámetros con cumpleaños (copia EXACTA de 202611120300) y quita cédula y fecha.
-- OJO: borra las cédulas y fechas de nacimiento guardadas; con vecinos reales, primero respaldarlas.
begin;
drop function if exists naufrago.registrar_residente(text, text, text, text, text, text, text, date, boolean);
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
revoke all on function naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean) from public, anon, authenticated;
grant execute on function naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean) to service_role;
drop index if exists naufrago.residentes_cedula_activa;
alter table naufrago.residentes drop column if exists fecha_nacimiento, drop column if exists cedula;
commit;
