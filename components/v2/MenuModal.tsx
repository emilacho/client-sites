"use client"
/**
 * MenuModal · 17-item catalog opened from the cofre anchor.
 *
 *  - 5 tabs (Encebollados · Ceviches · Otros · Bebidas · Extras) with
 *    item counts driven from MENU_ITEMS · order is canonical (3 · 2 ·
 *    1 · 6 · 5 · pinned in naufrago-content.ts).
 *  - Card grid · each card has emoji thumbnail, name, description,
 *    price, and a "+ Agregar" button that calls
 *    `cart.add({ id, name, priceUsd })` and flashes "Agregado" for
 *    1.2s so the user gets visual confirmation without leaving the
 *    modal.
 *  - Dismiss · backdrop click, ESC key, or the close (×) button.
 *  - "Confirmar por WhatsApp" CTA at the bottom · opens the cart
 *    drawer (which holds the actual WA checkout link) only if the
 *    cart has lines.
 *  - Framer Motion AnimatePresence for backdrop + panel reveal · the
 *    panel respects `prefers-reduced-motion` via the framer config.
 *
 * Round 9 · single-issue commit · wires the cofre click to a real
 * 17-item catalog. Cart drawer + TopBar + scene anchors are
 * untouched (same diff). Future rounds will polish water/sky/bloom.
 */
import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Minus, Plus } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"
import { PlatoThumb } from "./PlatoThumb"
import {
  ALLERGEN_LABELS,
  MENU_ITEMS,
  MENU_CATEGORIES,
  type MenuCategoryId,
  type MenuItem,
  type MenuItemIngredientToggle,
  type MenuItemVariant,
} from "@/lib/v2/naufrago-content"
import { usePopularItems, type PopularItem } from "@/lib/v2/use-popular-items"
import { useDynamicOptions } from "@/lib/v2/use-dynamic-options"

export interface MenuModalProps {
  open: boolean
  onClose: () => void
}

export function MenuModal({ open, onClose }: MenuModalProps) {
  const [activeCat, setActiveCat] = useState<MenuCategoryId>("encebollados")
  const cart = useCart()

  // R96.134 · funnel · menu_viewed cuando se abre el modal.
  useEffect(() => {
    if (open) {
      // Lazy import para evitar overhead bundle si el módulo no lo
      // requiere · funnel events son cross-cutting.
      void import("@/lib/v2/posthog-track").then(({ track }) =>
        track("menu_viewed", { active_cat: activeCat }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ESC closes the modal · only attached while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const handleConfirm = useCallback(() => {
    if (cart.itemCount === 0) return
    onClose()
    cart.open()
  }, [cart, onClose])

  const itemsByCat = MENU_ITEMS.filter((i) => i.category === activeCat)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu-modal-root"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de Náufrago"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: "8%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "8%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-10 flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-violet-500/10 md:rounded-3xl"
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
              <div>
                <h2
                  className="font-display text-2xl font-semibold uppercase leading-tight tracking-tight md:text-3xl"
                  style={{ color: "#3D2466" }}
                >
                  CREA TU PEDIDO
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
              >
                ×
              </button>
            </header>

            {/* R96.22 · popular items strip · más pedidos en Olón 30d.
                Pattern Amazon recommendations. Quick-add un click ·
                bypass del browse en MenuModal tabs. */}
            <PopularStrip />

            {/* Tabs */}
            <nav
              role="tablist"
              aria-label="Categorías de menú"
              className="flex gap-2 overflow-x-auto border-b border-slate-800 px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {MENU_CATEGORIES.map((cat) => {
                const count = MENU_ITEMS.filter((i) => i.category === cat.id).length
                const isActive = cat.id === activeCat
                return (
                  <button
                    key={cat.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCat(cat.id)}
                    className={
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
                      (isActive
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800")
                    }
                  >
                    <span aria-hidden>{cat.emoji}</span>
                    <span>{cat.label}</span>
                    <span
                      className={
                        "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono " +
                        (isActive
                          ? "bg-cyan-400/20 text-cyan-100"
                          : "bg-slate-800 text-slate-400")
                      }
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Grid · scrollable area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {itemsByCat.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* Footer · "Canoa de compras" CTA · abre el cart drawer. */}
            <footer className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/95 px-5 py-4">
              <div className="text-sm">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Tu pedido
                </span>
                <div className="mt-0.5 font-semibold text-white">
                  {cart.itemCount} {cart.itemCount === 1 ? "ítem" : "ítems"} · $
                  {cart.total.toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={cart.itemCount === 0}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-500/30 transition-transform hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0"
              >
                Canoa de compras
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* R96.22 · PopularStrip · top 3 más pedidos · horizontal scroll
   cards compactas + quick-add un click. Cuando source !== 'live'
   muestra badge 'sugeridos' (fallback). */
function PopularStrip() {
  const { items, source, loading } = usePopularItems()
  const cart = useCart()
  const [flashId, setFlashId] = useState<string | null>(null)

  if (loading || items.length === 0) return null

  const handleAdd = (item: PopularItem) => {
    cart.add({ id: item.id, name: item.name, priceUsd: item.priceUsd })
    setFlashId(item.id)
    window.setTimeout(() => setFlashId(null), 1100)
  }

  const headline = source === "live" ? "🔥 Los más pedidos en Olón" : "✨ Sugeridos para empezar"

  return (
    <section className="border-b border-slate-800 bg-slate-950/40 px-4 py-3">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-200">
        {headline}
      </h3>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => handleAdd(it)}
            className={
              "flex w-[136px] shrink-0 flex-col items-start gap-1 rounded-xl border p-2 text-left transition-colors " +
              (flashId === it.id
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-slate-700 bg-slate-900/60 hover:bg-slate-800")
            }
          >
            {/* R104 · los sugeridos vienen del servidor y ese contrato no
                lleva foto · el plato SÍ la tiene, así que se resuelve contra
                la carta por id. Evita tocar la respuesta del API. */}
            <PlatoThumb
              imageUrl={MENU_ITEMS.find((m) => m.id === it.id)?.imageUrl}
              emoji={it.emoji}
              gradient={it.gradient}
              alt={it.name}
              className="h-12 w-12 rounded-lg"
              emojiClassName="text-2xl"
              sizePx={48}
            />
            <span className="line-clamp-1 text-xs font-semibold text-white">
              {it.name}
            </span>
            <div className="flex w-full items-center justify-between">
              <span className="font-mono text-[10px] text-cyan-200">
                ${it.priceUsd.toFixed(2)}
              </span>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[9px] font-bold transition-colors " +
                  (flashId === it.id
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-200")
                }
              >
                {flashId === it.id ? "✓" : "+ Agregar"}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function MenuCard({ item }: { item: MenuItem }) {
  const cart = useCart()
  const [flash, setFlash] = useState(false)
  // R96.27 · panel unificado · solo ingredient toggles (no más
  // distinción modifiers vs toggles · todo se renderiza igual).
  const [modOpen, setModOpen] = useState(false)
  const [toggleStates, setToggleStates] = useState<Record<string, -1 | 0 | 1>>({})
  // R96.25 · variant picker modal · si item tiene variants/dynamicVariantsKey
  const [variantPickerOpen, setVariantPickerOpen] = useState(false)

  const ingredientToggles = item.ingredientToggles ?? []
  const hasVariants = !!item.variants?.length || !!item.dynamicVariantsKey
  const hasCustomization = ingredientToggles.length > 0
  const togglePriceDelta = ingredientToggles.reduce((sum, t) => {
    const state = toggleStates[t.id] ?? 0
    return state === 1 ? sum + (t.extraPriceDelta ?? 0) : sum
  }, 0)
  const totalPrice = item.priceUsd + togglePriceDelta

  const togglesAsCustomizations = ingredientToggles
    .filter((t) => (toggleStates[t.id] ?? 0) !== 0)
    .map((t) => {
      const state = toggleStates[t.id] ?? 0
      return state === 1
        ? {
            id: `tg-extra-${t.id}`,
            label: t.extraLabel,
            priceDelta: t.extraPriceDelta ?? 0,
          }
        : {
            id: `tg-sin-${t.id}`,
            label: t.removeLabel ?? `Sin ${t.label.toLowerCase()}`,
            priceDelta: 0,
          }
    })

  const setToggleState = (id: string, next: -1 | 0 | 1) =>
    setToggleStates((prev) => ({ ...prev, [id]: next }))

  const addToCart = (variant?: MenuItemVariant | { id: string; label: string }) => {
    const customizations = [...togglesAsCustomizations]
    if (variant) {
      customizations.unshift({
        id: variant.id,
        label: variant.label,
        priceDelta: "priceDelta" in variant ? variant.priceDelta : 0,
      })
    }
    const variantDelta =
      variant && "priceDelta" in variant ? variant.priceDelta : 0
    const lineId = customizations.length
      ? `${item.id}::${customizations.map((c) => c.id).sort().join("+")}`
      : item.id
    cart.add({
      id: lineId,
      name: variant ? `${item.name} · ${variant.label}` : item.name,
      priceUsd: totalPrice + variantDelta,
      ...(customizations.length ? { customizations } : {}),
    })
    setFlash(true)
    setToggleStates({})
    setModOpen(false)
    setVariantPickerOpen(false)
    window.setTimeout(() => setFlash(false), 1200)
  }

  const handleAdd = () => {
    if (hasVariants) {
      setVariantPickerOpen(true)
      return
    }
    addToCart()
  }


  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 transition-colors hover:bg-slate-900">
      <div className="flex gap-3">
        <PlatoThumb
          imageUrl={item.imageUrl}
          emoji={item.emoji}
          gradient={item.gradient}
          alt={item.name}
          className="h-20 w-20 rounded-xl"
          emojiClassName="text-3xl"
          sizePx={80}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-display text-base font-semibold text-white">
              {item.name}
            </h3>
            <span className="shrink-0 font-mono text-sm font-semibold text-cyan-200">
              ${totalPrice.toFixed(2)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-300">
            {item.description}
          </p>
          {item.allergens && item.allergens.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.allergens.map((a) => {
                const cfg = ALLERGEN_LABELS[a]
                return (
                  <span
                    key={a}
                    title={`Contiene ${cfg.label}`}
                    className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200 ring-1 ring-amber-500/20"
                  >
                    <span aria-hidden>{cfg.emoji}</span>
                    {cfg.label}
                  </span>
                )
              })}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {hasCustomization ? (
                <button
                  type="button"
                  onClick={() => setModOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200 ring-1 ring-violet-500/20 hover:bg-violet-500/20"
                >
                  {modOpen ? "− Cerrar" : "+ Personalizar"}
                  {togglesAsCustomizations.length > 0 && !modOpen ? (
                    <span className="ml-0.5 rounded-full bg-violet-500/40 px-1.5 text-[9px] font-bold">
                      {togglesAsCustomizations.length}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {item.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                >
                  {t}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAdd}
              aria-label={`Agregar ${item.name}`}
              className={
                "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                (flash
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-100 hover:bg-slate-700")
              }
            >
              {flash ? "✓ Agregado" : "+ Agregar"}
            </button>
          </div>
        </div>
      </div>
      {modOpen && hasCustomization ? (
        <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
            Ingredientes · ajustá lo que quieras
          </p>
          {ingredientToggles.map((tg) => (
            <IngredientStepper
              key={tg.id}
              toggle={tg}
              state={toggleStates[tg.id] ?? 0}
              onChange={(next) => setToggleState(tg.id, next)}
            />
          ))}
        </div>
      ) : null}
      {variantPickerOpen ? (
        <VariantPicker
          item={item}
          onPick={(v) => addToCart(v)}
          onClose={() => setVariantPickerOpen(false)}
        />
      ) : null}
    </article>
  )
}

/* R96.28 · IngredientStepper compact ~40% reducido vs R96.27 ·
   botones +/− 20×20 (eran 32×32) · padding row reducido · text
   menor · gap entre rows menor · entran más sin scroll. Mantiene
   prominente vía colores activos rose/cyan + scale press feedback. */
function IngredientStepper({
  toggle,
  state,
  onChange,
}: {
  toggle: MenuItemIngredientToggle
  state: -1 | 0 | 1
  onChange: (next: -1 | 0 | 1) => void
}) {
  const canRemove = !!toggle.removeLabel
  const onMinus = () => {
    if (state === 1) onChange(0)
    else if (state === 0 && canRemove) onChange(-1)
  }
  const onPlus = () => {
    if (state === -1) onChange(0)
    else if (state === 0) onChange(1)
  }
  const stateText =
    state === -1
      ? (toggle.removeLabel ?? toggle.label)
      : state === 1
        ? toggle.extraLabel
        : toggle.label
  const containerStyle =
    state === -1
      ? "border-rose-500/70 bg-rose-500/12 text-rose-50"
      : state === 1
        ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-50"
        : "border-slate-700 bg-slate-900/60 text-slate-300"

  return (
    <div
      className={[
        "flex items-center justify-between gap-2 rounded-md border px-2 py-1 transition-all",
        containerStyle,
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {toggle.emoji ? (
          <span aria-hidden className="text-sm leading-none">
            {toggle.emoji}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] font-semibold leading-snug">
            {stateText}
          </span>
          {state === 1 && toggle.extraPriceDelta ? (
            <span className="font-mono text-[9px] text-cyan-200">
              +${toggle.extraPriceDelta.toFixed(2)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onMinus}
          disabled={state === -1 || (state === 0 && !canRemove)}
          aria-label={`Quitar ${toggle.label}`}
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full border transition-all active:scale-90 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/40 disabled:text-slate-600",
            state === -1
              ? "border-rose-400 bg-rose-500 text-white shadow shadow-rose-500/40"
              : "border-rose-400/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/25 hover:text-rose-100",
          ].join(" ")}
        >
          <Minus className="h-2.5 w-2.5" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={onPlus}
          disabled={state === 1}
          aria-label={`Agregar ${toggle.label}`}
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full border transition-all active:scale-90 disabled:cursor-not-allowed",
            state === 1
              ? "border-cyan-300 bg-cyan-500 text-white shadow shadow-cyan-500/40"
              : "border-cyan-400/50 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/25 hover:text-cyan-100",
          ].join(" ")}
        >
          <Plus className="h-2.5 w-2.5" strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}

/* R96.25 · VariantPicker · modal full-screen mobile · grid 2-col
   con foto/emoji + label · click variant → cart.add + close. Detecta
   si el item tiene variants static o dynamicVariantsKey · fetcha
   dinámicas desde /api/dynamic-options. */
function VariantPicker({
  item,
  onPick,
  onClose,
}: {
  item: MenuItem
  onPick: (v: MenuItemVariant | { id: string; label: string; priceDelta: number }) => void
  onClose: () => void
}) {
  const { label: dynLabel, options: dynOpts, loading: dynLoading } =
    useDynamicOptions(item.dynamicVariantsKey ?? null)

  const variants: Array<MenuItemVariant | { id: string; label: string; priceDelta: number }> =
    item.variants && item.variants.length > 0
      ? item.variants
      : dynOpts.map((o) => ({ id: o.id, label: o.label, priceDelta: 0 }))

  const pickerTitle = item.variants
    ? "Elegí tu sabor"
    : dynLabel ?? "Elegí tu sabor"

  return (
    <motion.div
      key="variant-picker"
      className="fixed inset-0 z-[60] flex items-end justify-center md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={pickerTitle}
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "8%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "8%", opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative z-10 max-h-[80svh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-800 bg-slate-950 px-5 py-5 text-slate-100 shadow-2xl md:rounded-3xl"
      >
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
              {item.name}
            </span>
            <h3 className="mt-0.5 font-display text-xl font-semibold">
              {pickerTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800"
          >
            ×
          </button>
        </header>

        {dynLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Cargando sabores disponibles…
          </p>
        ) : variants.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Sin opciones disponibles ahora · escribinos por WhatsApp.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {variants.map((v) => {
              const mvariant = v as MenuItemVariant
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onPick(v)}
                  className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-2.5 text-left transition-colors hover:border-cyan-500 hover:bg-slate-800"
                >
                  {mvariant.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mvariant.imageUrl}
                      alt={v.label}
                      className="h-16 w-full rounded-md object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className={`flex h-16 w-full items-center justify-center rounded-md bg-gradient-to-br text-3xl shadow-inner ${
                        mvariant.gradient ?? "from-slate-700 to-slate-900"
                      }`}
                    >
                      <span>{mvariant.emoji ?? "🍹"}</span>
                    </div>
                  )}
                  <span className="text-xs font-semibold text-white">
                    {v.label}
                  </span>
                  {v.priceDelta > 0 ? (
                    <span className="font-mono text-[10px] text-cyan-200">
                      +${v.priceDelta.toFixed(2)}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
