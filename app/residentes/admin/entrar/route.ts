/**
 * /residentes/admin/entrar?llave=... · deja el aparato de Emilio abierto en la lista de vecinos (12-nov · CC3).
 */
import type { NextRequest } from "next/server"
import { LLAVE_ADMIN } from "@/lib/llave-de-aparato"
import { entrarConLlave } from "@/lib/entrar-con-llave"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export function GET(req: NextRequest) {
  return entrarConLlave(req, LLAVE_ADMIN, "/residentes/admin")
}
