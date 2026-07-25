import { apiRequest } from "@/lib/api"
import type { LoginResponse, User } from "@/lib/types"

const TOKEN_KEY = "myorg_token"
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

let memoryToken: string | null = null

/** Cookie on the Next.js origin — required by middleware (localStorage is invisible there). */
function setClientAuthCookie(token: string | null) {
  if (typeof document === "undefined") return
  if (token) {
    document.cookie = `token=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
  } else {
    document.cookie = "token=; Path=/; SameSite=Lax; Max-Age=0"
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return memoryToken
  return memoryToken ?? localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  memoryToken = token
  if (typeof window === "undefined") return
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
  setClientAuthCookie(token)
}

export async function login(username: string, password: string) {
  const data = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
  })
  if (data.token) setStoredToken(data.token)
  return data
}

export async function register(payload: {
  username: string
  email: string
  password: string
  full_name: string
}) {
  const data = await apiRequest<LoginResponse>("/auth/register", {
    method: "POST",
    body: payload,
  })
  if (data.token) setStoredToken(data.token)
  return data
}

export async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" })
  } finally {
    setStoredToken(null)
  }
}

export async function getMe() {
  return apiRequest<User>("/me")
}

export async function getPermissions() {
  const data = await apiRequest<string[] | { permissions: string[] }>(
    "/me/permissions"
  )
  if (Array.isArray(data)) return data
  return data.permissions ?? []
}

export function hasPermission(
  permissions: string[],
  required?: string | string[]
): boolean {
  if (!required) return true
  const codes = Array.isArray(required) ? required : [required]
  return codes.some((code) => permissions.includes(code))
}
