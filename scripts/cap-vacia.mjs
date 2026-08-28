import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/fricciones"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage()
await p.goto("http://localhost:3126/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.evaluate(() => document.querySelector("[aria-label*='canoa' i]")?.click())
await p.waitForTimeout(3000)
await p.screenshot({ path: join(dir, "10-vacia-nueva.png") })
// ¿el boton abre la carta?
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Ver el menú/i.test(e.textContent||""))?.click())
await p.waitForTimeout(4000)
const abrio = await p.evaluate(() => /CREA TU PEDIDO/i.test(document.body.innerText))
console.log("  el boton abre la carta:", abrio)
await p.screenshot({ path: join(dir, "11-abrio-carta.png") })
// combos
await p.keyboard.press("Escape"); await p.waitForTimeout(1500)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Combos/i.test(e.textContent||""))?.click())
await p.waitForTimeout(3500)
const txt = await p.evaluate(() => (document.body.innerText.match(/\d+ combos curados/)||["?"])[0])
console.log("  combos dice:", txt)
await b.close()
