import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { cliente } from "@/cliente.config"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  metadataBase: new URL(cliente.domain),
  title: {
    default: cliente.name,
    template: `%s · ${cliente.name}`,
  },
  description: cliente.description,
  openGraph: {
    title: cliente.name,
    description: cliente.description,
    url: cliente.domain,
    siteName: cliente.name,
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
