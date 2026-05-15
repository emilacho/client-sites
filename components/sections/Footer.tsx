import { cliente } from "@/cliente.config"

export function Footer() {
  return (
    <footer className="px-6 py-12 text-sm text-muted-foreground">
      <div className="mx-auto h-px max-w-5xl bg-border" />
      <div className="mx-auto mt-8 flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p>
          &copy; {new Date().getFullYear()} {cliente.name}. Todos los derechos
          reservados.
        </p>
        <p className="text-xs">
          Sitio construido por <span className="font-medium">Zero Risk</span>
        </p>
      </div>
    </footer>
  )
}
