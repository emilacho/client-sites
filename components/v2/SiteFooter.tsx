"use client"
/**
 * SiteFooter · R96.136 · footer global con links · Instagram + WhatsApp +
 * /faq + /privacidad. Sticky bottom semi-transparent · usable en home
 * (sobre la isla 3D) y en sub-pages. Mobile-first.
 */
import Link from "next/link"
import { cliente } from "@/cliente.config"

/** Instagram brand logo · gradient oficial (yellow→orange→pink→purple→blue)
 *  + glyph blanco encima · igual al logo clásico de la app móvil. */
function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <defs>
        <radialGradient
          id="ig-grad-naufrago"
          cx="0.3"
          cy="1"
          r="1.2"
        >
          <stop offset="0%" stopColor="#FED576" />
          <stop offset="25%" stopColor="#F47133" />
          <stop offset="50%" stopColor="#BC3081" />
          <stop offset="75%" stopColor="#4C68D7" />
          <stop offset="100%" stopColor="#4C68D7" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="url(#ig-grad-naufrago)" />
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
      />
      <circle
        cx="16"
        cy="16"
        r="4.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
      />
      <circle cx="22" cy="10" r="1.4" fill="#FFFFFF" />
    </svg>
  )
}

/** BoxTrackLogo · ícono delivery box · cardboard brown #B07A47 background
 *  + caja kraft #E8C896 con tape blanca cruzada · mismo footprint visual
 *  que WhatsApp/Instagram logos (h-6 w-6 · circle outer · branded color).
 *  Diseño · caja 3D ligeramente abierta con tape adhesiva delivery. */
function BoxTrackLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      {/* Background cardboard brown */}
      <circle cx="16" cy="16" r="16" fill="#A8763E" />
      {/* Box top face (lid · slightly angled · darker kraft) */}
      <polygon
        points="6,11 16,7 26,11 16,15"
        fill="#C99565"
        stroke="#5C3A1A"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Box front face (light kraft) */}
      <polygon
        points="6,11 16,15 16,25 6,21"
        fill="#E8C896"
        stroke="#5C3A1A"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Box right side (medium kraft · darker shadow) */}
      <polygon
        points="16,15 26,11 26,21 16,25"
        fill="#B88859"
        stroke="#5C3A1A"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Tape adhesiva blanca cruzando el top + bajando al front */}
      <polygon
        points="13,9 19,9 19,13.5 16,15 13,13.5"
        fill="#FAF6EA"
        opacity="0.85"
      />
      <rect
        x="13"
        y="15"
        width="3"
        height="9.6"
        fill="#FAF6EA"
        opacity="0.85"
      />
    </svg>
  )
}

/** WhatsApp brand logo clásico · círculo verde #25D366 + glyph
 *  teléfono blanco · path oficial simpleicons.org viewBox 24x24 ·
 *  centrado en viewBox 32x32 con padding 4px para que respire. */
function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <g transform="translate(4 4)">
        <path
          fill="#FFFFFF"
          d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"
        />
      </g>
    </svg>
  )
}

export default function SiteFooter() {
  return (
    <footer className="pointer-events-none fixed bottom-3 right-3 z-20 md:bottom-4 md:right-6">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-950/55 px-2.5 py-1.5 backdrop-blur-md text-[9px] uppercase tracking-widest text-slate-400">
        <a
          href={`https://wa.me/${cliente.whatsappE164}?text=${encodeURIComponent("Hola Náufrago · quería consultar antes de pedir.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center transition-transform hover:translate-y-[-1px]"
          aria-label="Hablar por WhatsApp"
          title="Hablar por WhatsApp"
        >
          <WhatsAppLogo className="h-6 w-6" />
        </a>
        <a
          href={`https://instagram.com/${cliente.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center transition-transform hover:translate-y-[-1px]"
          aria-label="Instagram Náufrago"
          title={`@${cliente.instagram}`}
        >
          <InstagramLogo className="h-6 w-6" />
        </a>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("naufrago:open-tracker"))
            }
          }}
          className="inline-flex items-center transition-transform hover:translate-y-[-1px]"
          aria-label="Seguir mi pedido"
          title="Seguir mi pedido"
        >
          <BoxTrackLogo className="h-6 w-6" />
        </button>
        <span className="text-slate-700">·</span>
        <Link
          href="/faq"
          className="text-slate-300 transition-colors hover:text-cyan-300"
        >
          FAQ
        </Link>
        <span className="text-slate-700">·</span>
        <Link
          href="/privacidad"
          className="text-slate-300 transition-colors hover:text-cyan-300"
        >
          Privacidad
        </Link>
      </div>
    </footer>
  )
}

/** SiteFooterStatic · variante NO sticky para sub-pages que tienen
 *  scroll · queda al final del article en flow normal. */
export function SiteFooterStatic() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-slate-800 bg-slate-950/80 py-4">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 text-[10px] uppercase tracking-widest text-slate-400 md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <a
            href={`https://wa.me/${cliente.whatsappE164}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp Náufrago"
            title="Hablar por WhatsApp"
          >
            <WhatsAppLogo className="h-5 w-5" />
          </a>
          <a
            href={`https://instagram.com/${cliente.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram Náufrago"
            title={`@${cliente.instagram}`}
          >
            <InstagramLogo className="h-5 w-5" />
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/faq" className="hover:text-cyan-300">
            FAQ
          </Link>
          <span className="text-slate-700">·</span>
          <Link href="/privacidad" className="hover:text-cyan-300">
            Privacidad
          </Link>
          <span className="text-slate-700">·</span>
          <span className="font-mono text-[9px] text-slate-500">© {year}</span>
        </div>
      </div>
    </footer>
  )
}
