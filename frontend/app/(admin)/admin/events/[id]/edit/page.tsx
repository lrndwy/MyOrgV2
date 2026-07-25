"use client"

import { useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { ErrorState, LoadingState } from "@/components/page-states"
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
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import type { Event } from "@/lib/types"

function toLocalDateTime(value?: string) {
  return value?.slice(0, 16) ?? ""
}

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const eventQuery = useApi(() => apiRequest<Event>(`/events/${id}`), [id])
  const [draft, setDraft] = useState<Partial<Event> | null>(null)
  const [saving, setSaving] = useState(false)

  const baseForm = eventQuery.data
    ? {
        ...eventQuery.data,
        start_time: toLocalDateTime(eventQuery.data.start_time),
        end_time: toLocalDateTime(eventQuery.data.end_time),
      }
    : null
  const form = draft ?? baseForm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    try {
      await apiRequest(`/events/${id}`, {
        method: "PUT",
        body: form,
      })
      toast.success("Event diperbarui")
      router.push("/admin/events")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Edit Event"
        crumbs={[
          { label: "Event", href: "/admin/events" },
          { label: form?.title ?? "Edit" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {eventQuery.loading ? <LoadingState rows={5} /> : null}
        {eventQuery.error ? <ErrorState message={eventQuery.error} /> : null}
        {form ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit Event</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Judul</FieldLabel>
                    <Input
                      value={form.title ?? ""}
                      onChange={(e) =>
                        setDraft({ ...form, title: e.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Deskripsi</FieldLabel>
                    <Textarea
                      value={form.description ?? ""}
                      onChange={(e) =>
                        setDraft({ ...form, description: e.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Lokasi</FieldLabel>
                    <Input
                      value={form.location ?? ""}
                      onChange={(e) =>
                        setDraft({ ...form, location: e.target.value })
                      }
                    />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field>
                      <FieldLabel>Waktu Mulai</FieldLabel>
                      <Input
                        type="datetime-local"
                        value={form.start_time ?? ""}
                        onChange={(e) =>
                          setDraft({ ...form, start_time: e.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Waktu Selesai</FieldLabel>
                      <Input
                        type="datetime-local"
                        value={form.end_time ?? ""}
                        onChange={(e) =>
                          setDraft({ ...form, end_time: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <Field className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FieldLabel>Izinkan Perizinan</FieldLabel>
                    <Switch
                      checked={form.allow_permission ?? false}
                      onCheckedChange={(checked) =>
                        setDraft({ ...form, allow_permission: checked })
                      }
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      Simpan
                    </Button>
                    <Button variant="outline" render={<Link href="/admin/events" />}>
                      Batal
                    </Button>
                  </div>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}
