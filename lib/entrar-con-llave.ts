import "server-only"
/**
 * Abrir un aparato con su llave · `/<ruta>?llave=...` (12-nov · CC3).
 *
 * Si la llave es la correcta, se guarda en la galleta y se redirige a la misma página SIN la llave en la
 * dirección (para que no quede en el historial ni se comparta por error). Si no, se redirige igual: la
 * página mostrará que el aparato no tiene acceso.
 */
import { NextResponse, type NextRequest } from "next/server"
import { type Llave, llaveValida, opcionesGalleta } from "@/lib/llave-de-aparato"

export function entrarConLlave(req: NextRequest, l: Llave, destino: string): NextResponse {
  const candidata = req.nextUrl.searchParams.get("llave")
  const r = NextResponse.redirect(new URL(destino, req.nextUrl.origin), 303)
  r.headers.set("Cache-Control", "no-store")
  r.headers.set("Referrer-Policy", "no-referrer")
  if (llaveValida(l, candidata)) r.cookies.set(l.galleta, candidata as string, opcionesGalleta())
  return r
}
