// Tarjeta de residente · leer la tarjeta por su ficha, el mes «desde» y el QR.
import { describe, expect, it } from "vitest"
import { BaseFalsa } from "./ayudas/base-falsa"
import { leerTarjeta, mesEcuador, qrSvg, urlValidacion } from "@/lib/residentes-tarjeta"

const FICHA = "abcDEF123_-xyzABC456789Q"

describe("leer la tarjeta", () => {
  it("activa: nombre, número visible y mes de alta", async () => {
    const base = new BaseFalsa()
    base.sembrar("residentes", { ficha: FICHA, nombre: "María", numero: 7, creado_en: "2026-11-12T15:00:00Z", baja_en: null })
    expect(await leerTarjeta(base, FICHA)).toEqual({ estado: "activa", nombre: "María", numero: "R-0007", desde: "NOV 2026" })
  })
  it("dada de baja → «baja», sin datos", async () => {
    const base = new BaseFalsa()
    base.sembrar("residentes", { ficha: FICHA, nombre: "María", numero: 7, creado_en: "2026-11-12T15:00:00Z", baja_en: "2026-11-13T00:00:00Z" })
    expect(await leerTarjeta(base, FICHA)).toEqual({ estado: "baja" })
  })
  it("ficha desconocida o mal formada → «no_existe»", async () => {
    const base = new BaseFalsa()
    expect(await leerTarjeta(base, FICHA)).toEqual({ estado: "no_existe" })
    expect(await leerTarjeta(base, "../../etc")).toEqual({ estado: "no_existe" })
  })
  it("un error de la base NO se disfraza de «no existe»", async () => {
    const rota = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "caída" } }) }) }) }),
    }
    await expect(leerTarjeta(rota, FICHA)).rejects.toThrow(/no se pudo leer/)
  })
})

describe("mes de alta en Ecuador", () => {
  it("usa el calendario de Guayaquil", () => {
    expect(mesEcuador("2026-12-01T03:00:00Z")).toBe("NOV 2026")
    expect(mesEcuador("2026-12-01T06:00:00Z")).toBe("DIC 2026")
  })
})

describe("el QR", () => {
  it("lleva a la página de la caja de esa ficha", () => {
    expect(urlValidacion("https://naufrago.ec", FICHA)).toBe(`https://naufrago.ec/residentes/v/${FICHA}`)
    expect(urlValidacion("https://naufrago.ec/", FICHA)).toBe(`https://naufrago.ec/residentes/v/${FICHA}`)
  })
  it("se arma en el sitio como SVG, con los colores de la marca", async () => {
    const svg = await qrSvg(urlValidacion("https://naufrago.ec", FICHA))
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain("#1F1138")
    expect(svg).toContain("#F5E9D2")
  })
})
