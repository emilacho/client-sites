import { chromium } from "playwright"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const urls = new Set()
p.on("response", (r) => { if (/\.js(\?|$)/.test(r.url())) urls.add(r.url()) })
await p.goto("https://client-sites-template-7ppcbf8ix-zero-risk1.vercel.app/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(15000)
await b.close()
console.log("js cargados:", urls.size)
for (const u of urls) {
  try {
    const t = await (await fetch(u)).text()
    const marcas = []
    if (t.includes("calientito")) marcas.push("CALIENTITO")
    if (t.includes("Carlos M")) marcas.push("Carlos M")
    if (t.includes("Patacones perfectos")) marcas.push("PATACONES-VIEJO")
    if (t.includes("Coconut_10_43")) marcas.push("coco-de-carlos")
    if (marcas.length) console.log(marcas.join(" + "), "→", u.split("/").pop())
  } catch (e) { console.log("no se pudo leer", u.split("/").pop()) }
}
