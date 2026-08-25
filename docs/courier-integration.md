# Integración con PedidosYa Envíos · estado real

**Última actualización · 25-ago-2026 (R106 + R107).** Este documento reemplaza por completo
la versión de R74, que describía un andamio de suposiciones que ya no existe.

## Estado · CONECTADO Y FUNCIONANDO

| Pieza | Estado |
|---|---|
| Credenciales | ✅ cargadas · probadas contra el servidor real |
| Cotización | ✅ **precio real que varía con la distancia** |
| Fuera de zona | ✅ PedidosYa rechaza · el cliente lee una frase en castellano |
| Despacho | ✅ crea el envío · devuelve precio, distancia y ventana de entrega |
| Cobro del envío | ✅ se suma al total del pedido |
| Tablas | ✅ `naufrago.courier_orders` · `courier_order_events` · `courier_token_cache` |
| Avisos de estado | ✅ registrados vía `PUT /v3/webhooks-configuration` |
| Modo | ⚠️ **PRUEBA** (`PEDIDOSYA_COURIER_IS_TEST=true`) · cotiza real, no manda motorizado |

## Cómo funciona de verdad (verificado, no supuesto)

**Autenticación · API v1 · `POST https://auth-api.pedidosya.com/v1/token`**
Cuerpo JSON con `client_id`, `client_secret`, `grant_type: "password"`, `username` (correo),
`password`. Devuelve `access_token` + `refresh_token`. **El token dura 45 minutos** y las
llamadas siguientes lo mandan CRUDO en `Authorization` — **sin el prefijo "Bearer"**.

⚠️ **PedidosYa BLOQUEA 10 minutos si se piden tokens de más.** Por eso el token se guarda
compartido en `naufrago.courier_token_cache` y todas las instancias reusan uno solo.

**Envíos · API v3 · base `https://courier-api.pedidosya.com`**

```
POST /v3/shippings/estimates        cotizar
POST /v3/shippings                  despachar (un solo paso)
GET  /v3/shippings/{id}             estado
GET  /v3/shippings/{id}/tracking    posición del motorizado
POST /v3/shippings/{id}/cancel      cancelar
GET  /v3/webhooks-configuration     leer avisos configurados
PUT  /v3/webhooks-configuration     configurar avisos
```

**No hay servidor de pruebas aparte.** Se prueba contra producción mandando `"isTest": true`
en el cuerpo. Los envíos de prueba no despachan motorizado y **el ambiente les avanza el
estado solo** (CONFIRMED → IN_PROGRESS → NEAR_DROPOFF), lo que sirve para probar los avisos.

**Dónde vive el precio.** La respuesta del despacho lo trae en `route.pricing.total`, junto
con `route.distance`, `route.estimatedDrivingTime` y `route.deliveryTimeFrom/To`. **Esa es la
cifra autoritativa** — no la del navegador, ni la de una re-cotización.

**La cotización NO trae tiempo de entrega.** Aparece recién al despachar. Por eso la canoa
dice "tiempo al confirmar" en vez de un 0.

## Credenciales y ajustes (todos en la plataforma de publicación · server-only)

```
PEDIDOSYA_COURIER_CLIENT_ID          PEDIDOSYA_COURIER_PICKUP_ADDRESS
PEDIDOSYA_COURIER_CLIENT_SECRET      PEDIDOSYA_COURIER_PICKUP_CITY
PEDIDOSYA_COURIER_USERNAME           PEDIDOSYA_COURIER_PICKUP_LAT / _LNG
PEDIDOSYA_COURIER_PASSWORD           PEDIDOSYA_COURIER_PICKUP_PHONE
PEDIDOSYA_COURIER_COUNTRY_CODE       PEDIDOSYA_COURIER_PICKUP_NAME
PEDIDOSYA_COURIER_WEBHOOK_KEY        PEDIDOSYA_COURIER_DROPOFF_CITY
PEDIDOSYA_COURIER_IS_TEST
```

**El punto de retiro es la cocina de Guayaquil** (Avenida 8 NO · Urdenor 1 · Tarqui), no Olón.
Olón era el dato de prueba con el que se armó la página. La ubicación canónica vive en
`lib/ubicacion.ts` y **nadie escribe coordenadas a mano**.

## Deudas declaradas

1. **Las 4 rutas de `/api/courier/*` pasan por un adaptador** (`pedidosya-client.ts`) que
   conserva las firmas viejas. Falta migrarlas a `getCourierProvider()` y borrar el adaptador.
2. **El despacho no devuelve `shareLocationUrl`**, así que el enlace de seguimiento del
   proveedor queda vacío. El seguimiento propio (`/order/[code]`) sí funciona.
3. **Al lanzar hay que:** apagar `IS_TEST`, y **re-registrar el aviso apuntando al dominio de
   producción** — hoy apunta a la dirección de la rama de trabajo.
4. `20260518_courier_orders.sql` quedó **obsoleta y NO debe aplicarse**: creaba las tablas en
   el esquema publicado y sin permisos por fila. La buena es `20260825`.
