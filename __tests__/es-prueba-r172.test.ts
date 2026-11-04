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

describe("R172 · ensayar un pedido con la cocina cerrada", () => {
  it("solo el dispositivo de prueba pasa; la cocina cerrada sigue cerrada para los demás, en pantalla y en el servidor", async () => {
    const { cocinaAbierta } = await import("@/lib/horario")
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-04T22:00:00Z")) // miércoles 17:00 en Ecuador: cerrado
    expect(cocinaAbierta()).toBe(false)
    expect(cocinaAbierta(false)).toBe(false)
    expect(cocinaAbierta(true)).toBe(true)
    vi.useRealTimers()
    for (const f of ["app/api/courier/order/route.ts", "app/api/courier/quote/route.ts"]) expect(readFileSync(f, "utf8")).toContain('cocinaAbierta(request.headers.get("x-naufrago-prueba") === "1")')
    const c = readFileSync("components/v2/CartDrawer.tsx", "utf8")
    expect(c).toContain("setAbierto(cocinaAbierta(esDispositivoDePrueba()))")
    expect(c.match(/"x-naufrago-prueba": "1"/g)?.length).toBe(2)
  })
})
