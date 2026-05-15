"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { WhatsAppButton } from "@/components/ui/WhatsAppButton"

const MENU = [
  {
    name: "Encebollado",
    image: "/naufrago/post-05-DSHyjPzEa3C.jpg",
    description:
      "Albacora fresca, yuca tierna, cebolla curtida y caldo intenso. El plato bandera de Olón, según el feed: \"el mejor encebollado de la zona\".",
    tags: ["Sin gluten", "Albacora fresca", "Quita-chuchaqui"],
    message: "Hola Náufrago, quiero un encebollado",
  },
  {
    name: "Ceviche",
    image: "/naufrago/post-04-DVjed5GiRrl.jpg",
    description:
      "Pescado del día, limón ecuatoriano, cebolla morada y cilantro fresco. Versión Náufrago: alta en proteína, omega-3, y el toque salado de la costa.",
    tags: ["Pescado del día", "Limón ecuatoriano", "Listo en minutos"],
    message: "Hola Náufrago, quiero un ceviche",
  },
]

export function MenuSection() {
  return (
    <section id="menu" className="bg-background px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Menú
          </p>
          <h2 className="mt-4 font-display text-4xl sm:text-5xl">
            Dos clásicos, hechos como deben hacerse
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            No tenemos carta larga. Tenemos las dos cosas que hacemos mejor
            que nadie en Olón.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {MENU.map((item, i) => (
            <motion.article
              key={item.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
              className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="font-display text-3xl">{item.name}</h3>
                <p className="mt-3 text-muted-foreground">{item.description}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <WhatsAppButton text="Pedir ahora" message={item.message} />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
