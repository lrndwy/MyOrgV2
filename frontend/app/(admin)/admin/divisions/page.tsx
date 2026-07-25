"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  ConfirmDialog,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { unwrapList } from "@/lib/format"
import type { Division } from "@/lib/types"

export default function AdminDivisionsPage() {
  const { data, loading, error, refetch } = useApi(async () => {
    const result = await apiRequest<Division[] | { items: Division[] }>(
      "/divisions"
    )
    return unwrapList(result)
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Division | null>(null)
  const [deleting, setDeleting] = useState<Division | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({ name: "", description: "" })

  const rows = useMemo(() => data ?? [], [data])
  const stats = useMemo(
    () => [{ label: "Total Divisi", value: rows.length }],
    [rows]
  )

  function openCreate() {
    setEditing(null)
    setForm({ name: "", description: "" })
    setOpen(true)
  }

  function openEdit(item: Division) {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description ?? "",
    })
    setOpen(true)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      if (editing) {
        await apiRequest(`/divisions/${editing.id}`, {
          method: "PUT",
          body: form,
        })
        toast.success("Divisi diperbarui")
      } else {
        await apiRequest("/divisions", { method: "POST", body: form })
        toast.success("Divisi ditambahkan")
      }
      setOpen(false)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setConfirming(true)
    try {
      await apiRequest(`/divisions/${deleting.id}`, { method: "DELETE" })
      toast.success("Divisi dihapus")
      setDeleting(null)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setConfirming(false)
    }
  }

  const columns = useMemo<ColumnDef<Division>[]>(
    () => [
      {
        id: "nama",
        accessorKey: "name",
        header: sortableHeader("Nama"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "deskripsi",
        accessorKey: "description",
        header: "Deskripsi",
        cell: ({ row }) => row.original.description ?? "-",
      },
      {
        id: "aksi",
        enableHiding: false,
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(row.original)}
            >
              Edit
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
      title="Divisi"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Divisi" },
      ]}
      stats={stats}
      actions={<Button onClick={openCreate}>Tambah Divisi</Button>}
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Belum ada divisi"
        searchPlaceholder="Cari divisi..."
        getRowId={(row) => String(row.id)}
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Divisi" : "Divisi Baru"}
        onSubmit={handleSubmit}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama</FieldLabel>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Hapus divisi?"
        description={`Divisi "${deleting?.name ?? ""}" akan dihapus.`}
        confirming={confirming}
        onConfirm={handleDelete}
      />
    </AdvancedResourcePage>
  )
}
