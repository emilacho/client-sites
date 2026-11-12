/**
 * /residentes/v/<ficha> · lo que ve la caja al escanear una tarjeta de residente (12-nov · CC3).
 *
 * El que atiende escanea el QR con la cámara normal del celular: el celular abre esta dirección.
 * - Con la llave de la caja guardada en ese celular → valida y anota la visita en un solo paso.
 * - Sin la llave (un cliente que escanea su propia tarjeta, una vista previa de WhatsApp…) → no anota
 *   nada y no muestra ningún dato del vecino.
 */
import type { Metadata } from "next"
import { getSupabaseAdmin } from "@/lib/supabase"
import { LLAVE_CAJA, aparatoAutorizado } from "@/lib/llave-de-aparato"
import { validarYAnotar, type Resultado } from "@/lib/residentes-validar"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Caja · Residente de Olón", robots: { index: false, follow: false } }

const MORADO = "#3D2466"
const ARENA = "#F5E9D2"

function Marco({ fondo, children }: { fondo: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: ARENA }}>
      <div className="w-full max-w-sm rounded-3xl p-8 text-center text-white shadow-xl" style={{ background: fondo }}>
        <p className="text-xs tracking-[0.25em] opacity-80">NÁUFRAGO · CAJA</p>
        {children}
      </div>
    </main>
  )
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-4 text-4xl font-[family-name:var(--font-bebas)] tracking-wide">{children}</h1>
}

function Pantalla({ r }: { r: Resultado }) {
  if (r.estado === "valida") {
    return (
      <Marco fondo="#1F7A4D">
        <Titulo>✔ Residente válido</Titulo>
        <p className="mt-3 text-xl font-semibold">{r.nombre}</p>
        <p className="opacity-80">{r.numero}</p>
        <p className="mt-6 rounded-xl bg-white/15 p-3">Aplica el descuento «Residente» en Loyverse.</p>
        <p className="mt-3 text-sm opacity-80">Visita anotada.</p>
      </Marco>
    )
  }
  if (r.estado === "ya_usada_hoy") {
    return (
      <Marco fondo="#B26B00">
        <Titulo>⚠ Ya se usó hoy</Titulo>
        <p className="mt-3 text-xl font-semibold">{r.nombre}</p>
        <p className="opacity-80">{r.numero}</p>
        <p className="mt-4">{r.horaUso ? `Se usó hoy a las ${r.horaUso} · vuelve a valer mañana.` : "Ya se usó hoy · vuelve a valer mañana."}</p>
        <p className="mt-6 rounded-xl bg-white/15 p-3 font-semibold">Cobra el precio normal.</p>
        <p className="mt-3 text-sm opacity-80">Este escaneo queda anotado como no válido.</p>
      </Marco>
    )
  }
  return (
    <Marco fondo="#9B2C2C">
      <Titulo>✖ No válido</Titulo>
      {r.estado === "baja" && <p className="mt-3">Esta tarjeta está dada de baja.</p>}
      <p className="mt-6 rounded-xl bg-white/15 p-3 font-semibold">Cobra el precio normal.</p>
    </Marco>
  )
}

export default async function ValidarResidente({ params }: { params: Promise<{ ficha: string }> }) {
  const { ficha } = await params

  if (!(await aparatoAutorizado(LLAVE_CAJA))) {
    return (
      <Marco fondo={MORADO}>
        <Titulo>Tarjeta de residente</Titulo>
        <p className="mt-4">Esta tarjeta se valida en la caja de Náufrago.</p>
        <p className="mt-2 text-sm opacity-80">Muéstrala al pagar.</p>
      </Marco>
    )
  }

  let r: Resultado
  try {
    r = await validarYAnotar(getSupabaseAdmin(), ficha)
  } catch (e) {
    console.error("[residentes/v] no se pudo validar", e instanceof Error ? e.message : e)
    return (
      <Marco fondo="#9B2C2C">
        <Titulo>No se pudo validar</Titulo>
        <p className="mt-4">Hubo un problema con el sistema.</p>
        <p className="mt-6 rounded-xl bg-white/15 p-3 font-semibold">Cobra el precio normal.</p>
        <p className="mt-3 text-sm opacity-80">Si se repite, avisa a Emilio.</p>
      </Marco>
    )
  }
  return <Pantalla r={r} />
}
