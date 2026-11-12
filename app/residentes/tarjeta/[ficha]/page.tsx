import Link from "next/link"
import { cliente } from "@/cliente.config"
import { getSupabaseAdmin } from "@/lib/supabase"
import { leerTarjeta, qrSvg, urlValidacion } from "@/lib/residentes-tarjeta"
import { Marco, Kicker } from "@/components/residentes/Marco"
import { BotonesTarjeta } from "@/components/residentes/BotonesTarjeta"

/**
 * /residentes/tarjeta/<ficha> · la tarjeta del vecino: QR (a /residentes/v/<ficha>),
 * nombre, número, «Guardar en el celular» e «Imprimir». Sin porcentaje. Vale una vez al día.
 */
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ ficha: string }> }

export default async function TarjetaResidentePage({ params }: Props) {
  const { ficha } = await params
  const tarjeta = await leerTarjeta(getSupabaseAdmin(), ficha)

  if (tarjeta.estado !== "activa") {
    return (
      <Marco>
        <Kicker>✦ Tarjeta de residente</Kicker>
        <h1 className="mt-2 font-[family-name:var(--font-bebas),sans-serif] text-[40px] leading-none tracking-wide text-white">
          {tarjeta.estado === "baja" ? "Esta tarjeta ya no vale" : "No encontramos esta tarjeta"}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#e9dcc4]">
          {tarjeta.estado === "baja"
            ? "Fue dada de baja. Si crees que es un error, pídele ayuda a Emilio en el local de Olón."
            : "Revisa el enlace. Si todavía no tienes tarjeta, regístrate con el código que te dio Emilio."}
        </p>
        <Link
          href="/residentes"
          className="mt-6 block rounded-full border border-[#6b5a8c] py-3.5 text-center font-bold"
        >
          Ir al registro
        </Link>
      </Marco>
    )
  }

  const svg = await qrSvg(urlValidacion(cliente.domain, ficha))

  return (
    <Marco>
      <style>{`
        @media print {
          @page { size: 62mm 96mm; margin: 0; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          [data-tarjeta], [data-tarjeta] * { visibility: visible !important; }
          [data-tarjeta] {
            position: fixed !important; inset: 0 !important; margin: 0 !important;
            border-radius: 0 !important; width: 62mm !important; height: 96mm !important;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          [data-tarjeta] [data-qr] { width: 40mm !important; height: 40mm !important; }
          [data-tarjeta] [data-marca] { font-size: 22px !important; }
          [data-tarjeta] [data-res] { font-size: 17px !important; letter-spacing: 0.1em !important; white-space: nowrap; }
          [data-tarjeta] [data-nombre] { font-size: 16px !important; }
          [data-tarjeta] [data-sub] { font-size: 10px !important; }
        }
      `}</style>
      <Kicker>✦ Tu tarjeta · guárdala</Kicker>

      <div
        data-tarjeta
        className="relative mt-[18px] flex flex-col items-center justify-center rounded-[18px] border-2 border-[#4DD4D8] p-[18px]"
        style={{ background: "linear-gradient(160deg,#4a2c7a,#2a1850)" }}
      >
        <span aria-hidden className="absolute left-3 top-3 h-[7px] w-[7px] rounded-full bg-[#1F1138]" />
        <span aria-hidden className="absolute right-3 top-3 h-[7px] w-[7px] rounded-full bg-[#1F1138]" />
        <p data-marca className="text-center font-[family-name:var(--font-alfa-slab),serif] text-[30px] tracking-wide text-[#4DD4D8]">
          NÁUFRAGO
        </p>
        <p data-res className="mt-0.5 text-center font-[family-name:var(--font-bebas),sans-serif] text-2xl tracking-[0.15em] text-[#F5E9D2]">
          RESIDENTE DE OLÓN
        </p>
        <div
          data-qr
          role="img"
          aria-label="Código QR de tu tarjeta"
          className="mx-auto mb-2.5 mt-3.5 h-[200px] w-[200px] overflow-hidden rounded-[10px] [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p data-nombre className="text-center text-[19px] font-semibold text-[#F5E9D2]">
          {tarjeta.nombre}
        </p>
        <p data-sub className="mt-1 text-center font-mono text-xs tracking-[0.15em] text-[#b9abcf]">
          {tarjeta.numero} · DESDE {tarjeta.desde}
        </p>
      </div>

      <BotonesTarjeta nombre={tarjeta.nombre} numero={tarjeta.numero} desde={tarjeta.desde} svg={svg} />

      <p className="mt-3.5 text-center text-[13px] leading-relaxed text-[#b9abcf]">
        Muéstrala en caja. Es solo tuya y no vence.
        <br />
        <b className="mt-1.5 inline-block font-semibold text-[#4DD4D8]">Vale una vez al día.</b>
      </p>
    </Marco>
  )
}
