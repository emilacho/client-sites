import Link from "next/link"
import { cliente } from "@/cliente.config"

/**
 * /privacidad · R96.129 · Aviso de Privacidad LOPDP Ecuador
 * compliance · cubre captura de datos · uso · derechos ARCO ·
 * retención · contacto DPO.
 */

export const metadata = {
  title: "Política de Privacidad · Náufrago",
  description: "Cómo Náufrago captura · usa y protege tus datos personales",
}

const LAST_UPDATED = "25 de mayo de 2026"

export default function PrivacidadPage() {
  return (
    <main className="min-h-[100svh] bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider text-[#F5E9D2]"
          >
            NÁUFRAGO
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Política de Privacidad
          </span>
        </div>
      </header>
      <article className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-sm text-slate-300">
        <p className="text-xs text-slate-500">
          Última actualización · {LAST_UPDATED}
        </p>
        <h1 className="font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wide text-[#F5E9D2]">
          Política de Privacidad
        </h1>
        <p>
          En <strong>{cliente.name}</strong> respetamos tu privacidad y cumplimos
          con la <strong>Ley Orgánica de Protección de Datos Personales del
          Ecuador (LOPDP)</strong> vigente desde diciembre de 2025. Este
          documento explica qué datos capturamos · para qué · y cómo puedes
          ejercer tus derechos.
        </p>

        <Section title="1 · Qué datos capturamos">
          <ul className="ml-5 list-disc space-y-1">
            <li>Nombre completo</li>
            <li>Número de WhatsApp (formato internacional E.164)</li>
            <li>Email (opcional · si te registrás vía Google o magic link)</li>
            <li>Direcciones de entrega · calle · referencia · coordenadas geo</li>
            <li>Histórico de pedidos · items · totales · fechas</li>
            <li>Preferencias alimenticias (notas opcionales para la cocina)</li>
            <li>Foto de comprobante de entrega (cuando aplica)</li>
            <li>IP del dispositivo · user agent (logs anonimizados)</li>
          </ul>
        </Section>

        <Section title="2 · Para qué usamos tus datos">
          <ul className="ml-5 list-disc space-y-1">
            <li>Procesar y entregar tu pedido</li>
            <li>Confirmar y dar seguimiento al pedido vía WhatsApp</li>
            <li>Gestionar tu programa de fidelización (perlas)</li>
            <li>Mejorar la experiencia (preferencias persistentes)</li>
            <li>Cumplir con obligaciones legales y contables del negocio</li>
            <li>Comunicarte promociones · solo si das consentimiento explícito</li>
          </ul>
        </Section>

        <Section title="3 · Con quién compartimos tus datos">
          <p>
            Compartimos datos mínimos necesarios con proveedores de servicios ·
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>PedidosYa</strong> · cuando eliges envío motorizado · les
              pasamos nombre · teléfono · dirección de entrega
            </li>
            <li>
              <strong>Twilio</strong> · envío de WhatsApp (status updates · OTP)
            </li>
            <li>
              <strong>Supabase</strong> · hosting de base de datos cifrada
            </li>
            <li>
              <strong>Vercel</strong> · hosting del sitio web
            </li>
            <li>
              <strong>Google Maps</strong> · autocompletado de direcciones
            </li>
          </ul>
          <p className="mt-2">
            NO vendemos · NO alquilamos · NO transferimos tus datos a terceros
            con fines comerciales.
          </p>
        </Section>

        <Section title="4 · Tus derechos (ARCO)">
          <p>Como titular de datos puedes ejercer en cualquier momento ·</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Acceso</strong> · descargar todos tus datos desde
              <Link href="/mi-cuenta" className="ml-1 text-cyan-300 underline">
                Mi Cuenta
              </Link>
              · botón &ldquo;Descargar mis datos&rdquo;
            </li>
            <li>
              <strong>Rectificación</strong> · editar tu nombre · email ·
              WhatsApp · direcciones · preferencias en cualquier momento
            </li>
            <li>
              <strong>Cancelación / eliminación</strong> · solicitar borrado de
              tu cuenta desde Mi Cuenta · soft-delete con 30 días de cooldown
            </li>
            <li>
              <strong>Oposición</strong> · negar el consentimiento de marketing
              opt-in cuando se te ofrezca
            </li>
            <li>
              <strong>Portabilidad</strong> · export en formato JSON estándar
            </li>
          </ul>
        </Section>

        <Section title="5 · Cuánto tiempo guardamos tus datos">
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Cuenta activa</strong> · mientras la cuenta exista
            </li>
            <li>
              <strong>Pedidos confirmados</strong> · 5 años (obligación contable
              SRI Ecuador)
            </li>
            <li>
              <strong>Logs de consent</strong> · 5 años (auditoría LOPDP)
            </li>
            <li>
              <strong>Post-eliminación</strong> · datos PII se borran tras 30
              días de cooldown · solo persiste hash anónimo para fines
              estadísticos
            </li>
          </ul>
        </Section>

        <Section title="6 · Cookies y tecnologías similares">
          <p>
            Usamos cookies funcionales (sesión · carrito) y analíticas
            (PostHog · uso del sitio). NO usamos cookies de tracking
            cross-site. Puedes rechazar las analíticas en el banner de
            consentimiento que aparece al entrar.
          </p>
        </Section>

        <Section title="7 · Contacto · DPO (Data Protection Officer)">
          <p>
            Para ejercer derechos · reclamos o consultas escríbenos a ·
          </p>
          <p className="mt-1">
            <a
              href={`mailto:${"emilacho@hotmail.com"}`}
              className="text-cyan-300 underline"
            >
              {"emilacho@hotmail.com"}
            </a>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Responsable · Náufrago · Avenida 8 NO, Urdenor 1, Tarqui · Guayaquil · Provincia del Guayas · Ecuador.
            Resolveremos tu solicitud dentro de 15 días hábiles per art. 30 LOPDP.
          </p>
        </Section>

        <Section title="8 · Cambios a esta política">
          <p>
            Podemos actualizar este documento cuando cambien nuestras prácticas
            o las regulaciones aplicables. La fecha de &ldquo;Última actualización&rdquo;
            arriba refleja la versión vigente. Si los cambios son materiales
            te notificaremos por correo o WhatsApp.
          </p>
        </Section>

        <div className="mt-8 border-t border-slate-800 pt-4 text-center">
          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-slate-500 hover:text-slate-300"
          >
            ← Volver a la home
          </Link>
        </div>
      </article>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wide text-cyan-200">
        {title}
      </h2>
      {children}
    </section>
  )
}
