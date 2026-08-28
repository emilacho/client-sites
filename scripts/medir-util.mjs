import { chromium, devices } from "playwright"
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices["Pixel 5"] })
const pg = await ctx.newPage()
const cdp = await ctx.newCDPSession(pg)
await cdp.send("Network.enable")
await cdp.send("Network.emulateNetworkConditions", {
  offline: false, downloadThroughput: (4*1024*1024)/8, uploadThroughput: (1024*1024)/8, latency: 150,
})
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
const t0 = Date.now()
await pg.goto("https://naufrago.ec/", { waitUntil: "domcontentloaded", timeout: 180000 })
// ¿Cuándo puede el cliente abrir la carta y ver un plato?
let tMenu = null, tPlato = null
try {
  await pg.locator('[aria-label="Fotos del menú"]').first().waitFor({ state: "visible", timeout: 120000 })
  tMenu = Date.now() - t0
  await pg.locator('[aria-label="Fotos del menú"]').first().dispatchEvent("click")
  await pg.locator("text=/Encebollado/i").first().waitFor({ state: "visible", timeout: 120000 })
  tPlato = Date.now() - t0
} catch (e) { console.log("  no se pudo:", String(e).slice(0,110)) }
console.log("\n  === LO QUE DE VERDAD IMPORTA ===")
console.log("  se ve el boton del menu   :", tMenu, "ms  (" + (tMenu/1000).toFixed(1) + " s)")
console.log("  se ve un plato en la carta:", tPlato, "ms  (" + (tPlato/1000).toFixed(1) + " s)")
await b.close()
