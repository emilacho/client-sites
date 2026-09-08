/**
 * Saca los colores exactos del letrero de madera de la isla · R171
 *
 * El botón de pedir tiene que verse como ese letrero. En vez de
 * elegir un marrón a ojo, se leen los píxeles del letrero real: es
 * un modelo 3D con iluminación, así que su color no está escrito en
 * ningún lado del código · sólo existe en pantalla.
 */
import { chromium } from "playwright"

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto("https://naufrago.ec", { waitUntil: "networkidle", timeout: 90000 })
await p.waitForTimeout(9000)
await p.locator('button:has-text("Aceptar")').first().click().catch(() => {})
await p.waitForTimeout(2500)

const buf = await p.screenshot()
await b.close()

// Se decodifica el PNG dentro de un navegador sin conexión · no hace
// falta ninguna librería de imágenes instalada.
const b2 = await chromium.launch()
const p2 = await b2.newPage()
const base64 = buf.toString("base64")
const colores = await p2.evaluate(async (b64) => {
  const img = new Image()
  img.src = "data:image/png;base64," + b64
  await img.decode()
  const c = document.createElement("canvas")
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const hex = (x, y) => {
    const d = ctx.getImageData(x, y, 1, 1).data
    return "#" + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, "0")).join("")
  }
  // La escena 3D se mueve, así que buscar por posición falla. Se
  // busca por COLOR: en toda la mitad inferior, los tonos oscuros son
  // la madera del letrero y del cofre; los verdes claros sobre oscuro
  // son las letras talladas.
  const madera = new Map()
  const letras = new Map()
  for (let x = 300; x < 1000; x += 2) {
    for (let y = 420; y < 780; y += 2) {
      const d = ctx.getImageData(x, y, 1, 1).data
      const [r, g, b] = [d[0], d[1], d[2]]
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const h = "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
      // Madera · oscura y más roja que azul.
      if (lum < 110 && r > b && r > 45) madera.set(h, (madera.get(h) ?? 0) + 1)
      // Letras talladas · verde agua claro.
      if (g > 150 && g > r + 40 && b > r + 10 && lum < 210)
        letras.set(h, (letras.get(h) ?? 0) + 1)
    }
  }
  const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 8)
  return { madera: top(madera), letras: top(letras) }
}, base64)
await b2.close()

console.log("Madera del letrero:")
for (const [h, n] of colores.madera) console.log(`  ${h}  x${n}`)
console.log("Letras talladas:")
for (const [h, n] of colores.letras) console.log(`  ${h}  x${n}`)
