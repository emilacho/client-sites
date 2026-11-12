import type { Metadata } from "next"

// Tarjeta de residente de Olón · todo /residentes queda fuera de los buscadores
// (las tarjetas llevan nombre y la ficha del QR).
export const metadata: Metadata = {
  title: "Residentes de Olón",
  robots: { index: false, follow: false, nocache: true },
}

export default function ResidentesLayout({ children }: { children: React.ReactNode }) {
  return children
}
