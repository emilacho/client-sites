#!/usr/bin/env node
/**
 * R126 · Achicar el cielo que ilumina la isla.
 *
 * `<Environment preset="sunset">` no dibuja nada en pantalla · sólo le da
 * a los materiales el reflejo del atardecer. Pero se baja de
 * raw.githubusercontent.com y pesa 1,4 MB · con los modelos ya
 * adelgazados pasó a ser el archivo más pesado de la página, y encima
 * viene de un dominio ajeno (si GitHub se cae o tarda, tarda la isla).
 *
 * Esto baja ese mismo cielo una vez, lo reduce a 512x256 y lo guarda como
 * .hdr propio en public/hdri/, comprimido por línea (RLE de Radiance).
 * A ese tamaño el reflejo es el mismo: three.js igual lo desenfoca para
 * calcular la luz · lo que se pierde es detalle que ningún material de
 * esta escena llega a mostrar.
 *
 * Correr · node scripts/achicar-cielo.mjs
 */
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js"
import { FloatType } from "three"
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const ORIGEN =
  "https://raw.githubusercontent.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/venice_sunset_1k.hdr"
// Tamaño del cielo reducido · se puede probar otro con ANCHO=256.
const ANCHO = Number(process.env.ANCHO ?? 512)
const ALTO = ANCHO / 2
const DESTINO = path.join(ROOT, "public", "hdri", `atardecer-${ANCHO}.hdr`)

/** Promedio de bloque · de la imagen original al tamaño chico. */
function reducir(datos, w, h, canales, nw, nh) {
  const salida = new Float32Array(nw * nh * 3)
  const fx = w / nw
  const fy = h / nh
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let sy = Math.floor(y * fy); sy < Math.floor((y + 1) * fy); sy++) {
        for (let sx = Math.floor(x * fx); sx < Math.floor((x + 1) * fx); sx++) {
          const i = (sy * w + sx) * canales
          r += datos[i]
          g += datos[i + 1]
          b += datos[i + 2]
          n++
        }
      }
      const o = (y * nw + x) * 3
      salida[o] = r / n
      salida[o + 1] = g / n
      salida[o + 2] = b / n
    }
  }
  return salida
}

/** Un píxel de color a los 4 bytes RGBE que guarda el formato. */
function aRGBE(r, g, b, destino, i) {
  const max = Math.max(r, g, b)
  if (max < 1e-32) return // negro · queda 0,0,0,0
  const e = Math.ceil(Math.log2(max))
  const f = 255.999 / Math.pow(2, e)
  destino[i] = Math.min(255, Math.max(0, r * f))
  destino[i + 1] = Math.min(255, Math.max(0, g * f))
  destino[i + 2] = Math.min(255, Math.max(0, b * f))
  destino[i + 3] = e + 128
}

/**
 * Comprime una tira de bytes al modo RLE de Radiance · repeticiones de 4
 * o más se guardan como (cantidad|128, valor) y el resto como bloques
 * literales de hasta 128. Un cielo es casi todo degradado, así que
 * repite mucho: sin esto el archivo pesa el triple.
 */
function rle(tira) {
  const salida = []
  let i = 0
  while (i < tira.length) {
    let corrida = 1
    while (i + corrida < tira.length && tira[i + corrida] === tira[i] && corrida < 127) corrida++
    if (corrida >= 4) {
      salida.push(128 + corrida, tira[i])
      i += corrida
    } else {
      const inicio = i
      let n = 0
      while (i < tira.length && n < 128) {
        // Cortar el bloque literal si empieza una repetición larga.
        if (i + 3 < tira.length && tira[i] === tira[i + 1] && tira[i] === tira[i + 2] && tira[i] === tira[i + 3]) break
        i++
        n++
      }
      salida.push(n)
      for (let k = inicio; k < inicio + n; k++) salida.push(tira[k])
    }
  }
  return salida
}

/**
 * Escribe formato Radiance .hdr (RGBE) con compresión por línea. Cada
 * píxel entra en 4 bytes: los tres colores comparten un exponente. Es el
 * formato que lee three.js con HDRLoader, que es el que usa drei cuando a
 * `<Environment>` se le pasa un archivo `.hdr`.
 */
function escribirHDR(pix, w, h) {
  const cabecera = `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`
  const partes = [Buffer.from(cabecera, "ascii")]
  const linea = Buffer.alloc(w * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3
      aRGBE(pix[o], pix[o + 1], pix[o + 2], linea, x * 4)
    }
    // Cabecera de línea comprimida · 2,2 y el ancho en dos bytes.
    partes.push(Buffer.from([2, 2, (w >> 8) & 0xff, w & 0xff]))
    for (let c = 0; c < 4; c++) {
      const tira = new Uint8Array(w)
      for (let x = 0; x < w; x++) tira[x] = linea[x * 4 + c]
      partes.push(Buffer.from(rle(tira)))
    }
  }
  return Buffer.concat(partes)
}

const res = await fetch(ORIGEN)
if (!res.ok) throw new Error(`GET ${ORIGEN} → ${res.status}`)
const crudo = Buffer.from(await res.arrayBuffer())
console.log(`  baja      ${(crudo.length / 1048576).toFixed(2)} MB desde github`)

const cielo = new HDRLoader()
  .setDataType(FloatType)
  .parse(crudo.buffer.slice(crudo.byteOffset, crudo.byteOffset + crudo.byteLength))
const canales = cielo.data.length / (cielo.width * cielo.height)
console.log(`  original  ${cielo.width}x${cielo.height} · ${canales} canales`)

const chico = reducir(cielo.data, cielo.width, cielo.height, canales, ANCHO, ALTO)
const hdr = escribirHDR(chico, ANCHO, ALTO)
await fs.mkdir(path.dirname(DESTINO), { recursive: true })
await fs.writeFile(DESTINO, hdr)
console.log(
  `  guarda    ${ANCHO}x${ALTO} · ${(hdr.length / 1024).toFixed(0)} KB → public/hdri/${path.basename(DESTINO)}`,
)
console.log(
  `  ahorro    ${(crudo.length / 1048576).toFixed(2)} MB → ${(hdr.length / 1024).toFixed(0)} KB  (-${Math.round((1 - hdr.length / crudo.length) * 100)}%)`,
)
