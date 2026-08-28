import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/sin-patacones-vivo"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
const clic = (r) => p.evaluate((rr) => { const b=[...document.querySelectorAll("button")].find(e=>new RegExp(rr,"i").test(e.textContent||"")); b?.click(); return !!b }, r)
const texto = () => p.evaluate(() => document.body.innerText)

// 1 · el pase de fotos
await clic("Fotos"); await p.waitForTimeout(3500)
const platos = []
for (let i = 0; i < 8; i++) {
  const n = await p.evaluate(() => document.querySelector("h3")?.textContent?.trim())
  const cont = await p.evaluate(() => document.body.innerText.match(/(\d) DE (\d)/)?.[0])
  if (n && !platos.includes(n)) platos.push(n)
  if (cont && cont.startsWith(cont.slice(-1))) break
  await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>(e.getAttribute("aria-label")||"")==="Siguiente")?.click())
  await p.waitForTimeout(1500)
}
console.log("PASE:", platos.length, "·", platos.join(" | "))
await p.keyboard.press("Escape"); await p.waitForTimeout(1500)

// 2 · la carta
await clic("^MEN"); await p.waitForTimeout(5000)
const pest = await p.evaluate(() => [...document.querySelectorAll("button")].map(e=>(e.textContent||"").trim()).filter(t=>/^(Encebollados|Ceviches|Otros|Bebidas|Extras)\d?$/.test(t.replace(/\s/g,""))))
console.log("PESTAÑAS:", JSON.stringify(pest))
console.log("¿dice patacon en la carta?:", /patacon/i.test(await texto()))
await p.screenshot({ path: join(dir, "carta.png") })
await p.keyboard.press("Escape"); await p.waitForTimeout(1500)

// 3 · combos
await clic("Combos"); await p.waitForTimeout(3000)
const t3 = await texto()
console.log("COMBOS · ¿patacon?:", /patacon/i.test(t3), "· familia?:", /familia/i.test(t3))
await p.screenshot({ path: join(dir, "combos.png") })
await b.close()
