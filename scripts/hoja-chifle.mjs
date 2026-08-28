import { chromium } from "playwright"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1920, height: 1000 } })).newPage()
await p.goto(pathToFileURL(resolve("tmp/hoja-chifle.html")).href)
await p.waitForTimeout(2500)
await p.screenshot({ path: resolve("tmp/hoja-chifle.png"), fullPage: true })
await b.close()
console.log("ok")
