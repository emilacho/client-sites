import type { Metadata } from "next"
import {
  Inter,
  DM_Serif_Display,
  Permanent_Marker,
  Bebas_Neue,
  Homemade_Apple,
  Caveat,
} from "next/font/google"
import { cliente } from "@/cliente.config"
import { restaurantSchema, localBusinessSchema } from "@/lib/structured-data"
import { JsonLdScript } from "@/lib/structured-data-script"
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
// Bebas Neue · classic newsstand silhouette (tall, narrow, naturally
// bold uppercase) · usado por el header NÁUFRAGO del OrderTracker
// (/order/[code]) + 404 not-found surface.
const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
})
// Round 89 · Homemade Apple + Caveat · true connected-cursive
// handwritten fonts for the pergamino canvas text. User wanted
// "letras concatenadas · como un humano sin alzar la mano".
// Permanent Marker is print-style marker · these two are real
// cursive script. Homemade Apple is single-stroke realistic
// handwriting (primary), Caveat is informal cursive with
// slightly cleaner letterforms (fallback at small sizes).
const handwritten = Homemade_Apple({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-handwritten",
  display: "swap",
})
const caveat = Caveat({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(cliente.domain),
  title: {
    default: `${cliente.name} · Fresco como recién salido del mar`,
    template: `%s · ${cliente.name}`,
  },
  description: cliente.description,
  keywords: [
    "ceviche Olón",
    "encebollado Ecuador",
    "delivery Santa Elena",
    "ghost kitchen",
    "comida costera",
    "mariscos Olón",
    cliente.name,
  ],
  openGraph: {
    title: cliente.name,
    description: cliente.description,
    url: cliente.domain,
    siteName: cliente.name,
    type: "website",
    locale: "es_EC",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${cliente.name} · ceviche y encebollado en Olón`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: cliente.name,
    description: cliente.description,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* R96.131 · JSON-LD schema.org · Restaurant + LocalBusiness ·
            AI search (ChatGPT/Perplexity/Gemini) + Google rich results. */}
        <JsonLdScript data={[restaurantSchema(), localBusinessSchema()]} />
      </head>
      <body
        className={`${inter.variable} ${displaySerif.variable} ${marker.variable} ${bebas.variable} ${handwritten.variable} ${caveat.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
