/**
 * Tarjeta de residente · la lista de vecinos de Emilio (12-nov · CC3).
 */
import { describe, expect, it } from "vitest"
import { baseFalsa } from "./__stubs__/base-residentes-falsa"
import { anularCodigo, codigosParaImprimir, darDeBaja, generarCodigos, listarCodigos, listarVecinos } from "@/lib/residentes-admin"
import { urlRegistroConCodigo } from "@/lib/residentes-hoja"

const RELOJ = () => "2026-11-12T18:00:00Z"

describe("generar códigos", () => {
  it("crea los que se piden, todos con el formato NAU- + 6", async () => {
    const b = baseFalsa({}, RELOJ)
    const hechos = await generarCodigos(b.base, 5)
    expect(hechos).toHaveLength(5)
    for (const c of hechos) expect(c).toMatch(/^NAU-[2-9A-HJKMNP-Z]{6}$/)
    expect(b.tablas.residente_codigos.map((c) => c.codigo)).toEqual(hechos)
  })

  it("si un código ya existía, prueba otro y no lo repite", async () => {
    const b = baseFalsa({ residente_codigos: [{ id: "c0", codigo: "NAU-AAAAAA", usado_en: null, anulado_en: null, residente_id: null }] }, RELOJ)
    const salen = ["NAU-AAAAAA", "NAU-BBBBBB", "NAU-AAAAAA", "NAU-CCCCCC"]
    const hechos = await generarCodigos(b.base, 2, () => salen.shift() as string)
    expect(hechos).toEqual(["NAU-BBBBBB", "NAU-CCCCCC"])
    expect(b.tablas.residente_codigos).toHaveLength(3)
  })

  it("de 1 a 50 por vez", async () => {
    const b = baseFalsa({}, RELOJ)
    await expect(generarCodigos(b.base, 0)).rejects.toThrow(/de 1 a 50/)
    await expect(generarCodigos(b.base, 51)).rejects.toThrow(/de 1 a 50/)
    await expect(generarCodigos(b.base, Number.NaN)).rejects.toThrow(/de 1 a 50/)
    expect(b.tablas.residente_codigos).toHaveLength(0)
  })

  it("si la base falla por otra cosa, se detiene", async () => {
    const b = baseFalsa({}, RELOJ)
    b.romperCon(() => ({ code: "57P01", message: "se cayó" }))
    await expect(generarCodigos(b.base, 3)).rejects.toThrow(/no se pudo guardar/)
  })
})

describe("anular y dar de baja", () => {
  const inicial = () => ({
    residente_codigos: [
      { id: "c-libre", codigo: "NAU-AAAAAA", creado_en: "2026-11-12T10:00:00Z", usado_en: null, anulado_en: null, residente_id: null },
      { id: "c-usado", codigo: "NAU-BBBBBB", creado_en: "2026-11-12T09:00:00Z", usado_en: "2026-11-12T11:00:00Z", anulado_en: null, residente_id: "r-ana" },
    ],
    residentes: [{ id: "r-ana", numero: 7, nombre: "Ana", whatsapp_e164: "593991234567", creado_en: "2026-11-12T11:00:00Z", baja_en: null, baja_motivo: null }],
  })

  it("anula un código sin usar, una sola vez", async () => {
    const b = baseFalsa(inicial(), RELOJ)
    expect(await anularCodigo(b.base, "c-libre")).toBe(true)
    expect(b.tablas.residente_codigos.find((c) => c.id === "c-libre")?.anulado_en).toBeTruthy()
    expect(await anularCodigo(b.base, "c-libre")).toBe(false)
  })

  it("no anula un código ya usado", async () => {
    const b = baseFalsa(inicial(), RELOJ)
    expect(await anularCodigo(b.base, "c-usado")).toBe(false)
    expect(b.tablas.residente_codigos.find((c) => c.id === "c-usado")?.anulado_en).toBeNull()
  })

  it("da de baja con el motivo limpio, y una segunda baja no cambia nada", async () => {
    const b = baseFalsa(inicial(), RELOJ)
    expect(await darDeBaja(b.base, "r-ana", "  perdió   el celular ")).toBe(true)
    const ana = b.tablas.residentes[0]
    expect(ana.baja_en).toBeTruthy()
    expect(ana.baja_motivo).toBe("perdió el celular")
    const primera = ana.baja_en
    expect(await darDeBaja(b.base, "r-ana", "otra")).toBe(false)
    expect(ana.baja_en).toBe(primera)
    expect(ana.baja_motivo).toBe("perdió el celular")
  })

  it("una baja sin motivo guarda vacío, no un texto en blanco", async () => {
    const b = baseFalsa(inicial(), RELOJ)
    await darDeBaja(b.base, "r-ana", "   ")
    expect(b.tablas.residentes[0].baja_motivo).toBeNull()
  })
})

describe("la hoja de códigos", () => {
  it("el QR del código lleva al registro con el código ya puesto, en el dominio público", () => {
    expect(urlRegistroConCodigo("NAU-7K3Q2X")).toBe("https://www.naufrago.ec/residentes?codigo=NAU-7K3Q2X")
  })
})

describe("leer la lista", () => {
  it("cuenta solo las visitas válidas como visitas, y la última es la más nueva", async () => {
    const b = baseFalsa({
      residentes: [
        { id: "r-ana", numero: 7, nombre: "Ana", whatsapp_e164: "593991234567", creado_en: "2026-11-01T11:00:00Z", baja_en: null, baja_motivo: null },
        { id: "r-luis", numero: 3, nombre: "Luis", whatsapp_e164: "593990000000", creado_en: "2026-11-01T11:00:00Z", baja_en: "2026-11-05T00:00:00Z", baja_motivo: "se mudó" },
      ],
      residente_visitas: [
        { residente_id: "r-ana", resultado: "valida", validado_en: "2026-11-10T18:00:00Z" },
        { residente_id: "r-ana", resultado: "valida", validado_en: "2026-11-11T18:00:00Z" },
        { residente_id: "r-ana", resultado: "ya_usada_hoy", validado_en: "2026-11-11T19:00:00Z" },
        { residente_id: "r-luis", resultado: "baja", validado_en: "2026-11-11T19:00:00Z" },
        { residente_id: null, resultado: "no_valido", validado_en: "2026-11-11T19:00:00Z" },
      ],
    }, RELOJ)
    const vs = await listarVecinos(b.base)
    expect(vs.map((v) => [v.numero, v.visitas, v.rechazos, v.ultimaVisita])).toEqual([
      ["R-0003", 0, 1, null],
      ["R-0007", 2, 1, "2026-11-11T18:00:00Z"],
    ])
    expect(vs[0].bajaMotivo).toBe("se mudó")
  })

  it("con más de 1000 visitas no se pierde ninguna (la base corta en 1000 por pedido)", async () => {
    const visitas = Array.from({ length: 2500 }, (_, i) => ({
      id: i + 1,
      residente_id: i % 2 ? "r-ana" : "r-luis",
      resultado: i % 5 === 0 ? "ya_usada_hoy" : "valida",
      validado_en: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(),
    }))
    const b = baseFalsa({
      residentes: [
        { id: "r-ana", numero: 1, nombre: "Ana", whatsapp_e164: "593991234567", creado_en: "2026-01-01T00:00:00Z", baja_en: null, baja_motivo: null },
        { id: "r-luis", numero: 2, nombre: "Luis", whatsapp_e164: "593990000000", creado_en: "2026-01-01T00:00:00Z", baja_en: null, baja_motivo: null },
      ],
      residente_visitas: visitas,
    }, RELOJ)
    const vs = await listarVecinos(b.base)
    const esperado = (id: string) => {
      const suyas = visitas.filter((v) => v.residente_id === id)
      const validas = suyas.filter((v) => v.resultado === "valida")
      return [validas.length, suyas.length - validas.length, validas[validas.length - 1].validado_en]
    }
    expect(vs.map((v) => [v.visitas, v.rechazos, v.ultimaVisita])).toEqual([esperado("r-ana"), esperado("r-luis")])
    expect(vs[0].visitas + vs[0].rechazos + vs[1].visitas + vs[1].rechazos).toBe(2500)
  })

  it("con exactamente 1000, y con más de 1000 vecinos y códigos, salen todos", async () => {
    const vecinos = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}`, numero: i + 1, nombre: `V${i}`, whatsapp_e164: `5939900${String(i).padStart(5, "0")}`, creado_en: "2026-01-01T00:00:00Z", baja_en: null, baja_motivo: null }))
    const codigos = Array.from({ length: 1234 }, (_, i) => ({ id: `c${String(i).padStart(5, "0")}`, codigo: `NAU-${String(i).padStart(6, "2")}`, creado_en: "2026-01-01T00:00:00Z", usado_en: null, anulado_en: null, residente_id: null }))
    const b = baseFalsa({ residentes: vecinos, residente_codigos: codigos }, RELOJ)
    expect(await listarVecinos(b.base)).toHaveLength(1000)
    const cs = await listarCodigos(b.base)
    expect(cs).toHaveLength(1234)
    expect(new Set(cs.map((c) => c.id)).size).toBe(1234) // el desempate por id no repite ni salta filas
  })

  it("si alguien baja el tope de la base (500), la lista sigue completa", async () => {
    const vecinos = Array.from({ length: 1234 }, (_, i) => ({ id: `r${i}`, numero: i + 1, nombre: `V${i}`, sector: "La Playita", whatsapp_e164: `5939900${String(i).padStart(5, "0")}`, creado_en: "2026-01-01T00:00:00Z", baja_en: null, baja_motivo: null }))
    const b = baseFalsa({ residentes: vecinos }, RELOJ, 500)
    const vs = await listarVecinos(b.base)
    expect(vs).toHaveLength(1234)
    expect(new Set(vs.map((v) => v.id)).size).toBe(1234)
    expect(vs[0].sector).toBe("La Playita")
    expect(vs[0].cedula).toBeNull() // los registros de antes de la cédula siguen saliendo, sin cédula
  })

  it("la lista lee y devuelve la cédula (la base entrega solo las columnas que se piden)", async () => {
    const b = baseFalsa({
      residentes: [
        { id: "r-ana", numero: 7, nombre: "Ana", sector: "Centro", cedula: "0912345678", whatsapp_e164: "593991234567", ficha: "f".repeat(24), creado_en: "2026-11-12T11:00:00Z", baja_en: null, baja_motivo: null },
        { id: "r-beto", numero: 8, nombre: "Beto", sector: "Centro", cedula: null, whatsapp_e164: "593990000000", ficha: "g".repeat(24), creado_en: "2026-11-12T11:00:00Z", baja_en: null, baja_motivo: null },
      ],
    }, RELOJ)
    // Como PostgREST: cada fila trae SOLO las columnas del select. Si alguien saca «cedula» del select, se pierde.
    const pedidas: string[] = []
    const base = {
      from: (tabla: string) => {
        const q = b.base.from(tabla)
        const selectOriginal = q.select
        const thenOriginal = q.then
        let cols: string[] | null = null
        q.select = (c: string) => { cols = c.split(",").map((x) => x.trim()); pedidas.push(`${tabla}:${c}`); return selectOriginal.call(q, c) }
        q.then = (ok: (r: unknown) => unknown, mal?: (e: unknown) => unknown) =>
          thenOriginal.call(q, (r: { data: unknown; error: unknown }) => {
            if (tabla !== "residentes" || !cols || !Array.isArray(r.data)) return ok(r)
            const c = cols
            return ok({ ...r, data: r.data.map((f: Record<string, unknown>) => Object.fromEntries(c.filter((k) => k in f).map((k) => [k, f[k]]))) })
          }, mal)
        return q
      },
    }
    const vs = await listarVecinos(base as typeof b.base)
    expect(pedidas.some((p) => p.startsWith("residentes:") && /\bcedula\b/.test(p))).toBe(true)
    expect(pedidas.some((p) => p.startsWith("residentes:") && /\bficha\b/.test(p))).toBe(false) // la ficha no sale de la base para la lista
    expect(vs.find((v) => v.id === "r-ana")?.cedula).toBe("0912345678")
    expect(vs.find((v) => v.id === "r-beto")?.cedula).toBeNull()
  })

  it("los códigos dicen quién los usó", async () => {
    const b = baseFalsa({
      residentes: [{ id: "r-ana", numero: 7, nombre: "Ana" }],
      residente_codigos: [{ id: "c1", codigo: "NAU-AAAAAA", creado_en: "2026-11-12T10:00:00Z", usado_en: "2026-11-12T11:00:00Z", anulado_en: null, residente_id: "r-ana" }],
    }, RELOJ)
    const cs = await listarCodigos(b.base)
    expect(cs[0].usadoPor).toBe("R-0007 · Ana")
  })

  it("para imprimir salen solo los sin usar y sin anular, y si se piden unos, solo esos", async () => {
    const b = baseFalsa({
      residente_codigos: [
        { id: "a", codigo: "NAU-AAAAAA", creado_en: "2026-11-12T10:00:00Z", usado_en: null, anulado_en: null, residente_id: null },
        { id: "b", codigo: "NAU-BBBBBB", creado_en: "2026-11-12T10:01:00Z", usado_en: "2026-11-12T11:00:00Z", anulado_en: null, residente_id: "r" },
        { id: "c", codigo: "NAU-CCCCCC", creado_en: "2026-11-12T10:02:00Z", usado_en: null, anulado_en: "2026-11-12T11:00:00Z", residente_id: null },
        { id: "d", codigo: "NAU-DDDDDD", creado_en: "2026-11-12T10:03:00Z", usado_en: null, anulado_en: null, residente_id: null },
      ],
    }, RELOJ)
    expect(await codigosParaImprimir(b.base, null)).toEqual(["NAU-AAAAAA", "NAU-DDDDDD"])
    expect(await codigosParaImprimir(b.base, ["NAU-DDDDDD", "NAU-BBBBBB"])).toEqual(["NAU-DDDDDD"])
  })
})
