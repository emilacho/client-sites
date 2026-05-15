import { Button } from "@client-sites/ui"
import { cliente } from "@/cliente.config"

export function HeroSection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
          {cliente.name}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          {cliente.description}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Button size="lg" asChild>
            <a href="#contact">Contactanos</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#services">Ver servicios</a>
          </Button>
        </div>
      </div>
    </section>
  )
}
