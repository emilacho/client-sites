/**
 * Tarjeta de residente · la caja (12-nov · CC3): validar + anotar en un solo paso, una vez por día de Ecuador,
 * y la llave del aparato.
 */
import { afterEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import { baseFalsa } from "./__stubs__/base-residentes-falsa"
import { validarYAnotar, horaEcuador } from "@/lib/residentes-validar"
import { LLAVE_ADMIN, LLAVE_CAJA, igual, llaveValida } from "@/lib/llave-de-aparato"
import { entrarConLlave } from "@/lib/entrar-con-llave"

const FICHA = "AbCdEfGhIjKlMnOpQrStUv_-"
const FICHA_BAJA = "zzzzzzzzzzzzzzzzzzzzzzzz"
const ANA = { id: "r-ana", numero: 7, nombre: "Ana Pérez", ficha: FICHA, baja_en: null }
const LUIS = { id: "r-luis", numero: 12, nombre: "Luis", ficha: FICHA_BAJA, baja_en: "2026-11-01T00:00:00Z" }

function caja(reloj: () => string) {
  return baseFalsa({ residentes: [structuredClone(ANA), structuredClone(LUIS)] }, reloj)
}

describe("validar en la caja", () => {
  it("la primera vez del día vale y deja UNA visita válida", async () => {
    const b = caja(() => "2026-11-12T18:05:00Z")
    const r = await validarYAnotar(b.base, FICHA)
    expect(r).toEqual({ estado: "valida", nombre: "Ana Pérez", numero: "R-0007" })
    expect(b.tablas.residente_visitas.map((v) => [v.residente_id, v.resultado])).toEqual([["r-ana", "valida"]])
  })

  it("el segundo escaneo del mismo día dice «ya se usó hoy», con la hora de Ecuador del uso, y no cuenta como uso", async () => {
    let ahora = "2026-11-12T18:05:00Z" // 13:05 en Ecuador
    const b = caja(() => ahora)
    await validarYAnotar(b.base, FICHA)
    ahora = "2026-11-12T20:00:00Z"
    const r = await validarYAnotar(b.base, FICHA)
    expect(r).toEqual({ estado: "ya_usada_hoy", nombre: "Ana Pérez", numero: "R-0007", horaUso: "13:05" })
    expect(b.tablas.residente_visitas.map((v) => v.resultado)).toEqual(["valida", "ya_usada_hoy"])
  })

  it("dos escaneos a la vez: solo uno pasa", async () => {
    const b = caja(() => "2026-11-12T18:05:00Z")
    const rs = await Promise.all([validarYAnotar(b.base, FICHA), validarYAnotar(b.base, FICHA)])
    expect(rs.map((r) => r.estado).sort()).toEqual(["valida", "ya_usada_hoy"])
    expect(b.tablas.residente_visitas.filter((v) => v.resultado === "valida")).toHaveLength(1)
  })

  it("el día es el de Ecuador: 23:59 y 00:01 de Guayaquil son días distintos", async () => {
    let ahora = "2026-11-13T04:59:00Z" // 12-nov 23:59 en Ecuador
    const b = caja(() => ahora)
    expect((await validarYAnotar(b.base, FICHA)).estado).toBe("valida")
    ahora = "2026-11-13T05:01:00Z" // 13-nov 00:01 en Ecuador
    expect((await validarYAnotar(b.base, FICHA)).estado).toBe("valida")
    ahora = "2026-11-13T05:02:00Z"
    expect((await validarYAnotar(b.base, FICHA)).estado).toBe("ya_usada_hoy")
  })

  it("una tarjeta de baja no vale y el escaneo queda anotado como baja", async () => {
    const b = caja(() => "2026-11-12T18:05:00Z")
    expect(await validarYAnotar(b.base, FICHA_BAJA)).toEqual({ estado: "baja", nombre: "Luis", numero: "R-0012" })
    expect(b.tablas.residente_visitas.map((v) => [v.residente_id, v.resultado])).toEqual([["r-luis", "baja"]])
  })

  it("una ficha que no existe, o mal escrita, no vale, no muestra datos y queda anotada sin vecino", async () => {
    const b = caja(() => "2026-11-12T18:05:00Z")
    expect(await validarYAnotar(b.base, "A".repeat(24))).toEqual({ estado: "no_valido" })
    expect(await validarYAnotar(b.base, "no-es-una-ficha")).toEqual({ estado: "no_valido" })
    expect(b.tablas.residente_visitas.map((v) => [v.residente_id, v.resultado])).toEqual([[null, "no_valido"], [null, "no_valido"]])
    // la ficha mal escrita ni siquiera se busca
    expect(b.llamadas.filter((l) => l === "select:residentes")).toHaveLength(1)
  })

  it("si la base falla al anotar la válida, NO da la tarjeta por buena", async () => {
    const b = caja(() => "2026-11-12T18:05:00Z")
    b.romperCon((tabla, op) => (tabla === "residente_visitas" && op === "insert" ? { code: "57P01", message: "se cayó" } : null))
    await expect(validarYAnotar(b.base, FICHA)).rejects.toThrow(/no se pudo anotar/)
  })

  it("un duplicado de OTRA regla no se confunde con «ya se usó hoy»", async () => {
    const b = caja(() => "2026-11-12T18:05:00Z")
    b.romperCon((tabla, op) => (tabla === "residente_visitas" && op === "insert" ? { code: "23505", message: 'duplicate key value violates unique constraint "residente_visitas_pkey"' } : null))
    await expect(validarYAnotar(b.base, FICHA)).rejects.toThrow(/no se pudo anotar/)
  })

  it("si no se puede leer la tarjeta, falla en vez de decir «no válido»", async () => {
    const b = caja(() => "2026-11-12T18:05:00Z")
    b.romperCon((tabla, op) => (tabla === "residentes" && op === "select" ? { code: "57P01", message: "se cayó" } : null))
    await expect(validarYAnotar(b.base, FICHA)).rejects.toThrow(/no se pudo leer/)
    expect(b.tablas.residente_visitas).toHaveLength(0)
  })

  it("la hora se muestra en Ecuador", () => {
    expect(horaEcuador("2026-11-12T18:05:00Z")).toBe("13:05")
  })
})

describe("la llave del aparato", () => {
  const antes = { caja: process.env.RESIDENTES_CAJA_LLAVE, admin: process.env.RESIDENTES_ADMIN_LLAVE }
  afterEach(() => {
    process.env.RESIDENTES_CAJA_LLAVE = antes.caja
    process.env.RESIDENTES_ADMIN_LLAVE = antes.admin
    if (antes.caja === undefined) delete process.env.RESIDENTES_CAJA_LLAVE
    if (antes.admin === undefined) delete process.env.RESIDENTES_ADMIN_LLAVE
  })

  it("sin llave cargada (o corta) no abre para nadie", () => {
    delete process.env.RESIDENTES_CAJA_LLAVE
    expect(llaveValida(LLAVE_CAJA, "cualquier-cosa-larga-123")).toBe(false)
    process.env.RESIDENTES_CAJA_LLAVE = "corta"
    expect(llaveValida(LLAVE_CAJA, "corta")).toBe(false)
  })

  it("abre solo con la llave exacta, y la de la caja no abre la lista de Emilio", () => {
    process.env.RESIDENTES_CAJA_LLAVE = "llave-de-la-caja-0001"
    process.env.RESIDENTES_ADMIN_LLAVE = "llave-de-emilio-00001"
    expect(llaveValida(LLAVE_CAJA, "llave-de-la-caja-0001")).toBe(true)
    expect(llaveValida(LLAVE_CAJA, "llave-de-la-caja-0002")).toBe(false)
    expect(llaveValida(LLAVE_CAJA, "")).toBe(false)
    expect(llaveValida(LLAVE_ADMIN, "llave-de-la-caja-0001")).toBe(false)
    expect(igual("abc", "abcd")).toBe(false)
  })

  it("entrar con la llave correcta guarda la galleta y redirige SIN la llave en la dirección", () => {
    process.env.RESIDENTES_CAJA_LLAVE = "llave-de-la-caja-0001"
    const r = entrarConLlave(new NextRequest("https://naufrago.ec/residentes/caja?llave=llave-de-la-caja-0001"), LLAVE_CAJA, "/residentes/caja/lista")
    expect(r.status).toBe(303)
    expect(r.headers.get("location")).toBe("https://naufrago.ec/residentes/caja/lista")
    const g = r.cookies.get("naufrago_caja_llave")
    expect(g?.value).toBe("llave-de-la-caja-0001")
    expect(g?.httpOnly).toBe(true)
    expect(g?.path).toBe("/residentes")
  })

  it("entrar con una llave equivocada no guarda nada", () => {
    process.env.RESIDENTES_CAJA_LLAVE = "llave-de-la-caja-0001"
    const r = entrarConLlave(new NextRequest("https://naufrago.ec/residentes/caja?llave=otra-llave-cualquiera"), LLAVE_CAJA, "/residentes/caja/lista")
    expect(r.status).toBe(303)
    expect(r.cookies.get("naufrago_caja_llave")).toBeUndefined()
  })
})
