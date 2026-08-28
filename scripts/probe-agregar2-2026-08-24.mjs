import { chromium } from "playwright"
import { resolve, join } from "node:path"
const BASE = "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("tmp/landing-2026-08-24")
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
p.on("pageerror", (e) => console.log("EXCEPCION:", String(e).slice(0, 160)))
await p.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(5000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1000)
await p.mouse.click(112, 108); await p.waitForTimeout(4000)

const pie = () => p.evaluate(() => { const m = document.body.innerText.match(/TU PEDIDO\s*\n?\s*([^\n]+)/i); return m ? m[1] : "?" })
console.log("antes:", await pie())

// 1) clic programático directo sobre el handler de React
const r1 = await p.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].filter(e => (e.textContent||"").trim() === "+ Agregar")
  if (!btns.length) return "sin botones"
  const el = btns[0]; const r = el.getBoundingClientRect()
  el.click()
  return `clic programático en (${Math.round(r.x+r.width/2)},${Math.round(r.y+r.height/2)}) · aria-hidden ancestro: ${!!el.closest("[aria-hidden='true']")} · inert: ${!!el.closest("[inert]")}`
})
console.log(r1)
await p.waitForTimeout(2500)
console.log("después del clic programático:", await pie())

// 2) clic real de ratón sobre las coordenadas exactas
const c = await p.evaluate(() => {
  const el = [...document.querySelectorAll("button")].find(e => (e.textContent||"").trim() === "+ Agregar")
  const r = el.getBoundingClientRect(); return { x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2),
    encima: (document.elementFromPoint(r.x+r.width/2, r.y+r.height/2)||{}).tagName }
})
console.log("coords:", JSON.stringify(c))
await p.mouse.click(c.x, c.y); await p.waitForTimeout(2500)
console.log("después del clic de ratón:", await pie())
await p.screenshot({ path: join(dir, "12-tras-agregar.png") })
await b.close()
