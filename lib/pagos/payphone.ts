import "server-only"
/**
 * PayPhone · la confirmación del cobro · R163.
 *
 * EL PLAZO QUE MANDA
 * Su documentación es explícita: si el sistema no confirma dentro de los
 * PRIMEROS 5 MINUTOS después del pago, PayPhone REVIERTE la transacción
 * automáticamente. No es una recomendación · es lo que hacen.
 *
 * Por eso la confirmación no puede vivir en el navegador del cliente: si
 * cierra la pestaña, se queda sin señal o se le corta la conexión al
 * volver, el cobro se cae solo y el pedido queda pagado-pero-no. Se
 * confirma desde el SERVIDOR, apenas el cliente aterriza.
 *
 * QUÉ DEVUELVE PAYPHONE AL CLIENTE
 * Lo manda de vuelta a nuestra dirección de respuesta con dos datos en
 * la dirección · `id` (el número de la transacción de ellos) y
 * `clientTransactionId` (el que pusimos nosotros al iniciar). Con esos
 * dos se pregunta por el estado.
 */
const CONFIRM_URL = "https://paymentbox.payphonetodoesposible.com/api/confirm"

/** 3 = aprobada · 2 = cancelada, según su documentación. */
export const PAYPHONE_APROBADA = 3

export interface CobroPayphone {
  aprobado: boolean
  /** "Approved" · "Canceled" · lo que conteste. */
  estado: string
  /** En centavos, como los maneja PayPhone. */
  montoCentavos: number
  /** Nuestro identificador · con él se encuentra el pedido. */
  clientTransactionId: string
  /** Para el recibo · "XX17". */
  ultimosDigitos?: string
  marcaTarjeta?: string
  codigoAutorizacion?: string
  /** El identificador de la transacción del lado de ellos. */
  transactionId?: number
  /** Cuando algo salió mal y hay que contarlo. */
  mensaje?: string
}

export function payphoneConfigurado(): boolean {
  return Boolean(process.env.PAYPHONE_TOKEN && process.env.PAYPHONE_STORE_ID)
}

/**
 * Le pregunta a PayPhone si el cobro se hizo, y con eso queda confirmado.
 *
 * Ojo · esta misma llamada ES la confirmación. No es sólo una consulta:
 * si no se hace, ellos revierten. Por eso se llama siempre, aunque el
 * cliente vuelva a cargar la página.
 */
export async function confirmarCobro(
  id: number,
  clientTransactionId: string,
): Promise<CobroPayphone | { error: string }> {
  const token = process.env.PAYPHONE_TOKEN
  if (!token) return { error: "payphone_sin_configurar" }

  try {
    const res = await fetch(CONFIRM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // El campo se llama `clientTxId` en el cuerpo aunque llegue como
      // `clientTransactionId` en la dirección · así lo define su
      // documentación. No es un error de tipeo.
      body: JSON.stringify({ id, clientTxId: clientTransactionId }),
      cache: "no-store",
    })
    const texto = await res.text()
    if (!res.ok) {
      return { error: `payphone_confirm_${res.status}:${texto.slice(0, 200)}` }
    }
    const d = JSON.parse(texto) as Record<string, unknown>
    return {
      aprobado: Number(d.statusCode) === PAYPHONE_APROBADA,
      estado: String(d.transactionStatus ?? "desconocido"),
      montoCentavos: Number(d.amount ?? 0),
      clientTransactionId: String(d.clientTransactionId ?? clientTransactionId),
      ultimosDigitos: d.lastDigits ? String(d.lastDigits) : undefined,
      marcaTarjeta: d.cardBrand ? String(d.cardBrand) : undefined,
      codigoAutorizacion: d.authorizationCode ? String(d.authorizationCode) : undefined,
      transactionId: d.transactionId ? Number(d.transactionId) : undefined,
      mensaje: d.message ? String(d.message) : undefined,
    }
  } catch (e) {
    return { error: `payphone_confirm_red:${e instanceof Error ? e.message : "?"}` }
  }
}

/** Los montos viajan en centavos · $6.50 se manda como 650. */
export function aCentavos(usd: number): number {
  return Math.round(usd * 100)
}
