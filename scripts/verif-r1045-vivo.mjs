import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/r1045"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
const t = await p.evaluate(() => document.body.innerText)
console.log("¿'patacon' en la portada?:", /patacon/i.test(t))
console.log("subtítulo:", (t.match(/Encebollados[^\n]*/)||["(no visible)"])[0].slice(0,90))
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(6000)
const sug = await p.evaluate(() => {
  const sec = [...document.querySelectorAll("section")].find(s=>/SUGERIDOS|más pedidos/i.test(s.textContent||""))
  return sec ? [...sec.querySelectorAll("button")].map(b=>(b.textContent||"").split("$")[0].trim()).filter(Boolean) : []
})
console.log("SUGERIDOS:", sug.length, "·", JSON.stringify(sug))
await p.screenshot({ path: join(dir, "carta.png") })
await b.close()
