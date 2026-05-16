"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ChevronDown, MessageCircle } from "lucide-react"
import { Spotlight } from "@/components/ui/spotlight"
import { ShimmerButton } from "@/components/shadcn/shimmer-button"
import { Badge } from "@/components/shadcn/badge"
import { cliente, whatsappLink } from "@/cliente.config"

/**
 * Hero · sourced from web-designer + marketing-content-creator + creative-director
 * agent outputs (master workflow 7196 · 2026-05-16).
 *
 * Toolkit components:
 *  - Aceternity `Spotlight` (radial mouse-follow glow above the dark image)
 *  - Framer Motion staggered fade-in
 *  - Magic UI `ShimmerButton` for the premium WhatsApp CTA
 *  - shadcn `Badge` for schedule availability
 *  - Lucide icons (MessageCircle, ChevronDown)
 */
export function HeroSection() {
  return (
    <section className="relative min-h-[92vh] overflow-hidden bg-primary text-primary-foreground">
      {/* Full-bleed hero image · creative-director hero_image_prompt → GPT Image */}
      <div className="absolute inset-0">
        <Image
          src="/naufrago/hero-v1.png"
          alt="Ceviche Náufrago · cuenco de cerámica con pescado fresco, leche de tigre y cebolla curtida sobre madera de mar"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/55 via-primary/65 to-primary/85" />
      </div>

      {/* Aceternity Spotlight · radial light above the gradient */}
      <Spotlight
        className="left-1/2 top-0 -translate-x-1/2"
        fill="hsl(42 56% 58%)"
      />

      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-5xl flex-col items-center justify-center px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-6"
        >
          <Badge
            variant="secondary"
            className="bg-white/15 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-white backdrop-blur-md hover:bg-white/20"
          >
            Olón · Santa Elena · Ecuador
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="font-display text-[clamp(3.25rem,7vw,6rem)] leading-[0.95] tracking-tight"
        >
          {cliente.taglineHero}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
          className="mt-7 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl"
        >
          {cliente.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href={whatsappLink("Hola Náufrago, quiero hacer un pedido")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShimmerButton
              shimmerColor="hsl(42 56% 70%)"
              background="hsl(9 60% 51%)"
              borderRadius="9999px"
              className="px-7 py-3.5 text-base font-semibold text-white"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Pide ahora por WhatsApp
            </ShimmerButton>
          </a>
          <a
            href="#menu"
            className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-6 text-base font-medium text-white transition-colors hover:bg-white/10"
          >
            Ver menú
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 flex flex-col items-center gap-1 text-sm text-white/80"
        >
          <span>{cliente.schedule}</span>
          <span className="text-xs uppercase tracking-[0.18em] text-white/60">
            WhatsApp · {cliente.whatsappDisplay}
          </span>
        </motion.div>

        <motion.a
          href="#menu"
          aria-label="Ir al menú"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 6, 0] }}
          transition={{
            opacity: { duration: 0.6, delay: 0.9 },
            y: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 hover:text-white"
        >
          <ChevronDown className="h-6 w-6" />
        </motion.a>
      </div>
    </section>
  )
}
