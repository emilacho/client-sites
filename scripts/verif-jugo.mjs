import { chromium } from "playwright"
import { resolve, join } from "node:path"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("http://localhost:3114/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Fotos/i.test(e.textContent||""))?.click())
await p.waitForTimeout(3500)
// saltar directo al 7
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>(e.getAttribute("aria-label")||"")==="Siguiente")?.click())
  await p.waitForTimeout(600)
}
await p.waitForTimeout(9000)   // esperar de verdad a que cargue
const r = await p.evaluate(() => {
  const img = document.querySelector("img[alt='Jugo natural del día']") || [...document.querySelectorAll("img")].find(i=>/jugo/.test(i.currentSrc))
  return { existe: !!img, src: img ? decodeURIComponent(img.currentSrc) : "-", ancho: img?.naturalWidth ?? 0, completo: img?.complete }
})
console.log(JSON.stringify(r))
await p.screenshot({ path: resolve("tmp/pase7/s7b.png") })
await b.close()
