-- R96.109 · Náufrago customer preferences · texto libre opcional
-- que el cliente captura post-pedido y se pre-rellena en futuros
-- carritos como notas. Estilo Pizza Profile favorite-toppings.

alter table naufrago_customers
  add column if not exists preferences text;

comment on column naufrago_customers.preferences is
  'Notas/preferencias del cliente · "sin cilantro · poco picante · etc". Pre-fill notas en futuros pedidos.';
