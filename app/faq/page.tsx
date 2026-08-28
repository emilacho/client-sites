import Link from "next/link"
import { FAQ } from "@/lib/v2/faq"
import { faqSchema } from "@/lib/structured-data"
import { JsonLdScript } from "@/lib/structured-data-script"
import { cliente } from "@/cliente.config"

/**
 * /faq · R96.136 · página de preguntas frecuentes con FAQPage JSON-LD ·
 * Google rich results + AI search (ChatGPT/Perplexity) usan esto para
 * snippet answers · cubre 10 preguntas canon.
 */

export const metadata = {
  title: "Preguntas frecuentes · Náufrago",
  description:
    "Horarios · zonas de entrega · pagos · tesoro de náufrago · cuenta · ruleta · soporte. Todo lo que necesitas saber para pedir en Náufrago.",
}

export default function FaqPage() {
  return (
    <main className="min-h-[100svh] bg-slate-950 text-slate-100">
      <JsonLdScript data={faqSchema(FAQ)} />
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider text-[#F5E9D2]"
          >
            NÁUFRAGO
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Preguntas Frecuentes
          </span>
        </div>
      </header>
      <article className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wide text-[#F5E9D2]">
          Preguntas Frecuentes
        </h1>
        <p className="text-sm text-slate-400">
          Lo más consultado por nuestros clientes. Si tu pregunta no está aquí ·
          escríbenos por WhatsApp al{" "}
          <a
            href={`https://wa.me/${cliente.whatsappE164}`}
            className="text-cyan-300 underline hover:text-cyan-200"
          >
            {cliente.whatsappDisplay}
          </a>
          .
        </p>

        <div className="mt-4 space-y-3">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3 transition-all open:bg-slate-900/60"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-100 marker:hidden">
                <span className="flex items-baseline justify-between gap-3">
                  <span>{item.question}</span>
                  <span
                    aria-hidden
                    className="shrink-0 text-cyan-400 transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-8 border-t border-slate-800 pt-4 text-center">
          <p className="text-xs text-slate-500">
            ¿No encontraste lo que buscas?{" "}
            <a
              href={`https://wa.me/${cliente.whatsappE164}?text=${encodeURIComponent(
                "Hola Náufrago · tengo una pregunta",
              )}`}
              className="text-cyan-300 underline hover:text-cyan-200"
            >
              Escríbenos por WhatsApp
            </a>
          </p>
          <Link
            href="/"
            className="mt-3 inline-block text-xs uppercase tracking-widest text-slate-500 hover:text-slate-300"
          >
            ← Volver al inicio
          </Link>
        </div>
      </article>
    </main>
  )
}
