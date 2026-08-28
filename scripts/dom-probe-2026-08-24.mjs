import { chromium } from "playwright"
const BASE = "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(5000)
const info = await p.evaluate(() => {
  const out = []
  document.querySelectorAll("button, a, [role=button], canvas").forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 5 || r.height < 5) return
    out.push({
      tag: el.tagName.toLowerCase(),
      texto: (el.textContent || "").trim().slice(0, 40),
      aria: el.getAttribute("aria-label") || "",
      x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      w: Math.round(r.width), h: Math.round(r.height),
    })
  })
  return out
})
console.log(JSON.stringify(info, null, 1))
await b.close()
