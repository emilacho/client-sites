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

/** BoxTrackLogo · cardboard delivery box isométrica realista · estilo
 *  FedEx/UPS · 3 faces 3D con gradients kraft + textura corrugated +
 *  brown packing tape sealed top + drop shadow inferior. Reconocible
 *  inmediatamente como caja de envío. Misma altura visual h-6 w-6
 *  que WhatsApp/Instagram pero más ancha (viewBox 40x32). */
function BoxTrackLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" aria-hidden className={className}>
      <defs>
        {/* Cardboard kraft realista · 3 tonos para 3 faces */}
        <linearGradient id="bx-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8C896" />
          <stop offset="100%" stopColor="#C99565" />
        </linearGradient>
        <linearGradient id="bx-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4A574" />
          <stop offset="100%" stopColor="#A87A4A" />
        </linearGradient>
        <linearGradient id="bx-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8B6235" />
          <stop offset="100%" stopColor="#5C3A1A" />
        </linearGradient>
        {/* Brown packing tape · color marrón típico cinta adhesiva */}
        <linearGradient id="bx-tape" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C4844A" />
          <stop offset="100%" stopColor="#9C6532" />
        </linearGradient>
      </defs>

      {/* Drop shadow base · simulates floor */}
      <ellipse cx="20" cy="29" rx="14" ry="1.5" fill="rgba(0,0,0,0.25)" />

      {/* Top face · lid */}
      <polygon
        points="4,11 20,5 36,11 20,17"
        fill="url(#bx-top)"
        stroke="#3D2A15"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* Front face · main visible · lighter kraft */}
      <polygon
        points="4,11 20,17 20,28 4,22"
        fill="url(#bx-front)"
        stroke="#3D2A15"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* Right side face · darker · in shadow */}
      <polygon
        points="20,17 36,11 36,22 20,28"
        fill="url(#bx-side)"
        stroke="#3D2A15"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* Corrugated texture · lines on side face simulating cardboard ondas */}
      <g stroke="#3D2A15" strokeWidth="0.25" opacity="0.55" fill="none">
        <line x1="36" y1="13" x2="20" y2="19" />
        <line x1="36" y1="15" x2="20" y2="21" />
        <line x1="36" y1="17" x2="20" y2="23" />
        <line x1="36" y1="19" x2="20" y2="25" />
        <line x1="36" y1="21" x2="20" y2="27" />
      </g>

      {/* Brown packing tape · sealed seam top crossing down front */}
      <polygon
        points="16.5,8.2 23.5,8.2 23.5,14.5 20,17 16.5,14.5"
        fill="url(#bx-tape)"
        stroke="#5C3A1A"
        strokeWidth="0.25"
      />
      <rect
        x="16.5"
        y="17"
        width="4.0"
        height="10.5"
        fill="url(#bx-tape)"
        stroke="#5C3A1A"
        strokeWidth="0.25"
      />

      {/* Tape highlight · thin shine line down the middle of tape */}
      <line
        x1="18.5"
        y1="9.5"
        x2="18.5"
        y2="26.5"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.6"
      />

      {/* Small barcode-like stamp · marca de envío en front */}
      <g fill="#3D2A15" opacity="0.45">
        <rect x="5.5" y="24" width="0.5" height="2" />
        <rect x="6.4" y="24" width="0.8" height="2" />
        <rect x="7.6" y="24" width="0.4" height="2" />
        <rect x="8.4" y="24" width="0.6" height="2" />
        <rect x="9.3" y="24" width="0.3" height="2" />
        <rect x="9.9" y="24" width="0.7" height="2" />
        <rect x="11" y="24" width="0.5" height="2" />
        <rect x="11.8" y="24" width="0.4" height="2" />
      </g>
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
          <BoxTrackLogo className="h-6 w-[30px]" />
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
