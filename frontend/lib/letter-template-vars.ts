/** Placeholders filled automatically — not shown in the create form. */
const AUTO_TEMPLATE_VARS = new Set([
  "{NOMOR_SURAT}",
  "{NOMOR}",
  "{LETTER_CODE}",
  "{PERIHAL}",
  "{SUBJECT}",
])

/** System placeholders in number format template — not user input. */
export const SYSTEM_NUMBER_PLACEHOLDERS = new Set([
  "number",
  "code",
  "month_roman",
  "year",
  "nomor",
  "nomor_surat",
  "letter_code",
])

export function isAutoTemplateVar(name: string) {
  const upper = name.trim().toUpperCase()
  return AUTO_TEMPLATE_VARS.has(upper)
}

export function isSystemNumberPlaceholder(name: string) {
  const base = name.replace(/^\{|\}$/g, "").toLowerCase().split(":")[0]
  return SYSTEM_NUMBER_PLACEHOLDERS.has(base)
}

export function filterUserTemplateVars(variables: string[]) {
  return variables.filter((v) => !isAutoTemplateVar(v))
}

export function filterDocxTemplateVars(
  variables: string[],
  numberPlaceholders: string[]
) {
  const numberKeys = new Set(numberPlaceholders.map((k) => k.toLowerCase()))
  return filterUserTemplateVars(variables).filter((v) => {
    const key = normalizeVarKey(v).toLowerCase()
    return !numberKeys.has(key)
  })
}

export function humanizeTemplateVar(name: string) {
  return name
    .replace(/^\{|\}$/g, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function humanizeNumberPlaceholder(name: string) {
  return humanizeTemplateVar(name)
}

/** Parse custom placeholders from a category number format template (client-side fallback). */
export function extractCustomNumberPlaceholders(template: string): string[] {
  if (!template.trim()) return []
  const seen = new Set<string>()
  const out: string[] = []
  const re = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(template)) !== null) {
    const name = match[1]
    if (isSystemNumberPlaceholder(name)) continue
    const key = name.toLowerCase().split(":")[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

export function normalizeVarKey(name: string) {
  return name.replace(/[{}]/g, "").toUpperCase()
}

/** Map common template vars to letter.recipient when present. */
export function pickRecipientFromVars(values: Record<string, string>) {
  for (const key of [
    "TUJUAN_INSTANSI",
    "PENERIMA",
    "RECIPIENT",
    "KEPADA",
    "TUJUAN",
  ]) {
    const v = values[key]?.trim()
    if (v) return v
  }
  return undefined
}

export function buildOutgoingVariableValues(
  subject: string,
  varValues: Record<string, string>,
  numberSegments: Record<string, string> = {}
) {
  const values: Record<string, string> = {}
  for (const [k, v] of Object.entries(numberSegments)) {
    if (v.trim()) {
      values[normalizeVarKey(k)] = v.trim()
    }
  }
  for (const [k, v] of Object.entries(varValues)) {
    values[normalizeVarKey(k)] = v
  }
  if (subject.trim()) {
    values.PERIHAL = subject.trim()
    values.SUBJECT = subject.trim()
  }
  return values
}
