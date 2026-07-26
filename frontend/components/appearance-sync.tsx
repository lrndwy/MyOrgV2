"use client"

import { useEffect } from "react"
import { applyAppearance, parseAppearance } from "@/lib/appearance"
import { useSettings } from "@/hooks/use-settings"

/**
 * Terapkan kustomisasi tampilan organisasi (kolom appearance di settings)
 * begitu settings termuat. Halaman pengaturan meng-apply draft-nya sendiri
 * secara live; komponen ini hanya menangani kondisi awal setelah load.
 */
export function AppearanceSync() {
  const { settings } = useSettings()

  useEffect(() => {
    if (!settings) return
    applyAppearance(parseAppearance(settings.appearance))
  }, [settings])

  return null
}
