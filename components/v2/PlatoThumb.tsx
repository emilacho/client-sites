"use client"

/**
 * PlatoThumb · R104 · la miniatura de un plato, en un solo lugar.
 *
 * Antes cada superficie dibujaba su propio cuadrito emoji+gradient con el
 * mismo markup copiado tres veces (tarjeta de la carta · sugeridos · línea
 * de la canoa). Al llegar las fotos reales eso eran tres sitios donde
 * olvidarse de una. Ahora hay uno.
 *
 * Regla: si el plato tiene foto propia se muestra la foto · si no, cae al
 * emoji sobre su gradient. El respaldo NO es decorativo: hay platos que
 * todavía no tienen foto (patacones · encebollado junior) y ponerles una
 * foto parecida sería prometer una cosa y servir otra.
 *
 * `sizes` importa: la foto original es 900x900 y estas miniaturas miden
 * entre 40 y 80 px. Sin `sizes` el navegador se bajaría la grande.
 */
import Image from "next/image"

export interface PlatoThumbProps {
  /** Foto real del plato · ausente = cae a emoji. */
  imageUrl?: string | null
  emoji: string
  /** Clases tailwind de gradient · respaldo cuando no hay foto. */
  gradient?: string
  /** Nombre del plato · alt de la foto. Vacío = decorativa. */
  alt?: string
  /** Clases de tamaño/forma del contenedor · ej "h-20 w-20 rounded-xl". */
  className: string
  /** Tamaño del emoji de respaldo · ej "text-3xl". */
  emojiClassName?: string
  /** Ancho real de render en CSS px · para que Next baje la copia chica. */
  sizePx: number
}

export function PlatoThumb({
  imageUrl,
  emoji,
  gradient = "from-slate-700 to-slate-900",
  alt,
  className,
  emojiClassName = "text-2xl",
  sizePx,
}: PlatoThumbProps) {
  if (imageUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden shadow-inner ${className}`}
      >
        <Image
          src={imageUrl}
          alt={alt ?? ""}
          fill
          sizes={`${sizePx}px`}
          className="object-cover"
        />
      </div>
    )
  }
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br shadow-inner ${gradient} ${className} ${emojiClassName}`}
    >
      <span>{emoji}</span>
    </div>
  )
}
