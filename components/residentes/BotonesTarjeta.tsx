"use client"

import { useState } from "react"

type Props = { nombre: string; numero: string; desde: string; svg: string }

/** La familia real de una fuente de next/font, leída del elemento que ya la usa en la página. */
function familia(selector: string, respaldo: string): string {
  const el = document.querySelector(selector)
  return el ? getComputedStyle(el).fontFamily : respaldo
}

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => mal(new Error("no cargó el QR"))
    img.src = src
  })
}

/** Dibuja la tarjeta en una imagen PNG (600×900) con el mismo diseño de la pantalla. */
async function dibujarTarjeta({ nombre, numero, desde, svg }: Props): Promise<Blob> {
  await document.fonts.ready
  const W = 600, H = 900
  const lienzo = document.createElement("canvas")
  lienzo.width = W
  lienzo.height = H
  const c = lienzo.getContext("2d")
  if (!c) throw new Error("sin lienzo")

  const fondo = c.createLinearGradient(0, 0, W, H)
  fondo.addColorStop(0, "#4a2c7a")
  fondo.addColorStop(1, "#2a1850")
  c.fillStyle = fondo
  c.beginPath()
  c.roundRect(6, 6, W - 12, H - 12, 36)
  c.fill()
  c.lineWidth = 6
  c.strokeStyle = "#4DD4D8"
  c.stroke()
  c.fillStyle = "#1F1138"
  for (const x of [40, W - 40]) {
    c.beginPath()
    c.arc(x, 40, 9, 0, Math.PI * 2)
    c.fill()
  }

  c.textAlign = "center"
  c.fillStyle = "#4DD4D8"
  c.font = `60px ${familia("[data-marca]", "serif")}`
  c.fillText("NÁUFRAGO", W / 2, 140)
  c.fillStyle = "#F5E9D2"
  c.font = `48px ${familia("[data-res]", "sans-serif")}`
  c.letterSpacing = "6px"
  c.fillText("RESIDENTE DE OLÓN", W / 2, 200)
  c.letterSpacing = "0px"

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  try {
    const qr = await cargarImagen(url)
    const lado = 400
    c.save()
    c.beginPath()
    c.roundRect((W - lado) / 2, 240, lado, lado, 20)
    c.clip()
    c.drawImage(qr, (W - lado) / 2, 240, lado, lado)
    c.restore()
  } finally {
    URL.revokeObjectURL(url)
  }

  c.fillStyle = "#F5E9D2"
  c.font = `600 38px ${familia("[data-nombre]", "sans-serif")}`
  c.fillText(nombre, W / 2, 720, W - 60)
  c.fillStyle = "#b9abcf"
  c.font = `24px ${familia("[data-sub]", "monospace")}`
  c.fillText(`${numero} · DESDE ${desde}`, W / 2, 770)
  c.fillStyle = "#4DD4D8"
  c.font = `600 26px ${familia("[data-nombre]", "sans-serif")}`
  c.fillText("Vale una vez al día", W / 2, 840)

  return new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error("sin imagen"))), "image/png"))
}

export function BotonesTarjeta(props: Props) {
  const [guardada, setGuardada] = useState(false)
  const [error, setError] = useState(false)

  async function guardar() {
    setError(false)
    try {
      const blob = await dibujarTarjeta(props)
      const archivo = `tarjeta-residente-${props.numero}.png`
      const enlace = document.createElement("a")
      enlace.href = URL.createObjectURL(blob)
      enlace.download = archivo
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000)
      setGuardada(true)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="no-imprimir">
      <button
        type="button"
        onClick={guardar}
        className="mt-5 w-full rounded-full py-[15px] text-[17px] font-bold text-[#2a1850]"
        style={{ background: "linear-gradient(90deg,#4DD4D8,#2aa8ac)" }}
      >
        Guardar en el celular
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="mt-2.5 w-full rounded-full border border-[#6b5a8c] py-[15px] text-[17px] font-bold text-[#F5E9D2]"
      >
        Imprimir
      </button>
      {guardada && (
        <p className="mt-3 rounded-xl border border-[#5b4a7c] bg-white/[0.04] px-3.5 py-3 text-[13px] leading-relaxed text-[#e9dcc4]">
          ✔ La imagen quedó en tus descargas o en tu galería. También puedes dejar esta página en tu pantalla de
          inicio: en el navegador, toca <b>Compartir</b> o el menú <b>⋮</b> y elige <b>Agregar a pantalla de inicio</b>.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-center text-[13px] text-[#f3d3cc]">
          No se pudo guardar la imagen. Toma una captura de pantalla de la tarjeta.
        </p>
      )}
    </div>
  )
}
