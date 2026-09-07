/**
 * interruptor-tarjeta.test.ts · R165
 *
 * Cargar las llaves NO abre la caja.
 *
 * El riesgo que esto cuida es de secuencia, no de código: quien carga
 * las credenciales en la plataforma no es quien decide que ya se puede
 * cobrar. Si la sola presencia de las llaves encendiera la tarjeta, el
 * primer cliente podría pagar antes de que nadie hubiera probado un
 * cobro completo.
 *
 * Verifica:
 *   1. sin llaves · sólo efectivo
 *   2. con llaves pero sin encender · sólo efectivo
 *   3. con llaves Y encendido · aparecen tarjeta y billetera
 *   4. apagarlo devuelve todo a efectivo · es el freno de mano
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { metodosDisponibles } from "../lib/metodos-de-pago"

const original = { ...process.env }

beforeEach(() => {
  delete process.env.PAYPHONE_TOKEN
  delete process.env.PAYPHONE_STORE_ID
  delete process.env.PAYPHONE_ACTIVO
})

afterEach(() => {
  process.env = { ...original }
})

describe("el interruptor de la tarjeta · R165", () => {
  it("sin credenciales · sólo efectivo", () => {
    expect(metodosDisponibles()).toEqual(["cash"])
  })

  it("con credenciales pero SIN encender · sigue sólo efectivo", () => {
    process.env.PAYPHONE_TOKEN = "un-token"
    process.env.PAYPHONE_STORE_ID = "una-tienda"
    expect(metodosDisponibles()).toEqual(["cash"])
  })

  it("encendido pero sin credenciales · no se ofrece lo que no cobra", () => {
    process.env.PAYPHONE_ACTIVO = "1"
    expect(metodosDisponibles()).toEqual(["cash"])
  })

  it("credenciales Y encendido · recién ahí aparece la tarjeta", () => {
    process.env.PAYPHONE_TOKEN = "un-token"
    process.env.PAYPHONE_STORE_ID = "una-tienda"
    process.env.PAYPHONE_ACTIVO = "1"
    expect(metodosDisponibles()).toEqual(["card", "payphone", "cash"])
  })

  it("apagarlo devuelve todo a efectivo · el freno de mano", () => {
    process.env.PAYPHONE_TOKEN = "un-token"
    process.env.PAYPHONE_STORE_ID = "una-tienda"
    process.env.PAYPHONE_ACTIVO = "0"
    expect(metodosDisponibles()).toEqual(["cash"])
  })
})
