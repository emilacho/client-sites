"use client"

export default function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-full bg-[#3D2466] px-4 py-2 font-semibold text-white">
      Imprimir
    </button>
  )
}
