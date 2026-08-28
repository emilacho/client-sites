import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const BASE = "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("tmp/landing-2026-08-24"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
p.on("console", (m) => { if (m.type() === "error") console.log("ERR-CONSOLA:", m.text().slice(0, 140)) })
p.on("pageerror", (e) => console.log("EXCEPCION:", String(e).slice(0, 160)))
await p.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(5000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1000)   // cookies
await p.mouse.click(112, 108); await p.waitForTimeout(4000)    // MENÚ

const agregar = p.getByRole("button", { name: /^\+ Agregar$/ }).first()
console.log("botones '+ Agregar' visibles:", await p.getByRole("button", { name: /^\+ Agregar$/ }).count())
await agregar.click({ force: true })
await p.waitForTimeout(2500)
const pie = await p.evaluate(() => {
  const t = document.body.innerText
  const m = t.match(/TU PEDIDO\s*\n?\s*([^\n]+)/i)
  return { pie: m ? m[1] : "no encontrado", ls: Object.keys(localStorage).filter(k=>/cart|canoa|pedido/i.test(k)).map(k=>[k, (localStorage.getItem(k)||"").slice(0,120)]) }
})
console.log("PIE DEL MENU:", pie.pie)
console.log("GUARDADO LOCAL:", JSON.stringify(pie.ls))
await p.screenshot({ path: join(dir, "12-tras-agregar.png") })
await b.close()
