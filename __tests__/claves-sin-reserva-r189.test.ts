/**
 * R189 · Las 4 claves de seguridad no tienen valor de reserva.
 * Si falta una, la operación falla sin escribir ni mandar nada.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const mockFrom = vi.fn()
const mockFetch = vi.fn()

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ ok: true }),
  getClientIp: () => "200.1.2.3",
}))

import { claveObligatoria } from "../lib/claves"
import { signSession, verifySession } from "../lib/account-session"
import { POST as loginRequest } from "../app/api/account/login-request/route"
import { POST as consent } from "../app/api/consent/route"
import { POST as ruleta } from "../app/api/ruleta/spin/route"

const CLAVES = [
  "ACCOUNT_SESSION_SECRET",
  "OTP_SALT",
  "CONSENT_IP_SALT",
  "RULETA_IP_SALT",
] as const

const pedido = (url: string, body: unknown) =>
  new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "200.1.2.3",
    },
    body: JSON.stringify(body),
  }) as never

beforeEach(() => {
  mockFrom.mockReset()
  mockFetch.mockReset()
  vi.stubGlobal("fetch", mockFetch)
  vi.spyOn(console, "error").mockImplementation(() => {})
  for (const c of CLAVES) vi.stubEnv(c, "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("claveObligatoria", () => {
  it.each(CLAVES)("%s vacía o con espacios falla y lo deja dicho", (c) => {
    expect(() => claveObligatoria(c)).toThrow(`falta_clave:${c}`)
    vi.stubEnv(c, "   ")
    expect(() => claveObligatoria(c)).toThrow(`falta_clave:${c}`)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(c))
  })

  it("devuelve el valor cuando existe", () => {
    vi.stubEnv("OTP_SALT", "valor-de-prueba")
    expect(claveObligatoria("OTP_SALT")).toBe("valor-de-prueba")
  })
})

describe("sesión", () => {
  it("sin clave no firma ni verifica", () => {
    expect(() => signSession({ whatsapp: "593990000000" })).toThrow(
      "falta_clave:ACCOUNT_SESSION_SECRET",
    )
    expect(() => verifySession("abc.def")).toThrow(
      "falta_clave:ACCOUNT_SESSION_SECRET",
    )
  })

  it("con clave firma, y otra clave no la acepta", () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "clave-uno")
    const ficha = signSession({ whatsapp: "593990000000" })
    expect(verifySession(ficha)?.whatsapp).toBe("593990000000")
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "clave-dos")
    expect(verifySession(ficha)).toBeNull()
  })

  it("la ficha firmada con el valor público viejo no entra", async () => {
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "naufrago-dev-secret-rotate")
    const vieja = signSession({ whatsapp: "593990000000" })
    vi.stubEnv("ACCOUNT_SESSION_SECRET", "clave-nueva")
    expect(verifySession(vieja)).toBeNull()
  })
})

describe("rutas sin su clave", () => {
  it("el código de entrada no se guarda ni se envía", async () => {
    const res = await loginRequest(
      pedido("/api/account/login-request", { whatsapp: "+593990000000" }),
    )
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("falta_clave:OTP_SALT")
    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("el permiso no se guarda", async () => {
    const res = await consent(
      pedido("/api/consent", { consent_type: "cookies", accepted: true }),
    )
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("falta_clave:CONSENT_IP_SALT")
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("la ruleta no gira", async () => {
    const res = await ruleta(pedido("/api/ruleta/spin", { fingerprint: "abc" }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("falta_clave:RULETA_IP_SALT")
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe("rutas con su clave · control", () => {
  const insert = vi.fn()
  beforeEach(() => {
    insert.mockReset()
    insert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })
  })

  it("el código de entrada se guarda con huella que depende de la clave", async () => {
    vi.stubEnv("OTP_SALT", "sal-uno")
    const res = await loginRequest(
      pedido("/api/account/login-request", { whatsapp: "+593990000000" }),
    )
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith("otp_codes")
    expect(insert.mock.calls[0][0].code_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("el permiso guarda una huella de la dirección que cambia con la clave", async () => {
    vi.stubEnv("CONSENT_IP_SALT", "sal-uno")
    const a = await consent(
      pedido("/api/consent", { consent_type: "cookies", accepted: true }),
    )
    vi.stubEnv("CONSENT_IP_SALT", "sal-dos")
    await consent(
      pedido("/api/consent", { consent_type: "cookies", accepted: true }),
    )
    expect(a.status).toBe(200)
    expect(insert.mock.calls[0][0].ip_hash).not.toBe(
      insert.mock.calls[1][0].ip_hash,
    )
  })
})

describe("barrido del código", () => {
  const fuentes = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const r = join(dir, n)
      return statSync(r).isDirectory()
        ? fuentes(r)
        : /\.tsx?$/.test(n)
          ? [r]
          : []
    })

  it.each([
    "account/login-request",
    "account/login-confirm",
    "customer/change-whatsapp-request",
    "customer/change-whatsapp-confirm",
    "loyalty/redeem-request",
    "loyalty/redeem-confirm",
  ])("%s saca la huella del código con la clave", (ruta) => {
    const texto = readFileSync(`app/api/${ruta}/route.ts`, "utf8")
    expect(texto).toContain('.update(`${claveObligatoria("OTP_SALT")}|${code}`)')
  })

  it.each([
    "naufrago-otp-2026",
    "naufrago-consent-2026",
    "naufrago-ruleta-2026",
    "naufrago-dev-secret-rotate",
  ])("%s ya no está en el código", (viejo) => {
    const con = [...fuentes("app"), ...fuentes("lib")].filter((f) =>
      readFileSync(f, "utf8").includes(viejo),
    )
    expect(con).toEqual([])
  })
})
