// Tarjeta de residente · POST /api/residentes/registro: lo que manda a la base y lo que contesta.
/* eslint-disable @typescript-eslint/no-explicit-any -- respuestas falsas de la base */
import { beforeEach, describe, expect, it, vi } from "vitest"

const { st } = vi.hoisted(() => ({
  st: {
    llamadas: [] as Array<{ fn: string; args: any }>,
    respuesta: { data: null as any, error: null as any },
    limiteOk: true,
  },
}))

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    rpc: async (fn: string, args: any) => {
      st.llamadas.push({ fn, args })
      return st.respuesta
    },
  }),
}))
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "1.2.3.4",
  checkRateLimit: vi.fn(async () => ({ ok: st.limiteOk, remaining: 0, resetIn: 600 })),
}))

import { POST } from "@/app/api/residentes/registro/route"
import { checkRateLimit } from "@/lib/rate-limit"

const pedir = (body: unknown) =>
  POST(
    new Request("http://x/api/residentes/registro", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }) as any,
  )
const valido = { codigo: "nau 7k3q2x", nombre: "  María  Rodríguez ", whatsapp: "099 123 4567" }

describe("registro de residente", () => {
  beforeEach(() => {
    st.llamadas.length = 0
    st.respuesta = { data: { resultado: "ok", ficha: "F".repeat(24), numero: 1 }, error: null }
    st.limiteOk = true
  })

  it("registra en un solo paso con los datos ya limpios y una ficha nueva", async () => {
    const res = await pedir(valido)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, ficha: "F".repeat(24) })
    expect(st.llamadas).toHaveLength(1)
    const { fn, args } = st.llamadas[0]
    expect(fn).toBe("registrar_residente")
    expect(args.p_codigo).toBe("NAU-7K3Q2X")
    expect(args.p_nombre).toBe("María Rodríguez")
    expect(args.p_whatsapp).toBe("593991234567")
    expect(args.p_ficha).toMatch(/^[A-Za-z0-9_-]{24}$/)
  })

  it("cada registro lleva una ficha distinta", async () => {
    await pedir(valido)
    await pedir(valido)
    expect(st.llamadas[0].args.p_ficha).not.toBe(st.llamadas[1].args.p_ficha)
  })

  it("código inválido / ya usado / anulado → 404 codigo_invalido", async () => {
    st.respuesta = { data: { resultado: "codigo_invalido" }, error: null }
    const res = await pedir(valido)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ ok: false, error: "codigo_invalido" })
  })

  it("un código mal escrito ni siquiera llega a la base", async () => {
    const res = await pedir({ ...valido, codigo: "NAU-OOOO" })
    expect(res.status).toBe(404)
    expect(st.llamadas).toHaveLength(0)
  })

  it("teléfono con tarjeta activa → 409 ya_registrado", async () => {
    st.respuesta = { data: { resultado: "ya_registrado" }, error: null }
    const res = await pedir(valido)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ ok: false, error: "ya_registrado" })
  })

  it("nombre o teléfono que no sirven → 400 sin tocar la base", async () => {
    for (const malo of [{ ...valido, nombre: "A" }, { ...valido, whatsapp: "12" }, { ...valido, whatsapp: 5 }, "no es json", null]) {
      const res = await pedir(malo)
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe("datos_invalidos")
    }
    expect(st.llamadas).toHaveLength(0)
  })

  it("demasiados intentos → 429 antes de leer nada", async () => {
    st.limiteOk = false
    const res = await pedir(valido)
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("600")
    expect(st.llamadas).toHaveLength(0)
  })

  it("el límite es por IP: 8 intentos cada 10 minutos", async () => {
    await pedir(valido)
    expect(checkRateLimit).toHaveBeenCalledWith("1.2.3.4", { limit: 8, windowSec: 600, bucket: "residentes-registro" })
  })

  it("un error de la base o una respuesta rara → 500, nunca un «ok» inventado", async () => {
    st.respuesta = { data: null, error: { message: "caída" } }
    expect((await pedir(valido)).status).toBe(500)
    st.respuesta = { data: { resultado: "ok" }, error: null }
    expect((await pedir(valido)).status).toBe(500)
    st.respuesta = { data: { resultado: "otra_cosa" }, error: null }
    expect((await pedir(valido)).status).toBe(500)
  })
})
