/** R172 · la marca de prueba: un dispositivo declarado de prueba rotula el pedido y los eventos; uno normal no. */
import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { CLAVE_ES_PRUEBA, declararPruebaDesdeLaDireccion, esDispositivoDePrueba } from "@/lib/v2/es-prueba"
import { courierOrderRequestSchema } from "@/lib/schemas"

function ventanaFalsa() {
  const almacen = new Map<string, string>()
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => almacen.get(k) ?? null, setItem: (k: string, v: string) => void almacen.set(k, v), removeItem: (k: string) => void almacen.delete(k) } })
  return almacen
}
afterEach(() => vi.unstubAllGlobals())

describe("R172 · dispositivo de prueba", () => {
  it("por defecto no es de prueba; ?prueba=1 lo declara; ?prueba=0 lo quita; otras direcciones no cambian nada", () => {
    ventanaFalsa()
    expect(esDispositivoDePrueba()).toBe(false)
    declararPruebaDesdeLaDireccion("a=1"); expect(esDispositivoDePrueba()).toBe(false)
    declararPruebaDesdeLaDireccion("prueba=si"); expect(esDispositivoDePrueba()).toBe(false)
    declararPruebaDesdeLaDireccion("prueba=1"); expect(esDispositivoDePrueba()).toBe(true)
    declararPruebaDesdeLaDireccion("x=1"); expect(esDispositivoDePrueba()).toBe(true) // queda guardado
    declararPruebaDesdeLaDireccion("prueba=0"); expect(esDispositivoDePrueba()).toBe(false)
  })
  it("sin almacenamiento disponible no falla y no marca", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("bloqueado") }, setItem: () => { throw new Error("bloqueado") }, removeItem: () => { throw new Error("bloqueado") } } })
    expect(esDispositivoDePrueba()).toBe(false)
    expect(() => declararPruebaDesdeLaDireccion("prueba=1")).not.toThrow()
  })
  it("en el servidor (sin window) nunca es de prueba", () => { expect(esDispositivoDePrueba()).toBe(false); expect(CLAVE_ES_PRUEBA).toBe("naufrago_es_prueba") })
})

describe("R172 · el pedido y la analítica llevan la marca", () => {
  it("el pedido acepta esPrueba opcional y solo booleano", () => {
    const base = { customer: { name: "A", phone: "0999999999" }, dropoff: { street: "x" }, lines: [{ id: "1", name: "j", priceUsd: 1, qty: 1 }] }
    const mal = courierOrderRequestSchema.safeParse({ ...base, esPrueba: "si" })
    expect(mal.success).toBe(false)
    if (!mal.success) expect(mal.error.issues.some((i) => i.path.join(".") === "esPrueba")).toBe(true) // falla por la marca, no por otro campo
    const sin = courierOrderRequestSchema.safeParse({ ...base })
    if (!sin.success) expect(sin.error.issues.some((i) => i.path.join(".") === "esPrueba")).toBe(false) // sin la marca no se exige
  })
  it("la ruta guarda es_prueba (modo simulado o dispositivo declarado), el carrito lo manda y cada evento lo lleva", () => {
    expect(readFileSync("app/api/courier/order/route.ts", "utf8")).toContain("es_prueba: mockMode || parsed.data.esPrueba === true")
    expect(readFileSync("components/v2/CartDrawer.tsx", "utf8")).toContain("esPrueba: esDispositivoDePrueba() || undefined")
    expect(readFileSync("lib/v2/posthog-track.ts", "utf8")).toContain("esDispositivoDePrueba() ? { es_prueba: true } : {}")
    expect(readFileSync("components/v2/PageViewTracker.tsx", "utf8")).toContain("declararPruebaDesdeLaDireccion(search)")
    expect(readFileSync("supabase/migrations/20261104_naufrago_es_prueba.sql", "utf8")).toContain("boolean not null default false")
  })
})

describe("R184 · la marca de prueba no abre el local", () => {
  afterEach(() => vi.useRealTimers())
  it("con la cocina cerrada, la cabecera vieja de prueba ya no deja cotizar ni pedir", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T22:00:00Z")) // miércoles 17:00 en Ecuador, pasada la apertura temporal: cerrado
    const cuerpo = JSON.stringify({ quoteToken: "t", customer: { name: "A", phone: "0999999999" }, dropoff: { street: "x" }, lines: [{ id: "1", name: "j", priceUsd: 1, qty: 1 }], esPrueba: true })
    const pedir = (ruta: string) => new Request("http://x/api/courier/" + ruta, { method: "POST", headers: { "Content-Type": "application/json", "x-naufrago-prueba": "1" }, body: cuerpo })
    const { POST: cotizar } = await import("@/app/api/courier/quote/route")
    expect((await (await cotizar(pedir("quote"))).json()).error).toBe("local_cerrado")
    for (const f of ["app/api/courier/order/route.ts", "app/api/courier/quote/route.ts", "components/v2/CartDrawer.tsx"]) {
      const codigo = readFileSync(f, "utf8")
      expect(codigo).toContain("cocinaAbierta()")
      expect(codigo).not.toContain("x-naufrago-prueba")
    }
  })
  it("la apertura temporal sigue valiendo para todos y vuelve sola", async () => {
    const { cocinaAbierta, APERTURA_TEMPORAL_HASTA } = await import("@/lib/horario")
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse(APERTURA_TEMPORAL_HASTA) - 60_000); expect(cocinaAbierta()).toBe(true)
    vi.setSystemTime(Date.parse(APERTURA_TEMPORAL_HASTA) + 60_000); expect(cocinaAbierta()).toBe(false)
  })
})
