"use server"
/**
 * Acciones de la lista de vecinos (12-nov · CC3). Cada una vuelve a comprobar la llave de Emilio:
 * una acción del servidor se puede llamar sin pasar por la página.
 */
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getSupabaseAdmin } from "@/lib/supabase"
import { LLAVE_ADMIN, aparatoAutorizado } from "@/lib/llave-de-aparato"
import { anularCodigo, darDeBaja, generarCodigos } from "@/lib/residentes-admin"

async function exigirLlave(): Promise<void> {
  if (!(await aparatoAutorizado(LLAVE_ADMIN))) redirect("/residentes/admin")
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function accionGenerar(form: FormData): Promise<void> {
  await exigirLlave()
  const cuantos = Number(form.get("cuantos"))
  const hechos = await generarCodigos(getSupabaseAdmin(), cuantos)
  revalidatePath("/residentes/admin")
  redirect(`/residentes/admin/hoja?c=${encodeURIComponent(hechos.join(","))}`)
}

export async function accionAnular(form: FormData): Promise<void> {
  await exigirLlave()
  const id = String(form.get("id") ?? "")
  if (!UUID.test(id)) redirect("/residentes/admin?aviso=codigo_invalido")
  const ok = await anularCodigo(getSupabaseAdmin(), id)
  revalidatePath("/residentes/admin")
  redirect(`/residentes/admin?aviso=${ok ? "codigo_anulado" : "codigo_no_anulable"}`)
}

export async function accionBaja(form: FormData): Promise<void> {
  await exigirLlave()
  const id = String(form.get("id") ?? "")
  if (!UUID.test(id)) redirect("/residentes/admin?aviso=vecino_invalido")
  const motivo = form.get("motivo")
  const ok = await darDeBaja(getSupabaseAdmin(), id, typeof motivo === "string" ? motivo : null)
  revalidatePath("/residentes/admin")
  redirect(`/residentes/admin?aviso=${ok ? "baja_hecha" : "baja_ya_estaba"}`)
}
