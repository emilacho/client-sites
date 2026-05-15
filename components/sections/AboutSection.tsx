"use client"

import Image from "next/image"
import { motion } from "framer-motion"

export function AboutSection() {
  return (
    <section id="about" className="bg-muted/40 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-center">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative aspect-square overflow-hidden rounded-2xl"
        >
          <Image
            src="/naufrago/post-07-DWfKKLpDF4U.jpg"
            alt="ONC · combo Náufrago"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Sobre Náufrago
          </p>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl">
            Una cocina escondida frente al mar
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-foreground/85">
            Náufrago es un ghost kitchen en la calle de los Paraguas, frente
            al Hostal Isramar, en plena Olón. Trabajamos con pescado del día,
            yuca de finca local y la limonada con café que la zona ya conoce
            como <span className="font-medium">ONC</span>.
          </p>
          <p className="mt-4 text-foreground/75">
            Abrimos jueves a lunes, de 9 AM a 5 PM. Pedís por WhatsApp,
            llegás, te lo damos listo. Si estás de paso por la costa, vení
            antes de meterte al agua.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
