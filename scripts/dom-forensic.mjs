/**
 * dom-forensic · introspect the live DOM for every occurrence of the 4
 * label strings (case-insensitive · accent-insensitive). Reports each
 * matching node's text content, tag, classList, and ancestor chain.
 *
 * Runs against the deployed preview URL · NOT the local dev server.
 */
import { chromium } from "playwright"

const URL =
  process.argv[2] ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app"

const PATTERNS = ["carrito", "historia", "contacto", "rese"]

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
})
const page = await ctx.newPage()

console.log("→ navigating", URL)
await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 })
await page.waitForTimeout(3000)

const result = await page.evaluate((patterns) => {
  const hits = []
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  // walk every element AND every text node
  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  let textHits = []
  while ((node = treeWalker.nextNode())) {
    const t = node.textContent?.trim() ?? ""
    if (!t) continue
    const haystack = norm(t)
    for (const p of patterns) {
      if (haystack.includes(p)) {
        const parent = node.parentElement
        textHits.push({
          pattern: p,
          text: t.slice(0, 200),
          parentTag: parent?.tagName?.toLowerCase() ?? "?",
          parentClass: parent?.className?.toString?.()?.slice(0, 120) ?? "",
          path: buildPath(parent),
          ariaLabel: parent?.getAttribute?.("aria-label") ?? "",
          isInCanvas: !!parent?.closest?.("canvas"),
          isInR3fHtml: !!parent?.closest?.("[data-r3f-html='1'], .react-three-html, .r3f-html"),
        })
      }
    }
  }
  // Walk attributes too · aria-label, title, alt
  const ELS = document.querySelectorAll("*")
  let attrHits = []
  ELS.forEach((el) => {
    const a = el.getAttribute?.("aria-label") ?? ""
    const t = el.getAttribute?.("title") ?? ""
    const aRoot = norm(a + " " + t)
    for (const p of patterns) {
      if (aRoot.includes(p)) {
        attrHits.push({
          pattern: p,
          aria: a,
          title: t,
          tag: el.tagName.toLowerCase(),
          path: buildPath(el),
        })
      }
    }
  })

  function buildPath(el, depth = 0) {
    if (!el || depth > 6) return ""
    const tag = el.tagName?.toLowerCase() ?? "?"
    const id = el.id ? "#" + el.id : ""
    const cls = (el.className?.toString?.() || "").split(/\s+/).slice(0, 2).map(c => "." + c).join("")
    const here = tag + id + cls
    const parent = el.parentElement
    return parent ? buildPath(parent, depth + 1) + " > " + here : here
  }
  return { textHits, attrHits }
}, PATTERNS)

console.log("\n=== TEXT NODES matching pattern ===")
console.log("(count:", result.textHits.length, ")")
for (const h of result.textHits) {
  console.log(`\n  pattern: ${h.pattern}`)
  console.log(`  text: "${h.text}"`)
  console.log(`  parent: <${h.parentTag} class="${h.parentClass}">`)
  console.log(`  path: ${h.path.slice(-200)}`)
  console.log(`  inCanvas: ${h.isInCanvas} · inR3fHtml: ${h.isInR3fHtml}`)
}

console.log("\n=== ATTRIBUTE matches (aria-label, title) ===")
console.log("(count:", result.attrHits.length, ")")
for (const h of result.attrHits) {
  console.log(`\n  pattern: ${h.pattern}`)
  console.log(`  aria-label: "${h.aria}"`)
  console.log(`  title:      "${h.title}"`)
  console.log(`  tag: <${h.tag}>`)
  console.log(`  path: ${h.path.slice(-200)}`)
}

await browser.close()
