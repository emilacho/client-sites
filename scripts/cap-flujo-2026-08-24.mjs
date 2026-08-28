import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"

const BASE = "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("tmp/landing-2026-08-24")
mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
const shot = (n) => p.screenshot({ path: join(dir, n) })

await p.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(4000)
// aceptar cookies
try { await p.getByRole("button", { name: /aceptar/i }).click({ timeout: 5000 }); await p.waitForTimeout(800) } catch { console.log("sin banner") }

const clic = async (nombre, archivo, espera = 2500) => {
  try {
    await p.getByText(nombre, { exact: false }).first().click({ timeout: 8000 })
    await p.waitForTimeout(espera)
    await shot(archivo)
    console.log("OK ·", nombre, "→", archivo)
  } catch (e) { console.log("FALLO ·", nombre, "·", String(e).split("\n")[0].slice(0, 110)) }
}
const cerrar = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(1200) }

await clic("MENÚ", "10-menu.png", 3500)
// intentar agregar el primer plato
try {
  const btn = p.getByRole("button", { name: /agregar|sumar|añadir/i }).first()
  await btn.click({ timeout: 6000 }); await p.waitForTimeout(2500); await shot("11-menu-agregado.png")
  console.log("OK · agregó plato")
} catch (e) { console.log("FALLO agregar ·", String(e).split("\n")[0].slice(0,110)) }
await cerrar()

await clic("Fotos del menú", "12-fotos.png", 3500); await cerrar()
await clic("Combos Náufrago", "13-combos.png", 3000); await cerrar()
await clic("Reservar hora", "14-reservar.png", 2500); await cerrar()
await clic("Náufrago Club", "15-club.png", 2500); await cerrar()

// abrir la canoa (carrito)
try {
  await p.locator("header button, [aria-label*='carr' i], [aria-label*='canoa' i]").last().click({ timeout: 6000 })
  await p.waitForTimeout(2500); await shot("20-canoa.png"); console.log("OK · canoa")
} catch (e) { console.log("FALLO canoa ·", String(e).split("\n")[0].slice(0,110)) }
// intentar llegar al pago
await clic("pagar", "21-pago.png", 3000)
await clic("finalizar", "22-pago2.png", 3000)

await b.close()
console.log("listo")
