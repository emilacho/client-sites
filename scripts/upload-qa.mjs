/**
 * upload-qa · uploads a local QA screenshot to Supabase Storage under
 * client-websites/naufrago/v2/qa/<filename>. Reads SUPABASE creds from
 * the zero-risk-platform/.env.local file (same workspace).
 *
 *   node scripts/upload-qa.mjs round-3-before-after.png
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const file = process.argv[2]
if (!file) {
  console.error("usage: node scripts/upload-qa.mjs <filename>")
  process.exit(2)
}

// Load creds from the sibling zero-risk-platform .env.local (no .env in
// client-sites for service-role keys).
const envPath = resolve(
  "C:/Users/emili/Documents/Claude/Projects/Agentic Business Agency/zero-risk-platform/.env.local",
)
const env = {}
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const eq = t.indexOf("=")
  if (eq < 0) continue
  env[t.slice(0, eq)] = t.slice(eq + 1)
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("missing supabase creds in zero-risk-platform/.env.local")
  process.exit(2)
}

const filePath = resolve(`scripts/qa/${file}`)
const png = readFileSync(filePath)
console.log("  local:", filePath, "·", png.length, "bytes")

const remote = `naufrago/v2/qa/${file}`
const uploadUrl = `${SUPABASE_URL}/storage/v1/object/client-websites/${remote}`
const r = await fetch(uploadUrl, {
  method: "POST",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "image/png",
    "x-upsert": "true",
  },
  body: png,
})
const body = await r.text()
console.log("  upload:", r.status, body.slice(0, 200))
const pub = `${SUPABASE_URL}/storage/v1/object/public/client-websites/${remote}`
console.log("  public URL:")
console.log("    " + pub)
