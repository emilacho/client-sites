import Link from "next/link"

/**
 * El fondo y la barra de las pantallas de residentes (estilo de la ventana del Club:
 * morado #3D2466 → #1F1138, cian #4DD4D8, arena #F5E9D2). Pensado para celular.
 * `data-marco` permite que «Imprimir» esconda todo menos la tarjeta.
 */
export function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-marco
      className="min-h-dvh px-4 pb-10 pt-4 text-[#F5E9D2]"
      style={{ background: "linear-gradient(180deg,#3D2466 0%,#2a1850 55%,#1F1138 100%)" }}
    >
      <div className="mx-auto w-full max-w-[420px]">
        <div className="no-imprimir flex items-center rounded-full bg-[#3b4452cc] px-4 py-2.5 text-[15px]">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-[#4DD4D8]" />
            Náufrago
          </Link>
        </div>
        <div className="pt-6">{children}</div>
      </div>
    </main>
  )
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-[#e9dcc4] opacity-90">
      {children}
    </p>
  )
}
