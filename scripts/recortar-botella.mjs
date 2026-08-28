import sharp from "sharp"
const D = "C:/Users/emili/AppData/Local/Temp/claude/C--Users-emili-Documents-Claude-Projects-Agentic-Business-Agency/fdc9aee4-4eb6-44ea-b889-e556588c7864/scratchpad/"

/** Quita el fondo claro entrando SOLO desde los bordes (relleno por
 *  inundación). Así el blanco de las letras "Coca-Cola", que está rodeado
 *  de rojo, no se toca · un umbral simple lo habría agujereado. */
async function quitarFondo(src, salida, tol = 34) {
  const img = sharp(src).resize({ width: 900, fit: "inside" }).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  const visto = new Uint8Array(w * h)
  const cola = []
  const claro = (i) => data[i] > 255 - tol && data[i+1] > 255 - tol && data[i+2] > 255 - tol
  for (let x = 0; x < w; x++) { cola.push([x,0]); cola.push([x,h-1]) }
  for (let y = 0; y < h; y++) { cola.push([0,y]); cola.push([w-1,y]) }
  while (cola.length) {
    const [x,y] = cola.pop()
    if (x<0||y<0||x>=w||y>=h) continue
    const p = y*w+x
    if (visto[p]) continue
    const i = p*c
    if (!claro(i)) continue
    visto[p] = 1
    data[i+3] = 0
    cola.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
  }
  await sharp(data, { raw: { width: w, height: h, channels: c } }).png().toFile(D+"colas/"+salida)
  const quitados = visto.reduce((a,b)=>a+b,0)
  console.log(`  ${salida} · fondo quitado: ${Math.round(quitados/(w*h)*100)}% de la imagen`)
}
await quitarFondo(D+"colas/cocacola-grande.webp", "recorte-grande.png")
await quitarFondo(D+"colas/Coca_Cola_Flasche_-_Original_Taste.jpg", "recorte-pequena.png", 70)
