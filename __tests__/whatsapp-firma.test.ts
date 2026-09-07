/**
 * whatsapp-firma.test.ts · R166
 *
 * La dirección que recibe los mensajes de WhatsApp es pública. Hasta
 * ahora le creía a cualquiera, y por ahí se cambian los jugos del día y
 * la dirección de entrega de un pedido.
 *
 * Estas pruebas construyen el sello igual que lo construye el proveedor
 * y comprueban que sólo pase el que corresponde.
 *
 * Verifica:
 *   1. el sello correcto pasa
 *   2. cambiar un solo campo lo invalida (nadie se hace pasar por otro)
 *   3. sin sello no pasa
 *   4. sin la clave de la cuenta no pasa NADA · no se atiende a ciegas
 *   5. el orden en que llegan los campos no cambia el resultado
 *   6. la dirección firmada es la pública, no la interna del servidor
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import crypto from "node:crypto"
import { firmaValida } from "../lib/whatsapp/firma"

const CLAVE = "clave-de-prueba-de-la-cuenta"
const DIRECCION = "https://naufrago.ec/api/whatsapp/incoming"

/** Arma el sello igual que lo arma el proveedor. */
function sellar(direccion: string, campos: Record<string, string>, clave = CLAVE) {
  let texto = direccion
  for (const n of Object.keys(campos).sort()) texto += n + campos[n]
  return crypto.createHmac("sha1", clave).update(Buffer.from(texto, "utf-8")).digest("base64")
}

function aviso(
  campos: Record<string, string>,
  sello: string | null,
  opciones: { host?: string } = {},
) {
  const cuerpo = new URLSearchParams(campos).toString()
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "x-forwarded-host": opciones.host ?? "naufrago.ec",
    "x-forwarded-proto": "https",
  }
  if (sello) headers["x-twilio-signature"] = sello
  // La dirección interna es a propósito distinta de la pública · es lo
  // que pasa de verdad detrás del servidor de publicación.
  const req = new Request("http://interno.local/api/whatsapp/incoming", {
    method: "POST",
    headers,
    body: cuerpo,
  })
  return { req, cuerpo }
}

const CAMPOS = {
  From: "whatsapp:+593997744288",
  To: "whatsapp:+14155238886",
  Body: "naranja y mora",
  MessageSid: "SM123",
}

const original = { ...process.env }
beforeEach(() => {
  process.env.TWILIO_AUTH_TOKEN = CLAVE
})
afterEach(() => {
  process.env = { ...original }
})

describe("firma del aviso de WhatsApp · R166", () => {
  it("el sello correcto pasa", () => {
    const { req, cuerpo } = aviso(CAMPOS, sellar(DIRECCION, CAMPOS))
    expect(firmaValida(req, cuerpo)).toBe(true)
  })

  it("nadie se hace pasar por el dueño · cambiar el remitente invalida el sello", () => {
    // El impostor manda el número del dueño pero sella con lo suyo, o
    // reusa un sello viejo. En los dos casos el resumen no coincide.
    const selloDeOtroMensaje = sellar(DIRECCION, { ...CAMPOS, Body: "otra cosa" })
    const { req, cuerpo } = aviso(CAMPOS, selloDeOtroMensaje)
    expect(firmaValida(req, cuerpo)).toBe(false)
  })

  it("con la clave equivocada no pasa", () => {
    const { req, cuerpo } = aviso(CAMPOS, sellar(DIRECCION, CAMPOS, "otra-clave"))
    expect(firmaValida(req, cuerpo)).toBe(false)
  })

  it("sin sello no pasa", () => {
    const { req, cuerpo } = aviso(CAMPOS, null)
    expect(firmaValida(req, cuerpo)).toBe(false)
  })

  it("sin la clave de la cuenta NO se atiende a ciegas", () => {
    delete process.env.TWILIO_AUTH_TOKEN
    const { req, cuerpo } = aviso(CAMPOS, sellar(DIRECCION, CAMPOS))
    expect(firmaValida(req, cuerpo)).toBe(false)
  })

  it("el orden en que llegan los campos no cambia nada", () => {
    const alReves = {
      MessageSid: "SM123",
      Body: "naranja y mora",
      To: "whatsapp:+14155238886",
      From: "whatsapp:+593997744288",
    }
    const { req, cuerpo } = aviso(alReves, sellar(DIRECCION, CAMPOS))
    expect(firmaValida(req, cuerpo)).toBe(true)
  })

  it("firma contra la dirección pública, no la interna del servidor", () => {
    // Si se firmara con la interna, TODOS los avisos reales rebotarían
    // en producción y el WhatsApp quedaría muerto sin que nadie lo note.
    const { req, cuerpo } = aviso(CAMPOS, sellar(DIRECCION, CAMPOS))
    expect(firmaValida(req, cuerpo)).toBe(true)

    // Y un aviso dirigido a otro sitio no vale acá.
    const otro = aviso(CAMPOS, sellar("https://otro-sitio.com/api/whatsapp/incoming", CAMPOS))
    expect(firmaValida(otro.req, otro.cuerpo)).toBe(false)
  })

  it("si el proveedor llama al dominio con www, también pasa", () => {
    const conWww = "https://www.naufrago.ec/api/whatsapp/incoming"
    const { req, cuerpo } = aviso(CAMPOS, sellar(conWww, CAMPOS), {
      host: "www.naufrago.ec",
    })
    expect(firmaValida(req, cuerpo)).toBe(true)
  })
})
