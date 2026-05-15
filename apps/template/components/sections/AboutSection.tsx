import { cliente } from "@/cliente.config"

export function AboutSection() {
  return (
    <section id="about" className="px-6 py-20">
      <div className="mx-auto max-w-3xl space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight">Sobre {cliente.name}</h2>
        <p className="text-lg text-muted-foreground">
          Placeholder de about · Phase 1 agent dispatch llena este bloque con
          la historia del cliente, equipo, credenciales, certificaciones.
        </p>
        <p className="text-muted-foreground">
          Mantener este copy genérico hasta que el brief cliente y la
          identidad de marca estén firmados. Evita committer detalles
          específicos del sector aquí · son responsabilidad del módulo de
          Phase 1.
        </p>
      </div>
    </section>
  )
}
