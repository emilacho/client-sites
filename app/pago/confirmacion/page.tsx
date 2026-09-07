/**
 * A dónde vuelve el cliente después de pagar · R163.
 *
 * Esta es la "Url de respuesta" que se configura en la cuenta de
 * PayPhone: https://naufrago.ec/pago/confirmacion
 *
 * POR QUÉ UNA PÁGINA Y NO UN ENDPOINT
 * Acá aterriza una PERSONA en su navegador, no un programa. Un endpoint
 * de API le habría devuelto un bloque de texto técnico en la pantalla
 * justo después de pagar.
 *
 * PERO CONFIRMA COMO UN ENDPOINT
 * Se dibuja en el servidor, así que antes de mostrar nada llama a la API
 * de confirmación de PayPhone. Eso NO es opcional: si nadie confirma
 * dentro de los primeros 5 minutos, PayPhone revierte el cobro solo.
 * Hacerlo desde el navegador sería confiar en que el cliente no cierre
 * la pestaña ni pierda señal.
 *
 * Es idempotente por diseño: si el cliente recarga, se vuelve a
 * consultar y el pedido no se marca dos veces.
 */
import Link from "next/link"
import { confirmarCobro } from "@/lib/pagos/payphone"
import { getSupabaseAdmin } from "@/lib/supabase"
import { cliente } from "@/cliente.config"

export const dynamic = "force-dynamic"
export const revalidate = 0

const CYAN = "#4DD4D8"

interface Props {
  searchParams: Promise<{ id?: string; clientTransactionId?: string }>
}

/** Deja el pedido marcado como pagado · sin pisar uno ya marcado. */
async function marcarPedidoPagado(
  orderCode: string,
  datos: { autorizacion?: string; ultimosDigitos?: string; marca?: string; transactionId?: number },
): Promise<void> {
  try {
    const supa = getSupabaseAdmin()
    const { data: pedido } = await supa
      .from("orders")
      .select("id, payment_status")
      .eq("client_slug", cliente.slug)
      .eq("order_code", orderCode)
      .maybeSingle()
    const fila = pedido as { id: string; payment_status: string } | null
    if (!fila) return
    if (fila.payment_status === "CAPTURED") return // ya estaba · no se repite

    await supa
      .from("orders")
      .update({
        payment_status: "CAPTURED",
        payment_method: "PAYPHONE",
        payment_provider: "PAYPHONE",
        payment_provider_intent_id: datos.transactionId
          ? String(datos.transactionId)
          : null,
      })
      .eq("id", fila.id)

    await supa.from("order_events").insert({
      order_id: fila.id,
      event_type: "PAYMENT_CAPTURED",
      actor: "payphone",
      payload: {
        autorizacion: datos.autorizacion,
        tarjeta: datos.marca,
        ultimos_digitos: datos.ultimosDigitos,
      },
    })
  } catch (e) {
    // No se le arruina la pantalla al cliente por esto · el cobro YA se
    // confirmó contra PayPhone, que es lo que no se puede perder.
    console.error("[pago] no se pudo marcar el pedido como pagado", e)
  }
}

export default async function ConfirmacionDePago({ searchParams }: Props) {
  const { id, clientTransactionId } = await searchParams

  if (!id || !clientTransactionId) {
    return (
      <Marco
        emoji="🤔"
        titulo="No encontramos tu pago"
        texto="Llegaste a esta página sin los datos de la transacción. Si acabas de pagar, escríbenos y lo revisamos al instante."
      />
    )
  }

  const r = await confirmarCobro(Number(id), clientTransactionId)

  if ("error" in r) {
    console.error("[pago] confirmación falló", r.error, { id, clientTransactionId })
    return (
      <Marco
        emoji="⏳"
        titulo="Estamos verificando tu pago"
        texto="No pudimos confirmarlo en este momento. NO vuelvas a pagar · escríbenos por WhatsApp con este código y lo resolvemos ahora mismo."
        codigo={clientTransactionId}
      />
    )
  }

  if (!r.aprobado) {
    return (
      <Marco
        emoji="💳"
        titulo="El pago no se completó"
        texto={
          r.mensaje ??
          "Tu banco no autorizó el cobro. No se te cobró nada · puedes intentar de nuevo o pagar en efectivo al motorizado."
        }
        codigo={clientTransactionId}
      />
    )
  }

  await marcarPedidoPagado(clientTransactionId, {
    autorizacion: r.codigoAutorizacion,
    ultimosDigitos: r.ultimosDigitos,
    marca: r.marcaTarjeta,
    transactionId: r.transactionId,
  })

  return (
    <Marco
      emoji="🌊"
      titulo="¡Pago recibido!"
      texto="Ya le avisamos a la cocina. Puedes seguir tu pedido en vivo desde el enlace de abajo."
      codigo={clientTransactionId}
      monto={r.montoCentavos / 100}
      tarjeta={r.marcaTarjeta && r.ultimosDigitos ? `${r.marcaTarjeta} ${r.ultimosDigitos}` : undefined}
      seguimiento={`/order/${encodeURIComponent(clientTransactionId)}`}
    />
  )
}

function Marco({
  emoji, titulo, texto, codigo, monto, tarjeta, seguimiento,
}: {
  emoji: string
  titulo: string
  texto: string
  codigo?: string
  monto?: number
  tarjeta?: string
  seguimiento?: string
}) {
  return (
    <main
      style={{ background: "linear-gradient(160deg,#020617,#0f172a 55%,#083344)" }}
      className="flex min-h-[100svh] items-center justify-center p-5 text-slate-100"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-center">
        <div className="mb-3 text-4xl" aria-hidden>{emoji}</div>
        <h1 className="text-xl font-semibold text-cyan-100">{titulo}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{texto}</p>

        {monto != null ? (
          <p className="mt-4 font-mono text-2xl tabular-nums text-cyan-200">
            ${monto.toFixed(2)}
          </p>
        ) : null}
        {tarjeta ? (
          <p className="mt-1 text-xs text-slate-500">{tarjeta}</p>
        ) : null}
        {codigo ? (
          <p className="mt-4 font-mono text-[11px] text-slate-500">
            Pedido {codigo}
          </p>
        ) : null}

        {seguimiento ? (
          <Link
            href={seguimiento}
            className="mt-5 block w-full rounded-xl py-3 text-sm font-bold text-slate-950"
            style={{ background: `linear-gradient(90deg, ${CYAN}, #2BA8AC)` }}
          >
            Seguir mi pedido
          </Link>
        ) : null}
        <a
          href={`https://wa.me/${cliente.whatsappE164}`}
          className="mt-3 block text-xs text-cyan-300"
        >
          Escríbenos por WhatsApp
        </a>
      </div>
    </main>
  )
}
