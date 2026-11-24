/**
 * horario.test.ts · R162
 *
 * El horario nuevo · 7:00 a 15:00, cerrado martes y miércoles.
 * Y lo que importa: que el cierre se decida con la hora DE LA COCINA,
 * no con el reloj de quien mira la página desde otro país.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import {
  COCINA_ABRE_H,
  COCINA_CIERRA_H,
  DIAS_CERRADOS,
  HORARIO_TEXTO,
  cocinaAbierta,
  cocinaAbiertaCon,
  INAUGURACION,
  DIAS_EXTRA_ABIERTOS,
  antesDeLaInauguracion,
  avisoDeLaInauguracion,
  fechaEnLaCocina,
  mensajeDeCerrado,
} from "@/lib/horario"

/** Un instante real en UTC · Ecuador es UTC-5 todo el año. */
const enGuayaquil = (dia: string, hora: number, minuto = 0) =>
  new Date(`${dia}T${String(hora + 5).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00Z`)

afterEach(() => vi.useRealTimers())

const congelar = (d: Date) => { vi.useFakeTimers(); vi.setSystemTime(d) }

describe("el horario que puso Emilio · R162", () => {
  it("abre a las 7 y cierra a las 15", () => {
    expect(COCINA_ABRE_H).toBe(7)
    expect(COCINA_CIERRA_H).toBe(15)
  })

  it("cierra martes y miércoles", () => {
    expect([...DIAS_CERRADOS]).toEqual([2, 3])
  })

  it("el texto que lee el cliente dice lo mismo", () => {
    expect(HORARIO_TEXTO).toBe("jueves a lunes de 7:00 a 15:00")
  })
})

describe("¿está abierta la cocina? · R162 (el horario de siempre, ya inaugurado)", () => {
  // 2026-11-30 es lunes · 01-dic martes · 02-dic miércoles · 03-dic jueves (24-nov: fechas después de la inauguración; antes, todo cerrado)
  it("lunes a las 10 de la mañana · abierto", () => {
    congelar(enGuayaquil("2026-11-30", 10))
    expect(cocinaAbiertaCon("", [])).toBe(true)
  })

  it("lunes a las 6 de la mañana · todavía cerrado", () => {
    congelar(enGuayaquil("2026-11-30", 6, 59))
    expect(cocinaAbiertaCon("", [])).toBe(false)
  })

  it("justo a las 7 en punto · abre", () => {
    congelar(enGuayaquil("2026-11-30", 7, 0))
    expect(cocinaAbiertaCon("", [])).toBe(true)
  })

  it("a las 14:59 todavía se puede pedir", () => {
    congelar(enGuayaquil("2026-11-30", 14, 59))
    expect(cocinaAbiertaCon("", [])).toBe(true)
  })

  it("a las 15:00 en punto ya no", () => {
    congelar(enGuayaquil("2026-11-30", 15, 0))
    expect(cocinaAbiertaCon("", [])).toBe(false)
  })

  it("martes al mediodía · cerrado aunque sea plena hora de almuerzo", () => {
    congelar(enGuayaquil("2026-12-01", 12))
    expect(cocinaAbiertaCon("", [])).toBe(false)
  })

  it("miércoles al mediodía · cerrado", () => {
    congelar(enGuayaquil("2026-12-02", 12))
    expect(cocinaAbiertaCon("", [])).toBe(false)
  })

  it("jueves al mediodía · vuelve a abrir", () => {
    congelar(enGuayaquil("2026-12-03", 12))
    expect(cocinaAbiertaCon("", [])).toBe(true)
  })

  it("manda la hora de la COCINA, no la de quien mira", () => {
    // 2026-11-30 03:00 UTC = domingo 29-nov 22:00 en Guayaquil · cerrado acá,
    // aunque en el reloj UTC ya sea lunes de madrugada.
    congelar(new Date("2026-11-30T03:00:00Z"))
    expect(cocinaAbiertaCon("", [])).toBe(false)
  })
})

describe("abrimos pronto, sin fecha · 24-nov (Emilio 20:05 Zúrich)", () => {
  it("hoy no hay fecha: la constante es null y no queda ningún miércoles extra", () => {
    expect(INAUGURACION).toBeNull()
    expect([...DIAS_EXTRA_ABIERTOS]).toEqual([])
  })

  it("sin fecha no se puede pedir: ni el miércoles 25 a las 7:00 (ya no abre sola), ni el jueves 26 al mediodía, ni en un año", () => {
    for (const d of [enGuayaquil("2026-11-25", 7, 0), enGuayaquil("2026-11-26", 12), enGuayaquil("2027-11-25", 10)]) {
      congelar(d)
      expect(antesDeLaInauguracion()).toBe(true)
      expect(cocinaAbierta()).toBe(false)
    }
  })

  it("el aviso no tiene fecha ni hora", () => {
    expect(avisoDeLaInauguracion()).toBe("Muy pronto abrimos en Guayaquil · te esperamos")
    expect(avisoDeLaInauguracion()).not.toMatch(/\d/)
  })

  it("el mensaje al intentar pedir tampoco", () => {
    expect(mensajeDeCerrado(Date.parse("2026-11-26T17:00:00Z"))).toBe("Muy pronto abrimos en Guayaquil. ¡Te esperamos!")
  })
})

describe("cuando Emilio dé la fecha · la misma constante con una fecha", () => {
  const FECHA = "2026-11-25T12:00:00Z" // ejemplo: miércoles 25-nov · 7:00 en Guayaquil
  const MIERCOLES = ["2026-11-25"]

  it("antes de la hora, cerrado aunque sea día y hora de atención (lunes 23-nov a las 10)", () => {
    congelar(enGuayaquil("2026-11-23", 10))
    expect(antesDeLaInauguracion(Date.now(), FECHA)).toBe(true)
    expect(cocinaAbiertaCon(FECHA, MIERCOLES)).toBe(false)
  })

  it("a las 6:59 todavía no; a las 7:00 en punto abre solo", () => {
    congelar(enGuayaquil("2026-11-25", 6, 59))
    expect(cocinaAbiertaCon(FECHA, MIERCOLES)).toBe(false)
    congelar(enGuayaquil("2026-11-25", 7, 0))
    expect(antesDeLaInauguracion(Date.now(), FECHA)).toBe(false)
    expect(cocinaAbiertaCon(FECHA, MIERCOLES)).toBe(true)
  })

  it("un día extra abre solo esa fecha: el miércoles siguiente vuelve a cerrar", () => {
    congelar(enGuayaquil("2026-12-02", 12))
    expect(cocinaAbiertaCon(FECHA, MIERCOLES)).toBe(false)
  })

  it("la fecha es la de la cocina: martes 24 a las 22:00 en Guayaquil ya es 25 en UTC, y sigue cerrado", () => {
    congelar(new Date("2026-11-25T03:00:00Z"))
    expect(fechaEnLaCocina()).toBe("2026-11-24")
    expect(cocinaAbiertaCon(FECHA, MIERCOLES)).toBe(false)
  })

  it("el aviso y el mensaje salen de la fecha", () => {
    expect(avisoDeLaInauguracion(FECHA)).toBe("Inauguramos el miércoles 25 de noviembre · pedidos desde las 7:00")
    expect(mensajeDeCerrado(Date.parse("2026-11-24T17:00:00Z"), FECHA)).toBe(
      "Inauguramos el miércoles 25 de noviembre · pedidos desde las 7:00. ¡Te esperamos!",
    )
    expect(mensajeDeCerrado(Date.parse("2026-12-01T17:00:00Z"), FECHA)).toBe(
      "Estamos cerrados · atendemos jueves a lunes de 7:00 a 15:00. ¡Te esperamos!",
    )
  })

  it("ya inaugurado (\"\"): sin cierre ni aviso, manda el horario de siempre", () => {
    congelar(enGuayaquil("2026-11-30", 10))
    expect(antesDeLaInauguracion(Date.now(), "")).toBe(false)
    expect(cocinaAbiertaCon("", [])).toBe(true)
  })
})
