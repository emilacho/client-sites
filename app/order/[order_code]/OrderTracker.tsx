"use client"
/**
 * Náufrago order tracker · Round 103 · client island.
 *
 * 4-stage progress bar + per-stage icon area + microcopy (Caveat cursive) +
 * prominent ETA. Stage 3 ("En camino") replaces the icon area with the
 * canoa scene · canoa pictogram travels horizontally driven by
 * `canoa_pct` from the API (0-100). When the rider is paused (e.g.
 * traffic light) the canoa pauses too · expressing real-world physics.
 *
 * Identity canon · `#3D2466` morado + `#4DD4D8` cyan + Caveat cursive for
 * microcopy + Bebas Neue display for stage names (already loaded by
 * `app/layout.tsx`).
 *
 * Polling · 30s interval to `/api/orders/[order_code]`. Stops once
 * status is DELIVERED or CANCELLED (terminal · no more updates).
 */
import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import type {
  NaufragoOrderStatus,
  DeliveryProvider,
} from "@/lib/schemas"
import { TRACKER_STAGES, type TrackerStageKey } from "@/lib/tracker/stages"
import { usePushSubscription } from "@/lib/v2/use-push-subscription"

// R96.6 · escena 3D del pescado para stage "preparando". Dynamic
// import sin SSR · r3f Canvas no puede server-render. Loading state
// fallback al emoji clásico mientras el bundle carga.
const FishScene = dynamic(
  () => import("./FishScene").then((m) => m.FishScene),
  { ssr: false, loading: () => null },
)

export interface OrderSnapshot {
  ok: boolean
  order_code: string
  status: NaufragoOrderStatus
  stage: TrackerStageKey | "cancelled"
  stage_index: number
  canoa_pct: number
  customer_name: string
  customer_phone: string
  cart_lines: Array<{ id: string; name: string; priceUsd: number; qty: number }>
  subtotal_usd: number
  discount_code: string | null
  discount_usd: number
  delivery_fee_usd: number
  total_usd: number
  delivery_provider: DeliveryProvider
  delivery_eta_minutes: number | null
  rider_info: {
    name?: string
    phone?: string
    plate?: string
    vehicleType?: string
    photoUrl?: string
    rating?: number
    tenureMonths?: number
  } | null
  customer_notes: string | null
  created_at: string
  rider_picked_up_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  delivery_photo_url?: string | null
  delivery_photo_lat?: number | null
  delivery_photo_lng?: number | null
  delivery_photo_at?: string | null
}

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"
const SKY_TOP = "#C8F0F2"

interface Props {
  initial: OrderSnapshot
  orderCode: string
}

export function OrderTracker({ initial, orderCode }: Props) {
  const [snap, setSnap] = useState<OrderSnapshot>(initial)

  useEffect(() => {
    if (snap.status === "DELIVERED" || snap.status === "CANCELLED") return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
          cache: "no-store",
        })
        if (res.ok) {
          const next = (await res.json()) as OrderSnapshot
          setSnap(next)
        }
      } catch {
        // network blip · keep last good snapshot · next poll retries
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [orderCode, snap.status])

  if (snap.stage === "cancelled") {
    return <CancelledBanner snap={snap} />
  }

  const stage = snap.stage as TrackerStageKey
  const etaText = computeEtaText(snap)

  return (
    <main
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, ${SKY_TOP} 0%, #FFFFFF 30%, #FFFFFF 100%)`,
      }}
    >
      <div className="mx-auto max-w-md px-5 py-8">
        <Header orderCode={snap.order_code} />
        <ProgressBar activeIndex={snap.stage_index} />
        <StageName stage={stage} />
        <StageBody
          stage={stage}
          canoaPct={snap.canoa_pct}
          photoUrl={snap.delivery_photo_url}
          photoAt={snap.delivery_photo_at}
        />
        <Microcopy stage={stage} />
        <EtaBadge text={etaText} stage={stage} />
        {stage === "en_route" && snap.rider_info ? (
          <RiderCard info={snap.rider_info} />
        ) : null}
        {stage !== "delivered" && snap.status !== "CANCELLED" ? (
          <PushCta orderCode={orderCode} />
        ) : null}
        {stage === "delivered" ? (
          <>
            <ReviewCard orderCode={orderCode} />
            <ReorderCta />
          </>
        ) : (
          <OrderSummary snap={snap} />
        )}
      </div>
    </main>
  )
}

function Header({ orderCode }: { orderCode: string }) {
  return (
    <header className="mb-6 flex items-baseline justify-between">
      <span
        className="font-[family-name:var(--font-bebas)] text-2xl tracking-wider"
        style={{ color: PURPLE }}
      >
        NÁUFRAGO
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        {orderCode}
      </span>
    </header>
  )
}

function ProgressBar({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="mb-6 flex items-center gap-1">
      {TRACKER_STAGES.map((s, i) => {
        const done = s.index < activeIndex
        const active = s.index === activeIndex
        const dotColor = done || active ? CYAN : "#E5E7EB"
        const lineColor = done ? CYAN : "#E5E7EB"
        const dotInner = done ? "✓" : ""
        return (
          <div key={s.key} className="flex flex-1 items-center">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold text-white"
              style={{
                background: dotColor,
                boxShadow: active
                  ? `0 0 0 4px ${CYAN}22, 0 0 14px ${CYAN}66`
                  : "none",
                transition: "all 240ms ease-out",
                animation: active ? "naufrago-pulse 1.8s ease-in-out infinite" : "none",
              }}
            >
              <span className="text-[11px] leading-none">
                {done ? dotInner : s.index}
              </span>
            </div>
            {i < TRACKER_STAGES.length - 1 ? (
              <div
                className="h-[2px] flex-1"
                style={{ background: lineColor, transition: "background 240ms" }}
              />
            ) : null}
          </div>
        )
      })}
      <style jsx global>{`
        @keyframes naufrago-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  )
}

function StageName({ stage }: { stage: TrackerStageKey }) {
  const s = TRACKER_STAGES.find((x) => x.key === stage)!
  return (
    <h1
      className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide"
      style={{ color: PURPLE }}
    >
      {s.name}
    </h1>
  )
}

function Microcopy({ stage }: { stage: TrackerStageKey }) {
  const s = TRACKER_STAGES.find((x) => x.key === stage)!
  return (
    <p
      className="mt-3 font-[family-name:var(--font-caveat)] text-2xl"
      style={{ color: PURPLE }}
    >
      &ldquo;{s.microcopy}&rdquo;
    </p>
  )
}

function EtaBadge({ text, stage }: { text: string; stage: TrackerStageKey }) {
  if (stage === "delivered") return null
  return (
    <div
      className="my-5 rounded-xl border px-4 py-3 text-center"
      style={{ borderColor: CYAN, background: `${CYAN}11` }}
    >
      <span
        className="font-mono text-base font-semibold tabular-nums"
        style={{ color: PURPLE }}
      >
        {text}
      </span>
    </div>
  )
}

function StageBody({
  stage,
  canoaPct,
  photoUrl,
  photoAt,
}: {
  stage: TrackerStageKey
  canoaPct: number
  photoUrl?: string | null
  photoAt?: string | null
}) {
  if (stage === "en_route") return <CanoaScene pct={canoaPct} />
  if (stage === "delivered") {
    return photoUrl ? (
      <DeliveryProofPhoto url={photoUrl} at={photoAt} />
    ) : (
      <CofreScene />
    )
  }
  if (stage === "preparing") return <FishScene />
  return <StageIcon stage={stage} />
}

function StageIcon({ stage }: { stage: "received" | "preparing" }) {
  const emoji = stage === "received" ? "📜" : "🍲"
  const label =
    stage === "received" ? "Pedido en cocina" : "Cocina trabajando"
  return (
    <div
      className="my-5 flex aspect-square items-center justify-center rounded-2xl"
      style={{ background: `${CYAN}1A`, border: `1px solid ${CYAN}33` }}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-7xl" aria-label={label} role="img">
          {emoji}
        </span>
        <span
          className="font-[family-name:var(--font-caveat)] text-lg"
          style={{ color: PURPLE }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

/**
 * The centerpiece of Round 103 · canoa traveling on the sea.
 *
 * Scene composition (mobile portrait · aspect ~1.4) ·
 *   - sky gradient top
 *   - city silhouette right
 *   - sea waves bottom (SVG path · subtle vertical wobble)
 *   - canoa horizontally positioned by `pct` (0-100) · with subtle bob
 *
 * Connected to real-time GPS · the `pct` value comes from the API which
 * computes it from the rider's `distance_remaining_m` (Pedidos Ya
 * webhook · R99). If rider pauses · pct stops moving · canoa pauses.
 */
function CanoaScene({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div
      className="my-5 overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(180deg, ${SKY_TOP} 0%, #FFFFFF 55%, ${CYAN}33 70%, ${CYAN}55 100%)`,
        height: "240px",
        position: "relative",
        border: `1px solid ${CYAN}55`,
      }}
    >
      {/* Sun · upper-left subtle */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "10%",
          top: "18%",
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: `radial-gradient(circle, #FFE57F 0%, #FFE57F00 70%)`,
        }}
      />
      {/* City silhouette · right side · destination */}
      <svg
        aria-hidden
        viewBox="0 0 100 60"
        preserveAspectRatio="xMaxYMid meet"
        style={{
          position: "absolute",
          right: 0,
          bottom: "30%",
          width: "30%",
          height: "40%",
        }}
      >
        <path
          d="M 0,60 L 0,40 L 8,40 L 8,28 L 14,28 L 14,20 L 22,20 L 22,12 L 30,12 L 30,18 L 38,18 L 38,8 L 46,8 L 46,15 L 55,15 L 55,5 L 64,5 L 64,20 L 72,20 L 72,28 L 80,28 L 80,18 L 90,18 L 90,32 L 100,32 L 100,60 Z"
          fill={PURPLE}
          opacity={0.85}
        />
        {/* Casita Náufrago · pin destination */}
        <circle cx="92" cy="20" r="2" fill={CYAN}>
          <animate attributeName="r" values="2;2.6;2" dur="1.6s" repeatCount="indefinite" />
        </circle>
      </svg>
      {/* Sea waves · animated SVG */}
      <svg
        aria-hidden
        viewBox="0 0 100 20"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "100%",
          height: "32%",
        }}
      >
        <defs>
          <linearGradient id="wave-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.55" />
            <stop offset="100%" stopColor={PURPLE} stopOpacity="0.75" />
          </linearGradient>
        </defs>
        <path
          d="M 0,10 Q 12.5,4 25,10 T 50,10 T 75,10 T 100,10 L 100,20 L 0,20 Z"
          fill="url(#wave-gradient)"
        >
          <animate
            attributeName="d"
            dur="3.5s"
            repeatCount="indefinite"
            values="
              M 0,10 Q 12.5,4 25,10 T 50,10 T 75,10 T 100,10 L 100,20 L 0,20 Z;
              M 0,10 Q 12.5,14 25,10 T 50,10 T 75,10 T 100,10 L 100,20 L 0,20 Z;
              M 0,10 Q 12.5,4 25,10 T 50,10 T 75,10 T 100,10 L 100,20 L 0,20 Z
            "
          />
        </path>
      </svg>
      {/* Canoa · horizontally positioned by pct · vertical bobbing animation */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: `calc(${clamped}% - 28px)`,
          bottom: "26%",
          transition: "left 30s linear",
          animation: "naufrago-canoa-bob 2.8s ease-in-out infinite",
        }}
      >
        <svg viewBox="0 0 60 32" style={{ width: 56, height: 30 }} aria-label="Canoa">
          {/* Sail */}
          <path d="M 30 4 L 30 22 L 42 22 Z" fill={SAND} stroke={PURPLE} strokeWidth="1" />
          <line x1="30" y1="4" x2="30" y2="22" stroke={PURPLE} strokeWidth="1.5" />
          {/* Hull */}
          <path
            d="M 6 22 Q 30 30 54 22 L 50 26 Q 30 32 10 26 Z"
            fill={PURPLE}
            stroke={PURPLE}
            strokeWidth="1"
          />
        </svg>
      </div>
      {/* Pct label · bottom-right · small · for feedback */}
      <div
        className="font-mono text-[10px] tabular-nums"
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          color: PURPLE,
          opacity: 0.65,
        }}
      >
        {clamped.toFixed(0)}%
      </div>
      <style jsx global>{`
        @keyframes naufrago-canoa-bob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  )
}

/* R96.18 · DeliveryProofPhoto · stage 4 cuando hay foto del
   motorizado entregada. Pattern Amazon photo-on-delivery ·
   adaptado Náufrago · "tu tesoro llegó" microcopy + timestamp. */
function DeliveryProofPhoto({
  url,
  at,
}: {
  url: string
  at?: string | null
}) {
  const timeText = at
    ? new Date(at).toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null
  return (
    <div
      className="my-5 overflow-hidden rounded-2xl"
      style={{
        border: `1px solid ${CYAN}55`,
      }}
    >
      <div className="relative aspect-[4/3] bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Foto del pedido entregado"
          className="h-full w-full object-cover"
        />
        <span
          className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm"
        >
          📷 Entregado{timeText ? ` · ${timeText}` : ""}
        </span>
      </div>
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: `${SAND}AA` }}
      >
        <span aria-hidden className="text-2xl">
          🏝️
        </span>
        <span
          className="font-[family-name:var(--font-caveat)] text-lg"
          style={{ color: PURPLE }}
        >
          Tu tesoro llegó · ¡salud!
        </span>
      </div>
    </div>
  )
}

function CofreScene() {
  return (
    <div
      className="my-5 flex aspect-square items-center justify-center rounded-2xl"
      style={{
        background: `radial-gradient(circle, ${SAND}AA 0%, ${SAND}33 70%, transparent 100%)`,
        border: `1px solid ${PURPLE}33`,
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-8xl" aria-label="Cofre abierto" role="img">
          🗝️
        </span>
        <span
          className="font-[family-name:var(--font-caveat)] text-xl"
          style={{ color: PURPLE }}
        >
          Tesoro entregado
        </span>
      </div>
    </div>
  )
}

function RiderCard({
  info,
}: {
  info: NonNullable<OrderSnapshot["rider_info"]>
}) {
  // R96.19 · foto + rating estrellas + tenure · auto-fill desde
  // tabla naufrago_drivers vía webhook · denormalized en order
  // rider_info JSONB para que el tracker no necesite JOIN.
  const initials = (info.name ?? "M")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <div
      className="my-4 rounded-xl border p-3"
      style={{ borderColor: `${PURPLE}22`, background: `${PURPLE}06` }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {info.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.photoUrl}
              alt={info.name ?? "Motorizado"}
              className="h-14 w-14 rounded-full object-cover ring-2"
              style={{ outlineColor: CYAN, boxShadow: `0 0 0 2px ${CYAN}` }}
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full font-semibold ring-2"
              style={{
                background: `${PURPLE}`,
                color: SAND,
                boxShadow: `0 0 0 2px ${CYAN}`,
              }}
            >
              {initials || "M"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Tu motorizado
          </p>
          <p
            className="truncate font-[family-name:var(--font-caveat)] text-xl"
            style={{ color: PURPLE }}
          >
            {info.name ?? "PedidosYa Courier"}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {typeof info.rating === "number" ? (
              <span className="inline-flex items-center gap-0.5 text-[11px]">
                <span style={{ color: "#FFC93C" }}>★</span>
                <span className="font-mono text-neutral-700">
                  {info.rating.toFixed(1)}
                </span>
              </span>
            ) : null}
            {typeof info.tenureMonths === "number" ? (
              <span className="font-mono text-[11px] text-neutral-500">
                · {info.tenureMonths}m en la plataforma
              </span>
            ) : null}
          </div>
          {info.plate || info.vehicleType ? (
            <p className="font-mono text-[11px] text-neutral-600">
              {info.vehicleType ?? "vehículo"} · {info.plate ?? "—"}
            </p>
          ) : null}
        </div>
        {info.phone ? (
          <a
            href={`tel:${info.phone}`}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: CYAN, color: PURPLE }}
          >
            Llamar
          </a>
        ) : null}
      </div>
    </div>
  )
}

function OrderSummary({ snap }: { snap: OrderSnapshot }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        Tu pedido
      </h2>
      <ul className="space-y-1">
        {snap.cart_lines.map((line) => (
          <li
            key={line.id}
            className="flex items-baseline justify-between font-mono text-sm"
          >
            <span>
              {line.qty}× {line.name}
            </span>
            <span className="tabular-nums">
              ${(line.priceUsd * line.qty).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-1 border-t pt-2 font-mono text-[12px]">
        <Row label="Subtotal" value={snap.subtotal_usd} />
        {snap.delivery_fee_usd > 0 ? (
          <Row label="Envío" value={snap.delivery_fee_usd} />
        ) : null}
        {snap.discount_usd > 0 ? (
          <Row
            label={`Desc ${snap.discount_code ?? ""}`}
            value={-snap.discount_usd}
          />
        ) : null}
        <Row label="Total" value={snap.total_usd} bold />
      </div>
    </section>
  )
}

function Row({
  label,
  value,
  bold,
}: {
  label: string
  value: number
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={bold ? "font-semibold" : ""} style={{ color: PURPLE }}>
        {label}
      </span>
      <span
        className={`tabular-nums ${bold ? "font-semibold" : ""}`}
        style={{ color: PURPLE }}
      >
        {value < 0 ? "-" : ""}${Math.abs(value).toFixed(2)}
      </span>
    </div>
  )
}

function ReorderCta() {
  return (
    <div className="my-4 space-y-3">
      <p
        className="text-center font-[family-name:var(--font-caveat)] text-lg"
        style={{ color: PURPLE }}
      >
        ¿Cómo estuvo el tesoro?
      </p>
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="text-3xl transition-transform hover:scale-110"
            aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
          >
            ☆
          </button>
        ))}
      </div>
      <Link
        href="/"
        className="block rounded-xl px-4 py-3 text-center text-sm font-semibold"
        style={{ background: PURPLE, color: "#FFFFFF" }}
      >
        Volver a pedir
      </Link>
    </div>
  )
}

function CancelledBanner({ snap }: { snap: OrderSnapshot }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-5 py-12 text-center">
        <h1
          className="font-[family-name:var(--font-bebas)] text-4xl"
          style={{ color: "#B22" }}
        >
          Pedido cancelado
        </h1>
        <p
          className="mt-3 font-[family-name:var(--font-caveat)] text-xl"
          style={{ color: PURPLE }}
        >
          {snap.cancellation_reason ?? "Cancelado · sin razón registrada"}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl px-5 py-3 text-sm font-semibold"
          style={{ background: PURPLE, color: "#FFFFFF" }}
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}

function computeEtaText(snap: OrderSnapshot): string {
  if (snap.status === "DELIVERED") {
    return snap.delivered_at
      ? `Entregado a las ${new Date(snap.delivered_at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`
      : "Entregado"
  }
  // For en-route, use ETA based on rider_picked_up_at + delivery_eta_minutes
  if (snap.stage === "en_route") {
    const pickup = snap.rider_picked_up_at
      ? new Date(snap.rider_picked_up_at).getTime()
      : null
    const etaMin = snap.delivery_eta_minutes ?? 20
    if (pickup) {
      const arrivalMs = pickup + etaMin * 60_000
      const remaining = Math.max(0, Math.round((arrivalMs - Date.now()) / 60_000))
      return remaining > 0 ? `Llega en ~${remaining} min` : "Llegando…"
    }
    return `Llega en ~${etaMin} min`
  }
  // Pre-rider stages · estimate from created_at + 25 min default
  const created = new Date(snap.created_at).getTime()
  const totalEta = (snap.delivery_eta_minutes ?? 20) + 8
  const arrivalMs = created + totalEta * 60_000
  const remaining = Math.max(0, Math.round((arrivalMs - Date.now()) / 60_000))
  return `Listo en ~${remaining} min`
}

/* R96.17 · PushCta · pide permiso de notifications y suscribe
   al order code · render solo si el browser soporta y el cliente
   no se suscribió todavía · pill compact por encima del summary. */
function PushCta({ orderCode }: { orderCode: string }) {
  const { state, subscribe, errorMessage } = usePushSubscription(orderCode)
  if (
    state === "unsupported" ||
    state === "subscribed" ||
    state === "denied"
  ) {
    return null
  }
  return (
    <div
      className="my-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm"
      style={{
        borderColor: `${CYAN}55`,
        background: `${CYAN}10`,
      }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="font-[family-name:var(--font-caveat)] text-base"
          style={{ color: PURPLE }}
        >
          ¿Te avisamos cuando esté lista?
        </p>
        {errorMessage ? (
          <p className="text-[11px] text-rose-500">{errorMessage}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={subscribe}
        disabled={state === "subscribing"}
        className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-all disabled:opacity-50"
        style={{ background: PURPLE }}
      >
        {state === "subscribing" ? "Activando…" : "Activar avisos"}
      </button>
    </div>
  )
}

/* R96.16 · ReviewCard · stage delivered · stars 1-5 + comment
   opcional · POST /api/orders/[code]/review · estado submitted
   muestra "Gracias por tu review!" + edit option. */
function ReviewCard({ orderCode }: { orderCode: string }) {
  const [stars, setStars] = useState(0)
  const [hoverStars, setHoverStars] = useState(0)
  const [comment, setComment] = useState("")
  const [state, setState] = useState<
    "idle" | "submitting" | "submitted" | "error"
  >("idle")
  const [error, setError] = useState<string | null>(null)

  const displayStars = hoverStars || stars

  async function submit() {
    if (stars < 1) return
    setState("submitting")
    setError(null)
    try {
      const res = await fetch(`/api/orders/${orderCode}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stars,
          comment: comment.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "review_failed")
      }
      setState("submitted")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar")
      setState("error")
    }
  }

  if (state === "submitted") {
    return (
      <div
        className="my-4 rounded-xl border p-4 text-center"
        style={{ borderColor: `${CYAN}55`, background: `${CYAN}15` }}
      >
        <p
          className="font-[family-name:var(--font-caveat)] text-xl"
          style={{ color: PURPLE }}
        >
          ¡Gracias por tu review!
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Tu opinión nos ayuda a mejorar.
        </p>
      </div>
    )
  }

  return (
    <div
      className="my-4 rounded-xl border p-4"
      style={{ borderColor: `${CYAN}55`, background: "#FFFFFF" }}
    >
      <p
        className="text-center font-[family-name:var(--font-caveat)] text-xl"
        style={{ color: PURPLE }}
      >
        ¿Cómo estuvo?
      </p>
      <div className="my-3 flex items-center justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setStars(n)}
            onMouseEnter={() => setHoverStars(n)}
            onMouseLeave={() => setHoverStars(0)}
            aria-label={`${n} estrellas`}
            className="text-3xl transition-transform hover:scale-110"
            style={{
              color: n <= displayStars ? "#FFC93C" : "#E5E5E5",
            }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="¿Qué te pareció? (opcional)"
        rows={2}
        maxLength={500}
        className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-cyan-500 focus:outline-none"
        style={{ color: PURPLE }}
      />
      {error ? (
        <p className="mt-2 text-xs text-rose-500">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={submit}
        disabled={stars < 1 || state === "submitting"}
        className="mt-3 w-full rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: PURPLE }}
      >
        {state === "submitting" ? "Enviando…" : "Enviar review"}
      </button>
    </div>
  )
}
