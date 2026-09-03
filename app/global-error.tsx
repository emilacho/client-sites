"use client"
/**
 * La pantalla de "se rompió todo" · R150.
 *
 * Cuando el motor de la página da su árbol por perdido, desmonta la
 * raíz completa. Hasta hoy no había nada acá, así que el cliente veía
 * el texto crudo del framework, en inglés:
 *
 *   "Application error: a client-side exception has occurred"
 *
 * Eso fue exactamente lo que vio cualquiera que eligiera envío a
 * domicilio con el permiso de ubicación dado (R149), y no le decía ni
 * qué pasó, ni qué hacer, ni cómo pedir igual.
 *
 * Esta pantalla reemplaza el documento entero, por eso lleva sus
 * propias etiquetas de página · no hereda la plantilla.
 */
import { useEffect } from "react"
import { reportarError } from "@/lib/v2/reportar-error"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    reportarError(error, {
      origen: "raiz_de_la_pagina",
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg,#020617,#0f172a 55%,#083344)",
          color: "#e2e8f0",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }} aria-hidden>
            🌊
          </div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "#a5f3fc" }}>
            Se nos fue la ola
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "#94a3b8", margin: "0 0 20px" }}>
            Algo falló de nuestro lado, no tuyo. Tu pedido no se perdió: vuelve
            a intentarlo y sigues donde estabas.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              width: "100%",
              padding: "13px 16px",
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(90deg,#4DD4D8,#2BA8AC)",
              color: "#020617",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Volver a intentar
          </button>
          <a
            href="https://wa.me/593997744288"
            style={{
              display: "block",
              marginTop: 12,
              fontSize: 13,
              color: "#67e8f9",
              textDecoration: "none",
            }}
          >
            O escríbenos por WhatsApp y te tomamos el pedido
          </a>
        </div>
      </body>
    </html>
  )
}
