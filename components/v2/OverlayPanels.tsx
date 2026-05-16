"use client"
/**
 * OverlayPanels · the 3 non-cart anchor overlays (historia · reseñas ·
 * contacto). Each opens as a modal panel above the 3D scene; the cart
 * has its own dedicated component (CartDrawer).
 *
 * Composition · a single `<OverlayPanels active={...} onClose />` is
 * rendered by the page and shows whichever panel is active.
 */
import { motion, AnimatePresence } from "framer-motion"
import { Anchor, Coffee, MessageSquare, Phone, Star, X } from "lucide-react"
import {
  naufragoV2,
  WHATSAPP_E164,
} from "@/lib/v2/naufrago-content"
import { cliente } from "@/cliente.config"

export type OverlayKind = "barco" | "cocos" | "palmeras" | null

interface OverlayPanelsProps {
  active: OverlayKind
  onClose: () => void
}

const TITLES: Record<Exclude<OverlayKind, null>, string> = {
  barco: "La historia",
  cocos: "Reseñas",
  palmeras: "Contacto",
}

const ICONS: Record<Exclude<OverlayKind, null>, typeof Coffee> = {
  barco: Anchor,
  cocos: Star,
  palmeras: Phone,
}

export function OverlayPanels({ active, onClose }: OverlayPanelsProps) {
  return (
    <AnimatePresence>
      {active ? (
        <>
          <motion.div
            key="bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-label={TITLES[active]}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-x-0 top-1/2 z-50 mx-auto max-h-[88vh] w-full max-w-2xl -translate-y-1/2 overflow-hidden rounded-2xl border-2 border-violet-500/30 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl"
          >
            <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const Icon = ICONS[active]
                  return <Icon className="h-4 w-4 text-cyan-300" />
                })()}
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {TITLES[active]}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              {active === "barco" ? <HistoriaBody /> : null}
              {active === "cocos" ? <TestimonialsBody /> : null}
              {active === "palmeras" ? <ContactBody /> : null}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function HistoriaBody() {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-slate-200">
      <h3 className="font-display text-xl font-semibold tracking-tight text-cyan-100">
        {naufragoV2.about.title}
      </h3>
      {naufragoV2.about.body.split("\n\n").map((p, i) => (
        <p key={i} className="text-slate-300">
          {p}
        </p>
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono uppercase tracking-wider text-cyan-200">
          {cliente.scheduleShort}
        </span>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono uppercase tracking-wider text-violet-200">
          Olón · Santa Elena
        </span>
      </div>
    </div>
  )
}

function TestimonialsBody() {
  return (
    <ul className="flex flex-col gap-4">
      {naufragoV2.testimonials.map((t) => (
        <li
          key={t.id}
          className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <div>
              <span className="font-medium text-slate-100">{t.author}</span>
              <span className="ml-2 text-xs text-slate-500">· {t.city}</span>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: t.rating }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-cyan-300 text-cyan-300" />
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-300">“{t.body}”</p>
        </li>
      ))}
    </ul>
  )
}

function ContactBody() {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-slate-200">
      <h3 className="font-display text-xl font-semibold tracking-tight text-cyan-100">
        {naufragoV2.contact.title}
      </h3>
      <p className="text-slate-300">
        Estamos de jueves a lunes, 9 AM a 5 PM. Escribinos por WhatsApp y te
        confirmamos tiempo de entrega.
      </p>
      <a
        href={`https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent("Hola Náufrago, quiero pedir")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-violet-500/30 transition-transform hover:translate-y-[-1px]"
      >
        <MessageSquare className="h-4 w-4" />
        {naufragoV2.contact.whatsappCta}
      </a>
      <dl className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wider text-slate-500">Zona</dt>
          <dd className="mt-1 text-slate-200">Olón · Manglaralto · Punta Blanca</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-slate-500">
            {naufragoV2.contact.hoursLabel}
          </dt>
          <dd className="mt-1 text-slate-200">{cliente.schedule}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-slate-500">WhatsApp</dt>
          <dd className="mt-1 font-mono text-slate-200">{cliente.whatsappDisplay}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-slate-500">Instagram</dt>
          <dd className="mt-1 text-slate-200">@{cliente.instagram}</dd>
        </div>
      </dl>
    </div>
  )
}
