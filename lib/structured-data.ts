/**
 * Structured data · R96.131 · JSON-LD schema.org generators.
 * Restaurant + LocalBusiness + Menu + MenuItem + FAQPage + BreadcrumbList.
 * AI search (ChatGPT/Gemini/Perplexity) usa esto en 2026 para recomendaciones.
 */
import { cliente } from "@/cliente.config"
import { COCINA_ABRE_H, COCINA_CIERRA_H } from "@/lib/horario"
import { MENU_ITEMS } from "@/lib/v2/naufrago-content"
import { COCINA } from "@/lib/ubicacion"

// R105 · la cocina que despacha · Guayaquil. Antes acá había un tercer par
// de coordenadas de Olón, distinto de los otros dos del repositorio.
const NAUFRAGO_GEO = {
  latitude: COCINA.lat,
  longitude: COCINA.lng,
}

const NAUFRAGO_OPENING = [
  // Schema · usa formato OpeningHoursSpecification array
  {
    "@type": "OpeningHoursSpecification" as const,
    dayOfWeek: ["Thursday", "Friday", "Saturday", "Sunday", "Monday"],
    // R162 · también sale de `lib/horario.ts` · antes decía 09:00-17:00
    // a mano y Google mostraba un horario que el sitio no cumplía.
    opens: `${String(COCINA_ABRE_H).padStart(2, "0")}:00`,
    closes: `${String(COCINA_CIERRA_H).padStart(2, "0")}:00`,
  },
]

interface JsonLd {
  "@context": "https://schema.org"
  "@type": string
  [key: string]: unknown
}

export function restaurantSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${cliente.domain}#restaurant`,
    name: cliente.name,
    description: cliente.description,
    url: cliente.domain,
    telephone: `+${cliente.whatsappE164}`,
    priceRange: "$$",
    servesCuisine: ["Ecuadorian", "Seafood", "Latin American"],
    address: {
      "@type": "PostalAddress",
      streetAddress: COCINA.calle,
      addressLocality: COCINA.ciudad,
      addressRegion: COCINA.provincia,
      postalCode: COCINA.codigoPostal,
      addressCountry: COCINA.pais,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: NAUFRAGO_GEO.latitude,
      longitude: NAUFRAGO_GEO.longitude,
    },
    openingHoursSpecification: NAUFRAGO_OPENING,
    sameAs: [`https://instagram.com/${cliente.instagram}`],
    image: `${cliente.domain}/og-image.png`,
    acceptsReservations: false,
    hasMenu: {
      "@type": "Menu",
      "@id": `${cliente.domain}#menu`,
      name: "Menú Náufrago",
      hasMenuSection: buildMenuSections(),
    },
  }
}

function buildMenuSections() {
  // Agrupar MENU_ITEMS por categoría.
  const byCategory: Record<string, typeof MENU_ITEMS> = {}
  for (const item of MENU_ITEMS) {
    const cat = item.category ?? "otros"
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  }
  const sectionLabel: Record<string, string> = {
    encebollados: "Encebollados",
    ceviches: "Ceviches",
    platos: "Platos fuertes",
    bebidas: "Bebidas",
    postres: "Postres",
    otros: "Otros",
  }
  return Object.entries(byCategory).map(([cat, items]) => ({
    "@type": "MenuSection" as const,
    name: sectionLabel[cat] ?? cat,
    hasMenuItem: items.map((item) => ({
      "@type": "MenuItem" as const,
      name: item.name,
      description: item.description ?? "",
      offers: {
        "@type": "Offer" as const,
        price: item.priceUsd.toFixed(2),
        priceCurrency: "USD",
      },
    })),
  }))
}

export function localBusinessSchema(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${cliente.domain}#localbusiness`,
    name: cliente.name,
    description: cliente.description,
    url: cliente.domain,
    telephone: `+${cliente.whatsappE164}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: COCINA.calle,
      addressLocality: COCINA.ciudad,
      addressRegion: COCINA.provincia,
      postalCode: COCINA.codigoPostal,
      addressCountry: COCINA.pais,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: NAUFRAGO_GEO.latitude,
      longitude: NAUFRAGO_GEO.longitude,
    },
    openingHoursSpecification: NAUFRAGO_OPENING,
    areaServed: {
      "@type": "GeoCircle",
      geoMidpoint: {
        "@type": "GeoCoordinates",
        latitude: NAUFRAGO_GEO.latitude,
        longitude: NAUFRAGO_GEO.longitude,
      },
      geoRadius: "15000",
    },
  }
}

export function breadcrumbSchema(
  items: Array<{ name: string; url: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function faqSchema(
  faqs: Array<{ question: string; answer: string }>,
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}

// JsonLdScript component lives in lib/structured-data-script.tsx (JSX)
