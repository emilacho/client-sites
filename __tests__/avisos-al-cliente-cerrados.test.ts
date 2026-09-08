/**
 * avisos-al-cliente-cerrados.test.ts · R170
 *
 * EL AGUJERO QUE ESTAS PRUEBAS CUIDAN
 * La dirección que manda el "tu pedido está confirmado" por WhatsApp
 * recibía del navegador el teléfono, el monto y el ENLACE de
 * seguimiento, y mandaba el mensaje con todo eso desde el número del
 * local · sin comprobar nada.
 *
 * O sea que cualquiera podía hacerle llegar a cualquier número un
 * WhatsApp con la cara del local y un enlace a donde quisiera. Ese es
 * el molde exacto de una estafa por mensaje, y de paso gasta el saldo
 * de mensajería.
 *
 * Dos cerrojos, y los dos se prueban acá:
 *   1 · sólo la llama el propio sistema
 *   2 · aunque la llamen, TODO sale de la ficha guardada · ni el
 *       destinatario ni el enlace se pueden elegir desde afuera
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BaseFalsa } from "./ayudas/base-falsa"

const LLAVE = "llave-interna-de-prueba-con-largo-suficiente"

const { base, twilio } = vi.hoisted(() => ({
  base: { actual: null as unknown },
  twilio: { llamadas: [] as { url: string; body: string }[] },
}))

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => base.actual }))

import { POST as avisoConfirmado } from "../app/api/notifications/order-confirm/route"
import { POST as avisoEstado } from "../app/api/notifications/order-status/route"
import { CABECERA_INTERNA } from "../lib/llave-interna"
import type { NextRequest } from "next/server"

function pedir(
  cuerpo: Record<string, unknown>,
  opciones: { conLlave?: boolean } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (opciones.conLlave) headers[CABECERA_INTERNA] = LLAVE
  return new Request("http://localhost:3000/api/notifications/order-confirm", {
    method: "POST",
    headers,
    body: JSON.stringify(cuerpo),
  }) as unknown as NextRequest
}

let supa: BaseFalsa
const original = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  twilio.llamadas = []
  process.env.NAUFRAGO_LLAVE_INTERNA = LLAVE
  process.env.TWILIO_ACCOUNT_SID = "AC123"
  process.env.TWILIO_AUTH_TOKEN = "tok"
  process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886"

  supa = new BaseFalsa()
  base.actual = supa
  supa.sembrar("orders", {
    id: "uuid-1",
    client_slug: "naufrago",
    order_code: "NF-2609-ABC123",
    customer_phone: "593987654321",
    total_usd: 17.5,
    cart_lines: [{ qty: 2 }, { qty: 1 }],
  })

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: { body?: string }) => {
      twilio.llamadas.push({ url: String(url), body: String(init?.body ?? "") })
      return new Response(JSON.stringify({ sid: "SM999" }), { status: 200 })
    }),
  )
})

afterEach(() => {
  process.env = { ...original }
  vi.unstubAllGlobals()
})

const mensajeEnviado = () => new URLSearchParams(twilio.llamadas[0]?.body ?? "")

describe("el aviso de confirmación ya no es un megáfono abierto · R170", () => {
  it("sin la llave del sistema · 404 y no se manda nada", async () => {
    const res = await avisoConfirmado(pedir({ orderCode: "NF-2609-ABC123" }))
    expect(res.status).toBe(404)
    expect(twilio.llamadas).toHaveLength(0)
  })

  it("con la llave · manda el aviso al teléfono de la FICHA", async () => {
    const res = await avisoConfirmado(
      pedir({ orderCode: "NF-2609-ABC123" }, { conLlave: true }),
    )
    expect(res.status).toBe(200)
    expect(mensajeEnviado().get("To")).toBe("whatsapp:+593987654321")
  })

  it("no se puede elegir a quién le llega · el teléfono de afuera se ignora", async () => {
    await avisoConfirmado(
      pedir(
        { orderCode: "NF-2609-ABC123", customerPhone: "593000000000" },
        { conLlave: true },
      ),
    )
    // Llega al de la ficha, no al que mandaron.
    expect(mensajeEnviado().get("To")).toBe("whatsapp:+593987654321")
  })

  it("no se puede elegir el enlace · acá vivía la estafa por mensaje", async () => {
    await avisoConfirmado(
      pedir(
        {
          orderCode: "NF-2609-ABC123",
          trackingUrl: "https://sitio-del-estafador.com/pagar",
        },
        { conLlave: true },
      ),
    )
    const texto = mensajeEnviado().get("Body") ?? ""
    expect(texto).not.toContain("estafador")
    expect(texto).toContain("/order/NF-2609-ABC123")
  })

  it("no se puede inventar el monto · sale de la ficha", async () => {
    await avisoConfirmado(
      pedir(
        { orderCode: "NF-2609-ABC123", totalUsd: 9999, itemCount: 40 },
        { conLlave: true },
      ),
    )
    const texto = mensajeEnviado().get("Body") ?? ""
    expect(texto).toContain("$17.50")
    expect(texto).toContain("3 platos") // 2 + 1 de la ficha
    expect(texto).not.toContain("9999")
  })

  it("un pedido inexistente no manda nada", async () => {
    const res = await avisoConfirmado(
      pedir({ orderCode: "NF-0000-NADA00" }, { conLlave: true }),
    )
    expect(res.status).toBe(404)
    expect(twilio.llamadas).toHaveLength(0)
  })

  it("se manda una sola vez · reintentar no duplica el mensaje", async () => {
    await avisoConfirmado(pedir({ orderCode: "NF-2609-ABC123" }, { conLlave: true }))
    await avisoConfirmado(pedir({ orderCode: "NF-2609-ABC123" }, { conLlave: true }))
    expect(twilio.llamadas).toHaveLength(1)
  })

  it("sin llave configurada en el servidor · tampoco pasa", async () => {
    delete process.env.NAUFRAGO_LLAVE_INTERNA
    const res = await avisoConfirmado(
      pedir({ orderCode: "NF-2609-ABC123" }, { conLlave: true }),
    )
    expect(res.status).toBe(404)
  })
})

describe("los avisos de cambio de estado también están cerrados · R170", () => {
  it("sin la llave del sistema · 404", async () => {
    const res = await avisoEstado(
      pedir({ orderCode: "NF-2609-ABC123", newStatus: "COOKING" }),
    )
    expect(res.status).toBe(404)
    expect(twilio.llamadas).toHaveLength(0)
  })
})
