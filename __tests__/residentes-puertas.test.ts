/**
 * Tarjeta de residente · las 7 puertas con datos de los vecinos (12-nov · CC3 · pedido de CC7 en 0fd4b51).
 *
 * Sin la galleta, o con la galleta de la OTRA llave, cada página muestra «sin acceso» y cada acción vuelve a
 * `/residentes/admin`, y NINGUNA toca la base. Con la llave correcta sí la tocan (control: si no, la prueba
 * pasaría aunque la puerta estuviera abierta por otro motivo).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { baseFalsa } from "./__stubs__/base-residentes-falsa"

const LLAVE_CAJA = "llave-de-la-caja-0001-abcdef"
const LLAVE_ADMIN = "llave-de-emilio-0001-abcdef"

const galletas = new Map<string, string>()
let b = baseFalsa()

vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (galletas.has(n) ? { value: galletas.get(n) } : undefined) }) }))
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => b.base }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw Object.assign(new Error(`redirect ${destino}`), { destino })
  },
}))

import AdminResidentes from "@/app/residentes/admin/page"
import HojaDeCodigos from "@/app/residentes/admin/hoja/page"
import CajaLista from "@/app/residentes/caja/lista/page"
import ValidarResidente from "@/app/residentes/v/[ficha]/page"
import { accionAnular, accionBaja, accionGenerar } from "@/app/residentes/admin/acciones"

// Bajo vitest las páginas salen con el JSX clásico (`React.createElement`); Next usa el automático.
;(globalThis as { React?: typeof React }).React = React

const antes = { caja: process.env.RESIDENTES_CAJA_LLAVE, admin: process.env.RESIDENTES_ADMIN_LLAVE }
afterAll(() => {
  for (const [k, v] of [["RESIDENTES_CAJA_LLAVE", antes.caja], ["RESIDENTES_ADMIN_LLAVE", antes.admin]] as const) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const ID = "00000000-0000-4000-8000-000000000001"
const vecino = { id: ID, numero: 7, nombre: "Ana Secreta", sector: "Centro", whatsapp_e164: "593991234567", creado_en: "2026-11-01T00:00:00Z", baja_en: null, baja_motivo: null, ficha: "f".repeat(24) }

beforeEach(() => {
  process.env.RESIDENTES_CAJA_LLAVE = LLAVE_CAJA
  process.env.RESIDENTES_ADMIN_LLAVE = LLAVE_ADMIN
  galletas.clear()
  b = baseFalsa({
    residentes: [vecino],
    residente_codigos: [{ id: ID, codigo: "NAU-AAAAAA", creado_en: "2026-11-12T10:00:00Z", usado_en: null, anulado_en: null, residente_id: null }],
  })
})

/** Las tres maneras de NO tener la llave de Emilio: nada, la de la caja, o una parecida. */
const sinLlaveDeEmilio: [string, () => void][] = [
  ["sin galleta", () => {}],
  ["con la galleta de la caja", () => galletas.set("naufrago_caja_llave", LLAVE_CAJA)],
  ["con la llave de la caja en la galleta de Emilio", () => galletas.set("naufrago_residentes_admin", LLAVE_CAJA)],
]
const conLlaveDeEmilio = () => galletas.set("naufrago_residentes_admin", LLAVE_ADMIN)

const html = async (el: Promise<unknown>) => renderToStaticMarkup((await el) as Parameters<typeof renderToStaticMarkup>[0])

describe("/residentes/admin · la lista de vecinos", () => {
  it.each(sinLlaveDeEmilio)("%s · sin acceso y sin leer la base", async (_n, poner) => {
    poner()
    const h = await html(AdminResidentes({ searchParams: Promise.resolve({}) }))
    expect(h).toContain("Sin acceso")
    expect(h).not.toContain("Ana Secreta")
    expect(b.llamadas).toEqual([])
  })

  it("control · con la llave de Emilio lee la base", async () => {
    conLlaveDeEmilio()
    await AdminResidentes({ searchParams: Promise.resolve({}) })
    expect(b.llamadas).toContain("select:residentes")
  })
})

describe("/residentes/admin/hoja · la hoja de códigos", () => {
  it.each(sinLlaveDeEmilio)("%s · sin acceso y sin leer la base", async (_n, poner) => {
    poner()
    const h = await html(HojaDeCodigos({ searchParams: Promise.resolve({}) }))
    expect(h).toContain("Sin acceso")
    expect(h).not.toContain("NAU-AAAAAA")
    expect(b.llamadas).toEqual([])
  })

  it("control · con la llave de Emilio lee los códigos", async () => {
    conLlaveDeEmilio()
    await HojaDeCodigos({ searchParams: Promise.resolve({}) })
    expect(b.llamadas).toContain("select:residente_codigos")
  })
})

describe("las acciones de Emilio", () => {
  const form = (campos: Record<string, string>) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(campos)) f.set(k, v)
    return f
  }
  const acciones: [string, () => Promise<void>][] = [
    ["generar códigos", () => accionGenerar(form({ cuantos: "3" }))],
    ["anular un código", () => accionAnular(form({ id: ID }))],
    ["dar de baja", () => accionBaja(form({ id: ID, motivo: "prueba" }))],
  ]

  for (const [accion, correr] of acciones) {
    it.each(sinLlaveDeEmilio)(`${accion} · %s · vuelve a la lista sin tocar la base`, async (_n, poner) => {
      poner()
      await expect(correr()).rejects.toMatchObject({ destino: "/residentes/admin" })
      expect(b.llamadas).toEqual([])
      expect(b.tablas.residente_codigos).toHaveLength(1)
      expect(b.tablas.residente_codigos[0].anulado_en).toBeNull()
      expect(b.tablas.residentes[0].baja_en).toBeNull()
    })

    it(`${accion} · control · con la llave de Emilio escribe en la base`, async () => {
      conLlaveDeEmilio()
      await expect(correr()).rejects.toHaveProperty("destino") // termina en un redirect con aviso
      expect(b.llamadas.some((l) => l.startsWith("insert:") || l.startsWith("update:"))).toBe(true)
    })
  }
})

describe("/residentes/v/<ficha> · lo que ve la caja", () => {
  const sinLlaveDeCaja: [string, () => void][] = [
    ["sin galleta", () => {}],
    ["con la galleta de Emilio", () => galletas.set("naufrago_residentes_admin", LLAVE_ADMIN)],
    ["con la llave de Emilio en la galleta de la caja", () => galletas.set("naufrago_caja_llave", LLAVE_ADMIN)],
  ]
  const abrir = () => ValidarResidente({ params: Promise.resolve({ ficha: vecino.ficha }) })

  it.each(sinLlaveDeCaja)("%s · no valida, no anota y no muestra al vecino", async (_n, poner) => {
    poner()
    const h = await html(abrir())
    expect(h).toContain("Esta tarjeta se valida en la caja")
    expect(h).not.toContain("Ana Secreta")
    expect(b.llamadas).toEqual([])
    expect(b.tablas.residente_visitas).toHaveLength(0)
  })

  it("control · con la llave de la caja anota la visita", async () => {
    galletas.set("naufrago_caja_llave", LLAVE_CAJA)
    await abrir()
    expect(b.tablas.residente_visitas).toHaveLength(1)
  })
})

describe("/residentes/caja/lista · ¿este celular es la caja?", () => {
  it("con la llave de Emilio (no la de la caja) dice «sin acceso»", async () => {
    galletas.set("naufrago_residentes_admin", LLAVE_ADMIN)
    galletas.set("naufrago_caja_llave", LLAVE_ADMIN)
    const h = await html(CajaLista())
    expect(h).toContain("Sin acceso")
    expect(h).not.toContain("ya es la caja")
  })

  it("sin galleta dice «sin acceso»", async () => {
    expect(await html(CajaLista())).toContain("Sin acceso")
  })

  it("control · con la llave de la caja dice que ya es la caja", async () => {
    galletas.set("naufrago_caja_llave", LLAVE_CAJA)
    expect(await html(CajaLista())).toContain("ya es la caja")
  })
})
