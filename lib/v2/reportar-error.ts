/**
 * Reporte de errores del navegador · R150.
 *
 * Hasta hoy, si la página se rompía en el teléfono de un cliente, NADIE
 * se enteraba. El fallo de R149 —la página entera cayéndose al elegir
 * envío— vivió sabe cuánto tiempo y se encontró de casualidad,
 * verificando otra cosa. Con esto, el próximo avisa solo.
 *
 * Va por PostHog, que ya está conectado y pago: cero cuentas nuevas,
 * cero costo. No es un monitor de errores dedicado —no agrupa ni alerta
 * como uno de verdad— pero responde la pregunta que importa: ¿esto le
 * pasa a gente real, cuántas veces, y en qué pantalla?
 *
 * Reglas que se respetan acá:
 *  · nunca frena a la página · todo va en "dispara y olvida"
 *  · nunca manda datos del cliente · sólo el mensaje del error, la
 *    pantalla y el rastro del código. Ni nombre, ni teléfono, ni
 *    dirección, ni nada que haya escrito.
 *  · no repite · el mismo error cien veces seguidas cuenta una sola,
 *    para no inundar ni gastar cuota.
 */
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
const CLAVE_ID = "naufrago_ph_distinct_id"

/** Los que ya se avisaron en esta visita · evita el diluvio. */
const yaAvisados = new Set<string>()

function quienEs(): string {
  try {
    return window.localStorage.getItem(CLAVE_ID) ?? "sin_id"
  } catch {
    return "sin_almacenamiento"
  }
}

function recortar(texto: string, largo: number): string {
  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto
}

export interface DondeSeRompio {
  /** En qué parte pasó · "dibujo", "promesa sin atender", "raíz", etc. */
  origen: string
  /** Datos extra que ayuden a entenderlo · nunca del cliente. */
  extra?: Record<string, unknown>
}

export function reportarError(error: unknown, donde: DondeSeRompio): void {
  if (typeof window === "undefined") return
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return

  const err = error instanceof Error ? error : new Error(String(error))
  const huella = `${donde.origen}|${err.name}|${err.message}`
  if (yaAvisados.has(huella)) return
  yaAvisados.add(huella)

  const cuerpo = {
    api_key: apiKey,
    event: "error_en_el_navegador",
    distinct_id: quienEs(),
    properties: {
      origen: donde.origen,
      tipo: err.name,
      mensaje: recortar(err.message, 300),
      // El rastro recortado alcanza para ubicar el archivo · entero es
      // ruido y ocupa cuota.
      rastro: recortar((err.stack ?? "").split("\n").slice(0, 6).join("\n"), 900),
      pantalla: window.location.pathname,
      ancho: window.innerWidth,
      segundos_en_la_pagina: Math.round(performance.now() / 1000),
      ...donde.extra,
      $current_url: window.location.href,
    },
    timestamp: new Date().toISOString(),
  }

  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
    keepalive: true,
  }).catch(() => {
    // Si ni el aviso se puede mandar, no hay nada más que hacer · y
    // desde luego no se rompe la página por eso.
  })
}
