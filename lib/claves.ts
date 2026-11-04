/**
 * R189 · Claves de seguridad del sitio.
 *
 * Antes cada ruta tenía un valor de reserva escrito en el código, y el
 * repositorio es público: faltar la variable significaba usar un valor
 * que cualquiera podía leer, sin que nadie se enterara. Ahora, si falta,
 * la operación falla y queda dicho en el registro.
 *
 * Se lee al usarla, no al cargar el archivo. Si no, la publicación y las
 * pruebas se caerían en un entorno que no necesita esa clave.
 */
export type ClaveDelSitio =
  | "ACCOUNT_SESSION_SECRET"
  | "OTP_SALT"
  | "CONSENT_IP_SALT"
  | "RULETA_IP_SALT"

export function claveObligatoria(nombre: ClaveDelSitio): string {
  const valor = process.env[nombre]?.trim()
  if (!valor) {
    console.error(`[claves] Falta la variable ${nombre}: la operación no sigue`)
    throw new Error(`falta_clave:${nombre}`)
  }
  return valor
}
