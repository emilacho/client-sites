import { chromium } from "playwright"
import { writeFileSync } from "node:fs"
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] })
const ctx = await b.newContext({ viewport: { width: 860, height: 1864 } })
const pg = await ctx.newPage()
await pg.goto("https://naufrago.ec/", { waitUntil: "domcontentloaded", timeout: 240000 })
try { await pg.locator("text=/ACEPTAR/i").first().click({ timeout: 12000 }) } catch {}
await pg.mouse.click(430, 1400)                       // dispara el montaje de la escena
try { await pg.waitForLoadState("networkidle", { timeout: 240000 }) } catch {}
await pg.waitForTimeout(10000)                        // que termine de acomodarse

// Ocultamos TODA la interfaz y dejamos solo el lienzo 3D
const ok = await pg.evaluate(() => {
  const c = document.querySelector("canvas")
  if (!c) return false
  const conservar = new Set()
  for (let e = c; e; e = e.parentElement) conservar.add(e)
  document.querySelectorAll("body *").forEach((e) => {
    if (!conservar.has(e) && !e.contains(c)) e.style.visibility = "hidden"
  })
  return true
})
console.log("  lienzo aislado:", ok)
await pg.waitForTimeout(1500)
// Captura por el protocolo del navegador · no espera a que la animacion pare
const cdp = await ctx.newCDPSession(pg)
const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
writeFileSync("scripts/isla-cruda.png", Buffer.from(data, "base64"))
console.log("  captura guardada")
await b.close()
