import { ContactForm } from "@/components/ContactForm"

export function ContactSection() {
  return (
    <section id="contact" className="px-6 py-20">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Contactanos</h2>
          <p className="mt-4 text-muted-foreground">
            Te respondemos en las próximas 24 horas laborables.
          </p>
        </div>
        <div className="mt-10">
          <ContactForm />
        </div>
      </div>
    </section>
  )
}
