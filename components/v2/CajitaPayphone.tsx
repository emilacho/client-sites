"use client"
/**
 * El formulario de pago de PayPhone · R164.
 *
 * PayPhone no da un componente · da un archivo de código y una hoja de
 * estilos que hay que cargar, y una clase global `PPaymentButtonBox` que
 * se dibuja dentro de un recuadro nuestro.
 *
 * DOS COSAS QUE NO SE PUEDEN OLVIDAR, DE SU DOCUMENTACIÓN
 *  · El formulario vence a los 10 minutos de dibujado.
 *  · Sólo funciona en el dominio registrado en la cuenta · en cualquier
 *    otro muestra un error de autorización. Por eso en una publicación
 *    de prueba NO va a funcionar aunque el token esté bien: no es un
 *    fallo nuestro.
 *
 * El recuadro donde ellos dibujan va VACÍO de nuestro lado · es la misma
 * regla que costó la caída de R149 con el mapa de Google: nunca darle
 * hijos de React a un nodo que maneja una librería ajena.
 */
import { useEffect, useRef, useState } from "react"

const CSS = "https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css"
const JS = "https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js"

declare global {
  interface Window {
    PPaymentButtonBox?: new (config: Record<string, unknown>) => {
      render: (elementId: string) => void
    }
  }
}

function cargarUnaVez(tag: "script" | "link", url: string): Promise<void> {
  return new Promise((listo, falla) => {
    const sel = tag === "script" ? `script[src="${url}"]` : `link[href="${url}"]`
    if (document.querySelector(sel)) return listo()
    const el = document.createElement(tag)
    if (tag === "script") {
      ;(el as HTMLScriptElement).src = url
      ;(el as HTMLScriptElement).async = true
    } else {
      ;(el as HTMLLinkElement).rel = "stylesheet"
      ;(el as HTMLLinkElement).href = url
    }
    el.onload = () => listo()
    el.onerror = () => falla(new Error(`no cargó ${url}`))
    document.head.appendChild(el)
  })
}

export interface CajitaProps {
  /** El código del pedido · es lo que PayPhone nos devuelve al volver. */
  orderCode: string
  /** Qué mostrar primero · la tarjeta o la billetera PayPhone. */
  metodo: "card" | "payphone"
  onError?: (mensaje: string) => void
}

export function CajitaPayphone({ orderCode, metodo, onError }: CajitaProps) {
  const caja = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando")
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const armar = async () => {
      try {
        const res = await fetch("/api/pago/preparar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderCode }),
        })
        const cfg = await res.json()
        if (!res.ok || !cfg.ok) {
          throw new Error(cfg.message ?? cfg.error ?? "no se pudo preparar el pago")
        }
        await Promise.all([cargarUnaVez("link", CSS), cargarUnaVez("script", JS)])
        if (!vivo || !caja.current || !window.PPaymentButtonBox) {
          throw new Error("el formulario de pago no cargó")
        }
        // `ok` es nuestro · el resto es la configuración de ellos.
        const config = { ...cfg }
        delete config.ok
        new window.PPaymentButtonBox({ ...config, defaultMethod: metodo }).render(
          caja.current.id,
        )
        if (vivo) setEstado("listo")
      } catch (e) {
        if (!vivo) return
        const m = e instanceof Error ? e.message : "no se pudo abrir el pago"
        setMensaje(m)
        setEstado("error")
        onError?.(m)
      }
    }
    void armar()
    return () => { vivo = false }
  }, [orderCode, metodo, onError])

  return (
    <div className="space-y-2">
      {estado === "cargando" ? (
        <p className="py-6 text-center text-xs text-slate-400">
          Abriendo el pago seguro…
        </p>
      ) : null}
      {estado === "error" ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-center">
          <p className="text-sm font-semibold text-rose-200">
            No pudimos abrir el pago con tarjeta
          </p>
          <p className="mt-0.5 text-xs text-rose-100/80">
            Puedes pagar en efectivo al motorizado, o escribirnos por WhatsApp.
          </p>
          {mensaje ? (
            <p className="mt-1 font-mono text-[10px] text-rose-200/50">{mensaje}</p>
          ) : null}
        </div>
      ) : null}
      {/* Este recuadro es de PayPhone · va SIEMPRE vacío de nuestro lado. */}
      <div id="pp-button" ref={caja} />
    </div>
  )
}
