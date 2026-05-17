import type { Metadata } from "next"
import {
  Inter,
  DM_Serif_Display,
  Permanent_Marker,
  Bebas_Neue,
} from "next/font/google"
import { cliente } from "@/cliente.config"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const displaySerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
})
// Permanent Marker · used by the v2 character speech bubble
// ("¡Pilas con ese YADO!"). Display: swap so the bubble doesn't FOUC.
const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marker",
  display: "swap",
})
// Bebas Neue · Round 24 · powers the PromoTicker · classic news-ticker
// silhouette (tall, narrow, naturally bold uppercase) · fits the
// "ALERTA NÁUFRAGO" headline tone better than the casual marker.
// Bebas only ships weight 400 · the typeface already reads as bold.
const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(cliente.domain),
  title: {
    default: `${cliente.name} · Fresco como recién salido del mar`,
    template: `%s · ${cliente.name}`,
  },
  description: cliente.description,
  openGraph: {
    title: cliente.name,
    description: cliente.description,
    url: cliente.domain,
    siteName: cliente.name,
    type: "website",
    locale: "es_EC",
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${displaySerif.variable} ${marker.variable} ${bebas.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
