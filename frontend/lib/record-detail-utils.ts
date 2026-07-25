import { formatCurrency, formatDate } from "@/lib/format"
import { storageUrl } from "@/lib/storage-url"

const IMAGE_KEY =
  /(?:^|_)(?:banner|avatar|icon|logo|receipt|proof|selfie|signature|document|file|image|photo|attachment)(?:_|$)|_url$|_image_url$/

const SKIP_KEYS = new Set([
  "password",
  "password_hash",
  "variable_values",
  "custom_answers",
  "field_options",
])

const TITLE_KEYS = [
  "title",
  "name",
  "full_name",
  "subject",
  "letter_code",
  "username",
  "code",
] as const

const HERO_KEYS = [
  "banner_image_url",
  "banner_url",
  "avatar_url",
  "receipt_url",
  "proof_url",
  "document_url",
  "selfie_url",
  "signature_url",
  "file_url",
  "logo_url",
  "icon_url",
  "attachment_url",
  "template_url",
] as const

export type DetailItem = {
  label: string
  value: string
  raw?: unknown
  type: "text" | "badge" | "date" | "currency" | "boolean" | "html" | "link"
}

export type DetailImage = {
  label: string
  url: string
}

function humanizeKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\bid\b/gi, "ID")
    .replace(/\burl\b/gi, "URL")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function isImageKey(key: string) {
  return IMAGE_KEY.test(key)
}

function isImageUrl(value: string) {
  if (!value.startsWith("http") && !value.startsWith("/storage")) return false
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(value) || value.includes("/storage/")
}

function stringifyValue(value: unknown): string {
  if (value == null || value === "") return "-"
  if (typeof value === "boolean") return value ? "Ya" : "Tidak"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if ("name" in obj && typeof obj.name === "string") return obj.name
    if ("full_name" in obj && typeof obj.full_name === "string")
      return obj.full_name
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function inferType(key: string, value: unknown): DetailItem["type"] {
  if (typeof value === "boolean") return "boolean"
  if (key === "status" || key.endsWith("_status") || key === "sp_level")
    return "badge"
  if (key.includes("amount") || key === "balance") return "currency"
  if (
    key.includes("_at") ||
    key.includes("_time") ||
    key.includes("_date") ||
    key === "publish_date" ||
    key === "letter_date" ||
    key === "transaction_date"
  )
    return "date"
  if (key === "content") return "html"
  if (
    key === "description" &&
    typeof value === "string" &&
    /<[a-z][\s\S]*>/i.test(value)
  )
    return "html"
  if (
    typeof value === "string" &&
    (value.startsWith("http") || value.startsWith("/storage"))
  )
    return "link"
  return "text"
}

function formatValue(key: string, value: unknown, type: DetailItem["type"]) {
  if (value == null || value === "") return "-"
  if (type === "currency" && typeof value === "number") return formatCurrency(value)
  if (type === "date" && typeof value === "string") {
    try {
      return formatDate(value)
    } catch {
      return value
    }
  }
  if (type === "boolean") return value ? "Ya" : "Tidak"
  if (type === "link" && typeof value === "string") return value
  return stringifyValue(value)
}

export function pickTitle(row: Record<string, unknown>) {
  for (const key of TITLE_KEYS) {
    const v = row[key]
    if (typeof v === "string" && v.trim()) return v
  }
  const user = row.user
  if (user && typeof user === "object") {
    const u = user as Record<string, unknown>
    if (typeof u.full_name === "string" && u.full_name.trim()) return u.full_name
    if (typeof u.username === "string" && u.username.trim()) return u.username
  }
  if (row.id != null) return `Record #${row.id}`
  return "Detail"
}

export function pickSubtitle(row: Record<string, unknown>) {
  const user = row.user
  if (user && typeof user === "object") {
    const u = user as Record<string, unknown>
    if (typeof u.email === "string" && u.email.trim()) return u.email
  }
  for (const key of ["description", "email", "type", "code", "module"] as const) {
    const v = row[key]
    if (typeof v === "string" && v.trim() && v.length < 120) return v
  }
  return undefined
}

export function pickHeroImage(row: Record<string, unknown>): string | null {
  for (const key of HERO_KEYS) {
    const v = row[key]
    if (typeof v === "string" && v.trim()) {
      const url = storageUrl(v)
      if (url) return url
    }
  }
  for (const [key, v] of Object.entries(row)) {
    if (typeof v === "string" && isImageKey(key) && v.trim()) {
      const url = storageUrl(v)
      if (url && isImageUrl(url)) return url
    }
  }
  return null
}

export function extractImages(row: Record<string, unknown>): DetailImage[] {
  const images: DetailImage[] = []
  const seen = new Set<string>()

  function add(label: string, raw: string) {
    const url = storageUrl(raw)
    if (!url || seen.has(url)) return
    if (!isImageUrl(url) && !isImageKey(label)) return
    seen.add(url)
    images.push({ label: humanizeKey(label), url })
  }

  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" && isImageKey(key)) add(key, value)
  }
  return images
}

export function buildDetailItems(row: Record<string, unknown>): DetailItem[] {
  const items: DetailItem[] = []
  const hero = pickHeroImage(row)

  for (const [key, value] of Object.entries(row)) {
    if (SKIP_KEYS.has(key)) continue
    if (key === "content") continue
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>
      if ("name" in nested || "full_name" in nested || "code" in nested) {
        items.push({
          label: humanizeKey(key),
          value: stringifyValue(value),
          raw: value,
          type: "text",
        })
      }
      continue
    }
    if (typeof value === "string" && isImageKey(key)) {
      const url = storageUrl(value)
      if (url && url === hero) continue
    }
    const type = inferType(key, value)
    items.push({
      label: humanizeKey(key),
      value: formatValue(key, value, type),
      raw: value,
      type,
    })
  }

  return items
}

export function rowToRecord(row: unknown): Record<string, unknown> {
  if (row && typeof row === "object") return row as Record<string, unknown>
  return {}
}
