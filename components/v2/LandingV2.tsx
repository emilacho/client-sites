"use client"
/**
 * LandingV2 · the root client component for the v2 Náufrago landing.
 *
 *  - mounts the CartProvider context
 *  - composes the 3D scene + TopBar + PromoTicker + CartDrawer +
 *    OverlayPanels (historia · reseñas · contacto)
 *  - cofre anchor opens the cart · the other 3 anchors open the
 *    corresponding overlay panel
 *  - hero copy + headline overlay the scene · fades out as the user
 *    scrolls (subtle reveal of the 3D world)
 */
import dynamic from "next/dynamic"
import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { CartProvider, useCart } from "@/lib/v2/cart-context"
import { naufragoV2 } from "@/lib/v2/naufrago-content"
import { TopBar } from "./TopBar"
import { CartDrawer } from "./CartDrawer"
import { OverlayPanels, type OverlayKind } from "./OverlayPanels"
import { PromoTicker } from "./PromoTicker"
import { MenuModal } from "./MenuModal"
import { SceneErrorBoundary } from "./SceneErrorBoundary"
import type { AnchorKind } from "./Scene"

// The r3f Canvas can't SSR · dynamic import with ssr:false.
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), {
  ssr: false,
  loading: () => <SceneFallback />,
})

function SceneFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="h-3 w-3 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
          cargando la isla…
        </span>
      </div>
    </div>
  )
}

function LandingInner() {
  // cart.open() is still used by TopBar (Carrito button) + CartDrawer's
  // own "Confirmar por WhatsApp" + MenuModal's footer Confirmar CTA.
  // Round 9 narrows the entry points · cofre + hero CTAs now route to
  // the catalog instead of the empty cart drawer.
  useCart()
  const [overlay, setOverlay] = useState<OverlayKind>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const openMenu = () => setMenuOpen(true)

  const handleAnchor = (kind: AnchorKind) => {
    if (kind === "cofre") {
      openMenu()
      return
    }
    setOverlay(kind)
  }

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-slate-950 text-slate-100">
      <TopBar />

      {/* 3D scene · full viewport · hero copy sits over it.
          Wrapped in SceneErrorBoundary so an unloadable asset doesn't
          white-screen the page · cart + top bar + overlays sit OUTSIDE
          the boundary and keep working when the scene fails. */}
      <div className="absolute inset-0 z-0">
        <SceneErrorBoundary>
          <Scene onAnchorClick={handleAnchor} />
        </SceneErrorBoundary>
      </div>

      {/* Hero copy · floats above the scene with a soft gradient backdrop
          so it stays readable over the GLB */}
      <div className="pointer-events-none relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-32 pt-24 md:items-start md:pb-40">
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
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">
            <span className="h-1 w-1 rounded-full bg-cyan-400" />
            Olón · ghost kitchen
          </span>
          {/* Round 20 · hero slogan · "Cuando tengas esa hambre de...
              NÁUFRAGO te espera!" · NÁUFRAGO highlighted in brand
              cyan #4DD4D8 against the white drop-shadow base. Plain
              string stays in naufragoV2.hero.headline for metadata
              consumers · this h1 owns the visual presentation. */}
          <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)] md:text-3xl lg:text-4xl">
            Cuando tengas esa hambre de...{" "}
            <span style={{ color: "#4DD4D8" }}>NÁUFRAGO</span>{" "}
            te espera!
          </h1>
          <p className="mt-3 text-sm text-slate-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] md:text-base">
            {naufragoV2.hero.subheadline}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openMenu}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-transform hover:translate-y-[-1px]"
            >
              {naufragoV2.hero.ctaPrimary}
            </button>
            <button
              type="button"
              onClick={openMenu}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-5 py-3 font-medium text-slate-100 backdrop-blur-sm transition-colors hover:bg-slate-800"
            >
              {naufragoV2.hero.ctaSecondary}
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          {/* Round 5 single-issue fix · the hint paragraph
              ("Toca los objetos en la isla · cofre = pedido, barco =
              historia, cocos = reseñas, palmeras = contacto.") was
              removed here · per forensic findings it was the source of
              the residual "historia / reseñas / contacto" text Emilio
              spotted post-revert · the 3D-anchored pill labels were
              already gone in b2b8cdd. No other change in this commit. */}
        </motion.div>
      </div>

      {/* Round 19 · bottom sticky promo strip (was MenuQuickAdd) */}
      <PromoTicker />

      {/* Drawers + modals · z-40+ to sit above the 3D layer */}
      <CartDrawer />
      <MenuModal open={menuOpen} onClose={() => setMenuOpen(false)} />
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
