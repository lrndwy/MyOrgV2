import { chromium } from "playwright"

const BASE = process.env.FRONTEND_URL || "http://localhost:3000"

const pages = [
  "/dashboard",
  "/profile",
  "/events",
  "/my-permissions",
  "/announcements",
  "/admin",
  "/admin/dashboard",
  "/admin/users",
  "/admin/users/create",
  "/admin/roles",
  "/admin/roles/create",
  "/admin/divisions",
  "/admin/events",
  "/admin/events/create",
  "/admin/permissions",
  "/admin/violations",
  "/admin/letters/incoming",
  "/admin/letters/outgoing",
  "/admin/letters/categories",
  "/admin/letters/templates",
  "/admin/backup",
  "/admin/storage",
  "/admin/announcements",
  "/admin/announcements/create",
  "/admin/finance",
  "/admin/settings",
]

const errors = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

page.on("console", (msg) => {
  if (msg.type() === "error") {
    errors.push({ url: page.url(), text: msg.text() })
  }
})
page.on("pageerror", (err) => {
  pageErrors.push({ url: page.url(), text: err.message })
})

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
await page.fill("#username", "admin")
await page.fill("#password", "admin123")
await Promise.all([
  page.waitForURL("**/dashboard**", { timeout: 15000 }).catch(() => null),
  page.click('button[type="submit"]'),
])

await page.waitForTimeout(1500)
const afterLogin = page.url()
console.log("after login:", afterLogin)

if (!afterLogin.includes("/dashboard")) {
  console.log("LOGIN FAILED — still at", afterLogin)
  await page.screenshot({ path: "/tmp/myorg-login-fail.png", fullPage: true })
  await browser.close()
  process.exit(1)
}

for (const path of pages) {
  const before = errors.length + pageErrors.length
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 20000 }).catch((e) => {
    pageErrors.push({ url: path, text: `navigation: ${e.message}` })
  })
  await page.waitForTimeout(900)
  const bodyText = await page.locator("body").innerText().catch(() => "")
  const crashed =
    bodyText.includes("Application error") ||
    bodyText.includes("Unhandled Runtime Error") ||
    bodyText.includes("useAuth must be used")
  const added = errors.length + pageErrors.length - before
  console.log(`${crashed ? "CRASH" : "ok"} ${path} (+${added} console/page errors)`)
  if (crashed) {
    await page.screenshot({ path: `/tmp/myorg-crash${path.replaceAll("/", "_")}.png`, fullPage: true })
  }
}

// Dynamic navigation: member event detail via card click
try {
  await page.goto(`${BASE}/events`, { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  const detailLink = page.locator('a[href^="/events/"]').first()
  if (await detailLink.count()) {
    const before = errors.length + pageErrors.length
    await detailLink.click()
    await page.waitForTimeout(1200)
    const added = errors.length + pageErrors.length - before
    console.log(`${added > 0 ? "ERR " : "ok  "} /events/[id] via card click (+${added})`)
  } else {
    console.log("skip /events/[id]: no event cards found")
  }
} catch (e) {
  console.log("ERR /events/[id] navigation:", e.message)
}

// Dynamic navigation: admin create dialog open (advanced table CRUD modal)
for (const [listPath, addLabel] of [["/admin/roles", "Tambah"], ["/admin/divisions", "Tambah"]]) {
  try {
    await page.goto(`${BASE}${listPath}`, { waitUntil: "networkidle" })
    await page.waitForTimeout(600)
    const before = errors.length + pageErrors.length
    const btn = page.locator(`button:has-text("${addLabel}")`).first()
    if (await btn.count()) {
      await btn.click()
      await page.waitForTimeout(800)
      const added = errors.length + pageErrors.length - before
      console.log(`${added > 0 ? "ERR " : "ok  "} ${listPath} create-dialog open (+${added})`)
    } else {
      console.log(`skip ${listPath} create-dialog: button not found`)
    }
  } catch (e) {
    console.log(`ERR ${listPath} create-dialog:`, e.message)
  }
}

console.log("\n=== CONSOLE ERRORS ===")
for (const e of errors) console.log("-", e.url, e.text.slice(0, 300))
console.log("\n=== PAGE ERRORS ===")
for (const e of pageErrors) console.log("-", e.url, e.text.slice(0, 300))

await browser.close()
process.exit(pageErrors.length > 0 ? 1 : 0)
