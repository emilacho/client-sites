/**
 * telefono-canonico.test.ts · R152
 *
 * El teléfono tiene que quedar en UNA sola forma antes de guardarse.
 * La misma persona estaba partida en dos: "0997744288" en su pedido y
 * "593997744288" en su tesoro, y las dos mitades nunca se cruzaban.
 */
import { describe, it, expect } from "vitest"
import { telefonoCanonico } from "@/lib/telefono"

describe("el teléfono queda en una sola forma · R152", () => {
  it("el celular como lo escribe un ecuatoriano", () => {
    expect(telefonoCanonico("0997744288")).toBe("593997744288")
  })

  it("el mismo sin el cero de adelante", () => {
    expect(telefonoCanonico("997744288")).toBe("593997744288")
  })

  it("el mismo con el prefijo internacional", () => {
    expect(telefonoCanonico("+593 99 774 4288")).toBe("593997744288")
  })

  it("las tres formas dan EXACTAMENTE lo mismo · que es todo el punto", () => {
    const formas = ["0997744288", "997744288", "+593997744288", "(099) 774-4288"]
    const canonicos = new Set(formas.map(telefonoCanonico))
    expect(canonicos.size).toBe(1)
  })

  it("un número demasiado corto no pasa", () => {
    expect(telefonoCanonico("222222")).toBeNull()
  })

  it("un número absurdamente largo tampoco", () => {
    expect(telefonoCanonico("333333333333333333")).toBeNull()
  })

  it("vacío o ausente no revienta", () => {
    expect(telefonoCanonico("")).toBeNull()
    expect(telefonoCanonico(null)).toBeNull()
    expect(telefonoCanonico(undefined)).toBeNull()
  })

  it("letras sueltas no cuelan un teléfono falso", () => {
    expect(telefonoCanonico("abc")).toBeNull()
  })
})
