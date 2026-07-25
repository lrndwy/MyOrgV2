import { chromium } from "playwright"
const BASE = "http://localhost:3000"
const errors = []
const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext()).newPage()
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()) })
page.on("pageerror", (err) => errors.push(err.message))

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
await page.fill("#username", "admin")
await page.fill("#password", "admin123")
await Promise.all([
  page.waitForURL("**/dashboard**", { timeout: 15000 }).catch(() => null),
  page.click('button[type="submit"]'),
])
await page.waitForTimeout(1000)

await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" })
await page.waitForTimeout(800)

const fileInputs = page.locator('input[type="file"]')
const count = await fileInputs.count()
console.log("file inputs found:", count)
await fileInputs.nth(0).setInputFiles("/tmp/test-logo.png")
await page.waitForTimeout(300)

const respPromise = page.waitForResponse((r) => r.url().includes("/settings") && r.request().method() === "PUT")
await page.click('button[type="submit"]')
const resp = await respPromise
console.log("PUT /settings status:", resp.status())
const respBody = await resp.text()
console.log("PUT /settings body:", respBody.slice(0, 400))

await page.waitForTimeout(1000)
const toastText = await page.locator("body").innerText().catch(() => "")
console.log("has success toast:", toastText.includes("berhasil disimpan"))

// verify logo image element now points to a working src
const logoImg = page.locator('img[alt="Logo"]')
if (await logoImg.count()) {
  const src = await logoImg.getAttribute("src")
  console.log("logo img src:", src)
}

console.log("\n=== ERRORS ===")
for (const e of errors) console.log("-", e.slice(0, 300))
await browser.close()
process.exit(0)
