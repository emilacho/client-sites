"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/Button"
import { cliente } from "@/cliente.config"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 py-24 md:py-36">
      <div className="mx-auto max-w-4xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-4xl font-semibold tracking-tight md:text-6xl"
        >
          {cliente.name}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
        >
          {cliente.description}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <a href="#contact">
            <Button size="lg">Contactanos</Button>
          </a>
          <a href="#services">
            <Button size="lg" variant="outline">
              Ver servicios
            </Button>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
