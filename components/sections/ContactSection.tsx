"use client"

import { motion } from "framer-motion"
import { MessageCircle, Clock, MapPin } from "lucide-react"
import { InstagramIcon } from "@/components/ui/InstagramIcon"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/shadcn/accordion"
import { Button } from "@/components/shadcn/button"
import { cliente, instagramLink, whatsappLink } from "@/cliente.config"

/**
 * Contact · web-designer section · resolves logistic objections before
 * the order step. FAQ items derived from web-designer content_blocks (3
 * common objections for a delivery without app: cómo pedir · zona ·
 * frescura).
 *
 * Toolkit: shadcn Accordion · Lucide icons (Clock · MapPin · Instagram ·
 * MessageCircle) · Framer scroll-reveal.
 */

const FAQ = [
  {
    q: "¿Cómo hago mi pedido?",
    a: "Escríbenos al WhatsApp 0997744288 con lo que se te antoja. Te confirmamos disponibilidad del día, te pasamos el total y te decimos cuándo lo tienes listo. Sin apps, sin formularios.",
  },
  {
    q: "¿A dónde entregan?",
    a: "Entregamos en Olón, Santa Elena. Si estás en una cabaña o casa de playa cerca, llegamos. Si estás más lejos, te avisamos antes de cobrarte.",
  },
  {
    q: "¿Qué tan fresco es el producto?",
    a: "Tan fresco como la pesca del día. Si no llegó del mar hoy, no sale a tu mesa — esa es la regla. Por eso abrimos jueves a lunes: cuando el mar trabaja, nosotros también.",
  },
]

export function ContactSection() {
  return (
    <section id="contact" className="px-6 py-20 md:py-28">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Contacto
          </p>
          <h2 className="mt-4 font-display text-4xl text-foreground sm:text-5xl">
            ¿Ya tienes hambre? Nosotros también.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Escríbenos al WhatsApp y en un momento te decimos qué hay hoy y
            cómo te lo llevamos.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="mt-10 grid gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:grid-cols-3"
        >
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Horario
              </p>
              <p className="mt-1 text-sm text-foreground/85">{cliente.schedule}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Zona
              </p>
              <p className="mt-1 text-sm text-foreground/85">{cliente.address}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <InstagramIcon className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Síguenos
              </p>
              <a
                href={instagramLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-foreground/85 underline-offset-4 hover:underline"
              >
                @{cliente.instagram}
              </a>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="mt-10"
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item, idx) => (
              <AccordionItem key={item.q} value={`faq-${idx}`}>
                <AccordionTrigger className="text-left text-base text-foreground">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-10 flex justify-center"
        >
          <a
            href={whatsappLink("Hola Náufrago, quiero hacer un pedido")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="lg" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Escríbenos al WhatsApp
            </Button>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
