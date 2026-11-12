// Capturas y medidas de la tarjeta «Fotos del menú» (StoriesModal) · CC4 12-nov
// uso: node scripts/capturar-tarjetas.mjs <base-url> <carpeta-salida> <etiqueta>
import { chromium } from "playwright"
import { mkdirSync, writeFileSync } from "node:fs"

const [base, out, etiqueta] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1440, height: 900 }, movil: false },
  { nombre: "celular-375x667", viewport: { width: 375, height: 667 }, movil: true },
  { nombre: "celular-390x844", viewport: { width: 390, height: 844 }, movil: true },
]
// 0 = texto más largo (con advertencia) · 2 = más corto · 5 = jugo (el que pide elegir sabor)
const FOTOS = { 0: "texto-largo", 2: "texto-corto", 5: "jugo" }
const medidas = []
const b = await chromium.launch()
for (const v of VISTAS) {
  const ctx = await b.newContext({ viewport: v.viewport, isMobile: v.movil, hasTouch: v.movil })
  const p = await ctx.newPage()
  await p.goto(base, { waitUntil: "networkidle", timeout: 120000 })
  await p.waitForTimeout(2500)
  await p.locator('button:has-text("Aceptar")').first().click({ timeout: 3000 }).catch(() => {})
  await p.locator('[aria-label="Fotos del menú"]').first().click()
  await p.waitForTimeout(1500)
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(900)
    const m = await p.evaluate(() => {
      const caja = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), abajo: Math.round(r.bottom) } }
      const sig = document.querySelector('[aria-label="Foto siguiente"]')
      const cta = [...document.querySelectorAll("button")].find((x) => /Canoa|sabor/.test(x.textContent || ""))
      const tarjeta = sig?.closest(".rounded-3xl")
      return { alto_pantalla: innerHeight, tarjeta: caja(tarjeta), siguiente: caja(sig), agregar: caja(cta) }
    })
    medidas.push({ etiqueta, vista: v.nombre, plato: i, ...m,
      siguiente_visible_sin_scroll: m.siguiente ? m.siguiente.abajo <= m.alto_pantalla : false,
      agregar_visible_sin_scroll: m.agregar ? m.agregar.abajo <= m.alto_pantalla : false })
    if (FOTOS[i]) await p.screenshot({ path: `${out}/${etiqueta}-${v.nombre}-${FOTOS[i]}.png` })
    if (i < 5) await p.locator('[aria-label="Foto siguiente"]').click()
  }
  await ctx.close()
}
await b.close()
writeFileSync(`${out}/${etiqueta}-medidas.json`, JSON.stringify(medidas, null, 2))
for (const m of medidas) console.log(m.vista, m.plato, "tarjeta", m.tarjeta?.h, "siguiente.y", m.siguiente?.y, "agregar.y", m.agregar?.y, "sig visible", m.siguiente_visible_sin_scroll, "agr visible", m.agregar_visible_sin_scroll)
