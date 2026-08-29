/**
 * Medición honesta del peso en celular · R126.
 *
 * `scripts/medir-celular.mjs` sumaba sólo el `content-length` que declara
 * el servidor · el código comprimido de Vercel no lo declara. Y
 * `performance.transferSize` devuelve 0 para todo lo que viene de otro
 * dominio (Supabase no manda Timing-Allow-Origin) · o sea que se comía
 * los modelos 3D, justo lo que importa medir.
 *
 * Acá se cuenta cada archivo por lo más confiable que haya: el peso real
 * del cuerpo de la respuesta.
 *
 * Correr · node scripts/medir-celular-total.mjs
 * Env · SITIO (por defecto https://naufrago.ec/)
 */
import { chromium, devices } from "playwright"

const SITIO = process.env.SITIO ?? "https://naufrago.ec/"
const b = await chromium.launch()
const ESCRITORIO = process.env.ESCRITORIO === "1"
const ctx = await b.newContext(
  ESCRITORIO ? { viewport: { width: 1440, height: 900 } } : { ...devices["Pixel 5"] },
)
const pg = await ctx.newPage()
const cdp = await ctx.newCDPSession(pg)
await cdp.send("Network.enable")
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  downloadThroughput: (4 * 1024 * 1024) / 8, // 4G modesto de Ecuador
  uploadThroughput: (1024 * 1024) / 8,
  latency: 150,
})
await cdp.send("Emulation.setCPUThrottlingRate", { rate: ESCRITORIO ? 1 : 4 }) // gama media

const pesos = new Map()
cdp.on("Network.loadingFinished", (e) => pesos.set(e.requestId, e.encodedDataLength))
const urls = new Map()
cdp.on("Network.responseReceived", (e) => urls.set(e.requestId, e.response.url))

const t0 = Date.now()
await pg.goto(SITIO, { waitUntil: "domcontentloaded", timeout: 180000 })
const tDom = Date.now() - t0
const tPintado = await pg
  .evaluate(() => {
    const e = performance.getEntriesByName("first-contentful-paint")[0]
    return e ? Math.round(e.startTime) : null
  })
  .catch(() => null)

// La isla se monta al primer toque o a los 800 ms · damos el toque y
// esperamos a que TODO baje, modelos incluidos.
await pg.mouse.move(200, 400)
// Esperar de verdad a la isla · el `networkidle` solo llega antes de que
// la escena arranque y daría un número lindo y falso.
let tIsla = null
try {
  await pg.waitForSelector("canvas", { timeout: 120000 })
  tIsla = Date.now() - t0
} catch {}
try {
  await pg.waitForLoadState("networkidle", { timeout: 180000 })
} catch {}
const tTodo = Date.now() - t0
// Ocho segundos más SOLO para que entren los rezagados en la cuenta de
// bytes · no se suman al tiempo que se reporta.
await pg.waitForTimeout(8000)

const hayIsla = await pg.evaluate(() => {
  const c = document.querySelector("canvas")
  if (!c) return false
  const gl = c.getContext("webgl2") ?? c.getContext("webgl")
  return !!gl && !gl.isContextLost()
})

const filas = []
for (const [id, bytes] of pesos) filas.push({ url: urls.get(id) ?? "?", bytes })
const total = filas.reduce((s, f) => s + f.bytes, 0)

console.log(
  "\n  === CARGA · " +
    (ESCRITORIO ? "COMPUTADORA" : "CELULAR · procesador de gama media") +
    " · 4G ===",
)
console.log("  sitio                        :", SITIO)
console.log("  primer contenido en pantalla :", tPintado, "ms")
console.log("  página utilizable (DOM)      :", tDom, "ms")
console.log("  isla en pantalla             :", tIsla, "ms")
console.log("  todo terminado de cargar     :", tTodo, "ms  (" + (tTodo / 1000).toFixed(1) + " s)")
console.log("  peso descargado              :", (total / 1048576).toFixed(2), "MB ·", filas.length, "archivos")
console.log("  isla 3D viva                 :", hayIsla ? "sí" : "NO")

console.log("\n  --- los 10 archivos más pesados ---")
for (const f of filas.sort((a, b) => b.bytes - a.bytes).slice(0, 10))
  console.log("   ", String(Math.round(f.bytes / 1024)).padStart(6), "KB ", f.url.split("/").pop().split("?")[0].slice(0, 52))
await b.close()
