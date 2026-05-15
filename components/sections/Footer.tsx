import { cliente, instagramLink, whatsappLink } from "@/cliente.config"

export function Footer() {
  return (
    <footer className="bg-background px-6 py-14 text-sm">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl text-foreground">
              {cliente.name}
            </p>
            <p className="mt-2 text-muted-foreground">{cliente.description}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Ubicación
            </p>
            <p className="mt-2 text-foreground/85">{cliente.address}</p>
            <p className="mt-2 text-muted-foreground">{cliente.schedule}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Contacto
            </p>
            <ul className="mt-2 space-y-2 text-foreground/85">
              <li>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  WhatsApp · {cliente.whatsappDisplay}
                </a>
              </li>
              <li>
                <a
                  href={instagramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  Instagram · @{cliente.instagram}
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {cliente.name}. Todos los
            derechos reservados.
          </p>
          <p>
            Sitio por <span className="font-medium text-foreground">Zero Risk</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
