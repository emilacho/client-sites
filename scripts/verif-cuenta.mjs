import { chromium } from "playwright"
const URL = (process.env.SITIO ?? "http://localhost:3129/") + "?login=1"
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
console.log("  titulo tesoro de naufrago:", /acumula tesoro de n.ufrago/i.test(txt))
console.log("  dice 4% (no 10%)        :", /4% de cada pedido/.test(txt) && !/10% de cada/.test(txt))
console.log("  frase de la direccion   :", /Guarda tu direcci.n y pide con un solo toque/i.test(txt))
console.log("  repetir pedido          :", /Repite cualquier pedido anterior/i.test(txt))
console.log("  cero voseo en pantalla  :", !/(ped\u00eds|us\u00e1s|gan\u00e1s|ten\u00e9s|pod\u00e9s|quer\u00e9s|escribinos|abrilo)/i.test(txt))
console.log("  errores de pagina       :", errores.length)
await pg.screenshot({ path: "scripts/out-cuenta.png" })
await b.close()
