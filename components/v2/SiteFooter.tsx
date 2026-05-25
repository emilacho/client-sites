"use client"
/**
 * SiteFooter · R96.136 · footer global con links · Instagram + WhatsApp +
 * /faq + /privacidad. Sticky bottom semi-transparent · usable en home
 * (sobre la isla 3D) y en sub-pages. Mobile-first.
 */
import Link from "next/link"
import { cliente } from "@/cliente.config"

// Instagram glyph inline SVG · evita pinear @types · lucide-react no
// expone "Instagram" en la versión actual del proyecto.
function Instagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

export default function SiteFooter() {
  return (
    <footer className="pointer-events-none fixed bottom-3 right-3 z-20 md:bottom-4 md:right-6">
      <div className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-800/70 bg-slate-950/55 px-2.5 py-1 backdrop-blur-md text-[9px] uppercase tracking-widest text-slate-400">
        <a
          href={`https://instagram.com/${cliente.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-slate-300 transition-colors hover:text-cyan-300"
          aria-label="Instagram Náufrago"
          title={`@${cliente.instagram}`}
        >
          <Instagram className="h-3 w-3" />
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
        <div className="flex items-center gap-3">
          <a
            href={`https://instagram.com/${cliente.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-cyan-300"
          >
            <Instagram className="h-3.5 w-3.5" />@{cliente.instagram}
          </a>
          <a
            href={`https://wa.me/${cliente.whatsappE164}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-300"
          >
            WhatsApp
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
