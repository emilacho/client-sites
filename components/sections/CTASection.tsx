"use client"

import { motion } from "framer-motion"
import { MessageCircle, MapPin, Clock } from "lucide-react"
import { ShimmerButton } from "@/components/shadcn/shimmer-button"
import { cliente, whatsappLink } from "@/cliente.config"

/**
 * CTA · web-designer "Sección de conversión de alta intención"
 *
 * Copy adapted from marketing-content-creator + web-designer briefs.
 * Microcopy "Sin apps, sin comisiones — directo con nosotros" comes
 * directly from web-designer content_blocks · validates Schwartz lens
 * per editor-en-jefe approval (objection handling preemptive).
 */

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-primary px-6 py-24 text-primary-foreground md:py-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, hsl(42 56% 58% / 0.35), transparent 50%), radial-gradient(circle at 80% 80%, hsl(9 60% 51% / 0.25), transparent 55%)",
        }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative mx-auto max-w-3xl text-center"
      >
        <p className="text-xs uppercase tracking-[0.3em] opacity-70">Hacer pedido</p>
        <h2 className="mt-4 font-display text-4xl sm:text-5xl md:text-6xl">
          ¿Tienes hambre? Nosotros tenemos el mar
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg opacity-90">
          Sin apps, sin comisiones — directo con nosotros. Te respondemos en
          minutos y te decimos qué hay hoy.
        </p>

        <div className="mt-10 flex justify-center">
          <a
            href={whatsappLink("Hola Náufrago, quiero hacer un pedido")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShimmerButton
              shimmerColor="hsl(42 56% 70%)"
              background="hsl(9 60% 51%)"
              borderRadius="9999px"
              className="px-8 py-4 text-base font-semibold text-white"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Hacer mi pedido ahora
            </ShimmerButton>
          </a>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm opacity-80">
          <span className="inline-flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {cliente.scheduleShort}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Entregamos en Olón, Santa Elena
          </span>
          <span className="opacity-70">WhatsApp · {cliente.whatsappDisplay}</span>
        </div>
      </motion.div>
    </section>
  )
}
