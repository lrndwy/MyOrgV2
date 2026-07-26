"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { unwrapList } from "@/lib/format"
import type { Division } from "@/lib/types"

export default function CreateEventPage() {
  const router = useRouter()
  const divisions = useApi(() =>
    apiRequest<Division[] | { items: Division[] }>("/divisions").then(unwrapList)
  )
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_time: "",
    end_time: "",
    division_id: "",
    allow_permission: true,
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiRequest("/events", {
        method: "POST",
        body: {
          ...form,
          division_id: form.division_id ? Number(form.division_id) : null,
        },
      })
      toast.success("Event dibuat")
      router.push("/admin/events")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat event")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Buat Event"
        crumbs={[
          { label: "Event", href: "/admin/events" },
          { label: "Buat" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>Form Event Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Judul</FieldLabel>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Deskripsi</FieldLabel>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Lokasi</FieldLabel>
                  <Input
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Divisi (kosong = General)</FieldLabel>
                  <Select
                    value={form.division_id}
                    onValueChange={(v) => {
                      if (v == null) return
                      setForm({ ...form, division_id: v })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="General" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">General</SelectItem>
                      {divisions.data?.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Waktu Mulai</FieldLabel>
                    <Input
                      type="datetime-local"
                      value={form.start_time}
                      onChange={(e) =>
                        setForm({ ...form, start_time: e.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Waktu Selesai</FieldLabel>
                    <Input
                      type="datetime-local"
                      value={form.end_time}
                      onChange={(e) =>
                        setForm({ ...form, end_time: e.target.value })
                      }
                      required
                    />
                  </Field>
                </div>
                <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FieldLabel>Izinkan Perizinan</FieldLabel>
                  <Switch
                    checked={form.allow_permission}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, allow_permission: checked })
                    }
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Menyimpan..." : "Simpan"}
                  </Button>
                  <Button variant="outline" render={<Link href="/admin/events" />}>
                    Batal
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
