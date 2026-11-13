import "server-only"
/**
 * La lista de vecinos de Emilio · leer, generar códigos, anular un código y dar de baja (12-nov · CC3).
 * Todo pasa por el servidor (`getSupabaseAdmin`); las tablas están cerradas para el navegador.
 */
import { generarCodigo, numeroVisible } from "@/lib/residentes"
import type { BaseResidentes } from "@/lib/residentes-validar"

export const MAX_CODIGOS_POR_VEZ = 50

export interface Vecino {
  id: string
  numero: string
  nombre: string
  /** Sector o barrio en Olón (obligatorio en el registro desde 6ac0850). */
  sector: string | null
  /** Cédula (obligatoria desde la ADENDA 1 del 12-nov; los registros de antes no la tienen). */
  cedula: string | null
  whatsapp: string
  creadoEn: string
  bajaEn: string | null
  bajaMotivo: string | null
  /** Visitas válidas (las que contaron como uso). */
  visitas: number
  ultimaVisita: string | null
  /** Escaneos que NO valieron (ya usada hoy, de baja). */
  rechazos: number
}

export interface Codigo {
  id: string
  codigo: string
  creadoEn: string
  usadoEn: string | null
  anuladoEn: string | null
  /** «R-0007 · Nombre» de quien lo usó. */
  usadoPor: string | null
}

function falla(que: string, e: { message?: string; code?: string }): never {
  throw new Error(`${que}: ${e.message ?? e.code}`)
}

/**
 * La base entrega como máximo `max_rows` filas por pedido (hoy 1000) y corta callada: se lee por páginas.
 * No se confía en ese número: se pide desde donde quedó la página anterior y se para solo cuando llega una VACÍA.
 * Así, si alguien baja `max_rows` (p. ej. a 500), la lista sigue completa; solo cuesta un pedido más al final.
 */
export const FILAS_POR_PAGINA = 1000
const TOPE_DE_FILAS = 200_000

/** Lee TODAS las filas de una consulta, página por página. `armar` debe dar un orden estable (con desempate). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function leerTodo(armar: () => any, que: string): Promise<any[]> {
  const todas: unknown[] = []
  while (todas.length <= TOPE_DE_FILAS) {
    const desde = todas.length
    const { data, error } = await armar().range(desde, desde + FILAS_POR_PAGINA - 1)
    if (error) falla(que, error)
    const filas = data ?? []
    if (filas.length === 0) return todas
    todas.push(...filas)
  }
  throw new Error(`${que}: más de ${TOPE_DE_FILAS} filas`)
}

export async function listarVecinos(base: BaseResidentes): Promise<Vecino[]> {
  const rs = await leerTodo(
    () => base.from("residentes").select("id, numero, nombre, sector, cedula, whatsapp_e164, creado_en, baja_en, baja_motivo").order("numero", { ascending: true }),
    "no se pudo leer la lista de vecinos",
  )
  const vs = await leerTodo(
    () =>
      base
        .from("residente_visitas")
        .select("id, residente_id, resultado, validado_en")
        .not("residente_id", "is", null)
        .order("validado_en", { ascending: false })
        .order("id", { ascending: false }),
    "no se pudieron leer las visitas",
  )

  const cuenta = new Map<string, { visitas: number; ultima: string | null; rechazos: number }>()
  for (const v of vs) {
    const c = cuenta.get(v.residente_id) ?? { visitas: 0, ultima: null, rechazos: 0 }
    if (v.resultado === "valida") {
      c.visitas++
      if (!c.ultima) c.ultima = v.validado_en // vienen de la más nueva a la más vieja
    } else c.rechazos++
    cuenta.set(v.residente_id, c)
  }
  return rs.map((r: Record<string, unknown>) => {
    const c = cuenta.get(r.id as string)
    return {
      id: r.id as string,
      numero: numeroVisible(r.numero as number),
      nombre: r.nombre as string,
      sector: (r.sector as string | null) ?? null,
      cedula: (r.cedula as string | null) ?? null,
      whatsapp: r.whatsapp_e164 as string,
      creadoEn: r.creado_en as string,
      bajaEn: (r.baja_en as string | null) ?? null,
      bajaMotivo: (r.baja_motivo as string | null) ?? null,
      visitas: c?.visitas ?? 0,
      ultimaVisita: c?.ultima ?? null,
      rechazos: c?.rechazos ?? 0,
    }
  })
}

export async function listarCodigos(base: BaseResidentes): Promise<Codigo[]> {
  const data = await leerTodo(
    () =>
      base
        .from("residente_codigos")
        .select("id, codigo, creado_en, usado_en, anulado_en, residentes!residente_codigos_residente_fk(numero, nombre)")
        .order("creado_en", { ascending: false })
        .order("id", { ascending: false }),
    "no se pudieron leer los códigos",
  )
  return data.map((c: Record<string, unknown>) => {
    const r = c.residentes as { numero: number; nombre: string } | null
    return {
      id: c.id as string,
      codigo: c.codigo as string,
      creadoEn: c.creado_en as string,
      usadoEn: (c.usado_en as string | null) ?? null,
      anuladoEn: (c.anulado_en as string | null) ?? null,
      usadoPor: r ? `${numeroVisible(r.numero)} · ${r.nombre}` : null,
    }
  })
}

/** Crea `cuantos` códigos nuevos (1 a 50) y devuelve los textos. Si choca con uno que ya existe, prueba otro. */
export async function generarCodigos(base: BaseResidentes, cuantos: number, nuevo: () => string = generarCodigo): Promise<string[]> {
  const n = Math.trunc(cuantos)
  if (!Number.isFinite(n) || n < 1 || n > MAX_CODIGOS_POR_VEZ) throw new Error(`se pueden generar de 1 a ${MAX_CODIGOS_POR_VEZ} códigos por vez`)
  const hechos: string[] = []
  let intentos = 0
  while (hechos.length < n) {
    if (++intentos > n + 20) throw new Error("no se pudieron generar códigos distintos")
    const codigo = nuevo()
    const { error } = await base.from("residente_codigos").insert({ codigo })
    if (!error) { hechos.push(codigo); continue }
    if (error.code === "23505") continue // ya existía: se prueba con otro
    falla("no se pudo guardar el código", error)
  }
  return hechos
}

/** Anula un código que todavía no se usó. Devuelve false si ya estaba usado o anulado. */
export async function anularCodigo(base: BaseResidentes, id: string): Promise<boolean> {
  const { data, error } = await base
    .from("residente_codigos")
    .update({ anulado_en: new Date().toISOString() })
    .eq("id", id)
    .is("usado_en", null)
    .is("anulado_en", null)
    .select("id")
  if (error) falla("no se pudo anular el código", error)
  return (data ?? []).length === 1
}

/** Da de baja una tarjeta activa. Desde ese momento la caja la ve «no válida». */
export async function darDeBaja(base: BaseResidentes, id: string, motivo: string | null): Promise<boolean> {
  const m = (motivo ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null
  const { data, error } = await base
    .from("residentes")
    .update({ baja_en: new Date().toISOString(), baja_motivo: m })
    .eq("id", id)
    .is("baja_en", null)
    .select("id")
  if (error) falla("no se pudo dar de baja", error)
  return (data ?? []).length === 1
}

/** Los códigos que se pueden imprimir: sin usar y sin anular. */
export async function codigosParaImprimir(base: BaseResidentes, pedidos: string[] | null): Promise<string[]> {
  let q = base.from("residente_codigos").select("codigo").is("usado_en", null).is("anulado_en", null)
  if (pedidos && pedidos.length) q = q.in("codigo", pedidos.slice(0, MAX_CODIGOS_POR_VEZ))
  const { data, error } = await q.order("creado_en", { ascending: true }).limit(200)
  if (error) falla("no se pudieron leer los códigos", error)
  return (data ?? []).map((c: { codigo: string }) => c.codigo)
}
