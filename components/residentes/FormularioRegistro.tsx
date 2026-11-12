"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export const MENSAJES: Record<string, string> = {
  codigo_invalido: "Ese código no existe o ya se usó. Pídele uno nuevo a Emilio.",
  ya_registrado: "Ese teléfono ya tiene una tarjeta. Si la perdiste, pídele ayuda a Emilio en el local.",
  datos_invalidos: "Revisa tu nombre y tu teléfono.",
  demasiados_intentos: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
}
const MENSAJE_GENERAL = "No pudimos crear tu tarjeta. Prueba otra vez en un momento."

const campo =
  "w-full rounded-xl border border-[#6b5a8c] bg-[#3a2a5c] px-3.5 py-3 text-base text-[#F5E9D2] placeholder:text-[#cbbfdc]/60 outline-none focus:border-[#4DD4D8]"

export function FormularioRegistro({ codigoInicial }: { codigoInicial: string }) {
  const router = useRouter()
  const [codigo, setCodigo] = useState(codigoInicial)
  const [nombre, setNombre] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch("/api/residentes/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nombre, whatsapp }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; ficha?: string; error?: string } | null
      if (json?.ok && json.ficha) {
        router.push(`/residentes/tarjeta/${json.ficha}`)
        return
      }
      setError(MENSAJES[json?.error ?? ""] ?? MENSAJE_GENERAL)
    } catch {
      setError(MENSAJE_GENERAL)
    }
    setEnviando(false)
  }

  return (
    <form onSubmit={enviar} className="mt-2" noValidate>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] text-[#e9dcc4]">Tu código (te lo dio Emilio)</span>
        <input
          className={`${campo} font-mono text-lg font-bold uppercase tracking-[0.25em] text-[#4DD4D8]`}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="NAU-XXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          required
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] text-[#e9dcc4]">Nombre y apellido</span>
        <input
          className={campo}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="name"
          maxLength={60}
          required
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] text-[#e9dcc4]">Teléfono (WhatsApp)</span>
        <input
          className={campo}
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="099 123 4567"
          maxLength={20}
          required
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-[#E5553F] bg-[#4a1a22] px-3.5 py-3 text-sm text-[#f3d3cc]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-5 w-full rounded-full py-[15px] text-[17px] font-bold text-[#2a1850] disabled:opacity-70"
        style={{ background: "linear-gradient(90deg,#4DD4D8,#2aa8ac)" }}
      >
        {enviando ? "Creando…" : "Crear mi tarjeta"}
      </button>

      <div className="mt-4 rounded-2xl border border-[#5b4a7c] bg-white/[0.04] px-3.5 py-3 text-[13px] leading-relaxed text-[#e9dcc4]">
        🔑 Sin código no hay tarjeta. Pídeselo a Emilio en el local de Olón.
        <br />
        Cada código sirve una sola vez.
      </div>
      <p className="mt-3.5 text-center text-[13px] leading-relaxed text-[#b9abcf]">
        Tu nombre y teléfono solo se usan para la tarjeta.
      </p>
    </form>
  )
}
