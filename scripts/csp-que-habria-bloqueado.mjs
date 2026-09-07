/**
 * ¿Qué habría bloqueado la lista de sitios permitidos? · R165.1
 *
 * En vez de dejar la lista en observación unos días y esperar a que los
 * clientes reales tropiecen con lo que falte, se recorre el sitio acá y
 * se anota todo lo que el navegador habría bloqueado.
 *
 * DOS CONTROLES PARA QUE EL "CERO" SIGNIFIQUE ALGO
 *
 * 1 · Se cuentan los dominios ajenos que se pidieron de verdad. Un
 *     recorrido que no carga nada también da cero avisos · si el mapa
 *     de Google no aparece en esa cuenta, el cero no probó lo riesgoso.
 *
 * 2 · Se adelanta el reloj del navegador a un lunes a las 10 de la
 *     mañana. Fuera del horario de cocina el sitio bloquea el paso de
 *     la dirección, que es justo donde vive el mapa.
 *
 * Uso · node scripts/csp-que-habria-bloqueado.mjs [url]
 */
import { chromium } from "playwright"

const BASE = process.argv[2] ?? "https://naufrago.ec"
const avisos = new Map()
const dominios = new Map()

function anotar(v, donde) {
  if (/^(chrome|moz|safari|webkit)-/.test(v.blockedURI ?? "")) return
  let origen = v.blockedURI || "(en linea)"
  try {
    origen = new URL(origen).origin
  } catch {
    /* "inline", "eval" · no son direcciones */
  }
  const clave = `${v.effectiveDirective} <- ${origen}`
  if (!avisos.has(clave)) avisos.set(clave, new Set())
  avisos.get(clave).add(donde)
}

const run = async () => {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  })
  const page = await ctx.newPage()

  page.on("request", (r) => {
    try {
      const h = new URL(r.url()).host
      if (h && h !== "naufrago.ec") dominios.set(h, (dominios.get(h) ?? 0) + 1)
    } catch {
      /* direcciones raras */
    }
  })

  let donde = "portada"
  await page.exposeFunction("__cspAviso", (v) => anotar(v, donde))
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspAviso?.({
        blockedURI: e.blockedURI,
        effectiveDirective: e.effectiveDirective || e.violatedDirective,
      })
    })
  })

  // El reloj se corre, no se congela · el tiempo sigue avanzando desde
  // ese momento, así nada que espere un intervalo se cuelga.
  await page.addInitScript(() => {
    const FINGIDO = new Date("2026-09-07T15:00:00Z").getTime()
    const Original = Date
    const desvio = FINGIDO - Original.now()
    class Fingida extends Original {
      constructor(...args) {
        if (args.length === 0) super(Original.now() + desvio)
        else super(...args)
      }
      static now() {
        return Original.now() + desvio
      }
    }
    window.Date = Fingida
  })

  const esperar = (ms) => page.waitForTimeout(ms)
  const clic = async (sel, ms = 2500) => {
    const b = page.locator(sel).first()
    if (!(await b.isVisible().catch(() => false))) return false
    await b.click({ timeout: 5000 }).catch(() => {})
    await esperar(ms)
    return true
  }
  const verBotones = async (etapa) => {
    const nombres = await page
      .locator("button:visible")
      .evaluateAll((els) =>
        els
          .map((e) => (e.textContent || "").trim().replace(/\s+/g, " "))
          .filter((t) => t && t.length < 30)
          .slice(0, 12),
      )
    console.log(`   [${etapa}] ${nombres.join(" | ")}`)
  }

  console.log(`- portada ${BASE}`)
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
  await esperar(6000)
  await clic('button:has-text("Aceptar")', 1200) // cartel de privacidad

  donde = "carta"
  console.log("- carta")
  await clic('button:has-text("MEN")', 3500)

  donde = "carrito"
  console.log("- carrito")
  await clic('button:has-text("Agregar")', 2500)
  await verBotones("tras agregar")

  donde = "direccion-mapa"
  console.log("- carrito abierto + direccion")
  // El carrito se llama "Canoa de compras" · no "carrito" ni un icono.
  // Buscarlo por la palabra esperada era el error: en este sitio las
  // cosas tienen nombre de barco.
  await clic('button:has-text("Canoa")', 3000)
  await verBotones("canoa abierta")

  // Avanzar hasta donde aparece el mapa.
  for (const t of ["Continuar", "Pedir", "Confirmar", "Entrega", "Direcci"]) {
    if (await clic(`button:has-text("${t}")`, 3000)) await verBotones(t)
  }
  await esperar(5000)
  await page.screenshot({ path: "scripts/out-csp-final.png" })

  await browser.close()

  console.log("")
  console.log("=== Dominios ajenos que el recorrido pidio de verdad ===")
  if (dominios.size === 0) {
    console.log("  NINGUNO · el recorrido no cargo nada · el cero de abajo NO vale")
  } else {
    for (const [h, n] of [...dominios].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)} x ${h}`)
    }
  }
  const conMapa = [...dominios.keys()].some((h) => h.includes("googleapis"))
  console.log(
    conMapa
      ? "  -> el mapa de Google SI se cargo · la parte riesgosa quedo probada"
      : "  -> OJO: el mapa de Google NO se cargo · falta probar la parte riesgosa",
  )

  console.log("")
  console.log("=== Lo que la lista HABRIA bloqueado ===")
  if (avisos.size === 0) {
    console.log("  Nada de lo que se recorrio.")
  } else {
    for (const [clave, lugares] of [...avisos].sort()) {
      console.log(`  ${clave}   ·   ${[...lugares].join(", ")}`)
    }
  }
}

run().catch((e) => {
  console.error("fallo:", e.message)
  process.exit(1)
})
