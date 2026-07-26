"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiRequest } from "@/lib/api"
import {
  applyAppearance,
  BASE_COLORS,
  CHART_PALETTES,
  chartColors,
  DEFAULT_APPEARANCE,
  FONT_OPTIONS,
  parseAppearance,
  PRIMARY_COLORS,
  RADIUS_OPTIONS,
  serializeAppearance,
  STYLE_PRESETS,
  type AppearanceConfig,
  type BaseKey,
  type ChartKey,
  type FontKey,
  type PrimaryKey,
  type StyleKey,
} from "@/lib/appearance"
import { updateSettingsCache } from "@/hooks/use-settings"
import { cn } from "@/lib/utils"
import type { OrganizationSettings } from "@/lib/types"

function baseSwatch(key: BaseKey): string {
  const f = BASE_COLORS[key]
  return `oklch(0.6 ${f.c} ${f.h})`
}

function primarySwatch(key: PrimaryKey): string {
  const p = PRIMARY_COLORS[key].light
  return `oklch(${p.l} ${p.c} ${p.h})`
}

export function AppearanceSettings({
  savedAppearance,
}: {
  savedAppearance?: string | null
}) {
  const [draft, setDraft] = useState<AppearanceConfig>(
    () => parseAppearance(savedAppearance) ?? DEFAULT_APPEARANCE
  )
  const [saving, setSaving] = useState(false)

  // Sinkronkan ulang draft saat settings selesai dimuat (fetch async) —
  // pola "adjust state during render", tanpa effect.
  const [lastSaved, setLastSaved] = useState(savedAppearance)
  if (savedAppearance !== lastSaved) {
    setLastSaved(savedAppearance)
    setDraft(parseAppearance(savedAppearance) ?? DEFAULT_APPEARANCE)
  }

  function update(next: AppearanceConfig) {
    setDraft(next)
    applyAppearance(next)
  }

  function applyStyle(style: StyleKey) {
    update({ style, ...STYLE_PRESETS[style].config })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = new FormData()
      body.append(
        "json",
        JSON.stringify({ appearance: serializeAppearance(draft) })
      )
      const updated = await apiRequest<OrganizationSettings>("/settings", {
        method: "PUT",
        body,
      })
      updateSettingsCache(updated)
      toast.success("Kustomisasi tampilan disimpan")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    update(DEFAULT_APPEARANCE)
    toast.info("Tampilan dikembalikan ke bawaan — klik Simpan untuk permanen")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kustomisasi Tampilan</CardTitle>
        <CardDescription>
          Perubahan langsung diterapkan sebagai pratinjau live. Klik “Simpan
          Tampilan” agar berlaku untuk semua pengguna.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Style</FieldLabel>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {(Object.keys(STYLE_PRESETS) as StyleKey[]).map((key) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={draft.style === key ? "default" : "outline"}
                  onClick={() => applyStyle(key)}
                >
                  {STYLE_PRESETS[key].label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Memilih style mengisi ulang semua parameter di bawah; tiap
              parameter tetap bisa diubah sendiri.
            </p>
          </Field>

          <div className="grid gap-6 md:grid-cols-2">
            <Field>
              <FieldLabel>Base Color</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BASE_COLORS) as BaseKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ ...draft, base: key })}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                      draft.base === key
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-3.5 rounded-full border"
                      style={{ backgroundColor: baseSwatch(key) }}
                    />
                    {BASE_COLORS[key].label}
                  </button>
                ))}
              </div>
            </Field>

            <Field>
              <FieldLabel>Warna Primer (Theme)</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRIMARY_COLORS) as PrimaryKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    title={PRIMARY_COLORS[key].label}
                    aria-label={PRIMARY_COLORS[key].label}
                    onClick={() => update({ ...draft, primary: key })}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform hover:scale-110",
                      draft.primary === key
                        ? "border-foreground"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: primarySwatch(key) }}
                  />
                ))}
              </div>
            </Field>
          </div>

          <Field>
            <FieldLabel>Warna Chart</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CHART_PALETTES) as ChartKey[]).map((key) => {
                const colors =
                  CHART_PALETTES[key].colors ??
                  chartColors({ ...draft, chart: key })
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ ...draft, chart: key })}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                      draft.chart === key
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span className="flex gap-0.5" aria-hidden>
                      {colors.map((c, i) => (
                        <span
                          key={i}
                          className="size-3 rounded-full"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                    {CHART_PALETTES[key].label}
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="grid gap-6 md:grid-cols-2">
            <Field>
              <FieldLabel>Font Heading</FieldLabel>
              <Select
                value={draft.headingFont}
                onValueChange={(v) => {
                  if (v == null) return
                  update({ ...draft, headingFont: v as FontKey })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FONT_OPTIONS) as FontKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {FONT_OPTIONS[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Font Teks</FieldLabel>
              <Select
                value={draft.textFont}
                onValueChange={(v) => {
                  if (v == null) return
                  update({ ...draft, textFont: v as FontKey })
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FONT_OPTIONS) as FontKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {FONT_OPTIONS[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>Radius Sudut</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {RADIUS_OPTIONS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={draft.radius === r ? "default" : "outline"}
                  onClick={() => update({ ...draft, radius: r })}
                >
                  {r === 0 ? "Kotak" : `${r}rem`}
                </Button>
              ))}
            </div>
          </Field>

          <div className="rounded-xl border p-4">
            <p className="font-heading text-base font-semibold">
              Pratinjau Heading — {FONT_OPTIONS[draft.headingFont].label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Teks isi memakai {FONT_OPTIONS[draft.textFont].label}. Tombol dan
              elemen di seluruh aplikasi mengikuti warna serta radius terpilih.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm">
                Tombol Primer
              </Button>
              <Button type="button" size="sm" variant="secondary">
                Sekunder
              </Button>
              <Button type="button" size="sm" variant="outline">
                Outline
              </Button>
              <span className="flex gap-1" aria-hidden>
                {chartColors(draft).map((c, i) => (
                  <span
                    key={i}
                    className="size-4 rounded-sm"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Tampilan"}
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset ke Bawaan
            </Button>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
