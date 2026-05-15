import type { MetadataRoute } from "next"
import { cliente } from "@/cliente.config"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = cliente.domain.replace(/\/$/, "")
  const now = new Date()
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/thanks`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ]
}
