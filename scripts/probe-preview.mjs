/**
 * Probe-preview · headless Chromium against the landing-v2 preview URL.
 * Captures console messages, page errors, network failures, and the
 * stack trace of the "Application error · client-side exception" so we
 * can fix the root cause.
 */
import { chromium } from "playwright"

const URL =
  process.argv[2] ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app"

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
})
const page = await ctx.newPage()
const consoles = []
const pageErrors = []
const failedRequests = []

page.on("console", (msg) => {
  consoles.push({ type: msg.type(), text: msg.text().slice(0, 800) })
})
page.on("pageerror", (err) => {
  pageErrors.push({ message: err.message, stack: String(err.stack).slice(0, 1500) })
})
page.on("requestfailed", (req) => {
  failedRequests.push({ url: req.url(), failure: req.failure()?.errorText ?? "?" })
})

const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 })
console.log("HTTP:", resp?.status())
await page.waitForTimeout(2500)

const visible = await page.evaluate(() => document.body.innerText.slice(0, 1500))
console.log("\nBODY innerText (first 1500):")
console.log(visible)

console.log("\nCONSOLE (filtered to error/warning):")
for (const c of consoles) {
  if (c.type === "error" || c.type === "warning") console.log("  [" + c.type + "]", c.text)
}

console.log("\nPAGE ERRORS:")
for (const e of pageErrors) {
  console.log("  ->", e.message)
  console.log("     ", e.stack.split("\n").slice(0, 6).join("\n      "))
}

console.log("\nFAILED REQUESTS:")
for (const f of failedRequests) {
  console.log("  ✗", f.failure, f.url)
}

await browser.close()
