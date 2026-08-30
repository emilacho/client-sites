-- R145 · la propina del motorizado queda escrita, y separada.
--
-- Hasta hoy el cliente elegía propina, la veía sumada en el total y el
-- navegador la mandaba · pero no había dónde guardarla y el servidor la
-- descartaba en silencio. La plata desaparecía del registro.
--
-- Va en su propia columna, NO dentro de total_usd, porque no es plata
-- del local: es del motorizado. Mezclarla con la venta inflaría los
-- ingresos y la contabilidad no cerraría.
--
-- Cómo llega al motorizado depende de cómo se pagó:
--   · efectivo  · el cliente se la da en mano al recibir · nunca pasa
--                 por nosotros (por eso tampoco entra en collectMoney:
--                 esa plata la recauda PedidosYa y nos la liquida a
--                 nosotros, y le quedaríamos debiendo la propina).
--   · por internet · la cobramos nosotros y el local se la entrega en
--                 efectivo cuando el motorizado pasa a retirar.
-- El servicio de Envíos de PedidosYa no tiene campo de propina · se
-- verificó sobre su especificación oficial (v3 y v1, cero apariciones).
alter table naufrago.orders
  add column if not exists tip_usd numeric(10,2) not null default 0;

comment on column naufrago.orders.tip_usd is
  'Propina para el motorizado. NO está incluida en total_usd ni en lo que se le ordena cobrar al repartidor: no es plata del local. En efectivo la entrega el cliente en mano; pagada por internet la entrega el local al motorizado al retirar.';
