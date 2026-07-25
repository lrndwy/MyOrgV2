/** Portal anggota — fitur di sidebar web user. */
export const MEMBER_PORTAL_PERMISSIONS = new Set([
  "events.view",
  "events.view_all",
  "permission.submit",
  "attendance.submit",
])

/** Panel admin — fitur operasional di /admin/*. */
export const ADMIN_PANEL_PERMISSIONS = new Set([
  "settings.manage",
  "users.view",
  "users.create",
  "users.edit",
  "users.delete",
  "users.import",
  "roles.view",
  "roles.create",
  "roles.edit",
  "roles.delete",
  "divisions.view",
  "divisions.create",
  "divisions.edit",
  "divisions.delete",
  "events.create",
  "events.edit",
  "events.delete",
  "attendance.approve",
  "violations.view",
  "violations.manage",
  "letters.view",
  "letters.manage",
  "announcement.create",
  "finance.view",
  "finance.create",
  "finance.edit",
  "finance.delete",
  "finance.categories.manage",
  "storage.view",
  "storage.upload",
  "storage.delete",
  "storage.manage",
  "backup.manage",
])

export type PermissionScope = "member" | "admin" | "both"

export function permissionScope(code: string): PermissionScope {
  const inMember = MEMBER_PORTAL_PERMISSIONS.has(code)
  const inAdmin = ADMIN_PANEL_PERMISSIONS.has(code)
  if (inMember && inAdmin) return "both"
  if (inMember) return "member"
  if (inAdmin) return "admin"
  // Default: operasional → admin panel
  return "admin"
}

export const SCOPE_LABELS: Record<PermissionScope, string> = {
  member: "Portal Anggota",
  admin: "Panel Admin",
  both: "Keduanya",
}
