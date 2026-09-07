import { NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * Dónde caen los avisos de la lista de sitios permitidos · R165.1
 *
 * Mientras la lista está en modo observación, el navegador del cliente
 * manda acá un aviso por cada cosa que HABRÍA bloqueado. Eso es
 * justamente lo que queremos saber antes de prohibir de verdad: si el
 * mapa, la isla o el formulario de pago cargan algo que no anotamos,
 * aparece acá y no como un sitio roto.
 *
 * TRES CUIDADOS
 *
 * 1 · Esto lo llama el navegador de cualquiera · es una puerta abierta
 *     al mundo. Lleva freno de velocidad y descarta cuerpos grandes.
 *
 * 2 · Los navegadores mandan MUCHO ruido ajeno: extensiones del
 *     cliente, traductores, antivirus que inyectan guiones. Todo eso
 *     dispara avisos que no son culpa nuestra. Por eso se filtran los
 *     orígenes que no son http(s), que son casi todos de extensiones.
 *
 * 3 · No se guarda nada del cliente · sólo qué se bloqueó y en qué
 *     página. Ni su dirección, ni su teléfono, ni su pedido.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Las extensiones del navegador del cliente no son problema nuestro. */
const RUIDO = [
  "chrome-extension",
  "moz-extension",
  "safari-extension",
  "safari-web-extension",
  "webkit-masked-url",
  "about:",
  "data:text/html",
]

interface Aviso {
  "blocked-uri"?: string
  "violated-directive"?: string
  "effective-directive"?: string
  "document-uri"?: string
  "source-file"?: string
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(getClientIp(request), {
    limit: 30,
    windowSec: 60,
    bucket: "csp_reporte",
  })
  // Se contesta 204 igual · al navegador no se le explica nada.
  if (!rl.ok) return new NextResponse(null, { status: 204 })

  try {
    const crudo = await request.text()
    if (crudo.length > 20_000) return new NextResponse(null, { status: 204 })

    const cuerpo = JSON.parse(crudo) as {
      "csp-report"?: Aviso
    }
    const a = cuerpo["csp-report"] ?? (cuerpo as unknown as Aviso)
    const bloqueado = String(a["blocked-uri"] ?? "")
    if (!bloqueado) return new NextResponse(null, { status: 204 })
    if (RUIDO.some((r) => bloqueado.startsWith(r))) {
      return new NextResponse(null, { status: 204 })
    }

    // Sólo el nombre del sitio · la dirección completa puede llevar
    // datos en la parte de la consulta.
    let origen = bloqueado
    try {
      origen = new URL(bloqueado).origin
    } catch {
      // "inline", "eval" y otros valores que no son direcciones.
    }

    console.warn(
      `[csp] habría bloqueado ${origen} · regla ${
        a["effective-directive"] ?? a["violated-directive"] ?? "?"
      } · en ${a["document-uri"]?.split("?")[0] ?? "?"}`,
    )
  } catch {
    // Un aviso mal formado no es motivo para devolver un error.
  }

  return new NextResponse(null, { status: 204 })
}
