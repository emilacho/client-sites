import sharp from "sharp"
const D = "C:/Users/emili/AppData/Local/Temp/claude/C--Users-emili-Documents-Claude-Projects-Agentic-Business-Agency/fdc9aee4-4eb6-44ea-b889-e556588c7864/scratchpad/"
// mismo relleno por inundación desde los bordes que usé con las botellas
const img = sharp(D+"extras/aguacate.jpg").resize({ width: 900, fit: "inside" }).ensureAlpha()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const { width: w, height: h, channels: c } = info
const tol = 24
const visto = new Uint8Array(w*h), cola = []
const claro = (i) => data[i] > 255-tol && data[i+1] > 255-tol && data[i+2] > 255-tol
for (let x=0;x<w;x++){cola.push([x,0]);cola.push([x,h-1])}
for (let y=0;y<h;y++){cola.push([0,y]);cola.push([w-1,y])}
while(cola.length){ const [x,y]=cola.pop(); if(x<0||y<0||x>=w||y>=h) continue
  const p=y*w+x; if(visto[p]) continue; const i=p*c; if(!claro(i)) continue
  visto[p]=1; data[i+3]=0; cola.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]) }
await sharp(data,{raw:{width:w,height:h,channels:c}}).png().toFile(D+"extras/aguacate-recorte.png")
console.log("   aguacate · fondo quitado:", Math.round(visto.reduce((a,b)=>a+b,0)/(w*h)*100)+"%")
// montar sobre la misma madera
const madera = await sharp(D+"colas/madera.png").toBuffer()
const ag = await sharp(D+"extras/aguacate-recorte.png").trim().resize({ height: 620, fit: "inside" }).toBuffer()
const m = await sharp(ag).metadata()
await sharp(madera).composite([{ input: ag, top: Math.round((900-m.height)/2), left: Math.round((900-m.width)/2) }])
  .jpeg({ quality: 84, mozjpeg: true }).toFile("public/stories/aguacate.jpg")
console.log("   aguacate.jpg listo")
