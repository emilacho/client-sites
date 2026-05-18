/**
 * One-shot · convert the 4 customer .png photos from the zr-vault
 * upload folder into JPG quality 85 thumbnails sized for the
 * 80×80 avatar slot in the coconut review cards. Output goes to
 * client-sites/public/reviews/<canonical>.jpg.
 *
 * Sharp is installed as a dev dep on this script's first run · it
 * stays in package.json afterward (the dev dep weight is fine for
 * an image-pipeline script that can be re-run for future clients).
 */
import sharp from "sharp"
import { mkdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const SRC =
  "C:/Users/emili/OneDrive/Documents/zr-vault/raw/uploads/2026-05-18-fotos-cliente-cc4"

const OUT = resolve("public/reviews")
mkdirSync(OUT, { recursive: true })

// Mapping decided by CC4 (Round 83) · see commit message.
const items = [
  { src: "cara de persona 1 .png", out: "reviewer-1-diego.jpg" },
  { src: "cara de persona 2.png",  out: "reviewer-2-pablo.jpg" },
  { src: "cara de persona 3.png",  out: "reviewer-3-andrea.jpg" },
  { src: "cara de persona 4.png",  out: "reviewer-4-maria.jpg" },
]

for (const it of items) {
  const inPath = `${SRC}/${it.src}`
  const outPath = `${OUT}/${it.out}`
  const buf = readFileSync(inPath)
  // 320×320 covers retina @ 80px slot · square crop, center-attended
  // gravity so faces (which the camera typically centers) survive.
  // mozjpeg compression with q85 + chromaSubsampling 4:2:0 default.
  const out = await sharp(buf)
    .resize(320, 320, { fit: "cover", position: "center" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()
  const fs = await import("node:fs/promises")
  await fs.writeFile(outPath, out)
  const inSize = buf.length
  const outSize = out.length
  const pct = ((1 - outSize / inSize) * 100).toFixed(0)
  console.log(
    `${it.src.padEnd(28)} → ${it.out.padEnd(28)} · ${(inSize / 1024).toFixed(0)}KB → ${(outSize / 1024).toFixed(0)}KB · -${pct}%`,
  )
}
console.log("done")
