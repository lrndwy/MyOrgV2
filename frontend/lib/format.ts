export function unwrapList<T>(
  data: T[] | { items?: T[] } | null | undefined
): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return data.items ?? []
}

/** Map GORM JSON (`ID`, `CreatedAt`, …) and backend field names to frontend types. */
function normalizeRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (key === "ID") continue
    result[key] = normalizeApiData(value)
  }

  if (obj.id !== undefined) {
    result.id = obj.id
  } else if (obj.ID !== undefined) {
    result.id = obj.ID
  }

  if (result.created_at == null && result.CreatedAt != null) {
    result.created_at = result.CreatedAt
  }
  if (result.updated_at == null && result.UpdatedAt != null) {
    result.updated_at = result.UpdatedAt
  }
  if (result.type == null && result.violation_type != null) {
    result.type = result.violation_type
  }
  if (result.issued_at == null && result.issued_date != null) {
    result.issued_at = result.issued_date
  }
  if (result.attended_at == null && result.checked_in_at != null) {
    result.attended_at = result.checked_in_at
  }
  if (result.total_income == null && result.income != null) {
    result.total_income = result.income
  }
  if (result.total_expense == null && result.expense != null) {
    result.total_expense = result.expense
  }
  if (result.recent_transactions == null && Array.isArray(result.recent)) {
    result.recent_transactions = result.recent
  }
  if (
    result.total == null &&
    result.present != null &&
    result.permitted != null &&
    result.absent != null
  ) {
    result.total =
      Number(result.present) +
      Number(result.permitted) +
      Number(result.absent) +
      Number(result.rejected ?? 0)
  }

  return result
}

export function normalizeApiData<T>(data: T): T {
  if (data == null || typeof data !== "object") return data
  if (Array.isArray(data)) {
    return data.map((item) => normalizeApiData(item)) as T
  }
  return normalizeRecord(data as Record<string, unknown>) as T
}

export function formatDate(value?: string | null) {
  if (!value) return "-"
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function formatCurrency(value?: number | null) {
  if (value == null) return "-"
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}
