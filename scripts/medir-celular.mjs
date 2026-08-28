import { chromium, devices } from "playwright"
const URL = process.env.SITIO ?? "https://naufrago.ec/"
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices["Pixel 5"] })
const pg = await ctx.newPage()

// Conexion movil real de Ecuador · 4G modesto, no fibra de escritorio
const cdp = await ctx.newCDPSession(pg)
await cdp.send("Network.enable")
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  downloadThroughput: (4 * 1024 * 1024) / 8,   // 4 Mbps
  uploadThroughput: (1 * 1024 * 1024) / 8,
  latency: 150,                                 // 150 ms
})
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })  // celular de gama media

const req = []
pg.on("response", async (r) => {
  try {
    const h = r.headers()
    const n = Number(h["content-length"] ?? 0)
    req.push({ url: r.url(), kb: n / 1024, tipo: (h["content-type"] ?? "").split(";")[0] })
  } catch {}
})

const t0 = Date.now()
await pg.goto(URL, { waitUntil: "domcontentloaded", timeout: 180000 })
const tDom = Date.now() - t0
let tPintado = null
try {
  tPintado = await pg.evaluate(() => {
    const e = performance.getEntriesByName("first-contentful-paint")[0]
    return e ? Math.round(e.startTime) : null
  })
} catch {}
try { await pg.waitForLoadState("networkidle", { timeout: 120000 }) } catch {}
const tTodo = Date.now() - t0

const total = req.reduce((s, r) => s + r.kb, 0)
console.log("\n  === CARGA EN CELULAR · 4G · procesador de gama media ===")
console.log("  primer contenido en pantalla :", tPintado ?? "?", "ms")
console.log("  pagina utilizable (DOM)      :", tDom, "ms")
console.log("  todo terminado de cargar     :", tTodo, "ms  (" + (tTodo/1000).toFixed(1) + " s)")
console.log("  peso descargado              :", Math.round(total), "KB   ·", req.length, "archivos")

const porTipo = {}
for (const r of req) porTipo[r.tipo || "?"] = (porTipo[r.tipo || "?"] ?? 0) + r.kb
console.log("\n  --- por tipo ---")
for (const [k, v] of Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,6))
  console.log("   ", String(Math.round(v)).padStart(6), "KB ", k)

console.log("\n  --- los 8 archivos mas pesados ---")
for (const r of req.sort((a,b)=>b.kb-a.kb).slice(0,8))
  console.log("   ", String(Math.round(r.kb)).padStart(6), "KB ", r.url.split("/").slice(-1)[0].slice(0,58))
await b.close()
