import "server-only"
/**
 * Validar una tarjeta de residente en la caja · y anotar la visita en un solo paso (12-nov · CC3).
 *
 * Regla de Emilio: la tarjeta vale UNA vez por día de Ecuador (America/Guayaquil). La base lo garantiza con
 * el índice único `residente_visitas_una_valida_por_dia` (residente, día) sobre las visitas válidas: se
 * intenta anotar la visita VÁLIDA directamente y, si la base la rechaza por ese índice, es que ya se usó hoy.
 * No hay «primero miro, después escribo»: dos escaneos seguidos no pueden dar válido los dos.
 *
 * Toda visita queda anotada (válida, baja, ya usada hoy o ficha que no existe), para que Emilio vea en la
 * lista cuántas veces vino cada vecino y si alguien intenta usar una tarjeta de baja.
 */
import { esFicha, numeroVisible } from "@/lib/residentes"

export type Resultado =
  | { estado: "valida"; nombre: string; numero: string }
  | { estado: "ya_usada_hoy"; nombre: string; numero: string; horaUso: string | null }
  | { estado: "baja"; nombre: string; numero: string }
  | { estado: "no_valido" }

interface ErrorBase { code?: string; message?: string }

/** Lo mínimo del cliente de Supabase que usa la validación (así se prueba sin base). */
export interface BaseResidentes {
  from(tabla: string): any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const INDICE_UNA_POR_DIA = "residente_visitas_una_valida_por_dia"

/** Hora de Ecuador «13:05» de una marca de tiempo de la base. */
export function horaEcuador(iso: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso))
}

async function anotar(base: BaseResidentes, residenteId: string | null, resultado: string): Promise<ErrorBase | null> {
  const { error } = await base.from("residente_visitas").insert({ residente_id: residenteId, resultado })
  return error ?? null
}

/**
 * Valida la ficha y anota la visita. Lanza si la base falla de una forma inesperada (la página muestra
 * «no se pudo validar, cobra el precio normal» en vez de dar por buena una tarjeta).
 */
export async function validarYAnotar(base: BaseResidentes, ficha: string): Promise<Resultado> {
  if (!esFicha(ficha)) {
    const e = await anotar(base, null, "no_valido")
    if (e) throw new Error(`no se pudo anotar la visita: ${e.message ?? e.code}`)
    return { estado: "no_valido" }
  }

  const { data: r, error: eLeer } = await base
    .from("residentes")
    .select("id, numero, nombre, baja_en")
    .eq("ficha", ficha)
    .maybeSingle()
  if (eLeer) throw new Error(`no se pudo leer la tarjeta: ${eLeer.message ?? eLeer.code}`)

  if (!r) {
    const e = await anotar(base, null, "no_valido")
    if (e) throw new Error(`no se pudo anotar la visita: ${e.message ?? e.code}`)
    return { estado: "no_valido" }
  }

  const quien = { nombre: r.nombre as string, numero: numeroVisible(r.numero as number) }

  if (r.baja_en) {
    const e = await anotar(base, r.id, "baja")
    if (e) throw new Error(`no se pudo anotar la visita: ${e.message ?? e.code}`)
    return { estado: "baja", ...quien }
  }

  // EL paso: anotar la válida. Si el índice de «una por día» la rechaza, ya se usó hoy.
  const e = await anotar(base, r.id, "valida")
  if (!e) return { estado: "valida", ...quien }
  const esLaDeHoy = e.code === "23505" && (e.message ?? "").includes(INDICE_UNA_POR_DIA)
  if (!esLaDeHoy) throw new Error(`no se pudo anotar la visita: ${e.message ?? e.code}`)

  const e2 = await anotar(base, r.id, "ya_usada_hoy")
  if (e2) throw new Error(`no se pudo anotar la visita: ${e2.message ?? e2.code}`)

  // La hora de la válida de hoy (la más reciente: es la única del día por el índice).
  const { data: v } = await base
    .from("residente_visitas")
    .select("validado_en")
    .eq("residente_id", r.id)
    .eq("resultado", "valida")
    .order("validado_en", { ascending: false })
    .limit(1)
    .maybeSingle()
  return { estado: "ya_usada_hoy", ...quien, horaUso: v?.validado_en ? horaEcuador(v.validado_en as string) : null }
}
