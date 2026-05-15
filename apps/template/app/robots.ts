import type { MetadataRoute } from "next"
import { cliente } from "@/cliente.config"

export default function robots(): MetadataRoute.Robots {
  const base = cliente.domain.replace(/\/$/, "")
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
  }
}
