"use client"
/**
 * Pantalla de cocina · R132 · rehecha en R133 a imagen de Loyverse KDS.
 *
 * POR QUÉ EXISTE
 * Loyverse no puede recibir un pedido pendiente: su conexión técnica sólo
 * acepta ventas YA CERRADAS y su pantalla de cocina únicamente escucha a
 * su propio punto de venta (comprobado · /orders, /tickets y /kds no
 * existen). El pedido que entra por naufrago.ec no puede aparecer en la
 * pantalla que ya cuelga en la cocina. Esta es esa pantalla, pero nuestra.
 *
 * NO SON DOS SISTEMAS · condición de Emilio
 * Acá se COCINA. La plata se sigue contando en UN solo lado: al cobrar,
 * la venta se manda a Loyverse. Cada ticket muestra si ya entró a la
 * contabilidad.
 *
 * POR QUÉ SE PARECE TANTO A LOYVERSE (pedido de Emilio · 29-ago-2026)
 * "que se asemeje en lo posible a la de Loyverse, para que los empleados
 * que ya están adaptados a ese sistema no les toque mucho cambio". Todo
 * lo que sigue sale de la documentación oficial del KDS de Loyverse, no
 * de mi gusto ·
 *   - la cabecera del ticket lleva número, tiempo desde que entró y quién
 *     lo tomó;
 *   - esa cabecera cambia de VERDE a AMARILLO a los 4 minutos y a ROJO a
 *     los 7 (son los valores por defecto de Loyverse);
 *   - los modificadores y comentarios del plato van debajo del plato, y
 *     el comentario del pedido va al PIE del ticket;
 *   - se toca un plato y queda TACHADO · así se marca lo ya cocinado;
 *   - se toca la CABECERA para dar el ticket por terminado;
 *   - hay sonido al entrar un pedido nuevo, que se puede apagar.
 * Lo único que Loyverse no tiene y acá sí: el cobro. En un local el
 * cajero cobra en la caja; acá la venta es de la web, así que el paso de
 * cobrar vive abajo, en la lista de los ya terminados, para no ensuciar
 * el tablero de cocina.
 *
 * CÓMO SE ABRE
 * Una vez con la llave en la dirección · `/cocina?llave=...`. Queda
 * guardada en la tablet. Sin llave no se ve nada.
 */
import { useCallback, useEffect, useRef, useState } from "react"

interface Linea {
  id?: string
  name?: string
  qty?: number
  priceUsd?: number
  notes?: string
  customizations?: Array<{ label?: string }>
}

interface Pedido {
  id: string
  order_code: string
  status: string
  created_at: string
  customer_name: string
  customer_phone: string
  dropoff_address: string
  dropoff_detail: string | null
  cart_lines: Linea[]
  customer_notes: string | null
  total_usd: number
  delivery_fee_usd: number
  payment_method: string
  vivo: boolean
  contabilidad: "ok" | "falló" | null
}

const LLAVE_GUARDADA = "naufrago_cocina_llave"
const SONIDO_GUARDADO = "naufrago_cocina_sonido"

/** Umbrales de Loyverse · amarillo a los 4 minutos, rojo a los 7. */
const MIN_AMARILLO = 4
const MIN_ROJO = 7

function minutosDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function colorCabecera(min: number): string {
  if (min >= MIN_ROJO) return "bg-red-600 text-white"
  if (min >= MIN_AMARILLO) return "bg-amber-400 text-slate-900"
  return "bg-emerald-600 text-white"
}

/**
 * Dos tonos cortos, sintetizados en el momento · sin archivo que bajar.
 * El navegador no deja sonar hasta que alguien toca la pantalla una vez,
 * por eso el sonido arranca apagado y se enciende con un botón.
 */
function useCampana(encendido: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const preparar = useCallback(() => {
    if (ctxRef.current) return
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctor) ctxRef.current = new Ctor()
    } catch {}
  }, [])
  const sonar = useCallback(() => {
    if (!encendido) return
    const ctx = ctxRef.current
    if (!ctx) return
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    const ahora = ctx.currentTime
    for (const [i, hz] of [880, 1320].entries()) {
      const osc = ctx.createOscillator()
      const vol = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = hz
      vol.gain.setValueAtTime(0.0001, ahora + i * 0.18)
      vol.gain.exponentialRampToValueAtTime(0.35, ahora + i * 0.18 + 0.02)
      vol.gain.exponentialRampToValueAtTime(0.0001, ahora + i * 0.18 + 0.16)
      osc.connect(vol).connect(ctx.destination)
      osc.start(ahora + i * 0.18)
      osc.stop(ahora + i * 0.18 + 0.18)
    }
  }, [encendido])
  return { preparar, sonar }
}

export default function PantallaCocina() {
  const [llave, setLlave] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ultima, setUltima] = useState<Date | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [cocinados, setCocinados] = useState<Record<string, boolean>>({})
  // R136 · cancelar pide DOS toques. En una cocina, un botón de cancelar
  // que borra al primer toque se aprieta sin querer con la mano llena.
  const [porCancelar, setPorCancelar] = useState<string | null>(null)
  const [sonido, setSonido] = useState(false)
  // R135 · una pantalla que muestra datos viejos EN SILENCIO es peor que
  // una apagada: la cocina cree que no entró nada y el cliente espera. Se
  // cuentan los intentos fallidos y cuándo fue la última vez que los datos
  // llegaron de verdad.
  const [fallos, setFallos] = useState(0)
  const [ultimaBuena, setUltimaBuena] = useState<Date | null>(null)
  const [enLinea, setEnLinea] = useState(true)
  const conocidos = useRef<Set<string> | null>(null)
  const { preparar, sonar } = useCampana(sonido)

  useEffect(() => {
    const enUrl = new URLSearchParams(window.location.search).get("llave")
    if (enUrl) {
      try {
        localStorage.setItem(LLAVE_GUARDADA, enUrl)
      } catch {}
      setLlave(enUrl)
      window.history.replaceState({}, "", "/cocina")
    } else {
      try {
        setLlave(localStorage.getItem(LLAVE_GUARDADA))
      } catch {
        setLlave(null)
      }
    }
    try {
      setSonido(localStorage.getItem(SONIDO_GUARDADO) === "1")
    } catch {}
  }, [])

  // El aviso del propio aparato · llega al instante, sin esperar a que
  // falle una consulta.
  useEffect(() => {
    setEnLinea(navigator.onLine)
    const arriba = () => setEnLinea(true)
    const abajo = () => setEnLinea(false)
    window.addEventListener("online", arriba)
    window.addEventListener("offline", abajo)
    return () => {
      window.removeEventListener("online", arriba)
      window.removeEventListener("offline", abajo)
    }
  }, [])

  const traer = useCallback(async () => {
    if (!llave) return
    try {
      const res = await fetch("/api/cocina/pedidos", {
        headers: { "x-cocina-llave": llave },
        cache: "no-store",
      })
      if (res.status === 401) {
        setError("La llave no sirve · pedí la dirección completa de nuevo.")
        return
      }
      const data = await res.json()
      if (!data.ok) {
        setError("No se pudieron traer los pedidos.")
        setFallos((n) => n + 1)
        return
      }
      const lista: Pedido[] = data.pedidos ?? []
      // Sonar sólo por pedidos que aparecen DESPUÉS de la primera carga ·
      // si no, cada vez que alguien abre la pantalla suena por todos.
      const vivosAhora = lista.filter((p) => p.vivo).map((p) => p.order_code)
      if (conocidos.current === null) {
        conocidos.current = new Set(vivosAhora)
      } else {
        const nuevos = vivosAhora.filter((c) => !conocidos.current!.has(c))
        if (nuevos.length > 0) sonar()
        conocidos.current = new Set(vivosAhora)
      }
      setPedidos(lista)
      const ahora = new Date()
      setUltima(ahora)
      setUltimaBuena(ahora)
      setFallos(0)
      setError(null)
    } catch {
      setFallos((n) => n + 1)
    }
  }, [llave, sonar])

  useEffect(() => {
    if (!llave) return
    traer()
    const t = setInterval(traer, 8000)
    return () => clearInterval(t)
  }, [llave, traer])

  // Reloj propio · los minutos corren aunque no entre ningún pedido.
  const [, redibujar] = useState(0)
  useEffect(() => {
    const t = setInterval(() => redibujar((n) => n + 1), 5000)
    return () => clearInterval(t)
  }, [])

  async function avanzar(pedido: Pedido, paso: string) {
    if (!llave) return
    setOcupado(pedido.id)
    try {
      const res = await fetch("/api/cocina/avanzar", {
        method: "POST",
        headers: { "content-type": "application/json", "x-cocina-llave": llave },
        body: JSON.stringify({ orderId: pedido.id, paso }),
      })
      const data = await res.json()
      if (!data.ok) setError(`No se pudo mover el ticket · ${data.error ?? ""}`)
      else if (paso === "entregado" && data.contabilidad === "falló")
        setError(
          `${pedido.order_code} se cobró, pero NO entró a la contabilidad. Queda anotado.`,
        )
      await traer()
    } catch {
      setError("Sin conexión · el ticket no se movió.")
    } finally {
      setOcupado(null)
    }
  }

  function alternarSonido() {
    preparar()
    setSonido((s) => {
      const nuevo = !s
      try {
        localStorage.setItem(SONIDO_GUARDADO, nuevo ? "1" : "0")
      } catch {}
      return nuevo
    })
  }

  if (llave === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 p-8 text-center text-slate-300">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-white">Pantalla de cocina</h1>
          <p className="text-sm">
            Esta pantalla se abre con su llave · pedila y entrá con la dirección
            completa.
          </p>
        </div>
      </main>
    )
  }

  const vivos = pedidos.filter((p) => p.vivo)
  const terminados = pedidos.filter((p) => !p.vivo)
  // R136 · un pedido CANCELADO no se cobra nunca. Sin esta línea la
  // lista le ofrecía el botón "Cobrado $X" a un pedido cancelado y,
  // peor, lo contaba como pendiente de cobro: un toque y entraba a la
  // contabilidad una venta que no existió. Lo vi en la captura de la
  // prueba, no leyendo el código.
  const porCobrar = terminados.filter(
    (p) => p.contabilidad !== "ok" && p.status !== "CANCELLED",
  )

  // Se da por caída cuando el aparato avisa que no hay red, o cuando dos
  // consultas seguidas fallan, o cuando pasaron 40 segundos sin que los
  // datos lleguen (la consulta corre cada 8).
  const segundosSinDatos = ultimaBuena
    ? Math.floor((Date.now() - ultimaBuena.getTime()) / 1000)
    : null
  const caida =
    !enLinea || fallos >= 2 || (segundosSinDatos !== null && segundosSinDatos > 40)

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100">
      {/* Barra superior · como la del KDS · cuenta de tickets y ajustes */}
      <header className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 px-3 py-2">
        <h1 className="text-base font-black tracking-wide">
          COCINA · <span className="text-cyan-400">naufrago.ec</span>
          <span className="ml-3 rounded bg-slate-800 px-2 py-0.5 text-sm font-bold">
            {vivos.length}
          </span>
        </h1>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className={caida ? "font-bold text-red-400" : ""}>
            {caida ? "● sin conexión" : "● en línea"} ·{" "}
            {ultima
              ? ultima.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
              : "…"}
          </span>
          <button
            type="button"
            onClick={alternarSonido}
            className={`rounded px-2 py-1 font-bold ${
              sonido ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-300"
            }`}
          >
            {sonido ? "🔔 sonido" : "🔕 sin sonido"}
          </button>
        </div>
      </header>

      {/* R135 · EL CARTEL DE CAÍDA · ocupa el ancho entero y apaga el
          tablero. La pantalla es el único camino por el que el local se
          entera de un pedido (el aviso por WhatsApp se sacó en R134), así
          que quedarse callada mostrando datos viejos es el peor final
          posible: la cocina cree que no entró nada. */}
      {caida ? (
        <div className="bg-red-600 px-4 py-4 text-center text-white">
          {/* El parpadeo va SOLO en el triángulo · si parpadea el cartel
              entero, la mitad del tiempo se ve apagado, que es justo lo
              contrario de una alarma. Lo vi en la captura de prueba. */}
          <p className="text-2xl font-black tracking-wide">
            <span className="animate-pulse">⚠</span> SIN CONEXIÓN · ESTA
            PANTALLA NO SE ESTÁ ACTUALIZANDO
          </p>
          <p className="mt-1 text-base">
            {enLinea
              ? "No se puede llegar al servidor · puede haber pedidos nuevos que no ves."
              : "La tablet se quedó sin internet · revisá el wifi."}
          </p>
          <p className="mt-1 text-sm opacity-90">
            Últimos datos buenos ·{" "}
            {ultimaBuena
              ? `${ultimaBuena.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })} (hace ${segundosSinDatos} s)`
              : "todavía ninguno"}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}
      {!sonido ? (
        <p className="bg-slate-800 px-3 py-1.5 text-center text-xs text-slate-300">
          Tocá <b>🔕 sin sonido</b> para que la pantalla avise cuando entre un pedido.
        </p>
      ) : null}

      <div className={`p-2 ${caida ? "pointer-events-none opacity-40" : ""}`}>
        {vivos.length === 0 ? (
          <p className="py-20 text-center text-slate-500">Sin tickets en cocina.</p>
        ) : null}

        {/* Tablero de tickets · columnas, como el KDS */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {vivos.map((p) => {
            const min = minutosDesde(p.created_at)
            return (
              <article key={p.id} className="overflow-hidden rounded bg-slate-800 shadow-lg">
                {/* CABECERA · se toca para dar el ticket por terminado */}
                <button
                  type="button"
                  disabled={ocupado === p.id}
                  onClick={() => avanzar(p, "listo")}
                  className={`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left font-bold disabled:opacity-60 ${colorCabecera(min)}`}
                >
                  <span className="font-mono text-base">{p.order_code.replace(/^NF-\d+-/, "")}</span>
                  <span className="text-sm">{min} min</span>
                  <span className="text-xs opacity-90">naufrago.ec</span>
                </button>

                <ul className="divide-y divide-slate-700">
                  {(p.cart_lines ?? []).map((l, i) => {
                    const clave = `${p.id}:${i}`
                    const listo = cocinados[clave]
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() =>
                            setCocinados((c) => ({ ...c, [clave]: !c[clave] }))
                          }
                          className="w-full px-3 py-2 text-left"
                        >
                          <span
                            className={`text-lg font-bold leading-tight ${
                              listo ? "text-slate-500 line-through" : "text-slate-50"
                            }`}
                          >
                            {l.qty ?? 1} {l.name}
                          </span>
                          {/* Modificadores y comentario del plato · debajo del plato */}
                          {(l.customizations ?? []).map((m, k) => (
                            <span
                              key={k}
                              className={`block text-sm ${listo ? "text-slate-600 line-through" : "text-amber-300"}`}
                            >
                              · {m.label}
                            </span>
                          ))}
                          {l.notes ? (
                            <span
                              className={`block text-sm ${listo ? "text-slate-600 line-through" : "text-amber-300"}`}
                            >
                              · {l.notes}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {/* PIE · el comentario del pedido, como en el KDS */}
                {p.customer_notes ? (
                  <p className="bg-slate-700 px-3 py-1.5 text-sm text-amber-200">
                    {p.customer_notes}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-1">
                  <p className="truncate text-xs text-slate-400">
                    {p.dropoff_address}
                    {p.dropoff_detail ? ` · ${p.dropoff_detail}` : ""}
                  </p>
                  {porCancelar === p.id ? (
                    <span className="flex shrink-0 items-center gap-2 text-xs">
                      <span className="text-slate-300">¿Cancelar?</span>
                      <button
                        type="button"
                        disabled={ocupado === p.id}
                        onClick={() => {
                          setPorCancelar(null)
                          avanzar(p, "cancelar")
                        }}
                        className="rounded bg-red-600 px-2 py-1 font-bold text-white"
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setPorCancelar(null)}
                        className="rounded bg-slate-700 px-2 py-1 text-slate-200"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPorCancelar(p.id)}
                      className="shrink-0 text-xs text-slate-500 underline decoration-dotted"
                    >
                      cancelar
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {/* Terminados · acá vive el cobro, que en un local haría la caja */}
      {terminados.length > 0 ? (
        <section className="border-t border-slate-800 p-2">
          <h2 className="mb-2 px-1 text-xs uppercase tracking-widest text-slate-500">
            Terminados · últimas 24 horas
            {porCobrar.length > 0 ? (
              <span className="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-slate-900">
                {porCobrar.length} sin cobrar
              </span>
            ) : null}
          </h2>
          <ul className="space-y-1">
            {terminados.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm"
              >
                <span className="font-mono text-slate-300">
                  {p.order_code.replace(/^NF-\d+-/, "")}
                </span>
                <span className="flex-1 truncate text-slate-500">{p.customer_name}</span>
                {p.status === "CANCELLED" ? (
                  <span className="font-bold text-red-400">cancelado</span>
                ) : p.contabilidad === "ok" ? (
                  <span className="font-bold text-emerald-400">
                    cobrado ${Number(p.total_usd).toFixed(2)} · en contabilidad ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={ocupado === p.id}
                    onClick={() => avanzar(p, "entregado")}
                    className="rounded bg-emerald-500 px-3 py-1.5 font-bold text-slate-950 disabled:opacity-50"
                  >
                    {ocupado === p.id
                      ? "…"
                      : `Cobrado $${Number(p.total_usd).toFixed(2)}`}
                  </button>
                )}
                {p.contabilidad === "falló" ? (
                  <span className="text-red-400">no entró a contabilidad</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
