"use client"
/**
 * AvisoInauguracion · 24-nov · Emilio: «poner dentro de la página un aviso
 * o anuncio con la fecha de inauguración».
 *
 * Sale de `lib/horario.ts` (INAUGURACION) y se va SOLO cuando se abre:
 * se revisa cada minuto. Arranca oculto y se decide en el navegador, para
 * que la página guardada en caché no muestre el aviso pasada la fecha.
 */
import { useEffect, useState } from "react"
import { antesDeLaInauguracion, avisoDeLaInauguracion } from "@/lib/horario"

export function AvisoInauguracion() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const revisar = () => setVisible(antesDeLaInauguracion())
    revisar()
    const id = window.setInterval(revisar, 60_000)
    return () => window.clearInterval(id)
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 md:bottom-6"
    >
      <p className="pointer-events-auto max-w-xl rounded-2xl border border-amber-300/40 bg-slate-950/85 px-5 py-3 text-center text-sm font-medium text-amber-100 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl md:text-base">
        {avisoDeLaInauguracion()}
      </p>
    </div>
  )
}
