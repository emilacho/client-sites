#!/usr/bin/env node
/**
 * Visual audit del widget · 4 screenshots (Anclado · Zarpando · Navegando ·
 * Llegó) + inspección DOM de features clave.
 *
 * Flow ·
 *  1) Crear pedido test en naufrago.orders status=ACCEPTED + dropoff
 *     coords Zermatt + rider_info completo
 *  2) Playwright abre preview · setea localStorage con el order_code
 *  3) Screenshot stage 1 (Anclado)
 *  4) UPDATE status=PREPARING + ratchet rider_info · screenshot stage 2
 *  5) UPDATE IN_TRANSIT con rider_info posición media · screenshot stage 3
 *  6) UPDATE DELIVERED · screenshot stage 4
 *  7) Inspeccionar DOM por features · stages dots · canoa · microcopy ·
 *     rider card · order summary · timeline button · etc
 */
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const envText = fs.readFileSync(
  "C:/Users/emili/Documents/Claude/Projects/Agentic Business Agency/zero-risk-platform/.env.local",
  "utf8",
)
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "")
  }
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, db: { schema: "naufrago" } },
)

const PREVIEW_URL = "https://client-sites-template-ff2jwrrf9-zero-risk1.vercel.app"
const OUT_DIR = path.resolve(process.cwd(), ".tmp-canonical-audit", "widget-audit-screenshots")
fs.mkdirSync(OUT_DIR, { recursive: true })

// 1) Crear pedido test
const code = `NF-2026-AUD${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`
console.log(`Creando pedido test ${code}`)
const seed = await supa
  .from("orders")
  .insert({
    order_code: code,
    status: "ACCEPTED",
    customer_name: "Audit Bot",
    customer_phone: "593900000003",
    dropoff_address: "Vispastrasse 168, 3920 Zermatt, Suiza",
    dropoff_lat: 46.029179,
    dropoff_lng: 7.754809,
    dropoff_detail: "Edificio gris · piso 3",
    cart_lines: [
      { id: "encebollado-mixto", name: "Encebollado Mixto", qty: 1, priceUsd: 6 },
      { id: "cola-grande", name: "Cola grande · Coca-Cola", qty: 1, priceUsd: 2 },
    ],
    subtotal_usd: 8,
    delivery_fee_usd: 0,
    total_usd: 8,
    payment_method: "CARD_DEBIT",
    payment_status: "CAPTURED",
    payment_provider: "KUSHKI",
    delivery_provider: "PEDIDOSYA_COURIER",
    delivery_eta_minutes: 5,
    accepted_at: new Date(Date.now() - 60_000).toISOString(),
    rider_info: {
      name: "Marco",
      phone: "+593997744288",
      vehicleType: "MOTORCYCLE",
      plate: "VS-MOCK-001",
      rating: 4.8,
      tenure_months: 14,
    },
  })
  .select("id")
  .single()
if (seed.error) {
  console.error("seed failed", seed.error)
  process.exit(1)
}
const orderId = seed.data.id

// 2) Playwright
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
})
const page = await ctx.newPage()

// Capturar console logs del widget
page.on("console", (msg) => {
  const text = msg.text()
  if (text.includes("[widget]") || text.includes("[cart]")) {
    console.log("  ->", text)
  }
})

console.log("Loading preview")
await page.goto(PREVIEW_URL, { waitUntil: "domcontentloaded" })
await page.evaluate((c) => {
  window.localStorage.setItem("naufrago_active_order_code", c)
  window.dispatchEvent(
    new CustomEvent("naufrago:order-active", { detail: { orderCode: c } }),
  )
}, code)

async function shot(label, stage) {
  await page.waitForTimeout(2000) // settle
  // Screenshot full page + widget zone
  await page.screenshot({
    path: path.join(OUT_DIR, `${stage}-${label}-full.png`),
    clip: { x: 1280 - 520, y: 800 - 660, width: 510, height: 650 },
  })
  console.log(`  📸 ${label}`)
}

async function setStatus(status, extra = {}) {
  const patch = { status, ...extra }
  if (status === "PREPARING") patch.preparing_at = new Date().toISOString()
  if (status === "READY") patch.ready_at = new Date().toISOString()
  if (status === "IN_TRANSIT") {
    patch.rider_picked_up_at = new Date().toISOString()
    patch.in_transit_at = new Date().toISOString()
  }
  if (status === "DELIVERED") patch.delivered_at = new Date().toISOString()
  await supa.from("orders").update(patch).eq("order_code", code)
}

// Stage 1 · ACCEPTED · Anclado
console.log("Stage 1 · ACCEPTED")
await page.waitForTimeout(5500) // poll once
await shot("anclado", "1")

// Stage 2 · PREPARING · Zarpando
console.log("Stage 2 · PREPARING")
await setStatus("PREPARING")
await page.waitForTimeout(6000)
await shot("zarpando", "2")

// Stage 3 · IN_TRANSIT · Navegando (mid-route)
console.log("Stage 3 · IN_TRANSIT mid-route")
await setStatus("IN_TRANSIT", {
  delivery_substatus: "OUT_FOR_DELIVERY",
  rider_info: {
    name: "Marco",
    phone: "+593997744288",
    vehicleType: "MOTORCYCLE",
    plate: "VS-MOCK-001",
    rating: 4.8,
    tenure_months: 14,
    lat: 46.048,
    lng: 7.765,
    distance_remaining_m: 2400,
    total_distance_m: 4600,
    eta_min: 3,
  },
})
await page.waitForTimeout(6000)
await shot("navegando-mid", "3")

// Stage 3b · IN_TRANSIT · NEARING (500m)
console.log("Stage 3b · NEARING")
await supa
  .from("orders")
  .update({
    delivery_substatus: "NEARING_DESTINATION",
    rider_info: {
      name: "Marco",
      phone: "+593997744288",
      vehicleType: "MOTORCYCLE",
      plate: "VS-MOCK-001",
      rating: 4.8,
      tenure_months: 14,
      lat: 46.033,
      lng: 7.756,
      distance_remaining_m: 450,
      total_distance_m: 4600,
      eta_min: 0,
    },
  })
  .eq("order_code", code)
await page.waitForTimeout(6000)
await shot("nearing", "3b")

// Stage 4 · DELIVERED
console.log("Stage 4 · DELIVERED")
await setStatus("DELIVERED")
await page.waitForTimeout(6000)
await shot("delivered", "4")

// DOM inspection · verificar features clave
console.log("\nDOM inspection")
const features = await page.evaluate(() => {
  const widget = document.querySelector('[role="region"][aria-label="Tracker de pedido Náufrago"]')
  if (!widget) return { mounted: false }
  return {
    mounted: true,
    width: widget.clientWidth,
    height: widget.clientHeight,
    has_stages_dots: widget.querySelectorAll('[aria-hidden]').length > 0,
    has_svg_map: !!widget.querySelector("svg"),
    has_route_path: !!widget.querySelector('svg path[stroke-dasharray="6 4"]'),
    has_canoa: widget.innerHTML.includes("🛶"),
    has_microcopy: !!widget.querySelector("[class*='handwritten']"),
    has_timeline_btn: widget.innerHTML.includes("Ver historial") || widget.querySelector('button[aria-label="Ver historial"]') !== null,
    has_rider_card: widget.innerHTML.includes("Marco"),
    has_order_summary: widget.innerHTML.includes("Encebollado") || widget.innerHTML.includes("Cola"),
    has_confetti: widget.innerHTML.includes("🎉") || widget.innerHTML.includes("✨"),
    has_island_x: widget.innerHTML.includes("✕"),
    has_taesch: widget.innerHTML.includes("TÄSCH"),
    has_isla_label: widget.innerHTML.includes("TU ISLA"),
    has_eta_text: widget.innerHTML.includes("min") || widget.innerHTML.includes("Llegando") || widget.innerHTML.includes("Buen provecho"),
  }
})
console.log(JSON.stringify(features, null, 2))

// Test click timeline button
console.log("\nClicking timeline button")
try {
  await page.click('button[aria-label="Ver historial de tiempos"]', { timeout: 3000 })
  await page.waitForTimeout(1000)
  await page.screenshot({
    path: path.join(OUT_DIR, `5-timeline-modal.png`),
    clip: { x: 1280 - 520, y: 800 - 660, width: 510, height: 650 },
  })
  console.log("  📸 timeline modal")
} catch (e) {
  console.log("  × timeline button click failed:", e.message)
}

// Cleanup
console.log("\nCleanup")
await supa.from("orders").delete().eq("id", orderId)

await browser.close()
console.log(`\n✅ Audit done · screenshots en ${OUT_DIR}`)
