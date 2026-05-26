"use client"
/**
 * LandingV2 · the root client component for the v2 Náufrago landing.
 *
 *  - mounts the CartProvider context
 *  - composes the 3D scene + TopBar + CartDrawer +
 *    OverlayPanels (historia · reseñas · contacto)
 *  - cofre anchor opens the cart · the other 3 anchors open the
 *    corresponding overlay panel
 *  - hero copy + headline overlay the scene · fades out as the user
 *    scrolls (subtle reveal of the 3D world)
 */
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { CartProvider, useCart } from "@/lib/v2/cart-context"
import { naufragoV2 } from "@/lib/v2/naufrago-content"
import { useLastOrder } from "@/lib/v2/use-last-order"
import { useEasyOrder } from "@/lib/v2/use-easy-order"
import { cliente } from "@/cliente.config"
import { Bell, RotateCw } from "lucide-react"
import { TopBar } from "./TopBar"
import { CartDrawer } from "./CartDrawer"
import { OverlayPanels, type OverlayKind } from "./OverlayPanels"
import { MenuModal } from "./MenuModal"
import { TrackOrderModal } from "./TrackOrderModal"
import { SubscribeModal } from "./SubscribeModal"
import RuletaModal from "./RuletaModal"
import AccountModal from "./AccountModal"
import CookieConsentBanner from "./CookieConsentBanner"
import SiteFooter from "./SiteFooter"
// Round 85 · TreasureRewardModal (R82 castaway SVG modal) retired ·
// the 3D pergamino in-scene that emerges from the cofre on click
// replaces it · same discount flow, more immersive reveal.
// Round 95 · OrderTracker (R91-R94 · canoa repartidor + rope +
// confetti + status overlay) eliminado per user · approach
// distinto en evaluación. La isla, cofre, pergamino, hover cards
// permanecen intactos.
import { SceneErrorBoundary } from "./SceneErrorBoundary"
import type { AnchorKind } from "./Scene"

// R96.130 · Wave 1 Item #3 · LCP optimization · poster visible
// inmediato + Canvas deferido 800ms post-mount o 1ra interacción ·
// captura LCP en el poster (no en el Canvas pesado · 3D models toman
// 2-3s en decode + paint). Domino's research · 100ms LCP = 1% conv.
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <ScenePoster />,
})

/**
 * ScenePoster · LCP element · gradient grande + headline visible
 * inmediato sin requerir el bundle r3f (54KB de chunk separado).
 */
function ScenePoster() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #1a2545 0%, #0a1124 60%, #060914 100%)",
      }}
    >
      <div className="flex flex-col items-center gap-3 opacity-70">
        <span className="text-6xl" aria-hidden>
          🏝️
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
          isla en aguas tranquilas
        </span>
      </div>
    </div>
  )
}

/** DeferredScene · monta el Canvas pesado tras 800ms post-mount o
 *  primera interacción (scroll · touch · click) · lo que llegue antes.
 *  Mientras tanto sirve el poster · LCP scoring captura el poster. */
function DeferredScene(props: React.ComponentProps<typeof Scene>) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (mounted) return
    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setMounted(true)
    }, 800)
    const onInteract = () => {
      if (!cancelled) {
        setMounted(true)
        window.clearTimeout(timeoutId)
      }
    }
    window.addEventListener("scroll", onInteract, { once: true, passive: true })
    window.addEventListener("touchstart", onInteract, { once: true, passive: true })
    window.addEventListener("click", onInteract, { once: true })
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      window.removeEventListener("scroll", onInteract)
      window.removeEventListener("touchstart", onInteract)
      window.removeEventListener("click", onInteract)
    }
  }, [mounted])
  if (!mounted) return <ScenePoster />
  return <Scene {...props} />
}

function LandingInner() {
  // cart.open() is still used by TopBar (Carrito button) + CartDrawer's
  // own "Confirmar por WhatsApp" + MenuModal's footer Confirmar CTA.
  // Round 9 narrows the entry points · cofre + hero CTAs now route to
  // the catalog instead of the empty cart drawer.
  const cart = useCart()
  // R96.9 · pattern Domino's "Pedí lo mismo" · CTA conditional
  // basado en localStorage del último pedido (TTL 30 días).
  const { order: lastOrder, clear: clearLastOrder } = useLastOrder()
  // R96.106 · Easy Order ("Hambre de Náufrago") · cross-device · server-side.
  // Si hay easyOrder fetched · prioriza este sobre el lastOrder local.
  const { easyOrder } = useEasyOrder()
  const [overlay, setOverlay] = useState<OverlayKind>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // Round 77 · cofre click opens the treasure reward modal.
  const [treasureOpen, setTreasureOpen] = useState(false)
  // Round 96.7 · "Sigue tu pedido" CTA · modal pide order code
  // y redirige a /order/[code].
  const [trackOpen, setTrackOpen] = useState(false)
  // R96.10 · "Registrate" CTA · subscriber lite opt-in.
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  // R96.98 · ruleta del cofre · click cofre abre la rueda giratoria.
  const [ruletaOpen, setRuletaOpen] = useState(false)
  // R96.113 · Account modal · botón usuario en TopBar abre login/perfil.
  const [accountOpen, setAccountOpen] = useState(false)
  // Round 95 · OrderTracker state eliminado · pendiente nuevo
  // approach del usuario.

  const openMenu = () => setMenuOpen(true)

  // R96.29 · CustomEvent listener · "Seguir comprando" del CartDrawer
  // dispatcha naufrago:open-menu · abrimos el modal del menú.
  useEffect(() => {
    const handler = () => setMenuOpen(true)
    window.addEventListener("naufrago:open-menu", handler)
    return () => window.removeEventListener("naufrago:open-menu", handler)
  }, [])

  const reorderLast = () => {
    if (!lastOrder) return
    // Re-popular cart con los items del último pedido + abrir
    // cart drawer. NO auto-confirma · solo pre-carga.
    for (const line of lastOrder.lines) {
      cart.add(
        { id: line.id, name: line.name, priceUsd: line.priceUsd },
        line.qty,
      )
    }
    cart.open()
  }

  // R96.106 · reorder desde Easy Order server-side (cross-device).
  const reorderEasyOrder = () => {
    if (!easyOrder) return
    for (const line of easyOrder.cart_lines) {
      cart.add(
        { id: line.id, name: line.name, priceUsd: line.priceUsd },
        line.qty,
      )
    }
    cart.open()
  }

  const handleAnchor = (kind: AnchorKind) => {
    // R96.98 · cofre click abre la ruleta de premios (1 spin por
    // IP/fingerprint cada 24h). Pergamino sigue saliendo de la
    // botella · son dos features independientes.
    if (kind === "cofre") {
      setRuletaOpen(true)
      return
    }
    setOverlay(kind)
  }

  // R96.83 · listener · botella click dispara CustomEvent que
  // setTreasureOpen(true) · pergamino emerge desde la botella.
  useEffect(() => {
    const handler = () => setTreasureOpen(true)
    window.addEventListener("naufrago:open-pergamino", handler)
    return () => window.removeEventListener("naufrago:open-pergamino", handler)
  }, [])

  // R96.113 · si la URL trae ?login=1 (redirect desde /mi-cuenta sin
  // sesión) · auto-abrir AccountModal y limpiar el query param.
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("login") === "1") {
      setAccountOpen(true)
      params.delete("login")
      const newUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : "") +
        window.location.hash
      window.history.replaceState({}, "", newUrl)
    }
  }, [])

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-slate-950 text-slate-100">
      <TopBar onOpenAccount={() => setAccountOpen(true)} />

      {/* 3D scene · full viewport · hero copy sits over it.
          Wrapped in SceneErrorBoundary so an unloadable asset doesn't
          white-screen the page · cart + top bar + overlays sit OUTSIDE
          the boundary and keep working when the scene fails. */}
      <div className="absolute inset-0 z-0">
        <SceneErrorBoundary>
          <DeferredScene
            onAnchorClick={handleAnchor}
            treasureOpen={treasureOpen}
            onTreasureClose={() => setTreasureOpen(false)}
            onOpenMenu={openMenu}
          />
        </SceneErrorBoundary>
      </div>

      {/* R96.31 · TODOS los CTAs + "Pedí lo mismo" alineados al marco
          izquierdo top vertical stack. Solo el hero banner (chip +
          headline) queda abajo. Orden top→bottom · primary 'Ver menú'
          (más prominent) · 'Pedí lo mismo' (condicional) · 'Sigue tu
          pedido' · 'Hablar por WhatsApp' · 'Registrate'. */}
      <div className="pointer-events-none absolute left-3 top-20 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2">
        <button
          type="button"
          onClick={openMenu}
          className="pointer-events-auto inline-flex w-[180px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-transform hover:translate-y-[-1px]"
        >
          <ChevronDown className="h-4 w-4 shrink-0" />
          {naufragoV2.hero.ctaSecondary}
        </button>
        {easyOrder ? (
          <div
            className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border-2 px-3 py-2 shadow-lg backdrop-blur-sm"
            style={{
              borderColor: "#3D2466",
              background: "rgba(245,233,210,0.85)",
            }}
          >
            <div className="min-w-0 flex-1">
              <span
                className="block font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: "#3D2466" }}
              >
                Tu orden favorita
              </span>
              <span
                className="block truncate text-xs font-semibold"
                style={{ color: "#3D2466" }}
              >
                {easyOrder.cart_lines.length}{" "}
                {easyOrder.cart_lines.length === 1 ? "plato" : "platos"}
                {easyOrder.total_usd
                  ? ` · $${Number(easyOrder.total_usd).toFixed(2)}`
                  : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={reorderEasyOrder}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-transform hover:translate-y-[-1px]"
              style={{ background: "#3D2466" }}
            >
              <RotateCw className="h-3 w-3" />
              Hambre de Náufrago
            </button>
          </div>
        ) : lastOrder ? (
          <div
            className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border-2 px-3 py-2 shadow-lg backdrop-blur-sm"
            style={{
              borderColor: "#3D2466",
              background: "rgba(245,233,210,0.85)",
            }}
          >
            <div className="min-w-0 flex-1">
              <span
                className="block font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: "#3D2466" }}
              >
                La última vez pediste
              </span>
              <span
                className="block truncate text-xs font-semibold"
                style={{ color: "#3D2466" }}
              >
                {lastOrder.lines.length}{" "}
                {lastOrder.lines.length === 1 ? "plato" : "platos"} · $
                {lastOrder.totalUsd.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={reorderLast}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-md transition-transform hover:translate-y-[-1px]"
              style={{ background: "#3D2466" }}
            >
              <RotateCw className="h-3 w-3" />
              Pedí lo mismo
            </button>
            <button
              type="button"
              onClick={clearLastOrder}
              aria-label="Quitar"
              className="rounded-full p-1 text-[11px] opacity-60 hover:opacity-100"
              style={{ color: "#3D2466" }}
            >
              ✕
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setTrackOpen(true)}
          className="pointer-events-auto inline-flex w-[180px] items-center justify-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-all hover:translate-y-[-1px]"
          style={{
            borderColor: "#3D2466",
            color: "#3D2466",
            background: "rgba(255,255,255,0.55)",
          }}
        >
          <RotateCw className="h-4 w-4 shrink-0" />
          Sigue tu pedido
        </button>
        <a
          href={`https://wa.me/${cliente.whatsappE164}?text=${encodeURIComponent("Hola Náufrago · quería consultar antes de pedir.")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Hablar por WhatsApp"
          className="pointer-events-auto inline-flex w-[180px] items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform hover:translate-y-[-1px]"
          style={{
            background: "linear-gradient(180deg, #25D366 0%, #1FB855 100%)",
            boxShadow: "0 10px 24px -10px rgba(37,211,102,0.55)",
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
          <span>Hablar por WhatsApp</span>
        </a>
        <button
          type="button"
          onClick={() => setSubscribeOpen(true)}
          className="pointer-events-auto inline-flex w-[180px] items-center justify-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-all hover:translate-y-[-1px]"
          style={{
            borderColor: "#3D2466",
            color: "#3D2466",
            background: "rgba(255,255,255,0.40)",
          }}
        >
          <Bell className="h-4 w-4 shrink-0" />
          Registrate
        </button>
      </div>

      {/* Hero copy · esquina inferior izquierda · solo headline +
          chip 'Olón ghost kitchen' + CTA primario 'Ver menú' + card
          'Pedí lo mismo' condicional. Los 3 CTAs secundarios viven
          arriba en el top-left stack · espacio natural entre ambos
          grupos gracias al justify-end del column flex. */}
      <div className="pointer-events-none relative z-10 flex min-h-[100svh] flex-col items-start justify-end px-3 pb-3">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          /* Round 10 · single-issue fix · hero block trimmed so the 3D
             island stays the visual lead. No more backdrop-blur (mobile
             container removed too · text rides drop-shadow legibility
             over the scene) · max-width clamped to 448px (was 672px)
             so the block never overlaps cofre/character on default. */
          className="pointer-events-auto max-w-md"
        >
          {/* Round 73 · hero letters retuned to the 2-color palette
              the user supplied · #3D2466 (deep indigo purple) +
              #4DD4D8 (celeste). NÁUFRAGO accent kept on the
              celeste; everything else pulled to the indigo. Pill
              chip swaps from generic cyan-500 utilities to the
              celeste-on-celeste-tint scheme to keep the palette
              strict. Drop-shadow kept (dark halo helps the indigo
              text read over the bright sand / water in the scene
              background). */}
          <span
            className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{
              borderColor: "rgba(77, 212, 216, 0.4)",
              background: "rgba(77, 212, 216, 0.10)",
              color: "#4DD4D8",
            }}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: "#4DD4D8" }}
            />
            Olón · ghost kitchen
          </span>
          <h1
            className="font-display text-2xl font-semibold leading-tight tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)] md:text-3xl lg:text-4xl"
            style={{ color: "#3D2466" }}
          >
            Cuando tengas esa hambre de...{" "}
            <span style={{ color: "#4DD4D8" }}>NÁUFRAGO</span>{" "}
            te espera!
          </h1>
          {/* R96.31 · hero abajo solo · chip + headline. Todos los
              CTAs ('Ver menú' · 'Pedí lo mismo' · 'Sigue tu pedido' ·
              'Hablar WhatsApp' · 'Registrate') viven en el stack
              superior izquierdo · ver bloque absolute top-20 arriba. */}
        </motion.div>
      </div>

      {/* Drawers + modals · z-40+ to sit above the 3D layer.
          Round 85 · TreasureRewardModal unmounted · cofre click
          drives the in-scene 3D pergamino emerge (Scene.tsx). */}
      <CartDrawer />
      <MenuModal open={menuOpen} onClose={() => setMenuOpen(false)} />
      <TrackOrderModal open={trackOpen} onClose={() => setTrackOpen(false)} />
      <SubscribeModal open={subscribeOpen} onClose={() => setSubscribeOpen(false)} />
      <RuletaModal open={ruletaOpen} onClose={() => setRuletaOpen(false)} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <CookieConsentBanner />
      <SiteFooter />
      <OverlayPanels active={overlay} onClose={() => setOverlay(null)} />

    </main>
  )
}

export default function LandingV2() {
  return (
    <CartProvider>
      <LandingInner />
    </CartProvider>
  )
}
