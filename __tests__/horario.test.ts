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

describe("¿está abierta la cocina? · R162", () => {
  // 2026-11-30 es lunes · 01-dic martes · 02-dic miércoles · 03-dic jueves (24-nov: fechas después de la inauguración; antes, todo cerrado)
  it("lunes a las 10 de la mañana · abierto", () => {
    congelar(enGuayaquil("2026-11-30", 10))
    expect(cocinaAbierta()).toBe(true)
  })

  it("lunes a las 6 de la mañana · todavía cerrado", () => {
    congelar(enGuayaquil("2026-11-30", 6, 59))
    expect(cocinaAbierta()).toBe(false)
  })

  it("justo a las 7 en punto · abre", () => {
    congelar(enGuayaquil("2026-11-30", 7, 0))
    expect(cocinaAbierta()).toBe(true)
  })

  it("a las 14:59 todavía se puede pedir", () => {
    congelar(enGuayaquil("2026-11-30", 14, 59))
    expect(cocinaAbierta()).toBe(true)
  })

  it("a las 15:00 en punto ya no", () => {
    congelar(enGuayaquil("2026-11-30", 15, 0))
    expect(cocinaAbierta()).toBe(false)
  })

  it("martes al mediodía · cerrado aunque sea plena hora de almuerzo", () => {
    congelar(enGuayaquil("2026-12-01", 12))
    expect(cocinaAbierta()).toBe(false)
  })

  it("miércoles al mediodía · cerrado", () => {
    congelar(enGuayaquil("2026-12-02", 12))
    expect(cocinaAbierta()).toBe(false)
  })

  it("jueves al mediodía · vuelve a abrir", () => {
    congelar(enGuayaquil("2026-12-03", 12))
    expect(cocinaAbierta()).toBe(true)
  })

  it("manda la hora de la COCINA, no la de quien mira", () => {
    // 2026-11-30 03:00 UTC = domingo 29-nov 22:00 en Guayaquil · cerrado acá,
    // aunque en el reloj UTC ya sea lunes de madrugada.
    congelar(new Date("2026-11-30T03:00:00Z"))
    expect(cocinaAbierta()).toBe(false)
  })
})

describe("pedidos cerrados hasta la inauguración · 24-nov", () => {
  it("la inauguración es el miércoles 25-nov a las 7:00 en Guayaquil, y ese miércoles abre aunque los miércoles cierren", () => {
    expect(INAUGURACION).toBe("2026-11-25T12:00:00Z")
    expect([...DIAS_EXTRA_ABIERTOS]).toEqual(["2026-11-25"])
  })

  it("antes de inaugurar no se puede pedir, ni en día y hora de atención (lunes 23-nov a las 10)", () => {
    congelar(enGuayaquil("2026-11-23", 10))
    expect(antesDeLaInauguracion()).toBe(true)
    expect(cocinaAbierta()).toBe(false)
  })

  it("el miércoles 25 a las 6:59 todavía no", () => {
    congelar(enGuayaquil("2026-11-25", 6, 59))
    expect(cocinaAbierta()).toBe(false)
  })

  it("el miércoles 25 a las 7:00 en punto abre solo", () => {
    congelar(enGuayaquil("2026-11-25", 7, 0))
    expect(antesDeLaInauguracion()).toBe(false)
    expect(cocinaAbierta()).toBe(true)
  })

  it("el miércoles 25 a las 14:59 se puede; a las 15:00 ya no", () => {
    congelar(enGuayaquil("2026-11-25", 14, 59))
    expect(cocinaAbierta()).toBe(true)
    congelar(enGuayaquil("2026-11-25", 15, 0))
    expect(cocinaAbierta()).toBe(false)
  })

  it("solo ese miércoles: el siguiente (2-dic) vuelve a cerrar", () => {
    congelar(enGuayaquil("2026-12-02", 12))
    expect(cocinaAbierta()).toBe(false)
  })

  it("el jueves 26 sigue el horario de siempre", () => {
    congelar(enGuayaquil("2026-11-26", 12))
    expect(cocinaAbierta()).toBe(true)
  })

  it("la fecha es la de la cocina: martes 24 a las 22:00 en Guayaquil ya es 25 en UTC, y sigue cerrado", () => {
    congelar(new Date("2026-11-25T03:00:00Z"))
    expect(fechaEnLaCocina()).toBe("2026-11-24")
    expect(cocinaAbierta()).toBe(false)
  })

  it("el aviso sale de la fecha, con tuteo y sin inventar nada", () => {
    expect(avisoDeLaInauguracion()).toBe("Inauguramos el miércoles 25 de noviembre · pedidos desde las 7:00")
  })

  it("el mensaje al intentar pedir: antes, la inauguración; después, el horario de siempre", () => {
    expect(mensajeDeCerrado(Date.parse("2026-11-24T17:00:00Z"))).toBe(
      "Inauguramos el miércoles 25 de noviembre · pedidos desde las 7:00. ¡Te esperamos!",
    )
    expect(mensajeDeCerrado(Date.parse("2026-12-01T17:00:00Z"))).toBe(
      "Estamos cerrados · atendemos jueves a lunes de 7:00 a 15:00. ¡Te esperamos!",
    )
  })
})
