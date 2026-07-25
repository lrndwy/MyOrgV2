"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  ConfirmDialog,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { FormSelect } from "@/components/form-select"
import { ImageUploadField } from "@/components/image-upload-field"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
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
import { toLocalInput, toRFC3339 } from "@/lib/datetime"
import { formatDate, unwrapList } from "@/lib/format"
import { eventBannerUrl } from "@/lib/event-banner"
import type { Division, Event } from "@/lib/types"

const emptyForm = {
  title: "",
  description: "",
  location: "",
  start_time: "",
  end_time: "",
  division_id: "",
  allow_permission: false,
}

export default function AdminEventsPage() {
  const { data, loading, error, refetch } = useApi(async () => {
    const result = await apiRequest<Event[] | { items: Event[] }>("/events")
    return unwrapList(result)
  })
  const divisions = useApi(() =>
    apiRequest<Division[] | { items: Division[] }>("/divisions").then(unwrapList)
  )

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [deleting, setDeleting] = useState<Event | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [bannerFile, setBannerFile] = useState<File | null>(null)

  const rows = useMemo(() => data ?? [], [data])
  const divisionOptions = useMemo(
    () =>
      (divisions.data ?? []).map((d) => ({
        value: String(d.id),
        label: d.name,
      })),
    [divisions.data]
  )

  const stats = useMemo(
    () => [
      { label: "Total Event", value: rows.length },
      { label: "Upcoming", value: rows.filter((e) => e.status === "upcoming").length },
      { label: "Ongoing", value: rows.filter((e) => e.status === "ongoing").length },
      { label: "Finished", value: rows.filter((e) => e.status === "finished").length },
    ],
    [rows]
  )

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setBannerFile(null)
    setOpen(true)
  }

  function openEdit(event: Event) {
    setEditing(event)
    setForm({
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      start_time: toLocalInput(event.start_time),
      end_time: toLocalInput(event.end_time),
      division_id: event.division_id ? String(event.division_id) : "",
      allow_permission: !!event.allow_permission,
    })
    setBannerFile(null)
    setOpen(true)
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await apiRequest(`/events/${deleting.id}`, { method: "DELETE" })
      toast.success("Event dihapus")
      setDeleting(null)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    }
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      if (editing && !bannerFile) {
        await apiRequest(`/events/${editing.id}`, {
          method: "PUT",
          body: {
            ...form,
            start_time: toRFC3339(form.start_time),
            end_time: toRFC3339(form.end_time),
            division_id: form.division_id ? Number(form.division_id) : null,
          },
        })
      } else {
        const body = new FormData()
        body.append("title", form.title)
        body.append("description", form.description)
        body.append("location", form.location)
        body.append("start_time", toRFC3339(form.start_time))
        body.append("end_time", toRFC3339(form.end_time))
        body.append("allow_permission", String(form.allow_permission))
        if (form.division_id) body.append("division_id", form.division_id)
        if (bannerFile) body.append("banner", bannerFile)

        if (editing) {
          await apiRequest(`/events/${editing.id}`, { method: "PUT", body })
        } else {
          await apiRequest("/events", { method: "POST", body })
        }
      }
      toast.success(editing ? "Event diperbarui" : "Event dibuat")
      setOpen(false)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo<ColumnDef<Event>[]>(
    () => [
      {
        id: "banner",
        header: "Banner",
        enableSorting: false,
        cell: ({ row }) => {
          const url = eventBannerUrl(row.original)
          if (!url) {
            return (
              <div className="flex h-14 w-24 items-center justify-center rounded-lg border bg-muted text-[10px] text-muted-foreground">
                Tanpa gambar
              </div>
            )
          }
          return (
            <img
              src={url}
              alt={row.original.title}
              className="h-14 w-24 rounded-lg border object-cover shadow-sm"
            />
          )
        },
      },
      {
        id: "judul",
        accessorKey: "title",
        header: sortableHeader("Judul"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        id: "mulai",
        accessorKey: "start_time",
        header: sortableHeader("Mulai"),
        cell: ({ row }) => formatDate(row.original.start_time),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "aksi",
        enableHiding: false,
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openEdit(row.original)}>
              Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              render={<Link href={`/admin/events/${row.original.id}/recap`} />}
            >
              Rekap
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleting(row.original)}
            >
              Hapus
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <AdvancedResourcePage
      title="Event"
      crumbs={[{ label: "Admin", href: "/admin/settings" }, { label: "Event" }]}
      stats={stats}
      actions={<Button onClick={openCreate}>Buat Event</Button>}
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Belum ada event"
        searchPlaceholder="Cari event..."
        getRowId={(row) => String(row.id)}
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Event" : "Buat Event"}
        onSubmit={handleSubmit}
        saving={saving}
        className="sm:max-w-2xl"
      >
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
            <FieldLabel>Banner Event</FieldLabel>
            <ImageUploadField
              value={bannerFile}
              onChange={setBannerFile}
                existingUrl={editing ? eventBannerUrl(editing) : null}
              maxSizeMB={5}
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel>Lokasi</FieldLabel>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Mulai</FieldLabel>
              <Input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
            </Field>
            <Field>
              <FieldLabel>Selesai</FieldLabel>
              <Input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Divisi</FieldLabel>
            <FormSelect
              value={form.division_id}
              onValueChange={(v) => setForm({ ...form, division_id: v })}
              options={divisionOptions}
              placeholder="Opsional"
            />
          </Field>
          <Field className="flex flex-row items-center justify-between gap-3">
            <FieldLabel>Izinkan perizinan</FieldLabel>
            <Switch
              checked={form.allow_permission}
              onCheckedChange={(checked) =>
                setForm({ ...form, allow_permission: !!checked })
              }
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Hapus Event"
        description={`Apakah Anda yakin ingin menghapus event "${deleting?.title}"?`}
        onConfirm={handleDelete}
      />
    </AdvancedResourcePage>
  )
}
