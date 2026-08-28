import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/fricciones"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p = await ctx.newPage()
const errores = []
p.on("pageerror", e => errores.push(String(e).slice(0,100)))
p.on("response", r => { if (r.status() >= 400 && !r.url().includes("favicon")) errores.push(`${r.status()} ${r.url().slice(0,70)}`) })

await p.goto("https://naufrago.ec/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.screenshot({ path: join(dir, "01-inicio.png") })

const abrir = async (re, file, esperar = 4000) => {
  const ok = await p.evaluate((r) => { const b=[...document.querySelectorAll("button")].find(e=>new RegExp(r,"i").test(e.textContent||"")); if(!b) return false; b.click(); return true }, re)
  if (!ok) { console.log("  NO ENCONTRE:", re); return }
  await p.waitForTimeout(esperar)
  await p.screenshot({ path: join(dir, file) })
  await p.keyboard.press("Escape"); await p.waitForTimeout(1500)
}
await abrir("Combos", "02-combos.png")
await abrir("Club", "03-club.png")
// canoa vacia
await p.evaluate(() => document.querySelector("[aria-label*='canoa' i]")?.click())
await p.waitForTimeout(3000)
await p.screenshot({ path: join(dir, "04-canoa-vacia.png") })
await p.keyboard.press("Escape"); await p.waitForTimeout(1500)
// mi cuenta
await p.evaluate(() => document.querySelector("[aria-label*='cuenta' i]")?.click())
await p.waitForTimeout(3500)
await p.screenshot({ path: join(dir, "05-cuenta.png") })
console.log("  errores de red o pagina:", errores.length ? errores.slice(0,6) : "ninguno")
await b.close()
