-- REVERSA de 202611120300_naufrago_residentes.sql · CC1 · 12-nov
-- Borra las 3 tablas de residentes y su función. OJO: borra también sus FILAS (vecinos, códigos y visitas).
-- Solo sirve tal cual ANTES de que haya vecinos reales; con datos, primero respaldar las 3 tablas.
begin;
drop function if exists naufrago.registrar_residente(text, text, text, text, text, text, smallint, smallint, boolean);
drop table if exists naufrago.residente_visitas;
alter table if exists naufrago.residente_codigos drop constraint if exists residente_codigos_residente_fk;
drop table if exists naufrago.residentes;
drop table if exists naufrago.residente_codigos;
commit;
