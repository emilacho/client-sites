import { chromium } from "playwright"
const URL = (process.env.SITIO ?? "http://localhost:3128/") + "?login=1"
const b = await chromium.launch()
const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
const errores = []
pg.on("pageerror", (e) => errores.push(String(e)))
await pg.goto(URL, { waitUntil: "networkidle", timeout: 120000 })
await pg.waitForTimeout(2500)
// abrir "Mi cuenta"
const btn = pg.locator("[aria-label=\"Mi cuenta\"]").first()
try { await btn.click({ timeout: 8000 }) } catch { /* ya abierto por ?login=1 */ }
await pg.waitForTimeout(1800)
const txt = (await pg.locator("body").innerText()).replace(/\s+/g, " ")
console.log("  dice 10% de cada pedido :", /10% de cada pedido/.test(txt))
console.log("  dice direccion guardada :", /direcci.n queda guardada/i.test(txt))
console.log("  dice repetir pedido     :", /Repet.s cualquier pedido/i.test(txt))
console.log("  sigue el acceso sin pass:", /sin password/i.test(txt))
console.log("  errores de pagina       :", errores.length)
await pg.screenshot({ path: "scripts/out-cuenta.png" })
await b.close()
