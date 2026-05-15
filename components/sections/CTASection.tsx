"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/Button"

export function CTASection() {
  return (
    <section className="bg-primary px-6 py-20 text-primary-foreground">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto max-w-3xl text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight">¿Listo para conversar?</h2>
        <p className="mt-4 opacity-90">
          Escribinos por el formulario · te respondemos en 24h laborables.
        </p>
        <a href="#contact" className="inline-block mt-8">
          <Button size="lg" variant="outline" className="bg-background text-foreground">
            Contactar ahora
          </Button>
        </a>
      </motion.div>
    </section>
  )
}
