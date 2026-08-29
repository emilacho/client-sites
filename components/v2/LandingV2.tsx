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
import { CartProvider, useCart } from "@/lib/v2/cart-context"
import { useLastOrder } from "@/lib/v2/use-last-order"
import { useEasyOrder } from "@/lib/v2/use-easy-order"
import { RotateCw } from "lucide-react"
import { TopBar } from "./TopBar"
import { CartDrawer } from "./CartDrawer"
import { OverlayPanels, type OverlayKind } from "./OverlayPanels"
import { MenuModal } from "./MenuModal"
import { TrackOrderModal } from "./TrackOrderModal"
// R97.8 · LLAMAME button + VoiceOrderModal removidos del UI ·
// código se mantiene en repo para revival futuro si re-activamos
// la línea de voz IA · ver feat/voice-ai-* branches en gitlog.
// import { VoiceOrderModal } from "./VoiceOrderModal"
import { StoriesModal } from "./StoriesModal"
import { CombosModal } from "./CombosModal"
import { ScheduleModal } from "./ScheduleModal"
import { ClubModal } from "./ClubModal"
import RuletaModal from "./RuletaModal"
import AccountModal from "./AccountModal"
import { OrderTrackerWidget } from "./OrderTrackerWidget"
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
      {/* R126 · esto ya NO reemplaza a la isla · es lo que se ve MIENTRAS
          la isla carga, en celular y en computadora por igual. Es una foto
          de la isla real sacada de la propia escena · 64 KB · así la
          primera pantalla no es un cuadro vacío. En R125 esta foto se
          quedaba para siempre en celular y la isla no se cargaba nunca:
          eso dejaba sin uso todo lo que la isla sabe hacer (el cofre, el
          bote, los cocos, el pergamino). Ahora los modelos pesan 3,7 MB en
          vez de 27,8 MB y la isla vuelve al celular. */}
      <picture>
        <source srcSet="/isla-poster.webp" type="image/webp" />
        <img
          src="/isla-poster.jpg"
          alt="La isla de Náufrago"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </div>
  )
}

/**
 * ¿Conviene cargar la isla 3D en este aparato? · R126.
 *
 * SER CELULAR YA NO ES MOTIVO PARA SALTARSE LA ISLA. En R125 sí lo era,
 * porque los modelos pesaban 27,8 MB; se resolvía el peso a costa de
 * dejar sin uso todo lo que la isla sabe hacer. R126 adelgazó los modelos
 * a 3,7 MB (scripts/adelgazar-modelos.mjs) · a ese peso el celular la
 * aguanta, y el cliente que entra desde el teléfono -3 de cada 4 ventas
 * en línea de Ecuador- ve la misma tienda que el de escritorio.
 *
 * Sólo se cae a la foto cuando el propio aparato avisa que no da: modo
 * ahorro de datos encendido, conexión 2G, o memoria de gama muy baja
 * (1 GB o menos, donde el navegador mata la pestaña al abrir WebGL).
 * Ahí la foto no es un recorte de funciones: es lo único que carga.
 */
function conviene3D(): boolean {
  if (typeof window === "undefined") return false
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
    deviceMemory?: number
  }
  if (nav.connection?.saveData) return false
  const tipo = nav.connection?.effectiveType
  if (tipo && /(^|-)2g$/.test(tipo)) return false
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 1) return false
  return true
}

/** DeferredScene · monta el Canvas pesado tras 800ms post-mount o
 *  primera interacción (scroll · touch · click) · lo que llegue antes.
 *  Mientras tanto sirve el poster · LCP scoring captura el poster. */
function DeferredScene(props: React.ComponentProps<typeof Scene>) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (mounted) return
    // R126 · sólo se queda en la foto el aparato que avisa que no da.
    if (!conviene3D()) return
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
  // R96.9 · pattern Domino's "Pide lo mismo" · CTA conditional
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
  // R96.98 · ruleta del cofre · click cofre abre la rueda giratoria.
  const [ruletaOpen, setRuletaOpen] = useState(false)
  // R96.113 · Account modal · botón usuario en TopBar abre login/perfil.
  const [accountOpen, setAccountOpen] = useState(false)
  // R97.8 · 4 modals nuevos · reemplazan LLAMAME (voice IA pausado)
  const [storiesOpen, setStoriesOpen] = useState(false)
  const [combosOpen, setCombosOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [clubOpen, setClubOpen] = useState(false)
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

  // R96.145 · listener · SiteFooter "Sigue tu pedido" ícono dispara
  // CustomEvent · abre TrackOrderModal.
  useEffect(() => {
    const handler = () => setTrackOpen(true)
    window.addEventListener("naufrago:open-tracker", handler)
    return () => window.removeEventListener("naufrago:open-tracker", handler)
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

      {/* R96.31 · TODOS los CTAs + "Pide lo mismo" alineados al marco
          izquierdo top vertical stack. Solo el hero banner (chip +
          headline) queda abajo. Orden top→bottom · primary 'Ver menú'
          (más prominent) · 'Pide lo mismo' (condicional) · 'Sigue tu
          pedido' · 'Hablar por WhatsApp' · 'Registrate'. */}
      <div className="pointer-events-none absolute left-3 top-20 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2">
        {/* R96.150 · botón "Ver menú" estilo letrero de madera Náufrago ·
            replica el sign del 3D scene · wood plank kraft + texto Bebas
            Neue uppercase sand · bolts en esquinas + wood grain lines */}
        <button
          type="button"
          onClick={openMenu}
          className="pointer-events-auto group relative inline-flex w-[200px] items-center justify-center px-5 py-3 transition-all hover:translate-y-[-1px] active:scale-[0.97] md:w-[340px] md:px-8 md:py-8"
          style={{
            background:
              "linear-gradient(180deg, #542D67 0%, #4B2855 50%, #38154B 100%)",
            border: "2.5px solid #2D1135",
            borderRadius: "6px 10px 6px 10px",
            boxShadow:
              "inset 0 1px 0 rgba(102,55,114,0.5), inset 0 -3px 0 rgba(26,8,40,0.6), 0 6px 14px rgba(45,17,53,0.5)",
          }}
        >
          {/* Bolts/nails · purple muy oscuro · matchea sign GLB bordes */}
          <span
            aria-hidden
            className="absolute left-2 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{
              background: "#1A0828",
              boxShadow: "inset 0 1px 0 rgba(102,55,114,0.4)",
            }}
          />
          <span
            aria-hidden
            className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{
              background: "#1A0828",
              boxShadow: "inset 0 1px 0 rgba(102,55,114,0.4)",
            }}
          />
          <span
            aria-hidden
            className="absolute bottom-1.5 left-2 h-1.5 w-1.5 rounded-full"
            style={{
              background: "#1A0828",
              boxShadow: "inset 0 1px 0 rgba(102,55,114,0.4)",
            }}
          />
          <span
            aria-hidden
            className="absolute bottom-1.5 right-2 h-1.5 w-1.5 rounded-full"
            style={{
              background: "#1A0828",
              boxShadow: "inset 0 1px 0 rgba(102,55,114,0.4)",
            }}
          />
          {/* Grain lines · purple claro #663772 semi-translucido */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-3 h-px"
            style={{ background: "rgba(102,55,114,0.45)" }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 bottom-3 h-px"
            style={{ background: "rgba(102,55,114,0.45)" }}
          />
          {/* Texto MENÚ · Alfa Slab One (slab serif heavy chunky · matchea
              la tipografía del sign 3D del isla · serifs prominentes +
              stems gruesos) · cyan-mint #51D4B4 (color del texto baked
              en el GLB original) */}
          <span
            className="font-[family-name:var(--font-alfa-slab),serif] text-xl tracking-[0.08em] md:text-5xl"
            style={{
              color: "#51D4B4",
              textShadow:
                "0 1px 2px rgba(26,8,40,0.85), 0 0 8px rgba(81,212,180,0.35)",
            }}
          >
            MENÚ
          </span>
        </button>

        {/* R97.8 · 2x2 grid de wood-plank buttons · reemplaza LLAMAME ·
            Pesca del día · Combo para 2 · Reservar hora · Náufrago Club ·
            cada uno mismo styling wood plank purple gradient · texto Alfa
            Slab cyan-mint glow · solo más chicos (~96px wide · text-sm) */}
        {/* R128 · en computadora los cuatro van uno abajo del otro,
            cuadrados, formando una columna con el cartel MENÚ arriba. El
            lado se mide contra el ALTO de la ventana (13%, tope 150 px):
            con medida fija el cuarto cartel se le montaba a la frase en
            las pantallas de 768 px de alto, que son la mayoría de las
            laptops. En celular siguen de a dos, que ahí el alto escasea. */}
        <div className="pointer-events-auto grid w-[200px] grid-cols-2 gap-2 md:w-[min(13vh,150px)] md:grid-cols-1 md:gap-3">
          {[
            { label: "Fotos\ndel menú", icon: "📸", onClick: () => setStoriesOpen(true), aria: "Fotos del menú" },
            { label: "Combos\nNáufrago", icon: "🍱", onClick: () => setCombosOpen(true), aria: "Combos Náufrago" },
            { label: "Reservar\nhora", icon: "⏰", onClick: () => setScheduleOpen(true), aria: "Pedir para un horario específico" },
            { label: "Náufrago\nClub", icon: "✦", onClick: () => setClubOpen(true), aria: "Suscripción Náufrago Club" },
          ].map((b) => (
            <button
              key={b.aria}
              type="button"
              onClick={b.onClick}
              aria-label={b.aria}
              className="group relative inline-flex h-[62px] flex-col items-center justify-center px-2 py-1.5 transition-all hover:translate-y-[-1px] active:scale-[0.97] md:h-[min(13vh,150px)] md:w-[min(13vh,150px)] md:px-3 md:py-3"
              style={{
                background:
                  "linear-gradient(180deg, #542D67 0%, #4B2855 50%, #38154B 100%)",
                border: "2px solid #2D1135",
                borderRadius: "5px 8px 5px 8px",
                boxShadow:
                  "inset 0 1px 0 rgba(102,55,114,0.5), inset 0 -2px 0 rgba(26,8,40,0.6), 0 4px 10px rgba(45,17,53,0.5)",
              }}
            >
              {/* Bolts esquinas · más chicos */}
              {[
                ["left-1 top-1 md:left-2 md:top-2", "rounded-tl"],
                ["right-1 top-1 md:right-2 md:top-2", "rounded-tr"],
                ["left-1 bottom-1 md:left-2 md:bottom-2", "rounded-bl"],
                ["right-1 bottom-1 md:right-2 md:bottom-2", "rounded-br"],
              ].map(([pos]) => (
                <span
                  key={pos}
                  aria-hidden
                  className={`absolute h-1 w-1 rounded-full md:h-1.5 md:w-1.5 ${pos}`}
                  style={{
                    background: "#1A0828",
                    boxShadow: "inset 0 1px 0 rgba(102,55,114,0.4)",
                  }}
                />
              ))}
              <span className="text-sm leading-none md:text-2xl" aria-hidden>
                {b.icon}
              </span>
              <span
                className="mt-0.5 whitespace-pre-line text-center font-[family-name:var(--font-alfa-slab),serif] text-[10px] leading-[1.1] tracking-[0.06em] md:mt-1.5 md:text-[15px] md:leading-[1.2]"
                style={{
                  color: "#51D4B4",
                  textShadow:
                    "0 1px 1.5px rgba(26,8,40,0.85), 0 0 6px rgba(81,212,180,0.35)",
                }}
              >
                {b.label}
              </span>
            </button>
          ))}
        </div>

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
              Pide lo mismo
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
        {/* R96.145 · "Sigue tu pedido" movido al SiteFooter como icon
            pequeño · listener naufrago:open-tracker abre el modal. */}
        {/* R96.142 · WhatsApp CTA movido al SiteFooter como logo brand.
            R96.144 · "Registrate" CTA removido · redundante con icono
            usuario topbar · opt-in promos ahora se captura en checkout
            (CartDrawer checkbox) y en /mi-cuenta (sección notificaciones). */}
      </div>

      {/* Hero copy · esquina inferior izquierda · solo headline +
          chip 'Olón ghost kitchen' + CTA primario 'Ver menú' + card
          'Pide lo mismo' condicional. Los 3 CTAs secundarios viven
          arriba en el top-left stack · espacio natural entre ambos
          grupos gracias al justify-end del column flex. */}
      {/* R127 · en celular la frase se subía por encima de la barra de
          abajo (WhatsApp · Instagram · FAQ · Privacidad), que es fija y en
          una pantalla angosta le pasa por encima: se leía media frase. Ya
          venía tapada desde antes, se ve en la captura de R125. */}
      <div className="pointer-events-none relative z-10 flex min-h-[100svh] flex-col items-start justify-end px-3 pb-20 md:pb-3">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          /* Round 10 · single-issue fix · hero block trimmed so the 3D
             island stays the visual lead. No more backdrop-blur (mobile
             container removed too · text rides drop-shadow legibility
             over the scene) · max-width clamped to 448px (was 672px)
             so the block never overlaps cofre/character on default. */
          className="pointer-events-auto max-w-[15rem] sm:max-w-md"
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
          {/* R97.8.11 · chip 'Olón · ghost kitchen' removido · info
              ahora vive solo en el TopBar centrado · evita duplicación */}
          {/* R127 · en celular la frase ocupaba media pantalla y le comía
              el lugar a la isla · baja de 24 a 16 px y el bloque se
              angosta. De tableta para arriba queda igual que siempre. */}
          <h1
            className="font-display text-base font-semibold leading-tight tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)] sm:text-xl md:text-3xl lg:text-4xl"
            style={{ color: "#3D2466" }}
          >
            Cuando tengas esa hambre de...{" "}
            <span style={{ color: "#4DD4D8" }}>NÁUFRAGO</span>{" "}
            te espera!
          </h1>
          {/* R96.31 · hero abajo solo · chip + headline. Todos los
              CTAs ('Ver menú' · 'Pide lo mismo' · 'Sigue tu pedido' ·
              'Hablar WhatsApp' · 'Registrate') viven en el stack
              superior izquierdo · ver bloque absolute top-20 arriba. */}
        </motion.div>
      </div>

      {/* Drawers + modals · z-40+ to sit above the 3D layer.
          Round 85 · TreasureRewardModal unmounted · cofre click
          drives the in-scene 3D pergamino emerge (Scene.tsx). */}
      <CartDrawer onOpenMenu={() => setMenuOpen(true)} />
      <MenuModal open={menuOpen} onClose={() => setMenuOpen(false)} />
      <TrackOrderModal open={trackOpen} onClose={() => setTrackOpen(false)} />
      {/* R97.8 · 4 modals nuevos · reemplazan VoiceOrderModal */}
      <StoriesModal
        open={storiesOpen}
        onClose={() => setStoriesOpen(false)}
        onOpenMenu={() => setMenuOpen(true)}
      />
      <CombosModal open={combosOpen} onClose={() => setCombosOpen(false)} />
      <ScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <ClubModal open={clubOpen} onClose={() => setClubOpen(false)} />
      <RuletaModal open={ruletaOpen} onClose={() => setRuletaOpen(false)} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <OrderTrackerWidget />
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
