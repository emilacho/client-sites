import { chromium } from "playwright"
import { resolve, join } from "node:path"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(8000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1200)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(7000)
const r = await p.evaluate(() => [...document.querySelectorAll("img")].map(i => ({
  foto: decodeURIComponent(i.currentSrc.split("url=")[1]?.split("&")[0] ?? ""),
  ancho: i.naturalWidth, completo: i.complete })))
console.log(JSON.stringify(r))
await p.screenshot({ path: resolve("tmp/carta-vivo/e-junior.png") })
await b.close()
