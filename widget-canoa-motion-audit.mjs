#!/usr/bin/env node
/**
 * Audit ESPECÍFICO de movimiento de la canoa · captura 5 frames durante
 * en_route (a distinct rider positions) y verifica que la canoa avance
 * visualmente entre frames. Plus captura el badge de sub-status para
 * verificar el conditional payment_method.
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
const OUT_DIR = path.resolve(
  process.cwd(),
  ".tmp-canonical-audit",
  "widget-canoa-motion",
)
fs.mkdirSync(OUT_DIR, { recursive: true })

const code = `NF-2026-MOT${Math.floor(Math.random() * 999).toString().padStart(3, "0")}`
console.log(`Creating order ${code}`)

const PICKUP_LAT = 46.0667
const PICKUP_LNG = 7.78
const DROPOFF_LAT = 46.029179
const DROPOFF_LNG = 7.754809
const TOTAL_DIST = 4600

const seed = await supa
  .from("orders")
  .insert({
    order_code: code,
    status: "IN_TRANSIT",
    customer_name: "Motion Bot",
    customer_phone: "593900000004",
    dropoff_address: "Vispastrasse 168, Zermatt",
    dropoff_lat: DROPOFF_LAT,
    dropoff_lng: DROPOFF_LNG,
    cart_lines: [{ id: "encebollado", name: "Encebollado", qty: 1, priceUsd: 4 }],
    subtotal_usd: 4,
    total_usd: 4,
    payment_method: "CARD_DEBIT", // test no-cash payment
    payment_status: "CAPTURED",
    payment_provider: "KUSHKI",
    delivery_provider: "PEDIDOSYA_COURIER",
    delivery_eta_minutes: 5,
    accepted_at: new Date(Date.now() - 90_000).toISOString(),
    preparing_at: new Date(Date.now() - 60_000).toISOString(),
    ready_at: new Date(Date.now() - 30_000).toISOString(),
    rider_picked_up_at: new Date(Date.now() - 15_000).toISOString(),
    in_transit_at: new Date(Date.now() - 15_000).toISOString(),
    rider_info: {
      name: "Marco",
      phone: "+593997744288",
      vehicleType: "MOTORCYCLE",
      plate: "VS-MOCK-001",
      rating: 4.8,
      tenure_months: 14,
      lat: PICKUP_LAT,
      lng: PICKUP_LNG,
      distance_remaining_m: TOTAL_DIST,
      total_distance_m: TOTAL_DIST,
      eta_min: 5,
    },
  })
  .select("id")
  .single()
if (seed.error) {
  console.error("seed failed", seed.error)
  process.exit(1)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
page.on("console", (msg) => {
  const t = msg.text()
  if (t.includes("[widget]") || t.includes("[cart]")) console.log(" >>", t)
})
await page.goto(PREVIEW_URL, { waitUntil: "domcontentloaded" })
await page.evaluate((c) => {
  window.localStorage.setItem("naufrago_active_order_code", c)
  window.dispatchEvent(
    new CustomEvent("naufrago:order-active", { detail: { orderCode: c } }),
  )
}, code)

// Capture 5 frames at different rider positions (5%, 30%, 60%, 90% along route)
const positions = [
  { pct: 0.05, distance: TOTAL_DIST * 0.95 },
  { pct: 0.3, distance: TOTAL_DIST * 0.7 },
  { pct: 0.6, distance: TOTAL_DIST * 0.4 },
  { pct: 0.9, distance: TOTAL_DIST * 0.1, substatus: "NEARING_DESTINATION" },
  { pct: 1.0, distance: 0, substatus: "AT_DESTINATION" },
]

function interpolate(t) {
  return {
    lat: PICKUP_LAT + (DROPOFF_LAT - PICKUP_LAT) * t,
    lng: PICKUP_LNG + (DROPOFF_LNG - PICKUP_LNG) * t,
  }
}

// Helper to extract canoa transform values from DOM
async function extractCanoaState() {
  return page.evaluate(() => {
    const widget = document.querySelector('[role="region"][aria-label="Tracker de pedido Náufrago"]')
    if (!widget) return null
    const svg = widget.querySelector("svg")
    if (!svg) return null
    // Find the outer group of canoa · look for the one containing 🛶 text
    const allGroups = svg.querySelectorAll("g")
    for (const g of allGroups) {
      const text = g.querySelector("text")
      if (text && text.textContent === "🛶") {
        const outer = g.closest("g[style*='transform']")
        const innerTransform = g.style.transform || ""
        const outerTransform = outer?.style.transform || ""
        return { outerTransform, innerTransform }
      }
    }
    // Sub-status badge text
    return null
  })
}

async function getSubStatusBadgeText() {
  return page.evaluate(() => {
    const widget = document.querySelector('[role="region"][aria-label="Tracker de pedido Náufrago"]')
    if (!widget) return null
    // Look for divs that match the badge styling (rounded-2xl + sub-status emoji)
    const html = widget.innerHTML
    const m =
      html.match(/Cerca · prepará el efectivo/)?.[0] ??
      html.match(/Cerca · está por llegar/)?.[0] ??
      html.match(/¡Llegó! Sal a recibir/)?.[0] ??
      null
    return m
  })
}

const observations = []
for (let i = 0; i < positions.length; i++) {
  const p = positions[i]
  const pos = interpolate(p.pct)
  console.log(`\nPosition ${i + 1}/${positions.length} · ${(p.pct * 100).toFixed(0)}% along route`)
  await supa
    .from("orders")
    .update({
      delivery_substatus: p.substatus ?? "OUT_FOR_DELIVERY",
      delivery_eta_minutes: Math.max(0, Math.round((p.distance / 1000) / 60 * 60)),
      rider_info: {
        name: "Marco",
        phone: "+593997744288",
        vehicleType: "MOTORCYCLE",
        plate: "VS-MOCK-001",
        rating: 4.8,
        tenure_months: 14,
        lat: pos.lat,
        lng: pos.lng,
        distance_remaining_m: Math.round(p.distance),
        total_distance_m: TOTAL_DIST,
        eta_min: Math.max(0, Math.round((p.distance / 1000) / 60 * 60)),
      },
    })
    .eq("order_code", code)

  await page.waitForTimeout(4500) // wait for poll + transition

  const canoaState = await extractCanoaState()
  const badgeText = await getSubStatusBadgeText()
  observations.push({
    expectedPct: p.pct,
    canoa: canoaState,
    subStatus: badgeText,
  })
  console.log(`  canoa.outer = ${canoaState?.outerTransform?.slice(0, 80) ?? "null"}`)
  console.log(`  canoa.inner = ${canoaState?.innerTransform?.slice(0, 80) ?? "null"}`)
  console.log(`  badge text = ${badgeText ?? "null"}`)

  await page.screenshot({
    path: path.join(OUT_DIR, `frame-${i + 1}-pct${Math.round(p.pct * 100)}.png`),
    clip: { x: 1280 - 510, y: 800 - 720, width: 500, height: 710 },
  })
}

console.log("\n═══ ANÁLISIS ═══")
for (let i = 0; i < observations.length; i++) {
  const o = observations[i]
  console.log(`Frame ${i + 1} pct=${(o.expectedPct * 100).toFixed(0)}%`)
  console.log(`  outerTransform: ${o.canoa?.outerTransform?.slice(0, 70)}`)
}
const allOuterTransforms = observations
  .map((o) => o.canoa?.outerTransform ?? "")
  .filter(Boolean)
const uniqueTransforms = new Set(allOuterTransforms)
console.log(
  `\nCanoa positions únicas · ${uniqueTransforms.size}/${observations.length}`,
)
if (uniqueTransforms.size >= observations.length - 1) {
  console.log("✅ Canoa SE MUEVE entre frames")
} else {
  console.log("❌ Canoa ESTÁTICA o no actualiza")
}

console.log(`\nSub-status badges observados ·`)
observations.forEach((o, i) => console.log(`  Frame ${i + 1}: ${o.subStatus}`))

// Cleanup
await supa.from("orders").delete().eq("id", seed.data.id)
await browser.close()
console.log(`\nScreenshots en ${OUT_DIR}`)
