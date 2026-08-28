import { chromium } from "playwright"
import { resolve, join } from "node:path"
const dir = resolve("tmp/carta")
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("http://localhost:3113/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
const clic = (r) => p.evaluate((rr) => { const b=[...document.querySelectorAll("button")].find(e=>new RegExp(rr,"i").test(e.textContent||"")); b?.click(); return !!b }, r)
await clic("^MEN"); await p.waitForTimeout(4000)
const estado = async (etiqueta) => {
  await p.waitForTimeout(3500)
  const r = await p.evaluate(() => [...document.querySelectorAll("img")].map(i => ({
    src: i.currentSrc.split("url=")[1]?.split("&")[0] ?? i.currentSrc.slice(-40),
    ancho: i.naturalWidth, alto: i.getBoundingClientRect().height, completo: i.complete,
  })))
  console.log(etiqueta, JSON.stringify(r, null, 0))
}
await estado("ENCEBOLLADOS:")
await clic("Ceviches"); await estado("CEVICHES:")
await p.screenshot({ path: join(dir, "02b-ceviches.png") })
await clic("Bebidas"); await estado("BEBIDAS:")
await p.screenshot({ path: join(dir, "03b-bebidas.png") })
await b.close()
