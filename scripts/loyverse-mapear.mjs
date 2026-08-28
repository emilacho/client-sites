/**
 * Ata nuestra carta al catálogo de Loyverse · R124.
 *
 * POR QUÉ HACE FALTA
 * Loyverse no acepta una venta con el nombre del plato escrito a mano: su
 * API exige el identificador del producto tal como existe en SU catálogo.
 * Este guion lee ese catálogo, lo compara con nuestra carta y propone la
 * equivalencia de cada plato.
 *
 * NO ESCRIBE NADA por defecto · primero muestra la propuesta para que un
 * humano la revise. Recién con --aplicar la guarda. Una equivalencia mal
 * puesta manda la venta del ceviche a la cuenta del café, y eso ensucia la
 * contabilidad sin que nadie lo note.
 *
 * USO
 *   node scripts/loyverse-mapear.mjs                 (muestra la propuesta)
 *   node scripts/loyverse-mapear.mjs --aplicar       (la guarda)
 *
 * Necesita LOYVERSE_TOKEN en el entorno, o pasarlo como primer argumento.
 */

import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const BASE = "https://api.loyverse.com/v1.0"
const APLICAR = process.argv.includes("--aplicar")
const TOKEN =
  process.env.LOYVERSE_TOKEN ??
  process.argv.find((a) => !a.startsWith("-") && a.length > 30 && !a.includes("/"))

if (!TOKEN) {
  console.error("Falta el token de Loyverse (LOYVERSE_TOKEN o como argumento).")
  process.exit(1)
}

/** Quita tildes y mayúsculas para poder comparar nombres. */
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

async function loyverse(ruta) {
  const r = await fetch(`${BASE}${ruta}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!r.ok) {
    const d = await r.text().catch(() => "")
    throw new Error(`${ruta} -> HTTP ${r.status} ${d.slice(0, 200)}`)
  }
  return r.json()
}

// ── 1 · nuestra carta · se lee del archivo para que no se desincronice ──
function nuestraCarta() {
  const src = readFileSync("lib/v2/naufrago-content.ts", "utf8")
  const ini = src.indexOf("MENU_ITEMS")
  const bloque = src.slice(ini, ini + 22000)
  // El freno (?!\bid:) es lo que hace correcta la lectura: cada plato tiene
  // id, name y precio SIN otro "id:" de por medio. Sin ese freno la
  // búsqueda salta al plato siguiente y agarra los ingredientes · probado:
  // ataba "yuca" a "Encebollado Mixto" y "aguacate" a "Ceviche Mixto",
  // que en la contabilidad sería cobrarle al cliente el plato equivocado.
  const re =
    /id:\s*"([^"]+)"(?:(?!\bid:)[\s\S])*?name:\s*"([^"]+)"(?:(?!\bid:)[\s\S])*?priceUsd:\s*([0-9.]+)/g
  const out = []
  const vistos = new Set()
  let m
  while ((m = re.exec(bloque))) {
    if (vistos.has(m[1])) continue
    vistos.add(m[1])
    out.push({ id: m[1], nombre: m[2], precio: Number(m[3]) })
  }
  return out
}

// ── 2 · el catálogo de Loyverse ──
const [tiendas, pagos, items] = await Promise.all([
  loyverse("/stores"),
  loyverse("/payment_types"),
  loyverse("/items?limit=250"),
])

console.log("\n=== TUS TIENDAS EN LOYVERSE ===")
for (const s of tiendas.stores ?? []) console.log("  ", s.id, "·", s.name)

console.log("\n=== TUS FORMAS DE COBRO ===")
for (const p of pagos.payment_types ?? []) console.log("  ", p.id, "·", p.name, "·", p.type)

// Cada producto puede tener variantes · nos quedamos con la primera de cada uno.
const catalogo = []
for (const it of items.items ?? []) {
  for (const v of it.variants ?? []) {
    catalogo.push({
      variantId: v.variant_id,
      nombre: it.item_name + (v.option1_value ? ` ${v.option1_value}` : ""),
      precio: v.default_price,
    })
  }
}
console.log(`\n=== TU CATÁLOGO · ${catalogo.length} productos ===`)

// ── 3 · la propuesta de equivalencias ──
const carta = nuestraCarta()
const propuesta = []
console.log(`\n=== PROPUESTA · ${carta.length} platos de la carta ===`)
console.log("  NUESTRO PLATO".padEnd(34), "PRECIO", " →", "EN LOYVERSE")
for (const plato of carta) {
  const n = norm(plato.nombre)
  let hit =
    catalogo.find((c) => norm(c.nombre) === n) ??
    catalogo.find((c) => norm(c.nombre).includes(n) || n.includes(norm(c.nombre)))
  const alerta = hit && Math.abs((hit.precio ?? 0) - plato.precio) > 0.009 ? "  ⚠ PRECIO DISTINTO" : ""
  console.log(
    "  " + plato.nombre.padEnd(32),
    ("$" + plato.precio.toFixed(2)).padStart(6),
    " → ",
    hit ? `${hit.nombre} ($${Number(hit.precio ?? 0).toFixed(2)})${alerta}` : "SIN EQUIVALENCIA",
  )
  if (hit) propuesta.push({ menu_item_id: plato.id, variant_id: hit.variantId, nombre_loyverse: hit.nombre })
}

const envio = catalogo.find((c) => /envio|env[ií]o|delivery|domicilio/i.test(c.nombre))
console.log("\n  __envio__".padEnd(34), "      ", " → ", envio ? envio.nombre : "SIN EQUIVALENCIA · hay que crear un producto 'Envío' en Loyverse")
if (envio) propuesta.push({ menu_item_id: "__envio__", variant_id: envio.variantId, nombre_loyverse: envio.nombre })

const faltan = carta.length + 1 - propuesta.length
console.log(`\n  atados: ${propuesta.length} · faltan: ${faltan}`)

// ── 4 · guardar, solo si se pidió ──
if (!APLICAR) {
  console.log("\n  (nada se guardó · repetí con --aplicar cuando la propuesta esté bien)")
  process.exit(0)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error("Faltan las credenciales de la base para guardar.")
  process.exit(1)
}
const supa = createClient(url, key, { db: { schema: "naufrago" }, auth: { persistSession: false } })
const { error } = await supa.from("loyverse_item_map").upsert(propuesta, { onConflict: "menu_item_id" })
if (error) {
  console.error("  no se pudo guardar:", error.message)
  process.exit(1)
}
console.log(`\n  guardadas ${propuesta.length} equivalencias.`)
