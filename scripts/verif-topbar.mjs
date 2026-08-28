import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/topbar"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
// contexto SIN permiso de ubicacion concedido · como un visitante nuevo
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
let pidioUbicacion = false
const p = await ctx.newPage()
await ctx.grantPermissions([])
p.on("console", m => { if (/geolocation/i.test(m.text())) pidioUbicacion = true })
await p.goto("https://naufrago.ec/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(7000)
const barra = await p.evaluate(() => {
  const h = document.querySelector("header")
  return h ? h.innerText.replace(/\n+/g," · ").slice(0,120) : "(sin barra)"
})
console.log("  BARRA SUPERIOR:", barra)
await p.screenshot({ path: join(dir, "barra.png"), clip: { x: 0, y: 0, width: 1440, height: 90 } })
await b.close()
