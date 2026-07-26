"use client"

import { useCallback, useEffect, useState } from "react"
import { apiRequest } from "@/lib/api"
import type { OrganizationSettings } from "@/lib/types"

let cached: OrganizationSettings | null = null
let inflight: Promise<OrganizationSettings> | null = null

function fetchSettings(): Promise<OrganizationSettings> {
  if (inflight) return inflight
  inflight = apiRequest<OrganizationSettings>("/settings").then((s) => {
    cached = s
    inflight = null
    return s
  })
  return inflight
}

/**
 * Perbarui cache settings modul ini setelah PUT berhasil, supaya komponen yang
 * mount belakangan (mis. AppearanceSync) tidak memakai nilai basi.
 */
export function updateSettingsCache(next: OrganizationSettings) {
  cached = next
}

export function useSettings() {
  const [settings, setSettings] = useState<OrganizationSettings | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) {
      setSettings(cached)
      setLoading(false)
      return
    }
    let cancelled = false
    fetchSettings().then((s) => {
      if (!cancelled) {
        setSettings(s)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refetch = useCallback(() => {
    inflight = null
    cached = null
    setLoading(true)
    fetchSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  return { settings, loading, refetch }
}
