/**
 * R190 · La base rechazaba eventos sin que nadie se enterara, y dos de
 * ellos son el control para no repetirle un WhatsApp al cliente.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import type { NextRequest } from "next/server"
import { BaseFalsa } from "./ayudas/base-falsa"

const LLAVE = "llave-interna-de-prueba-con-largo-suficiente"
const { base } = vi.hoisted(() => ({ base: { actual: null as unknown } }))

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => base.actual }))

import { POST as avisoConfirmado } from "../app/api/notifications/order-confirm/route"
import { POST as avisoEstado } from "../app/api/notifications/order-status/route"
import { CABECERA_INTERNA } from "../lib/llave-interna"
import { guardarEvento } from "../lib/eventos-pedido"
import {
  NAUFRAGO_ORDER_EVENT_ACTORS,
  NAUFRAGO_ORDER_EVENT_TYPES,
} from "../lib/schemas"

const MIGRACIONES = "supabase/migrations"

/** Valores de la última migración que define esa restricción. */
function listaDeLaRestriccion(nombre: string, hasta?: string): string[] {
  const archivos = readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith(".sql") && (!hasta || f <= hasta))
    .sort()
    .reverse()
  for (const a of archivos) {
    const texto = readFileSync(join(MIGRACIONES, a), "utf8")
    const m = new RegExp(
      `add constraint ${nombre}[\\s\\S]*?array\\[([\\s\\S]*?)\\]`,
      "i",
    ).exec(texto)
    if (m) return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }
  throw new Error(`Ninguna migración define ${nombre}`)
}

const RESTRICCION = "naufrago_order_events_event_type_check"
const TIPOS_DE_HOY = listaDeLaRestriccion(RESTRICCION)
const TIPOS_DE_ANTES = listaDeLaRestriccion(
  RESTRICCION,
  "20260828_naufrago_loyverse.sql",
)

/** Lista viva de actores, leída de la base el 2026-11-04. */
const ACTORES_DE_LA_BASE = [
  "system",
  "customer",
  "staff",
  "webhook:pedidosya-courier",
  "webhook:rappi",
  "webhook:uber-eats",
  "webhook:payment",
]

function basePedido(tiposAdmitidos: string[]) {
  const supa = new BaseFalsa()
  supa.sembrar("orders", {
    id: "uuid-1",
    client_slug: "naufrago",
    order_code: "NF-2611-AAA111",
    customer_phone: "593987654321",
    total_usd: 17.5,
    delivery_eta_minutes: 30,
    cart_lines: [{ qty: 1 }],
  })
  const from = supa.from.bind(supa)
  ;(supa as unknown as { from: unknown }).from = (tabla: string) => {
    const q = from(tabla) as unknown as Record<string, unknown>
    if (tabla !== "order_events") return q
    const insertar = (q.insert as (f: unknown) => unknown).bind(q)
    q.insert = (fila: { event_type: string }) =>
      tiposAdmitidos.includes(fila.event_type)
        ? insertar(fila)
        : Promise.resolve({ data: null, error: { message: "viola la restricción" } })
    return q
  }
  base.actual = supa
  return supa
}

const pedir = (cuerpo: unknown) =>
  new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", [CABECERA_INTERNA]: LLAVE },
    body: JSON.stringify(cuerpo),
  }) as unknown as NextRequest

const envios = () => vi.mocked(fetch).mock.calls.length

beforeEach(() => {
  vi.stubEnv("NAUFRAGO_LLAVE_INTERNA", LLAVE)
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123")
  vi.stubEnv("TWILIO_AUTH_TOKEN", "tok")
  vi.stubEnv("TWILIO_WHATSAPP_FROM", "whatsapp:+10000000000")
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ sid: "SM1" }), { status: 201 })),
  )
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("la lista del código es la de la base", () => {
  it("los tipos coinciden con la última restricción", () => {
    expect([...NAUFRAGO_ORDER_EVENT_TYPES].sort()).toEqual([...TIPOS_DE_HOY].sort())
  })

  it("no se perdió ningún tipo que la base ya admitía", () => {
    expect(TIPOS_DE_HOY).toEqual(expect.arrayContaining(TIPOS_DE_ANTES))
    expect(TIPOS_DE_ANTES).toHaveLength(21)
    expect(TIPOS_DE_HOY).toHaveLength(25)
  })

  it("los actores coinciden con los de la base", () => {
    expect([...NAUFRAGO_ORDER_EVENT_ACTORS].sort()).toEqual(
      [...ACTORES_DE_LA_BASE].sort(),
    )
  })
})

describe("guardarEvento", () => {
  const evento = {
    order_id: "uuid-1",
    event_type: "DELIVERED",
    actor: "system",
  } as const

  it("si la base rechaza sin lanzar, lo dice y no tumba nada", async () => {
    const rechaza = {
      from: () => ({
        insert: async () => ({ error: { message: "viola la restricción" } }),
      }),
    }
    await expect(guardarEvento(rechaza, evento)).resolves.toBe(false)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("viola la restricción"),
    )
  })

  it("si la llamada lanza, tampoco tumba nada", async () => {
    const revienta = {
      from: () => ({
        insert: async () => {
          throw new Error("sin red")
        },
      }),
    }
    await expect(guardarEvento(revienta, evento)).resolves.toBe(false)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("sin red"))
  })

  it("si guarda, no hace ruido", async () => {
    const guarda = { from: () => ({ insert: async () => ({ error: null }) }) }
    await expect(guardarEvento(guarda, evento)).resolves.toBe(true)
    expect(console.error).not.toHaveBeenCalled()
  })
})

describe("un aviso repetido · un solo WhatsApp", () => {
  const estado = { orderCode: "NF-2611-AAA111", newStatus: "DELIVERED" }
  const confirmado = { orderCode: "NF-2611-AAA111" }

  it("control · con la lista de antes salían dos", async () => {
    basePedido(TIPOS_DE_ANTES)
    await avisoEstado(pedir(estado))
    await avisoEstado(pedir(estado))
    expect(envios()).toBe(2)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("WHATSAPP_STATUS_NOTIFIED"),
    )
  })

  it("el aviso de estado sale una vez", async () => {
    const supa = basePedido(TIPOS_DE_HOY)
    const primero = await (await avisoEstado(pedir(estado))).json()
    const segundo = await (await avisoEstado(pedir(estado))).json()
    expect(primero.sent).toBe(true)
    expect(segundo).toMatchObject({ sent: false, reason: "already_notified" })
    expect(envios()).toBe(1)
    expect(supa.filas("order_events")).toHaveLength(1)
  })

  it("otro estado del mismo pedido sí sale", async () => {
    basePedido(TIPOS_DE_HOY)
    await avisoEstado(pedir(estado))
    await avisoEstado(pedir({ ...estado, newStatus: "CANCELLED" }))
    expect(envios()).toBe(2)
  })

  it("control · la confirmación con la lista de antes salía dos veces", async () => {
    basePedido(TIPOS_DE_ANTES)
    await avisoConfirmado(pedir(confirmado))
    await avisoConfirmado(pedir(confirmado))
    expect(envios()).toBe(2)
  })

  it("la confirmación sale una vez", async () => {
    basePedido(TIPOS_DE_HOY)
    await avisoConfirmado(pedir(confirmado))
    const segundo = await (await avisoConfirmado(pedir(confirmado))).json()
    expect(segundo).toMatchObject({ sent: false, reason: "ya_enviado" })
    expect(envios()).toBe(1)
  })
})

describe("nadie escribe la bitácora por su cuenta", () => {
  const fuentes = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const r = join(dir, n)
      return statSync(r).isDirectory()
        ? fuentes(r)
        : /\.tsx?$/.test(n)
          ? [r]
          : []
    })

  it("solo guardarEvento hace el insert", () => {
    const directos = [...fuentes("app"), ...fuentes("lib")].filter(
      (f) =>
        !f.replace(/\\/g, "/").endsWith("lib/eventos-pedido.ts") &&
        /from\(\s*["']order_events["']\s*\)\s*\.(insert|upsert)\(/.test(
          readFileSync(f, "utf8"),
        ),
    )
    expect(directos).toEqual([])
  })
})
