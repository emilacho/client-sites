import { Button } from "@client-sites/ui"

export function CTASection() {
  return (
    <section className="bg-primary px-6 py-20 text-primary-foreground">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          ¿Listo para conversar?
        </h2>
        <p className="mt-4 opacity-90">
          Escribinos por el formulario · te respondemos en 24h laborables.
        </p>
        <Button size="lg" variant="secondary" className="mt-8" asChild>
          <a href="#contact">Contactar ahora</a>
        </Button>
      </div>
    </section>
  )
}
