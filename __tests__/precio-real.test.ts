/**
 * precio-real.test.ts · R154
 *
 * El servidor tiene que llegar EXACTAMENTE al mismo precio que muestra
 * la pantalla, para toda combinación posible de la carta. Si difiere en
 * un centavo, rompe pedidos legítimos · si no revisa, deja pasar
 * pedidos alterados.
 *
 * Esta prueba recorre la carta entera y arma cada combinación como la
 * arma la pantalla (MenuModal.addToCart), comparando los dos caminos.
 */
import { describe, it, expect } from "vitest"
import { MENU_ITEMS } from "@/lib/v2/naufrago-content"
import { precioRealDeLinea, revisarPrecios } from "@/lib/checkout/precio-real"

const r2 = (n: number) => Math.round(n * 100) / 100

describe("el precio lo pone la casa · R154", () => {
  it("cada plato sin modificar vale lo que dice la carta", () => {
    for (const item of MENU_ITEMS) {
      expect(precioRealDeLinea(item.id).precioUsd, item.id).toBe(r2(item.priceUsd))
    }
  })

  it("cada extra suma exactamente lo que dice la carta", () => {
    for (const item of MENU_ITEMS) {
      for (const t of item.ingredientToggles ?? []) {
        const id = `${item.id}::tg-extra-${t.id}`
        const esperado = r2(item.priceUsd + (t.extraPriceDelta ?? 0))
        expect(precioRealDeLinea(id).precioUsd, id).toBe(esperado)
      }
    }
  })

  it("quitar un ingrediente no cambia el precio", () => {
    for (const item of MENU_ITEMS) {
      for (const t of item.ingredientToggles ?? []) {
        const id = `${item.id}::tg-sin-${t.id}`
        expect(precioRealDeLinea(id).precioUsd, id).toBe(r2(item.priceUsd))
      }
    }
  })

  it("cada variante fija suma lo suyo", () => {
    for (const item of MENU_ITEMS) {
      for (const v of item.variants ?? []) {
        const id = `${item.id}::${v.id}`
        expect(precioRealDeLinea(id).precioUsd, id).toBe(r2(item.priceUsd + v.priceDelta))
      }
    }
  })

  it("TODOS los extras juntos · como los ordena la pantalla", () => {
    for (const item of MENU_ITEMS) {
      const toggles = item.ingredientToggles ?? []
      if (toggles.length < 2) continue
      const ids = toggles.map((t) => `tg-extra-${t.id}`).sort()
      const linea = `${item.id}::${ids.join("+")}`
      const esperado = r2(
        item.priceUsd + toggles.reduce((s, t) => s + (t.extraPriceDelta ?? 0), 0),
      )
      expect(precioRealDeLinea(linea).precioUsd, linea).toBe(esperado)
    }
  })

  it("el sabor del día se acepta y no cuesta", () => {
    const conSabor = MENU_ITEMS.filter((i) => i.dynamicVariantsKey)
    expect(conSabor.length).toBeGreaterThan(0)
    for (const item of conSabor) {
      const id = `${item.id}::naranja`
      expect(precioRealDeLinea(id).precioUsd, id).toBe(r2(item.priceUsd))
    }
  })

  it("un plato que no existe no tiene precio", () => {
    expect(precioRealDeLinea("plato-inventado").precioUsd).toBeNull()
  })

  it("un extra inventado no se acepta", () => {
    const conToggles = MENU_ITEMS.find((i) => (i.ingredientToggles ?? []).length > 0)!
    const id = `${conToggles.id}::tg-extra-caviar-gratis`
    expect(precioRealDeLinea(id).precioUsd).toBeNull()
  })
})

describe("la revisión del pedido completo · R154", () => {
  const encebollado = MENU_ITEMS.find((i) => i.id === "encebollado-naufrago")!

  it("un pedido honesto pasa", () => {
    const rev = revisarPrecios([
      { id: encebollado.id, priceUsd: encebollado.priceUsd, qty: 3 },
    ])
    expect(rev.ok).toBe(true)
    expect(rev.subtotalUsd).toBe(r2(encebollado.priceUsd * 3))
  })

  it("EL AGUJERO · 10 platos a un centavo se rechaza", () => {
    const rev = revisarPrecios([{ id: encebollado.id, priceUsd: 0.01, qty: 10 }])
    expect(rev.ok).toBe(false)
    expect(rev.problemas[0]).toContain("precio_alterado")
    // y el subtotal de la casa es el de verdad, no el del navegador
    expect(rev.subtotalUsd).toBe(r2(encebollado.priceUsd * 10))
  })

  it("un precio inflado también se rechaza · no solo el rebajado", () => {
    const rev = revisarPrecios([{ id: encebollado.id, priceUsd: 999, qty: 1 }])
    expect(rev.ok).toBe(false)
  })

  it("un plato que no existe en la carta se rechaza", () => {
    const rev = revisarPrecios([{ id: "plato-inventado", priceUsd: 4, qty: 1 }])
    expect(rev.ok).toBe(false)
    expect(rev.problemas[0]).toContain("plato_desconocido")
  })

  it("medio centavo de redondeo NO rompe un pedido honesto", () => {
    const rev = revisarPrecios([
      { id: encebollado.id, priceUsd: encebollado.priceUsd + 0.005, qty: 1 },
    ])
    expect(rev.ok).toBe(true)
  })
})

describe("los regalos de la ruleta · R154.1 · regresión", () => {
  it("un premio de la ruleta vale cero y SE ACEPTA", () => {
    for (const id of ["prize-chifle", "prize-pan", "prize-cola"]) {
      expect(precioRealDeLinea(id).precioUsd, id).toBe(0)
    }
  })

  it("un pedido con comida MÁS su premio pasa", () => {
    const rev = revisarPrecios([
      { id: "encebollado-naufrago", priceUsd: 4, qty: 2 },
      { id: "prize-chifle", priceUsd: 0, qty: 1 },
    ])
    expect(rev.ok).toBe(true)
    expect(rev.subtotalUsd).toBe(8) // el regalo no suma
  })

  it("pedir diez regalos no se acepta", () => {
    const rev = revisarPrecios([{ id: "prize-chifle", priceUsd: 0, qty: 10 }])
    expect(rev.ok).toBe(false)
    expect(rev.problemas[0]).toContain("regalo_con_exceso")
  })

  it("un regalo inventado no cuela", () => {
    expect(precioRealDeLinea("prize-langosta").precioUsd).toBeNull()
  })

  it("y no se puede cobrar de menos poniéndole precio a un regalo", () => {
    // Si alguien manda el regalo con precio, la casa igual lo cuenta en 0
    const rev = revisarPrecios([{ id: "prize-chifle", priceUsd: 5, qty: 1 }])
    expect(rev.ok).toBe(false) // el precio no coincide con el de la casa
    expect(rev.subtotalUsd).toBe(0)
  })
})
