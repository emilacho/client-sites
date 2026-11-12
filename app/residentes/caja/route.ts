/**
 * /residentes/caja?llave=... · deja el celular de la caja listo para validar tarjetas (12-nov · CC3).
 * Se abre UNA vez, en el mismo navegador que abre la cámara (Safari en iPhone, Chrome en Android).
 */
import type { NextRequest } from "next/server"
import { LLAVE_CAJA } from "@/lib/llave-de-aparato"
import { entrarConLlave } from "@/lib/entrar-con-llave"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET(req: NextRequest) {
  return entrarConLlave(req, LLAVE_CAJA, "/residentes/caja/lista")
}
