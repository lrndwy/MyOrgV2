"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  getMe,
  getPermissions,
  getStoredToken,
  logout as authLogout,
} from "@/lib/auth"
import type { User } from "@/lib/types"

interface AuthContextValue {
  user: User | null
  permissions: string[]
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  hasPermission: (code?: string | string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null)
      setPermissions([])
      setLoading(false)
      return
    }
    try {
      const [me, perms] = await Promise.all([getMe(), getPermissions()])
      setUser(me)
      setPermissions(perms)
    } catch {
      setUser(null)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  const logout = useCallback(async () => {
    await authLogout()
    setUser(null)
    setPermissions([])
  }, [])

  const hasPermission = useCallback(
    (code?: string | string[]) => {
      if (!code) return true
      const codes = Array.isArray(code) ? code : [code]
      return codes.some((c) => permissions.includes(c))
    },
    [permissions]
  )

  return (
    <AuthContext.Provider
      value={{ user, permissions, loading, refresh, logout, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
