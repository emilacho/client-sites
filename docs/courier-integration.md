# PedidosYa Courier Integration · Round 74 scaffold

End-to-end customer delivery flow scaffold. **Status · 80% built ·
final 20% blocked on docs/credentials.** Everything below either
works now (typed, validated, compiles, deployed) or has a clearly
marked TODO(R74) at the exact line that needs filling.

## What ships in this round

| Layer | File | State |
|---|---|---|
| Zod schemas | `lib/schemas.ts` (courier* exports) | ✅ ready |
| Server client | `lib/courier/pedidosya-client.ts` | 🟡 endpoint paths + auth body marked TODO |
| Quote API | `app/api/courier/quote/route.ts` | ✅ ready (calls client) |
| Order API | `app/api/courier/order/route.ts` | ✅ ready (calls client + Supabase persist) |
| Webhook API | `app/api/courier/webhook/route.ts` | 🟡 header name + signature format marked TODO |
| Migration SQL | `supabase/migrations/20260518_courier_orders.sql` | ✅ ready (apply manually) |
| UI | `components/v2/CourierQuoteFlow.tsx` + CartDrawer hook | ✅ ready |

## Required environment variables

Add to `.env.local` (dev) and to Vercel project settings (prod /
preview). NEVER expose any of these on the client side · all server
only.

```
PEDIDOSYA_COURIER_BASE_URL=https://courier-api-stg.pedidosya.com
PEDIDOSYA_COURIER_CLIENT_ID=...
PEDIDOSYA_COURIER_CLIENT_SECRET=...
PEDIDOSYA_COURIER_COUNTRY_CODE=EC
PEDIDOSYA_COURIER_PICKUP_ADDRESS=Calle de los Paraguas, frente al Hostal Isramar, Olón
PEDIDOSYA_COURIER_PICKUP_LAT=-1.8021
PEDIDOSYA_COURIER_PICKUP_LNG=-80.7637
PEDIDOSYA_COURIER_PICKUP_PHONE=+593997744288
PEDIDOSYA_COURIER_WEBHOOK_SECRET=...
```

(`PICKUP_LAT/LNG` above are approximate · replace with the kitchen's
actual geocode.)

## What we don't yet know · the TODO(R74) list

1. **Token endpoint URL** ·
   `lib/courier/pedidosya-client.ts` line ~70. The placeholder is
   `POST /v3/oauth/token` with `application/x-www-form-urlencoded`
   body containing `grant_type=client_credentials`. Confirm against
   the "Autenticación" section of the docs.

2. **Estimate endpoint URL + payload shape** ·
   `pedidosya-client.ts` line ~140 (`getDeliveryQuote`). Placeholder
   is `POST /v3/estimates/orders` with a `waypoints[]` array. The
   response keys we read are `estimateId`, `deliveryOfferPrice`,
   `deliveryTimeInMinutes`, `expirationDate`. Reconcile field names
   against the live "Creación de envíos" / "Cotizaciones" section.

3. **Order endpoint URL + payload shape** ·
   `pedidosya-client.ts` line ~195 (`createOrder`). Placeholder is
   `POST /v3/orders` with `contactInfo` + `items[]`. Map to the
   real shape.

4. **Webhook signature header + format** ·
   `pedidosya-client.ts` `verifyWebhookSignature` + the webhook
   route's signature lookup (line ~38 of `webhook/route.ts`). The
   placeholder accepts either `x-pedidosya-signature` or
   `x-signature` and a `sha256=HEX` body. Confirm both.

5. **Country / market identifier** · the docs likely require an
   account-bound country code in either the URL path or a header.
   The scaffold passes `countryCode` inline in each waypoint per
   the conventional PedidosYa shape · if the docs say it goes on
   the URL (`/v3/EC/estimates/orders`) or in a header
   (`X-Country: EC`), update accordingly.

## Wire-up checklist (once docs / credentials arrive)

1. Update the 4 `TODO(R74)` blocks in `pedidosya-client.ts` with the
   real paths + body shapes.
2. Run the SQL migration · paste
   `supabase/migrations/20260518_courier_orders.sql` into the
   Supabase SQL editor.
3. Configure the env vars in `.env.local` + Vercel.
4. Register the webhook URL with PedidosYa:
   `https://<your-host>/api/courier/webhook` · save the secret
   into `PEDIDOSYA_COURIER_WEBHOOK_SECRET`.
5. Smoke test in staging:
   - `curl -X POST .../api/courier/quote -d '{"dropoff":...,"lines":[...]}'`
   - `curl -X POST .../api/courier/order -d '{"quoteToken":...,...}'`
6. Open the CartDrawer in a browser, add an item, click the new
   "Cotizar" button, fill the form, confirm.

## What the user sees (today)

CartDrawer now has a new "Envío PedidosYa" section between the
total and the WhatsApp CTA. With no env vars configured, the
"Cotizar" button still works · the request reaches `/api/courier/quote`
which returns a 503 with `courier_env_missing:PEDIDOSYA_COURIER_CLIENT_ID`.
The UI displays the error and a Reintentar button. As soon as env
vars + endpoint TODOs are filled, the same UI starts serving real
quotes.
