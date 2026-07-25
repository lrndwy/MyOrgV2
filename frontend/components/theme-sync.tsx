"use client"

import { useEffect } from "react"
import { useTheme } from "next-themes"
import { apiRequest } from "@/lib/api"
import type { OrganizationSettings } from "@/lib/types"

export function ThemeSync() {
  const { setTheme } = useTheme()

  useEffect(() => {
    let cancelled = false
    apiRequest<OrganizationSettings>("/settings")
      .then((s) => {
        if (!cancelled && s.theme) {
          setTheme(s.theme)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [setTheme])

  return null
}
