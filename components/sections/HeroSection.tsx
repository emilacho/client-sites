"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { WhatsAppButton } from "@/components/ui/WhatsAppButton"
import { cliente } from "@/cliente.config"

export function HeroSection() {
  return (
    <section className="relative min-h-[88vh] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/naufrago/post-08-DPti3m8jQJt.jpg"
          alt="Encebollado Náufrago · Olón"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/45 to-black/70" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-4xl flex-col items-center justify-center px-6 py-24 text-center text-white">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-sm uppercase tracking-[0.3em] text-white/80"
        >
          Olón · Santa Elena · Ecuador
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mt-6 font-display text-6xl leading-none tracking-tight sm:text-7xl md:text-8xl"
        >
          {cliente.name}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
          className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl"
        >
          El más fresco de la zona. Encebollado y ceviche de albacora directo
          desde la costa, en un ghost kitchen pintoresco frente al hostal
          Isramar.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <WhatsAppButton
            size="lg"
            text="Pedir por WhatsApp"
            message="Hola Náufrago, quiero hacer un pedido"
          />
          <a
            href="#menu"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-6 text-base font-medium text-white transition-colors hover:bg-white/10"
          >
            Ver menú
          </a>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-sm text-white/75"
        >
          {cliente.schedule}
        </motion.p>
      </div>
    </section>
  )
}
