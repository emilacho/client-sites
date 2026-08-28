import { chromium } from "playwright"
const BASE = process.env.SITIO ?? "http://localhost:3133"
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const err = []
pg.on("pageerror", (e) => err.push(String(e)))
await pg.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 })
await pg.waitForTimeout(2500)
// el aviso de cookies tapa la pantalla en la primera visita
try { await pg.locator("text=/ACEPTAR/i").first().click({ timeout: 6000 }); await pg.waitForTimeout(700) } catch {}
// Los botones de la isla flotan sin parar, asi que el clic normal de Playwright
// nunca los ve "quietos" y expira. dispatchEvent no espera a que se detengan.
let abierto = false
try {
  await pg.locator('[aria-label="Suscripción Náufrago Club"]').first().dispatchEvent("click")
  abierto = true
} catch {}
await pg.waitForTimeout(1500)
const t = (await pg.locator("body").innerText()).replace(/\s+/g, " ")
console.log("  se abrio el club        :", abierto)
console.log("  precio $4.99            :", /\$4\.99/.test(t), "· ya no dice $9.99:", !/\$9\.99/.test(t))
console.log("  jugo con tope de 4      :", /hasta 4 al mes/i.test(t))
console.log("  tesoro al 8% vs 4%      :", /8% de cada pedido en vez del 4%/.test(t))
console.log("  sin envio gratis        :", !/[Ee]nv.o gratis/.test(t))
console.log("  sin prioridad en cocina :", !/[Pp]rioridad en cocina/.test(t))
console.log("  sin interpolacion cruda :", !/\$\{/.test(t))
console.log("  errores de pagina       :", err.length)
await pg.screenshot({ path: "scripts/out-club.png" })
await b.close()
