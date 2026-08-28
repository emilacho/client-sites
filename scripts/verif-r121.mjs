import { chromium } from "playwright"
const BASE = process.env.SITIO ?? "http://localhost:3131"
const b = await chromium.launch()
const voseo = /\S*(ped\u00eds|us\u00e1s|gan\u00e1s|ten\u00e9s|pod\u00e9s|quer\u00e9s|eleg\u00eds|pag\u00e1s|ahorr\u00e1s|atend\u00e9s|acept\u00e1s|encontr\u00e1s|necesit\u00e1s|prefer\u00eds|busc\u00e1s|registr\u00e1s|escribinos|abrilo)\S*/gi
const errores = []
for (const ruta of ["/", "/faq", "/privacidad", "/mi-cuenta"]) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  pg.on("pageerror", (e) => errores.push(ruta + ": " + e))
  await pg.goto(BASE + ruta, { waitUntil: "networkidle", timeout: 120000 })
  await pg.waitForTimeout(2000)
  if (ruta === "/faq") {
    const n = await pg.locator("summary, [role=button]").count()
    for (let i = 0; i < n; i++) {
      try { await pg.locator("summary, [role=button]").nth(i).click({ timeout: 2500 }) } catch {}
    }
    await pg.waitForTimeout(900)
  }
  const t = (await pg.locator("body").innerText()).replace(/\s+/g, " ")
  const hits = [...new Set(t.match(voseo) ?? [])]
  const perlas = /\bperlas?\b/i.test(t)
  console.log("  " + ruta.padEnd(12),
    "argentino:", hits.length ? hits.join("|") : "no",
    "· dice 'perlas':", perlas)
  if (ruta === "/faq") {
    console.log("     horario unico 11:00-22:00 :", /11:00 a 22:00/.test(t))
    console.log("     sin horario viejo 9AM-5PM :", !/9:00 AM|5:00 PM/.test(t))
    console.log("     tesoro al 4%              :", /4% del total en tesoro/.test(t))
    console.log("     zona sin radio inventado  :", !/15 km/.test(t) && /Guayaquil/.test(t))
    console.log("     sin Kushki                :", !/Kushki/i.test(t))
  }
  await pg.close()
}
console.log("  errores de pagina:", errores.length, errores.join(" ; ").slice(0, 200))
await b.close()
