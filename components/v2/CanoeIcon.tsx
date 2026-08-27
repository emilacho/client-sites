/**
 * CanoeIcon · R96.32 · custom lucide-style SVG · canoa con hull
 * prominente abajo + vela triangular arriba con mástil al medio.
 * Reemplaza Sailboat de lucide que tenía hull chico · vela y casco
 * ahora se distinguen claro · misma stroke + tamaño + currentColor
 * pattern que el resto de los icons lucide.
 */
import type { SVGProps } from "react"

export function CanoeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Vela triangular · top-right · base en el mástil. Top y bottom
          subidos respecto R96.32 para dejar más mástil visible. */}
      <path d="M13 2 L13 10 L18.5 10 Z" fill="currentColor" fillOpacity="0.2" />
      {/* Mástil vertical · más largo · asoma claramente abajo de la vela. */}
      <line x1="13" y1="2" x2="13" y2="15.5" />
      {/* Hull / casco prominente · arco wide bottom · base de la canoa */}
      <path d="M2 14 L22 14 L19.5 20 C 17 21.5 7 21.5 4.5 20 Z" fill="currentColor" fillOpacity="0.15" />
    </svg>
  )
}
