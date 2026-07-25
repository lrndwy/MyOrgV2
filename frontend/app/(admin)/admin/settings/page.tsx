"use client"

import { useRef, useState } from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { ErrorState, LoadingState } from "@/components/page-states"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { storageUrl } from "@/lib/storage-url"
import type { OrganizationSettings } from "@/lib/types"

export default function AdminSettingsPage() {
  const { setTheme } = useTheme()
  const { data, loading, error, setData } = useApi(() =>
    apiRequest<OrganizationSettings>("/settings")
  )
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<OrganizationSettings | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [iconFile, setIconFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [iconPreview, setIconPreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

  const settings = form ?? data

  function handleLogoChange(file: File | null) {
    setLogoFile(file)
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
  }

  function handleIconChange(file: File | null) {
    setIconFile(file)
    setIconPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!settings) return
    setSaving(true)
    try {
      const body = new FormData()
      body.append("web_name", settings.web_name ?? "")
      body.append("theme", settings.theme ?? "system")
      body.append(
        "allow_self_register",
        String(settings.allow_self_register ?? false)
      )
      body.append(
        "allow_cross_division_events_view",
        String(settings.allow_cross_division_events_view ?? false)
      )
      if (logoFile) body.append("logo", logoFile)
      if (iconFile) body.append("icon", iconFile)

      const updated = await apiRequest<OrganizationSettings>("/settings", {
        method: "PUT",
        body,
      })
      setData(updated)
      setForm(null)
      handleLogoChange(null)
      handleIconChange(null)
      if (logoInputRef.current) logoInputRef.current.value = ""
      if (iconInputRef.current) iconInputRef.current.value = ""
      toast.success("Pengaturan berhasil disimpan")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Pengaturan" crumbs={[{ label: "Admin", href: "/admin/settings" }, { label: "Pengaturan" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {loading ? <LoadingState rows={5} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {settings ? (
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Organisasi</CardTitle>
              <CardDescription>Konfigurasi branding dan kebijakan sistem</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nama Web</FieldLabel>
                    <Input
                      value={settings.web_name ?? ""}
                      onChange={(e) =>
                        setForm({ ...settings, web_name: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Logo</FieldLabel>
                    <div className="flex items-center gap-4">
                      <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {logoPreview || settings.logo_url ? (
                          <img
                            src={logoPreview ?? storageUrl(settings.logo_url)}
                            alt="Logo"
                            className="size-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Tidak ada
                          </span>
                        )}
                      </div>
                      <Input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="max-w-xs"
                        onChange={(e) =>
                          handleLogoChange(e.target.files?.[0] ?? null)
                        }
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Icon Web (Favicon)</FieldLabel>
                    <div className="flex items-center gap-4">
                      <div className="flex size-16 items-center justify-center overflow-hidden rounded-md border bg-muted">
                        {iconPreview || settings.icon_url ? (
                          <img
                            src={iconPreview ?? storageUrl(settings.icon_url)}
                            alt="Icon"
                            className="size-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Tidak ada
                          </span>
                        )}
                      </div>
                      <Input
                        ref={iconInputRef}
                        type="file"
                        accept="image/*"
                        className="max-w-xs"
                        onChange={(e) =>
                          handleIconChange(e.target.files?.[0] ?? null)
                        }
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>Tema</FieldLabel>
                    <Select
                      value={settings.theme ?? "system"}
                      onValueChange={(value) => {
                        if (value == null) return
                        setForm({
                          ...settings,
                          theme: value as OrganizationSettings["theme"],
                        })
                        setTheme(value)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih tema" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FieldLabel>Izinkan Registrasi Mandiri</FieldLabel>
                    <Switch
                      checked={settings.allow_self_register ?? false}
                      onCheckedChange={(checked) =>
                        setForm({ ...settings, allow_self_register: checked })
                      }
                    />
                  </Field>
                  <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FieldLabel>Lihat Event Lintas Divisi</FieldLabel>
                    <Switch
                      checked={settings.allow_cross_division_events_view ?? false}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...settings,
                          allow_cross_division_events_view: checked,
                        })
                      }
                    />
                  </Field>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Menyimpan..." : "Simpan Pengaturan"}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}
