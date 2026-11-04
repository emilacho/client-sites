-- R172 · los pedidos de prueba se marcan en el origen. Por defecto NO es prueba.
-- Los 19 pedidos existentes (30-may a 28-oct) los marca Emilio como pruebas suyas:
-- se aplican aparte, con su visto bueno, no en esta migración.
alter table naufrago.orders add column if not exists es_prueba boolean not null default false;
comment on column naufrago.orders.es_prueba is 'true = pedido de prueba (modo simulado o dispositivo declarado de prueba); las lecturas de ventas reales lo excluyen';
