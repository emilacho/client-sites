import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/horario"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
await p.goto("https://naufrago.ec/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Reservar\s*hora/i.test(e.textContent||""))?.click())
await p.waitForTimeout(4000)
await p.screenshot({ path: join(dir, "escritorio.png") })
const t = await p.evaluate(() => { const h=[...document.querySelectorAll("h2")].find(x=>/ELIGE/i.test(x.textContent||"")); return h ? h.parentElement.innerText.replace(/\n+/g,' | ') : "(no abrio)" })
console.log(" ", t.slice(0,220))
await b.close()
