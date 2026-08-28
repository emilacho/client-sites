import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/produccion"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("https://client-sites-template-five.vercel.app/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(8000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1200)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(6000)
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[0]?.click() })
await p.waitForTimeout(1500)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Canoa de compras/i.test(e.textContent||""))?.click())
await p.waitForTimeout(3000)
// entrar al camino PedidosYa
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/PedidosYa/i.test(e.textContent||""))?.click())
await p.waitForTimeout(4000)
// llenar la direccion
await p.evaluate(() => {
  const set = (ph, val) => { const el=[...document.querySelectorAll("input")].find(i=>(i.placeholder||"").toLowerCase().includes(ph)); if(el){ const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true})) } }
  set("calle","Av. Victor Emilio Estrada 600, Urdesa")
  set("nombre","Prueba CC4")
  set("tel","+593997744288")
})
await p.waitForTimeout(1500)
await p.screenshot({ path: join(dir, "02-datos.png") })
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Cotizar/i.test(e.textContent||""))?.click())
await p.waitForTimeout(9000)
await p.screenshot({ path: join(dir, "03-pago.png") })
const txt = await p.evaluate(() => document.body.innerText)
console.log("¿aparece la pantalla de pago?:", /tarjeta|efectivo|apple|google|deuna|payphone/i.test(txt))
console.log("metodos que se ven:", ["Tarjeta","Efectivo","Apple Pay","Google Pay","DeUna","PayPhone"].filter(m=>txt.includes(m)))

await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Continuar al pago/i.test(e.textContent||""))?.click())
await p.waitForTimeout(6000)
await p.screenshot({ path: join(dir, "04-metodos-pago.png") })
const t2 = await p.evaluate(() => document.body.innerText)
console.log("METODOS VISIBLES:", ["Tarjeta","Efectivo","Apple Pay","Google Pay","DeUna","PayPhone"].filter(m=>t2.includes(m)))
const bs = await p.evaluate(() => [...document.querySelectorAll("button")].map(e=>({t:(e.textContent||"").trim().slice(0,28), off:e.disabled})).filter(x=>x.t))
console.log("BOTONES:", JSON.stringify(bs.slice(-14)))
await b.close()
