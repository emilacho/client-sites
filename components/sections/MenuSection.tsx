"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { MessageCircle, ShieldCheck, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card"
import { Badge } from "@/components/shadcn/badge"
import { Button } from "@/components/shadcn/button"
import { whatsappLink } from "@/cliente.config"

/**
 * Menu · web-designer section "Lo que sale de nuestra cocina"
 *
 * Copy from marketing-content-creator agent (two flagship dishes from the
 * brand brief · no invented items, no pricing per editor-en-jefe note that
 * pricing transparency is a future iteration).
 *
 * Toolkit components: shadcn Card · shadcn Badge · shadcn Button · Lucide
 * icons (Star · ShieldCheck) · Framer scroll-reveal stagger.
 */

const MENU = [
  {
    name: "Ceviche Náufrago",
    image: "/naufrago/post-04-DVjed5GiRrl.jpg",
    description:
      "Pescado fresco de la zona, limón que pica en el buen sentido, cebolla morada bien curada y ese toque costeño que no se aprende — se hereda. Cada cuchara sabe a playa de verdad.",
    badge: "Favorito de Olón",
    whatsappMessage: "Hola Náufrago, quiero un ceviche",
  },
  {
    name: "Encebollado del Naufragio",
    image: "/naufrago/post-05-DSHyjPzEa3C.jpg",
    description:
      "Caldo con fuerza, albacora tierna y yuca que te abraza por dentro. El desayuno más honesto del litoral, listo para salvarte cualquier mañana — o tarde.",
    badge: null,
    whatsappMessage: "Hola Náufrago, quiero un encebollado",
  },
]

export function MenuSection() {
  return (
    <section id="menu" className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Menú
          </p>
          <h2 className="mt-4 font-display text-4xl text-foreground sm:text-5xl">
            Lo que sale de nuestra cocina
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Dos clásicos, hechos como deben hacerse. Sin atajos, sin
            congelados, sin pretensiones.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {MENU.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: "easeOut" }}
            >
              <Card className="overflow-hidden border-border/60 bg-card shadow-sm transition-shadow hover:shadow-xl">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                  {item.badge ? (
                    <Badge className="absolute left-4 top-4 gap-1 bg-accent text-accent-foreground shadow-md">
                      <Star className="h-3 w-3" />
                      {item.badge}
                    </Badge>
                  ) : null}
                </div>
                <CardHeader className="pt-6">
                  <CardTitle className="font-display text-3xl">{item.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-6">
                  <p className="text-muted-foreground">{item.description}</p>
                  <div className="mt-6">
                    <a
                      href={whatsappLink(item.whatsappMessage)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      <Button size="lg" className="gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Pedir este plato
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <ShieldCheck className="h-4 w-4 text-primary" />
          Preparado al momento · sin conservantes · sin rodeos.
        </motion.p>
      </div>
    </section>
  )
}
