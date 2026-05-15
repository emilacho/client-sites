"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Label, Textarea } from "@client-sites/ui"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback?: (token: string) => void }) => string
      reset: (widgetId?: string) => void
    }
  }
}

export function ContactForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const turnstileToken =
      (formData.get("cf-turnstile-response") as string | null) ?? undefined

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        message: formData.get("message"),
        turnstile_token: turnstileToken,
      }),
    })

    if (res.ok) {
      router.push("/thanks")
      return
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setError(data.error ?? "submission_failed")
    setSubmitting(false)
  }

  const turnstileSiteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono (opcional)</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Mensaje</Label>
        <Textarea id="message" name="message" required rows={5} />
      </div>
      {turnstileSiteKey ? (
        <div
          className="cf-turnstile"
          data-sitekey={turnstileSiteKey}
          data-theme="auto"
        />
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">Error: {error}. Intenta de nuevo.</p>
      ) : null}
      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? "Enviando..." : "Enviar mensaje"}
      </Button>
    </form>
  )
}
