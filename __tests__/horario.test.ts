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
  // 2026-09-07 es lunes · 08 martes · 09 miércoles · 10 jueves
  it("lunes a las 10 de la mañana · abierto", () => {
    congelar(enGuayaquil("2026-09-07", 10))
    expect(cocinaAbierta()).toBe(true)
  })

  it("lunes a las 6 de la mañana · todavía cerrado", () => {
    congelar(enGuayaquil("2026-09-07", 6, 59))
    expect(cocinaAbierta()).toBe(false)
  })

  it("justo a las 7 en punto · abre", () => {
    congelar(enGuayaquil("2026-09-07", 7, 0))
    expect(cocinaAbierta()).toBe(true)
  })

  it("a las 14:59 todavía se puede pedir", () => {
    congelar(enGuayaquil("2026-09-07", 14, 59))
    expect(cocinaAbierta()).toBe(true)
  })

  it("a las 15:00 en punto ya no", () => {
    congelar(enGuayaquil("2026-09-07", 15, 0))
    expect(cocinaAbierta()).toBe(false)
  })

  it("martes al mediodía · cerrado aunque sea plena hora de almuerzo", () => {
    congelar(enGuayaquil("2026-09-08", 12))
    expect(cocinaAbierta()).toBe(false)
  })

  it("miércoles al mediodía · cerrado", () => {
    congelar(enGuayaquil("2026-09-09", 12))
    expect(cocinaAbierta()).toBe(false)
  })

  it("jueves al mediodía · vuelve a abrir", () => {
    congelar(enGuayaquil("2026-09-10", 12))
    expect(cocinaAbierta()).toBe(true)
  })

  it("manda la hora de la COCINA, no la de quien mira", () => {
    // 2026-09-07 03:00 UTC = domingo 22:00 en Guayaquil · cerrado acá,
    // aunque en el reloj UTC ya sea lunes de madrugada.
    congelar(new Date("2026-09-07T03:00:00Z"))
    expect(cocinaAbierta()).toBe(false)
  })
})
