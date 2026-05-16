"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { Anchor, Heart, Waves } from "lucide-react"
import { InstagramIcon } from "@/components/ui/InstagramIcon"
import { Button } from "@/components/shadcn/button"
import { cliente, instagramLink } from "@/cliente.config"

/**
 * About · web-designer "Somos Náufrago — la cocina de Olón"
 *
 * Copy block from marketing-content-creator agent. 3 pillars derived from
 * brand-strategist values list (Frescura sin negociación · Raíz costera ·
 * Cercanía real). Social proof from real IG followers count (1218).
 */

const PILLARS = [
  {
    icon: Waves,
    title: "Frescura sin negociación",
    body: "El producto manda. Si no llegó del mar hoy, no sale a tu mesa.",
  },
  {
    icon: Anchor,
    title: "Raíz costera",
    body: "Cocinamos del litoral porque somos del litoral. Sin disfraz.",
  },
  {
    icon: Heart,
    title: "Cercanía real",
    body: "Cada cliente es el compa que llega a la mesa. Sin guion.",
  },
]

export function AboutSection() {
  return (
    <section id="about" className="bg-muted/50 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative aspect-square overflow-hidden rounded-2xl shadow-xl"
          >
            <Image
              src="/naufrago/post-07-DWfKKLpDF4U.jpg"
              alt="Combo ONC Náufrago · encebollado con limonada de café"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Sobre Náufrago
            </p>
            <h2 className="mt-4 font-display text-4xl text-foreground sm:text-5xl">
              Somos la cocina que el mar nos prestó
            </h2>
            <div className="mt-6 space-y-4 text-foreground/85">
              <p>
                Náufrago nació en Olón, Santa Elena, con una sola obsesión:
                que el marisco llegue a tu mesa tan fresco que casi todavía
                huela a sal. No somos un restaurante de ciudad disfrazado de
                costeño — somos del litoral, cocinamos del litoral y sabemos
                exactamente dónde está el mejor pescado de la zona.
              </p>
              <p className="text-muted-foreground">
                Sembramos respeto en cada plato: por el mar, por la
                tradición y por el compa que va a comer. Nada de atajos,
                nada de congelados, nada de pretensiones. Solo el sabor de
                siempre, bien hecho, en tu puerta.
              </p>
            </div>

            <div className="mt-8">
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" className="gap-2">
                  <InstagramIcon className="h-4 w-4" />
                  {cliente.followersCount.toLocaleString("es-EC")} vecinos en
                  @{cliente.instagram}
                </Button>
              </a>
            </div>
          </motion.div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {PILLARS.map((p, i) => {
            const Icon = p.icon
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-xl text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
