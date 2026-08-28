import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/fotos-vivo"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
p.on("pageerror", e => console.log("EXC:", String(e).slice(0,120)))
await p.goto("https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
const r = await p.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find(e=>/Fotos/i.test(e.textContent||""))
  if (!b) return "no está el botón"
  b.click(); return "clic dado"
})
console.log(r)
await p.waitForTimeout(4000)
for (let i = 1; i <= 5; i++) {
  const nom = await p.evaluate(() => {
    const h = [...document.querySelectorAll("h1,h2,h3")].map(x=>x.textContent.trim()).filter(Boolean)
    return h.join(" | ").slice(0,60)
  })
  await p.screenshot({ path: join(dir, `slide-${i}.png`) })
  console.log("slide", i, "·", nom)
  await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>(e.getAttribute("aria-label")||"")==="Siguiente")?.click())
  await p.waitForTimeout(2200)
}
await b.close()
