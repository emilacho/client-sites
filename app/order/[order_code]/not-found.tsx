import Link from "next/link"

export default function OrderNotFound() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <h1
          className="font-[family-name:var(--font-bebas)] text-5xl"
          style={{ color: "#3D2466" }}
        >
          NÁUFRAGO
        </h1>
        <p
          className="mt-6 font-[family-name:var(--font-caveat)] text-2xl"
          style={{ color: "#3D2466" }}
        >
          No encontramos ese pedido
        </p>
        <p className="mt-3 text-sm text-neutral-600">
          El código que abriste no existe · o ya pasó mucho tiempo desde la
          entrega. Si acabas de ordenar, espera un par de segundos y refrescá.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl px-5 py-3 text-sm font-semibold"
          style={{ background: "#3D2466", color: "#FFFFFF" }}
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  )
}
