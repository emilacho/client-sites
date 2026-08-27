-- R109 · 27-ago-2026 · cerrar las 7 tablas que se leían desde internet
--
-- QUÉ PASABA · el esquema `naufrago` está publicado hacia afuera (así debe
-- ser: la página lee sus propios datos). Pero estas 7 tablas quedaron SIN
-- permisos por fila, y sin permisos la publicación significa que cualquiera
-- con la llave anónima -la que viaja dentro del navegador de cualquier
-- visitante- las lee enteras.
--
-- Medido el 25 y re-medido el 26-ago con la llave pública:
--   otp_codes     HTTP 200 · devolvía CÓDIGOS DE INICIO DE SESIÓN + teléfonos
--   customers     HTTP 200 · nombre, teléfono, correo
--   consent_log   HTTP 200 · devolvía filas
--   ruleta_spins  HTTP 200 · devolvía filas
--   easy_orders   HTTP 200 · devolvía filas
--   promo_usage   HTTP 200 · vacía hoy, misma exposición
--   juice_admin_log HTTP 200 · vacía hoy, misma exposición
--
-- Hoy los datos son de prueba. El día del lanzamiento pasan a ser el
-- teléfono y el código de acceso de gente real.
--
-- POR QUÉ ESTO NO ROMPE LA PÁGINA · verificado antes de escribir esto:
-- el navegador NO lee ninguna de estas tablas directo. Sólo usa Supabase
-- para la sesión del cliente y para una suscripción en vivo a
-- `loyalty_balance` (que ya tiene permisos encendidos). Todo el resto de
-- los datos pasa por rutas del servidor, que usan la llave de servicio y
-- por definición ignoran estos permisos.
--
-- CRITERIO · permisos ENCENDIDOS y CERO políticas ⇒ nadie de afuera entra,
-- ni anónimo ni autenticado. Es el mismo criterio con el que ya están las
-- otras 10 tablas del esquema, incluida `orders`.

alter table naufrago.otp_codes       enable row level security;
alter table naufrago.customers       enable row level security;
alter table naufrago.consent_log     enable row level security;
alter table naufrago.ruleta_spins    enable row level security;
alter table naufrago.easy_orders     enable row level security;
alter table naufrago.promo_usage     enable row level security;
alter table naufrago.juice_admin_log enable row level security;

-- El servidor sigue entrando · la llave de servicio salta los permisos,
-- pero el GRANT explícito deja el permiso escrito y no implícito.
grant all on table naufrago.otp_codes       to service_role;
grant all on table naufrago.customers       to service_role;
grant all on table naufrago.consent_log     to service_role;
grant all on table naufrago.ruleta_spins    to service_role;
grant all on table naufrago.easy_orders     to service_role;
grant all on table naufrago.promo_usage     to service_role;
grant all on table naufrago.juice_admin_log to service_role;
