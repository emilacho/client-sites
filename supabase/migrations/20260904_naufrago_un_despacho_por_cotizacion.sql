-- R158 · un despacho por cotización · candado contra el pedido duplicado.
--
-- Comprobado contra una publicación de prueba: mandando DOS veces el
-- mismo pedido con la misma cotización se crearon dos envíos distintos
-- en PedidosYa, con dos motorizados y dos cobros de envío.
--
-- No hace falta mala intención: alcanza con una conexión de celular que
-- se corta después de que el servidor ya recibió el pedido. El cliente
-- ve que no pasó nada, toca de nuevo, y salen dos.
--
-- La cotización es la llave natural: una cotización, un envío. El
-- candado va en la base y no sólo en el código porque dos peticiones
-- simultáneas pueden mirar "¿ya existe?" a la vez, y las dos ver que no.
--
-- Se limpian los duplicados que hubiera antes de poner el candado ·
-- se conserva el primero de cada cotización, que es el que de verdad
-- se despachó primero.
delete from naufrago.courier_orders a
using naufrago.courier_orders b
where a.quote_token = b.quote_token
  and a.quote_token is not null
  and a.created_at > b.created_at;

create unique index if not exists naufrago_courier_orders_una_por_cotizacion
  on naufrago.courier_orders (quote_token)
  where quote_token is not null;

comment on index naufrago.naufrago_courier_orders_una_por_cotizacion is
  'R158 · una cotización = un envío. Evita el pedido duplicado cuando el cliente reintenta porque se le cortó la conexión.';
