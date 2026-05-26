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

/** WhatsApp brand logo clásico · círculo verde #25D366 + glyph
 *  teléfono blanco · el ícono oficial usado en marketing del producto. */
function WhatsAppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="16" cy="16" r="16" fill="#25D366" />
      <path
        fill="#FFFFFF"
        d="M22.65 19.18c-.36-.18-2.12-1.05-2.45-1.17-.33-.12-.57-.18-.81.18-.24.36-.93 1.17-1.14 1.41-.21.24-.42.27-.78.09-.36-.18-1.52-.56-2.9-1.79-1.07-.96-1.8-2.14-2.01-2.5-.21-.36-.02-.55.16-.73.16-.16.36-.42.54-.63.18-.21.24-.36.36-.6.12-.24.06-.45-.03-.63-.09-.18-.81-1.95-1.11-2.67-.29-.7-.59-.6-.81-.61-.21-.01-.45-.01-.69-.01-.24 0-.63.09-.96.45-.33.36-1.26 1.23-1.26 3 0 1.77 1.29 3.48 1.47 3.72.18.24 2.54 3.88 6.15 5.44.86.37 1.53.59 2.05.76.86.27 1.65.23 2.27.14.69-.1 2.12-.87 2.42-1.71.3-.84.3-1.56.21-1.71-.09-.15-.33-.24-.69-.42M16.02 26.16h-.01c-1.96 0-3.88-.53-5.56-1.52l-.4-.24-4.13 1.08 1.1-4.03-.26-.41a10.92 10.92 0 0 1-1.67-5.83c.01-6.03 4.91-10.93 10.94-10.93 2.92 0 5.67 1.14 7.73 3.21a10.86 10.86 0 0 1 3.2 7.73c-.01 6.03-4.91 10.93-10.94 10.93m9.31-20.24a13.18 13.18 0 0 0-9.31-3.86c-7.27 0-13.19 5.91-13.19 13.18 0 2.32.61 4.58 1.76 6.58L2.79 28l5.97-1.57a13.17 13.17 0 0 0 6.3 1.6h.01c7.27 0 13.18-5.91 13.18-13.18a13.1 13.1 0 0 0-3.86-9.32"
      />
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
