"use client"

import { motion } from "framer-motion"

// Placeholder content · Phase 1 agent dispatch replaces this with per-client services.
const PLACEHOLDER_SERVICES = [
  { title: "Servicio 1", description: "Descripción del servicio · Phase 1 agent fills this." },
  { title: "Servicio 2", description: "Descripción del servicio · Phase 1 agent fills this." },
  { title: "Servicio 3", description: "Descripción del servicio · Phase 1 agent fills this." },
]

export function ServicesSection() {
  return (
    <section id="services" className="bg-muted/40 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Nuestros servicios</h2>
          <p className="mt-4 text-muted-foreground">
            Cliente-agnostic copy block · agent dispatch reemplaza esto en Phase 1.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLACEHOLDER_SERVICES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              className="rounded-xl border border-border bg-background p-6 shadow-sm"
            >
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
