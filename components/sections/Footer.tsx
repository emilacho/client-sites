import { MessageCircle } from "lucide-react"
import { InstagramIcon } from "@/components/ui/InstagramIcon"
import { cliente, instagramLink, whatsappLink } from "@/cliente.config"

export function Footer() {
  return (
    <footer className="bg-background px-6 py-14 text-sm">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <p className="font-display text-3xl text-foreground">
              {cliente.name}
            </p>
            <p className="mt-3 text-muted-foreground">
              Sabor de mar, directo a tu mesa.
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Olón · Santa Elena
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Navegación
            </p>
            <ul className="mt-3 space-y-2 text-foreground/85">
              <li>
                <a href="#menu" className="hover:text-foreground hover:underline">
                  Menú
                </a>
              </li>
              <li>
                <a href="#about" className="hover:text-foreground hover:underline">
                  Nosotros
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="hover:text-foreground hover:underline"
                >
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Contacto
            </p>
            <ul className="mt-3 space-y-2 text-foreground/85">
              <li>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-foreground hover:underline"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp · {cliente.whatsappDisplay}
                </a>
              </li>
              <li>
                <a
                  href={instagramLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-foreground hover:underline"
                >
                  <InstagramIcon className="h-4 w-4" />@{cliente.instagram}
                </a>
              </li>
              <li className="text-muted-foreground">{cliente.scheduleShort}</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {cliente.name}. El mar en cada
            bocado.
          </p>
          <p>
            Sitio por <span className="font-medium text-foreground">Zero Risk</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
