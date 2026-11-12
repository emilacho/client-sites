import { Marco, Kicker } from "@/components/residentes/Marco"
import { FormularioRegistro } from "@/components/residentes/FormularioRegistro"

/**
 * /residentes · registro de la tarjeta de residente de Olón.
 * Se entra con el código que da Emilio; si el vecino escanea el QR impreso,
 * llega con `?codigo=NAU-XXXXXX` y el campo ya viene lleno.
 */
export const dynamic = "force-dynamic"

type Props = { searchParams: Promise<{ codigo?: string | string[] }> }

export default async function RegistroResidentesPage({ searchParams }: Props) {
  const { codigo } = await searchParams
  const inicial = (Array.isArray(codigo) ? codigo[0] : codigo ?? "").slice(0, 20)

  return (
    <Marco>
      <Kicker>✦ Olón · solo residentes</Kicker>
      <h1 className="mt-2 font-[family-name:var(--font-bebas),sans-serif] text-[46px] leading-none tracking-wide text-white">
        Tarjeta de residente
      </h1>
      <p className="mt-0.5 font-[family-name:var(--font-caveat),cursive] text-[26px] leading-tight text-[#4DD4D8]">
        Para los vecinos de Olón
      </p>
      <FormularioRegistro codigoInicial={inicial} />
    </Marco>
  )
}
