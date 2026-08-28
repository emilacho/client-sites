import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/pase7"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("http://localhost:3114/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Fotos/i.test(e.textContent||""))?.click())
await p.waitForTimeout(4000)
for (let i = 1; i <= 7; i++) {
  const info = await p.evaluate(() => {
    const h = document.querySelector("h3")
    const cta = [...document.querySelectorAll("button")].find(e=>/Agregar a la Canoa|Elegir el sabor/i.test(e.textContent||""))
    const img = [...document.querySelectorAll("img")].find(i=>i.currentSrc.includes("stories"))
    return { plato: h?.textContent?.trim(), boton: cta?.textContent?.trim().replace(/\s+/g," "),
             foto: img ? decodeURIComponent(img.currentSrc.split("url=")[1]?.split("&")[0]||"") : "SIN FOTO", cargada: img?.naturalWidth ?? 0 }
  })
  console.log(i, "·", JSON.stringify(info))
  await p.screenshot({ path: join(dir, `s${i}.png`) })
  await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>(e.getAttribute("aria-label")||"")==="Siguiente")?.click())
  await p.waitForTimeout(2200)
}
await b.close()
