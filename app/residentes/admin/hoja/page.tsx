/**
 * /residentes/admin/hoja · la hoja imprimible de códigos de Emilio (12-nov · CC3).
 * Un QR por código; cada QR lleva a `naufrago.ec/residentes?codigo=NAU-XXXXXX` (el registro ya lo acepta puesto).
 * Sin `?c=` salen todos los códigos sin usar y sin anular; con `?c=NAU-…,NAU-…` (lo que deja «Generar códigos»), solo esos.
 */
import Link from "next/link"
import { getSupabaseAdmin } from "@/lib/supabase"
import { LLAVE_ADMIN, aparatoAutorizado } from "@/lib/llave-de-aparato"
import { normalizarCodigo } from "@/lib/residentes"
import { qrSvg } from "@/lib/residentes-tarjeta"
import { codigosParaImprimir } from "@/lib/residentes-admin"
import { urlRegistroConCodigo } from "@/lib/residentes-hoja"
import BotonImprimir from "./BotonImprimir"

export const dynamic = "force-dynamic"

const MORADO = "#3D2466"

export default async function HojaDeCodigos({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  if (!(await aparatoAutorizado(LLAVE_ADMIN))) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#F5E9D2]">
        <p className="rounded-2xl p-6 text-white" style={{ background: MORADO }}>Sin acceso.</p>
      </main>
    )
  }
  const { c } = await searchParams
  const pedidos = c ? c.split(",").map(normalizarCodigo).filter((x): x is string => x !== null) : null
  const codigos = await codigosParaImprimir(getSupabaseAdmin(), pedidos)
  const tarjetas = await Promise.all(codigos.map(async (codigo) => ({ codigo, svg: await qrSvg(urlRegistroConCodigo(codigo)) })))

  return (
    <main className="min-h-screen bg-white p-4 text-[#1F1138] print:p-0">
      <style>{`@media print { .no-imprimir { display: none !important } @page { margin: 10mm } }`}</style>
      <div className="no-imprimir mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <Link href="/residentes/admin" className="underline">← Volver a la lista</Link>
        <p>{tarjetas.length} {tarjetas.length === 1 ? "código" : "códigos"} para imprimir</p>
        <BotonImprimir />
      </div>
      {tarjetas.length === 0 ? (
        <p className="mx-auto max-w-3xl">No hay códigos sin usar. Genera nuevos desde la lista.</p>
      ) : (
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
          {tarjetas.map((t) => (
            <div key={t.codigo} className="break-inside-avoid rounded-xl border-2 border-dashed border-[#3D2466] p-3 text-center">
              <p className="text-[10px] font-bold tracking-[0.25em]">NÁUFRAGO · RESIDENTE DE OLÓN</p>
              <div className="mx-auto my-2 w-36" dangerouslySetInnerHTML={{ __html: t.svg }} />
              <p className="font-mono text-lg font-bold">{t.codigo}</p>
              <p className="text-xs">Escanéalo o entra a naufrago.ec/residentes</p>
              <p className="text-[10px] opacity-70">Sirve una sola vez.</p>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
