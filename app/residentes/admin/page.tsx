/**
 * /residentes/admin · la lista de vecinos de Emilio (12-nov · CC3).
 * Vecinos con sus visitas, «Generar códigos» (hoja imprimible con QR), «Anular código» y «Dar de baja».
 * Se abre con la llave de Emilio (`/residentes/admin/entrar?llave=...`), una vez por aparato.
 */
import type { Metadata } from "next"
import Link from "next/link"
import { getSupabaseAdmin } from "@/lib/supabase"
import { LLAVE_ADMIN, aparatoAutorizado } from "@/lib/llave-de-aparato"
import { listarCodigos, listarVecinos, MAX_CODIGOS_POR_VEZ } from "@/lib/residentes-admin"
import { accionAnular, accionBaja, accionGenerar } from "./acciones"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Vecinos · Residentes de Olón", robots: { index: false, follow: false } }

const MORADO = "#3D2466"
const ARENA = "#F5E9D2"

const AVISOS: Record<string, string> = {
  codigo_anulado: "Código anulado: ya no sirve para registrarse.",
  codigo_no_anulable: "Ese código ya estaba usado o anulado; no se cambió nada.",
  codigo_invalido: "No se reconoció el código.",
  baja_hecha: "Tarjeta dada de baja: desde ahora la caja la ve «no válida».",
  baja_ya_estaba: "Esa tarjeta ya estaba de baja; no se cambió nada.",
  vecino_invalido: "No se reconoció al vecino.",
}

function fecha(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
}

export default async function AdminResidentes({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  if (!(await aparatoAutorizado(LLAVE_ADMIN))) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: ARENA }}>
        <div className="max-w-sm rounded-3xl p-8 text-center text-white" style={{ background: MORADO }}>
          <h1 className="text-3xl font-[family-name:var(--font-bebas)] tracking-wide">Sin acceso</h1>
          <p className="mt-3">Abre el enlace con tu llave para ver la lista de vecinos.</p>
        </div>
      </main>
    )
  }

  const { aviso } = await searchParams
  const base = getSupabaseAdmin()
  const [vecinos, codigos] = await Promise.all([listarVecinos(base), listarCodigos(base)])
  const activos = vecinos.filter((v) => !v.bajaEn)
  const libres = codigos.filter((c) => !c.usadoEn && !c.anuladoEn)

  return (
    <main className="min-h-screen p-4 sm:p-8" style={{ background: ARENA, color: MORADO }}>
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p className="text-xs tracking-[0.25em] opacity-70">NÁUFRAGO · RESIDENTES DE OLÓN</p>
          <h1 className="text-4xl font-[family-name:var(--font-bebas)] tracking-wide">Vecinos</h1>
          <p>{activos.length} con tarjeta activa · {libres.length} códigos sin usar</p>
        </header>

        {aviso && AVISOS[aviso] && <p className="rounded-xl bg-white p-3 shadow">{AVISOS[aviso]}</p>}

        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="text-2xl font-[family-name:var(--font-bebas)] tracking-wide">Generar códigos</h2>
          <p className="text-sm opacity-80">Cada código sirve una sola vez. Se abre una hoja con un QR por código, lista para imprimir.</p>
          <form action={accionGenerar} className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor="cuantos">Cuántos</label>
            <input id="cuantos" name="cuantos" type="number" min={1} max={MAX_CODIGOS_POR_VEZ} defaultValue={10} className="w-20 rounded-lg border px-2 py-1" />
            <button type="submit" className="rounded-full px-4 py-2 font-semibold text-white" style={{ background: MORADO }}>Generar códigos</button>
            {libres.length > 0 && <Link href="/residentes/admin/hoja" className="underline">Imprimir los {libres.length} sin usar</Link>}
          </form>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="text-2xl font-[family-name:var(--font-bebas)] tracking-wide">Vecinos con tarjeta</h2>
          {vecinos.length === 0 && <p className="mt-2 opacity-70">Todavía no se registró nadie.</p>}
          <ul className="mt-2 divide-y">
            {vecinos.map((v) => (
              <li key={v.id} className={`py-3 ${v.bajaEn ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p><span className="font-semibold">{v.numero}</span> · {v.nombre}{v.sector ? <span className="opacity-70"> · {v.sector}</span> : null}</p>
                  <p className="text-sm">{v.visitas} {v.visitas === 1 ? "visita" : "visitas"} · última {fecha(v.ultimaVisita)}</p>
                </div>
                <p className="text-sm opacity-70">+{v.whatsapp} · desde {fecha(v.creadoEn)}{v.rechazos ? ` · ${v.rechazos} escaneos no válidos` : ""}</p>
                {v.bajaEn ? (
                  <p className="text-sm">De baja desde {fecha(v.bajaEn)}{v.bajaMotivo ? ` · ${v.bajaMotivo}` : ""}</p>
                ) : (
                  <details className="mt-1 text-sm">
                    <summary className="cursor-pointer underline">Dar de baja</summary>
                    <form action={accionBaja} className="mt-2 flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={v.id} />
                      <input name="motivo" placeholder="Motivo (opcional)" maxLength={200} className="flex-1 rounded-lg border px-2 py-1" />
                      <button type="submit" className="rounded-full bg-red-700 px-3 py-1 font-semibold text-white">Confirmar baja</button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="text-2xl font-[family-name:var(--font-bebas)] tracking-wide">Códigos</h2>
          {codigos.length === 0 && <p className="mt-2 opacity-70">Todavía no hay códigos.</p>}
          <ul className="mt-2 divide-y">
            {codigos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-mono text-base">{c.codigo}</span>
                <span>
                  {c.anuladoEn ? `anulado ${fecha(c.anuladoEn)}` : c.usadoEn ? `usado ${fecha(c.usadoEn)} · ${c.usadoPor ?? ""}` : `sin usar · creado ${fecha(c.creadoEn)}`}
                </span>
                {!c.usadoEn && !c.anuladoEn && (
                  <details>
                    <summary className="cursor-pointer underline">Anular código</summary>
                    <form action={accionAnular} className="mt-1">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="rounded-full bg-red-700 px-3 py-1 font-semibold text-white">Confirmar</button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
