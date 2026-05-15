import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { cliente } from "@/cliente.config"

export default function ThanksPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-semibold">Gracias por escribirnos</h1>
        <p className="text-muted-foreground">
          Recibimos tu mensaje. Te respondemos en las próximas 24 horas
          laborables.
        </p>
        <Link href="/">
          <Button>Volver al inicio · {cliente.name}</Button>
        </Link>
      </div>
    </main>
  )
}
