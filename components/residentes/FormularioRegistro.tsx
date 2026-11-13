"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export const MENSAJES: Record<string, string> = {
  codigo_invalido: "Ese código no existe o ya se usó. Pide uno nuevo en el local.",
  ya_registrado: "Ese teléfono ya tiene una tarjeta. Si la perdiste, pide ayuda en el local.",
  cedula_registrada: "Esta cédula ya tiene tarjeta. Si la perdiste, pide ayuda en el local.",
  datos_invalidos:
    "Revisa tus datos: nombre, cédula, teléfono y sector; y, si los pusiste, el correo y la fecha de nacimiento.",
  demasiados_intentos: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
}
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
// del año en curso hacia atrás, hasta 1900 (misma regla que la base)
const ANIOS = Array.from({ length: new Date().getFullYear() - 1900 + 1 }, (_, i) => new Date().getFullYear() - i)
const MENSAJE_GENERAL = "No pudimos crear tu tarjeta. Prueba otra vez en un momento."

const campo =
  "w-full rounded-xl border border-[#6b5a8c] bg-[#3a2a5c] px-3.5 py-3 text-base text-[#F5E9D2] placeholder:text-[#cbbfdc]/60 outline-none focus:border-[#4DD4D8]"

export function FormularioRegistro({ codigoInicial }: { codigoInicial: string }) {
  const router = useRouter()
  const [codigo, setCodigo] = useState(codigoInicial)
  const [nombre, setNombre] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [sector, setSector] = useState("")
  const [correo, setCorreo] = useState("")
  const [cedula, setCedula] = useState("")
  const [nacimientoDia, setNacimientoDia] = useState("")
  const [nacimientoMes, setNacimientoMes] = useState("")
  const [nacimientoAnio, setNacimientoAnio] = useState("")
  const [aceptaNovedades, setAceptaNovedades] = useState(false)
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
        body: JSON.stringify({
          codigo, nombre, cedula, whatsapp, sector, correo, nacimientoDia, nacimientoMes, nacimientoAnio, aceptaNovedades,
        }),
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
        <span className="mb-1.5 block text-[13px] text-[#e9dcc4]">Tu código</span>
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
        <span className="mb-1.5 block text-[13px] text-[#e9dcc4]">Cédula</span>
        <input
          className={campo}
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Solo números"
          maxLength={20}
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
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] text-[#e9dcc4]">Sector o barrio en Olón</span>
        <input
          className={campo}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          placeholder="Ej.: Centro, La Playa, Curía"
          maxLength={60}
          required
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[13px] text-[#e9dcc4]">
          Correo <span className="text-[#b9abcf]">(opcional)</span>
        </span>
        <input
          className={campo}
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={120}
        />
      </label>
      <fieldset className="mt-4">
        <legend className="mb-1.5 block text-[13px] text-[#e9dcc4]">
          Fecha de nacimiento <span className="text-[#b9abcf]">(opcional)</span>
        </legend>
        <div className="grid grid-cols-[2fr_3fr_2.5fr] gap-2">
          <select
            aria-label="Día de nacimiento"
            className={campo}
            value={nacimientoDia}
            onChange={(e) => setNacimientoDia(e.target.value)}
          >
            <option value="">Día</option>
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
          <select
            aria-label="Mes de nacimiento"
            className={campo}
            value={nacimientoMes}
            onChange={(e) => setNacimientoMes(e.target.value)}
          >
            <option value="">Mes</option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="Año de nacimiento"
            className={campo}
            value={nacimientoAnio}
            onChange={(e) => setNacimientoAnio(e.target.value)}
          >
            <option value="">Año</option>
            {ANIOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <label className="mt-4 flex items-start gap-3 text-[14px] leading-snug text-[#e9dcc4]">
        <input
          type="checkbox"
          checked={aceptaNovedades}
          onChange={(e) => setAceptaNovedades(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#4DD4D8]"
        />
        Acepto recibir novedades de Náufrago por WhatsApp
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
      <p className="mt-2.5 text-center text-[13px] leading-relaxed text-[#b9abcf]">
        Tus datos solo los usa Náufrago y no se comparten.
      </p>

      <div className="mt-4 rounded-2xl border border-[#5b4a7c] bg-white/[0.04] px-3.5 py-3 text-[13px] leading-relaxed text-[#e9dcc4]">
        🔑 Sin código no hay tarjeta. Pídelo en el local de Olón.
        <br />
        Cada código sirve una sola vez.
      </div>
    </form>
  )
}
