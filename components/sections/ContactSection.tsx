"use client"

import { motion } from "framer-motion"
import { ContactForm } from "@/components/ContactForm"

export function ContactSection() {
  return (
    <section id="contact" className="px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-2xl"
      >
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Contactanos</h2>
          <p className="mt-4 text-muted-foreground">
            Te respondemos en las próximas 24 horas laborables.
          </p>
        </div>
        <div className="mt-10">
          <ContactForm />
        </div>
      </motion.div>
    </section>
  )
}
