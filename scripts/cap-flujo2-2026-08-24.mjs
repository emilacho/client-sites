import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const BASE = "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("tmp/landing-2026-08-24"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(5000)

const shot = (n) => p.screenshot({ path: join(dir, n) })
const clicXY = async (x, y, nombre, archivo, esp = 3000) => {
  await p.mouse.click(x, y); await p.waitForTimeout(esp)
  await shot(archivo); console.log("clic", nombre, "→", archivo)
}
// cerrar banner cookies (ACEPTAR ~ 1305,860)
await p.mouse.click(1305, 860); await p.waitForTimeout(1200)
await shot("05-sin-banner.png")

await clicXY(112, 108, "MENÚ", "10-menu.png", 4000)
// dentro del menú: buscar botones de agregar
const enModal = await p.evaluate(() => {
  const o = []
  document.querySelectorAll("button").forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width > 20 && r.height > 15) o.push({ t: (el.textContent||"").trim().slice(0,30), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2) })
  })
  return o
})
console.log("botones visibles en menú:", JSON.stringify(enModal.slice(0, 25)))
await b.close()
