"use client"

import { motion } from "framer-motion"
import { WhatsAppButton } from "@/components/ui/WhatsAppButton"
import { cliente } from "@/cliente.config"

export function CTASection() {
  return (
    <section className="bg-primary px-6 py-20 text-primary-foreground md:py-28">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-3xl text-center"
      >
        <p className="text-sm uppercase tracking-[0.3em] opacity-70">
          Pedidos
        </p>
        <h2 className="mt-4 font-display text-4xl sm:text-5xl">
          Te lo dejamos listo
        </h2>
        <p className="mt-6 text-lg opacity-90">
          Escribinos por WhatsApp · pasás · te lo damos en mano.
          <br />
          {cliente.schedule} · {cliente.whatsappDisplay}
        </p>
        <div className="mt-10 flex justify-center">
          <WhatsAppButton
            size="lg"
            text="Pedir por WhatsApp"
            message="Hola Náufrago, quiero hacer un pedido"
          />
        </div>
      </motion.div>
    </section>
  )
}
