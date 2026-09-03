"use client"
/**
 * Cazador de errores · R150.
 *
 * Se engancha a los dos avisos que da el navegador cuando algo se rompe
 * y nadie lo atajó:
 *   · `error`              · una excepción que llegó hasta arriba
 *   · `unhandledrejection` · una promesa que falló y nadie la escuchó
 *
 * El segundo importa más de lo que parece acá: casi todas las llamadas
 * al servidor de esta página son "dispara y olvida" con el error
 * tragado. Si una empieza a fallar, hoy no se entera nadie.
 *
 * No dibuja nada · sólo escucha.
 */
import { useEffect } from "react"
import { reportarError } from "@/lib/v2/reportar-error"

export function CazadorDeErrores() {
  useEffect(() => {
    const alRomperse = (e: ErrorEvent) => {
      reportarError(e.error ?? e.message, {
        origen: "excepcion_sin_atajar",
        extra: { archivo: e.filename, linea: e.lineno },
      })
    }
    const alFallarUnaPromesa = (e: PromiseRejectionEvent) => {
      reportarError(e.reason, { origen: "promesa_sin_atender" })
    }
    window.addEventListener("error", alRomperse)
    window.addEventListener("unhandledrejection", alFallarUnaPromesa)
    return () => {
      window.removeEventListener("error", alRomperse)
      window.removeEventListener("unhandledrejection", alFallarUnaPromesa)
    }
  }, [])
  return null
}
