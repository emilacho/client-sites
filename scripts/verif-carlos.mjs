import { chromium } from "playwright"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const urls = new Set()
p.on("response", (r) => { if (/\.js(\?|$)/.test(r.url())) urls.add(r.url()) })
await p.goto("https://client-sites-template-7ppcbf8ix-zero-risk1.vercel.app/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(15000)   // que cargue la escena 3D
console.log("archivos js cargados:", urls.size)
const hits = await p.evaluate(async (lista) => {
  const out = []
  for (const u of lista) {
    try { const t = await (await fetch(u)).text()
      if (t.includes("calientito")) out.push(["calientito", u.split("/").pop()])
      if (t.includes("Carlos M")) out.push(["Carlos M", u.split("/").pop()])
      if (/Patacones perfectos/.test(t)) out.push(["PATACONES-VIEJO", u.split("/").pop()])
    } catch {}
  }
  return out
}, [...urls])
console.log(JSON.stringify(hits))
await b.close()
