/**
 * /residentes/caja/lista · dice si este celular ya es la caja (12-nov · CC3).
 */
import type { Metadata } from "next"
import { LLAVE_CAJA, aparatoAutorizado } from "@/lib/llave-de-aparato"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Caja · Residente de Olón", robots: { index: false, follow: false } }

export default async function CajaLista() {
  const ok = await aparatoAutorizado(LLAVE_CAJA)
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "#F5E9D2" }}>
      <div className="w-full max-w-sm rounded-3xl p-8 text-center text-white shadow-xl" style={{ background: ok ? "#1F7A4D" : "#3D2466" }}>
        <p className="text-xs tracking-[0.25em] opacity-80">NÁUFRAGO · CAJA</p>
        {ok ? (
          <>
            <h1 className="mt-4 text-4xl font-[family-name:var(--font-bebas)] tracking-wide">Este celular ya es la caja</h1>
            <p className="mt-4">Para validar una tarjeta de residente, escanea su QR con la cámara del celular.</p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-4xl font-[family-name:var(--font-bebas)] tracking-wide">Sin acceso</h1>
            <p className="mt-4">Este celular todavía no es la caja. Abre el enlace con la llave de la caja.</p>
          </>
        )}
      </div>
    </main>
  )
}
