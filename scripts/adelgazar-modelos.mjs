#!/usr/bin/env node
/**
 * R126 · Adelgazar los modelos 3D SIN sacar la isla del celular.
 *
 * El problema medido en R125 · la página bajaba 45 MB por visita y 20 MB
 * eran los modelos. La respuesta de R125 fue reemplazar la isla por una
 * foto en celular · eso tiraba a la basura todo lo construido en la isla.
 * Esta es la respuesta correcta · los modelos siguen siendo modelos y se
 * siguen pudiendo tocar · pesan menos.
 *
 * DE DÓNDE SALE EL PESO (medido con tmp/glbinfo.mjs sobre los -compact) ·
 *   personaje  9,69 MB · 92% es UNA textura PNG de 2048x2048 (9 MB)
 *   pergamino  8,52 MB · 88% texturas 2K + 611.054 triángulos
 *   cangrejo   3,54 MB · 48% texturas 2K + 676.279 triángulos
 *   letrero    2,66 MB · 75% texturas 2K
 *   tabla      2,45 MB · 87% texturas 2K
 *   isla       0,41 MB · ya estaba bien
 * Todo estaba a 2048x2048 · tamaño de textura de consola · para objetos
 * que en pantalla ocupan pocos centímetros.
 *
 * QUÉ HACE ·
 *   1. texturas · baja resolución por ranura (el color se ve · el mapa de
 *      relieve y el de metal/rugosidad casi no) y pasa todo a WebP.
 *   2. geometría · simplifica SOLO los que tienen exceso absurdo de
 *      triángulos · el personaje NO se toca (tiene esqueleto y animación).
 *   3. comprime la malla con Draco y sube los `-lite.glb` a Supabase.
 *
 * NO toca · nombres de nodos ni de materiales. El código de la escena
 * busca por nombre ("Ocean001_57" · "Chest_14" · "Boat_15") · por eso acá
 * NO se usa join/flatten/dedup, que renombran o fusionan nodos.
 *
 * Originales intactos en el bucket · volver atrás = revertir las URLs de
 * `naufragoAssets` en lib/v2/naufrago-content.ts.
 *
 * Correr · node scripts/adelgazar-modelos.mjs [--solo=personaje,letrero] [--sin-subir]
 * Env req · SUPABASE_SERVICE_ROLE_KEY (de ../zero-risk-platform/.env.local)
 */
import { NodeIO } from "@gltf-transform/core"
import {
  ALL_EXTENSIONS,
  KHRDracoMeshCompression,
  EXTTextureWebP,
} from "@gltf-transform/extensions"
import { simplify, weld } from "@gltf-transform/functions"
import { MeshoptSimplifier } from "meshoptimizer"
import draco3d from "draco3dgltf"
import sharp from "sharp"
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const TMP = path.join(ROOT, "tmp", "lite")

const SUPABASE_BASE = "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object"
const BUCKET = "client-websites"
const PREFIX = "naufrago/3d-models"
const PUBLIC_BASE = `${SUPABASE_BASE}/public/${BUCKET}/${PREFIX}`
const UPLOAD_BASE = `${SUPABASE_BASE}/${BUCKET}/${PREFIX}`

/**
 * Presupuesto por objeto · en píxeles de textura y en fracción de
 * triángulos que sobrevive. Los números salen de cuánto ocupa cada cosa
 * en pantalla · el personaje y el letrero se miran de cerca · el cangrejo
 * y la botella son del tamaño de una uña.
 */
const RECETAS = [
  {
    key: "isla",
    fuente: `${PUBLIC_BASE}/island-low-poly.glb`,
    destino: "island-low-poly-lite.glb",
    // El relieve del OCÉANO son las olas · a 512 el mar queda liso y se
    // pierde el brillo del agua. Es la única textura de toda la isla que
    // se mira en movimiento, así que se le deja el tamaño original.
    color: 1024, relieve: 2048, otras: 512,
    // La isla ES la escena · sus nodos se buscan por nombre. No se toca.
    simplificar: null,
  },
  {
    key: "personaje",
    fuente: `${PUBLIC_BASE}/character-castaway-confused-scratch.glb`,
    destino: "character-castaway-confused-scratch-lite.glb",
    color: 1024, relieve: 512, otras: 512,
    // Tiene esqueleto y animación · simplificar rompe los pesos del hueso.
    simplificar: null,
  },
  {
    key: "letrero",
    fuente: `${PUBLIC_BASE}/sign-naufrago.glb`,
    destino: "sign-naufrago-lite.glb",
    // Dice NÁUFRAGO · el color tiene que quedar legible.
    color: 1024, relieve: 512, otras: 256,
    simplificar: 0.4,
  },
  {
    key: "tabla",
    fuente: `${PUBLIC_BASE}/surfboard-old.glb`,
    destino: "surfboard-old-lite.glb",
    color: 768, relieve: 512, otras: 256,
    simplificar: 0.5,
  },
  {
    key: "cangrejo",
    fuente: `${PUBLIC_BASE}/cangrejo-compact.glb`,
    destino: "cangrejo-lite.glb",
    color: 512, relieve: 512, otras: 256,
    // 676.279 triángulos para un bicho de 3 cm en pantalla.
    simplificar: 0.12,
  },
  {
    key: "botella",
    fuente: `${PUBLIC_BASE}/botella-compact.glb`,
    destino: "botella-lite.glb",
    color: 512, relieve: 256, otras: 256,
    simplificar: 0.4,
  },
  {
    // No está en la isla · lo usa la pantalla de seguimiento del pedido.
    key: "atun",
    fuente: `${PUBLIC_BASE}/atun-compact.glb`,
    destino: "atun-lite.glb",
    color: 768, relieve: 512, otras: 256,
    simplificar: 0.3,
  },
  {
    key: "pergamino",
    local: path.join(ROOT, "public", "models", "pergamino-pirata.glb"),
    destinoLocal: path.join(ROOT, "public", "models", "pergamino-pirata-lite.glb"),
    color: 1024, relieve: 512, otras: 256,
    simplificar: 0.2,
  },
]

async function leerLlave() {
  const envPath = path.resolve(ROOT, "..", "zero-risk-platform", ".env.local")
  const raw = await fs.readFile(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/)
    if (m) return m[1].trim().replace(/^"|"$/g, "")
  }
  throw new Error(`SUPABASE_SERVICE_ROLE_KEY no está en ${envPath}`)
}

async function subir(localPath, remotePath, key) {
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
  if (!res.ok) throw new Error(`subir ${remotePath} · HTTP ${res.status} · ${await res.text()}`)
  return data.length
}

function kb(n) { return (n / 1024).toFixed(0).padStart(6) + " KB" }
function mb(n) { return (n / 1048576).toFixed(2).padStart(6) + " MB" }

/**
 * Baja las texturas con sharp directo, no con `textureCompress` de
 * gltf-transform · esa función le pide a sharp un espacio de color por
 * número y la versión de sharp de este proyecto (0.34) lo rechaza
 * ("colourspace: parameter space not set"). Hacerlo a mano además deja
 * decidir el tamaño ranura por ranura.
 *
 * Una misma textura puede estar en dos ranuras (en el personaje, la de
 * color es también la de emisión) · gana el presupuesto más grande, así
 * nunca se degrada de más por culpa de la ranura menos exigente.
 */
async function comprimirTexturas(doc, receta) {
  const RANURAS = [
    ["getBaseColorTexture", receta.color, 85],
    ["getNormalTexture", receta.relieve, 90],
    ["getMetallicRoughnessTexture", receta.otras, 80],
    ["getEmissiveTexture", receta.otras, 80],
    ["getOcclusionTexture", receta.otras, 80],
  ]
  const plan = new Map()
  for (const material of doc.getRoot().listMaterials()) {
    for (const [getter, lado, calidad] of RANURAS) {
      const tex = material[getter]?.()
      if (!tex) continue
      const previo = plan.get(tex)
      if (!previo || lado > previo.lado) plan.set(tex, { lado, calidad })
    }
  }

  let antes = 0
  let despues = 0
  for (const [tex, { lado, calidad }] of plan) {
    const original = tex.getImage()
    if (!original) continue
    antes += original.byteLength
    // `pipelineColourspace("srgb")` NO es decorativo · importar
    // @gltf-transform/functions (arriba, para simplify/weld) arrastra
    // ndarray-pixels, que deja a sharp con un espacio de color global
    // inválido · sin esta línea TODA conversión muere con
    // "colourspace: parameter space not set". Verificado aislando el
    // import: sin él la misma llamada funciona.
    const nueva = await sharp(Buffer.from(original))
      .pipelineColourspace("srgb")
      .resize(lado, lado, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: calidad })
      .toBuffer()
    tex.setImage(new Uint8Array(nueva)).setMimeType("image/webp")
    const uri = tex.getURI()
    if (uri) tex.setURI(uri.replace(/\.(png|jpe?g)$/i, ".webp"))
    despues += nueva.byteLength
  }
  if (plan.size) doc.createExtension(EXTTextureWebP).setRequired(true)
  return { antes, despues, cantidad: plan.size }
}

function contarTriangulos(doc) {
  let t = 0
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices()
      const pos = prim.getAttribute("POSITION")
      t += (idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3
    }
  return Math.round(t)
}

async function main() {
  const soloArg = process.argv.find((a) => a.startsWith("--solo="))
  const solo = soloArg ? soloArg.split("=")[1].split(",") : null
  const sinSubir = process.argv.includes("--sin-subir")
  await fs.mkdir(TMP, { recursive: true })

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "draco3d.decoder": await draco3d.createDecoderModule(),
      "draco3d.encoder": await draco3d.createEncoderModule(),
    })
  await MeshoptSimplifier.ready

  const key = sinSubir ? null : await leerLlave()
  const resumen = []

  for (const r of RECETAS) {
    if (solo && !solo.includes(r.key)) continue
    console.log(`\n[${r.key}]`)

    // 1 · traer el archivo
    const entrada = path.join(TMP, `${r.key}-src.glb`)
    if (r.local) {
      await fs.copyFile(r.local, entrada)
    } else {
      const res = await fetch(r.fuente)
      if (!res.ok) throw new Error(`GET ${r.fuente} → ${res.status}`)
      await fs.writeFile(entrada, Buffer.from(await res.arrayBuffer()))
    }
    const antes = (await fs.stat(entrada)).size
    console.log(`  entra      ${mb(antes)}`)

    const doc = await io.read(entrada)
    const trisAntes = contarTriangulos(doc)

    // 2 · texturas · por ranura, porque no todas se miran igual.
    //     color = lo que el ojo lee · relieve = detalle fino · el resto
    //     (metal/rugosidad/oclusión/emisión) casi no se percibe.
    const tex = await comprimirTexturas(doc, r)
    console.log(`  texturas   ${tex.cantidad} · ${kb(tex.antes)} → ${kb(tex.despues)}`)

    // 3 · geometría · solo donde sobra
    if (r.simplificar) {
      await doc.transform(
        weld(),
        simplify({ simplifier: MeshoptSimplifier, ratio: r.simplificar, error: 0.001 }),
      )
    }

    // 4 · comprimir la malla
    doc.createExtension(KHRDracoMeshCompression).setRequired(true)

    const salida = r.destinoLocal ?? path.join(TMP, r.destino)
    await io.write(salida, doc)
    const despues = (await fs.stat(salida)).size
    const trisDespues = contarTriangulos(doc)
    console.log(`  sale       ${mb(despues)}   (-${Math.round((1 - despues / antes) * 100)}%)`)
    console.log(`  triángulos ${trisAntes.toLocaleString()} → ${trisDespues.toLocaleString()}`)

    let url = r.destinoLocal ? "/models/" + path.basename(r.destinoLocal) : null
    if (!r.destinoLocal && !sinSubir) {
      await subir(salida, r.destino, key)
      url = `${PUBLIC_BASE}/${r.destino}`
      console.log(`  subido     ${r.destino}`)
    }
    resumen.push({ key: r.key, antes, despues, trisAntes, trisDespues, url })
  }

  console.log("\n=== RESUMEN ===")
  let a = 0, d = 0
  for (const s of resumen) {
    a += s.antes
    d += s.despues
    console.log(`  ${s.key.padEnd(10)} ${mb(s.antes)} → ${kb(s.despues)}  (-${Math.round((1 - s.despues / s.antes) * 100)}%)`)
  }
  console.log(`  ${"TOTAL".padEnd(10)} ${mb(a)} → ${mb(d)}  (-${Math.round((1 - d / a) * 100)}%)`)
  console.log("\nURLs para naufragoAssets ·")
  for (const s of resumen) console.log(`  ${s.key.padEnd(10)} ${s.url}`)
}

main().catch((e) => {
  console.error("[adelgazar-modelos] FATAL", e)
  process.exit(1)
})
