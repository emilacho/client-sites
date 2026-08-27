#!/usr/bin/env node
/**
 * One-shot · descarga los 4 GLBs de Supabase · aplica `resize`
 * (texturas 2K máx) + `draco` (compresión geométrica) vía
 * gltf-transform CLI · sube los `-compact.glb` a Supabase con
 * service role key + reporta before/after sizes por archivo.
 *
 * Idempotent · si el `-compact.glb` ya existe en Supabase ·
 * se sobrescribe (x-upsert: true). Originales NUNCA se tocan ·
 * rollback es revertir el cambio de URL en naufragoAssets.
 *
 * Run · node scripts/compact-glbs.mjs
 * Env req · SUPABASE_SERVICE_ROLE_KEY (read from ../zero-risk-platform/.env.local)
 */
import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const TMP = path.join(ROOT, "tmp", "glb")

const SUPABASE_BASE =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object"
const BUCKET = "client-websites"
const PATH_PREFIX = "naufrago/3d-models"
const PUBLIC_BASE = `${SUPABASE_BASE}/public/${BUCKET}/${PATH_PREFIX}`
const UPLOAD_BASE = `${SUPABASE_BASE}/${BUCKET}/${PATH_PREFIX}`

const ASSETS = [
  { key: "island",    base: "island-low-poly" },
  { key: "character", base: "character-castaway-confused-scratch" },
  { key: "sign",      base: "sign-naufrago" },
  { key: "surfboard", base: "surfboard-old" },
]

async function loadServiceRoleKey() {
  const envPath = path.resolve(
    ROOT,
    "..",
    "zero-risk-platform",
    ".env.local",
  )
  const raw = await fs.readFile(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/)
    if (m) return m[1].trim().replace(/^"|"$/g, "")
  }
  throw new Error(`SUPABASE_SERVICE_ROLE_KEY not found in ${envPath}`)
}

function quote(s) {
  return `"${s.replace(/"/g, '\\"')}"`
}

function run(cmdLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmdLine, { stdio: "inherit", shell: true })
    p.on("exit", (code) =>
      code === 0
        ? resolve(undefined)
        : reject(new Error(`exit ${code} · ${cmdLine}`)),
    )
    p.on("error", reject)
  })
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(dest, buf)
  return buf.length
}

async function upload(localPath, remotePath, key) {
  const data = await fs.readFile(localPath)
  const res = await fetch(`${UPLOAD_BASE}/${remotePath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "model/gltf-binary",
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: data,
  })
  if (!res.ok) {
    throw new Error(
      `upload ${remotePath} · HTTP ${res.status} · ${await res.text()}`,
    )
  }
  return data.length
}

async function main() {
  await fs.mkdir(TMP, { recursive: true })
  const key = await loadServiceRoleKey()
  console.log(`[compact-glbs] service role key loaded · prefix ${key.slice(0, 8)}…`)

  const summary = []
  for (const asset of ASSETS) {
    const original = path.join(TMP, `${asset.key}.glb`)
    const resized = path.join(TMP, `${asset.key}-r.glb`)
    const compact = path.join(TMP, `${asset.key}-compact.glb`)
    const sourceUrl = `${PUBLIC_BASE}/${asset.base}.glb`
    const targetPath = `${asset.base}-compact.glb`

    console.log(`\n[${asset.key}] start`)
    let originalSize = 0
    if (asset.key === "island") {
      // Reuse already-downloaded + already-processed if present
      try {
        originalSize = (await fs.stat(original)).size
      } catch {
        originalSize = await download(sourceUrl, original)
      }
    } else {
      originalSize = await download(sourceUrl, original)
    }
    console.log(`  download · ${(originalSize / 1024 / 1024).toFixed(2)} MB`)

    await run(
      `npx -y @gltf-transform/cli resize --width 2048 --height 2048 ${quote(original)} ${quote(resized)}`,
    )
    await run(
      `npx -y @gltf-transform/cli draco ${quote(resized)} ${quote(compact)}`,
    )

    const compactSize = (await fs.stat(compact)).size
    console.log(`  compact   · ${(compactSize / 1024).toFixed(1)} KB`)

    const uploaded = await upload(compact, targetPath, key)
    console.log(`  uploaded  · ${(uploaded / 1024).toFixed(1)} KB → ${targetPath}`)

    summary.push({
      key: asset.key,
      before: originalSize,
      after: compactSize,
      reduction: Math.round((1 - compactSize / originalSize) * 100),
      url: `${PUBLIC_BASE}/${targetPath}`,
    })
  }

  console.log("\n[compact-glbs] DONE")
  console.log("┌────────────┬──────────┬─────────┬──────────┐")
  console.log("│ asset      │ before   │ after   │ -%       │")
  console.log("├────────────┼──────────┼─────────┼──────────┤")
  for (const s of summary) {
    const bef = `${(s.before / 1024 / 1024).toFixed(2)} MB`
    const aft = `${(s.after / 1024).toFixed(1)} KB`
    console.log(`│ ${s.key.padEnd(10)} │ ${bef.padStart(8)} │ ${aft.padStart(7)} │ ${(s.reduction + "%").padStart(8)} │`)
  }
  console.log("└────────────┴──────────┴─────────┴──────────┘")
  console.log("\nupdated URLs · use these in naufragoAssets ·")
  for (const s of summary) console.log(`  ${s.key.padEnd(10)} ${s.url}`)
}

main().catch((err) => {
  console.error("[compact-glbs] FATAL", err)
  process.exit(1)
})
