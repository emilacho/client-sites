import "server-only"
/**
 * ¿Quién está preguntando? · R151
 *
 * Varias rutas entregaban —y una además ESCRIBÍA— datos personales
 * confiando en un número de teléfono puesto en la dirección:
 *
 *   GET  /api/customer/preferences?whatsapp=0999...   ← lee
 *   POST /api/customer/preferences {whatsapp, ...}    ← ESCRIBE
 *   GET  /api/subscribers/lookup?whatsapp=0999...
 *
 * Un teléfono no es una credencial: es un dato que cualquiera puede
 * escribir. Con eso se podía leer, y peor, MODIFICAR las preferencias
 * de otra persona sabiendo su número.
 *
 * Acá se resuelve quién pregunta a partir de algo que sí hay que tener:
 *
 *   1. La sesión de la cuenta (token de Supabase Auth) · es la que ya
 *      usa /api/account/me y la que tiene el cliente en «Mi cuenta».
 *   2. Un código de pedido válido · quien tiene el enlace de
 *      seguimiento es el dueño de ese pedido, o alguien a quien él se
 *      lo pasó. Mismo nivel de confianza que el enlace, ni más ni menos.
 *
 * El teléfono lo resuelve el SERVIDOR a partir de eso. Nunca lo pone
 * quien llama.
 */
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase"
import { telefonoCanonico } from "@/lib/telefono"

const CLIENT_SLUG = "naufrago"

export interface QuienPregunta {
  whatsapp: string
  /** Con qué lo demostró · sirve para decidir cuánto contarle. */
  via: "cuenta" | "codigo_de_pedido"
}

/** Vía 1 · la sesión de la cuenta. */
async function porLaCuenta(req: Request): Promise<QuienPregunta | null> {
  const auth = req.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const token = auth.slice(7)
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!url || !anon) return null
  try {
    const anonClient = createClient(url, anon, { auth: { persistSession: false } })
    const { data, error } = await anonClient.auth.getUser(token)
    if (error || !data?.user) return null
    const { data: cliente } = await getSupabaseAdmin()
      .from("customers")
      .select("whatsapp_e164")
      .eq("client_slug", CLIENT_SLUG)
      .eq("auth_user_id", data.user.id)
      .maybeSingle()
    const w = (cliente as { whatsapp_e164?: string } | null)?.whatsapp_e164
    return w ? { whatsapp: w, via: "cuenta" } : null
  } catch {
    return null
  }
}

/** Vía 2 · tiene el enlace de seguimiento de un pedido. */
async function porElCodigoDePedido(codigo: string): Promise<QuienPregunta | null> {
  // Forma canónica NF-AAAA-XXXXXX · se filtra antes de tocar la base.
  if (!/^NF-\d{4}-[0-9A-F]{6}$/i.test(codigo)) return null
  try {
    const { data } = await getSupabaseAdmin()
      .from("orders")
      .select("customer_phone")
      .eq("client_slug", CLIENT_SLUG)
      .eq("order_code", codigo.toUpperCase())
      .maybeSingle()
    const tel = (data as { customer_phone?: string } | null)?.customer_phone
    // R152 · los pedidos viejos guardan el número crudo · se normaliza
    // acá también para que la búsqueda de la ficha encuentre algo.
    const canonico = telefonoCanonico(tel)
    return canonico ? { whatsapp: canonico, via: "codigo_de_pedido" } : null
  } catch {
    return null
  }
}

/**
 * Resuelve quién pregunta, o null si no lo demostró de ninguna forma.
 * `codigoDePedido` sale del cuerpo o de la dirección de la llamada.
 */
export async function quienPregunta(
  req: Request,
  codigoDePedido?: string | null,
): Promise<QuienPregunta | null> {
  const porCuenta = await porLaCuenta(req)
  if (porCuenta) return porCuenta
  if (codigoDePedido) return porElCodigoDePedido(codigoDePedido)
  return null
}

/** Para mostrar sin exponer · "0997744288" → "•••• 4288". */
export function telefonoTapado(tel: string): string {
  const d = (tel ?? "").replace(/\D/g, "")
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : "••••"
}
