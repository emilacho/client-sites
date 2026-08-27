// Crop the area of the sign baseColor texture where the text lives ·
// devuelve un PNG zoomeado para inspección visual de la tipografía.
import sharp from "sharp"

const SRC = "scripts/qa/sign-baseColor.jpg"
const OUT = "scripts/qa/sign-text-crop.png"

const meta = await sharp(SRC).metadata()
console.log(`Source · ${meta.width}×${meta.height}`)

// Heuristic · text is usually in the central horizontal band of the
// baseColor atlas · save 3 horizontal strips for inspection.
const w = meta.width ?? 2048
const h = meta.height ?? 2048

// Full center band
await sharp(SRC)
  .extract({
    left: 0,
    top: Math.floor(h * 0.3),
    width: w,
    height: Math.floor(h * 0.4),
  })
  .toFile("scripts/qa/sign-band-center.png")

// Top third
await sharp(SRC)
  .extract({
    left: 0,
    top: 0,
    width: w,
    height: Math.floor(h * 0.35),
  })
  .toFile("scripts/qa/sign-band-top.png")

// Bottom third
await sharp(SRC)
  .extract({
    left: 0,
    top: Math.floor(h * 0.65),
    width: w,
    height: Math.floor(h * 0.35),
  })
  .toFile("scripts/qa/sign-band-bottom.png")

// Also save full image as PNG for inspection
await sharp(SRC).toFile(OUT)

console.log(`Saved · ${OUT}`)
console.log(`Saved · scripts/qa/sign-band-center.png`)
console.log(`Saved · scripts/qa/sign-band-top.png`)
console.log(`Saved · scripts/qa/sign-band-bottom.png`)
console.log(`\nOpen these files to inspect the typography baked in the GLB.`)
