import { chromium } from "playwright"
const b = await chromium.launch()
const rx = /\S*(ped\u00eds|us\u00e1s|gan\u00e1s|ten\u00e9s|pod\u00e9s|quer\u00e9s|sab\u00e9s|eleg\u00eds|confirm\u00e1s|recib\u00eds|escribinos|abrilo|prob\u00e1 |sin password|por email)\S*/gi
for (const ruta of ["/", "/faq", "/privacidad", "/mi-cuenta"]) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  await pg.goto("https://naufrago.ec" + ruta, { waitUntil: "networkidle", timeout: 120000 })
  await pg.waitForTimeout(2000)
  const t = (await pg.locator("body").innerText()).replace(/\s+/g, " ")
  const hits = [...new Set(t.match(rx) ?? [])]
  console.log("  " + ruta.padEnd(13), hits.length ? "ARGENTINO: " + hits.join(" | ") : "limpio")
  await pg.close()
}
await b.close()
