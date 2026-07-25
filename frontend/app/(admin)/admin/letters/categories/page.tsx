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
import type { LetterCategory } from "@/lib/types"

const DEFAULT_TEMPLATE = "{number:3}/{code}/{month_roman}/{year}"
const EXAMPLE_TEMPLATE =
  "{number:3}/{code}/{unit}/HIMATRIS/{month_roman}/{year}"

const emptyForm = {
  name: "",
  code: "",
  start_number: "1",
  current_number: "0",
  number_format_template: DEFAULT_TEMPLATE,
}

function toForm(category: LetterCategory) {
  return {
    name: category.name,
    code: category.code ?? "",
    start_number: String(category.start_number ?? 1),
    current_number: String(category.current_number ?? 0),
    number_format_template:
      category.number_format_template ?? DEFAULT_TEMPLATE,
  }
}

function toPayload(form: typeof emptyForm) {
  return {
    name: form.name,
    code: form.code,
    start_number: Number(form.start_number) || 1,
    current_number: Number(form.current_number) || 0,
    number_format_template: form.number_format_template || DEFAULT_TEMPLATE,
  }
}

export default function LetterCategoriesPage() {
  const { data, loading, error, refetch } = useApi(async () => {
    const result = await apiRequest<
      LetterCategory[] | { items: LetterCategory[] }
    >("/letter_categories")
    return unwrapList(result)
  })

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LetterCategory | null>(null)
  const [deleting, setDeleting] = useState<LetterCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const rows = useMemo(() => data ?? [], [data])
  const stats = useMemo(
    () => [
      { label: "Total Kategori", value: rows.length },
      {
        label: "Dengan Template",
        value: rows.filter((r) => r.number_format_template?.trim()).length,
      },
    ],
    [rows]
  )

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(category: LetterCategory) {
    setEditing(category)
    setForm(toForm(category))
    setOpen(true)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      const body = toPayload(form)
      if (editing) {
        await apiRequest(`/letter_categories/${editing.id}`, {
          method: "PUT",
          body,
        })
        toast.success("Kategori diperbarui")
      } else {
        await apiRequest("/letter_categories", { method: "POST", body })
        toast.success("Kategori ditambahkan")
      }
      setOpen(false)
      setEditing(null)
      setForm(emptyForm)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan kategori")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setConfirming(true)
    try {
      await apiRequest(`/letter_categories/${deleting.id}`, { method: "DELETE" })
      toast.success("Kategori dihapus")
      setDeleting(null)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setConfirming(false)
    }
  }

  const columns = useMemo<ColumnDef<LetterCategory>[]>(
    () => [
      {
        id: "nama",
        accessorKey: "name",
        header: sortableHeader("Nama"),
      },
      {
        id: "kode",
        accessorKey: "code",
        header: "Kode",
        cell: ({ row }) => row.original.code ?? "-",
      },
      {
        id: "start_number",
        accessorKey: "start_number",
        header: sortableHeader("Start Number"),
        cell: ({ row }) => row.original.start_number ?? 1,
      },
      {
        id: "current_number",
        accessorKey: "current_number",
        header: sortableHeader("Current Number"),
        cell: ({ row }) => row.original.current_number ?? 0,
      },
      {
        id: "template",
        accessorKey: "number_format_template",
        header: "Number Format Template",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs font-mono text-xs">
            {row.original.number_format_template ?? "-"}
          </span>
        ),
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
      title="Kategori Surat"
      crumbs={[
        { label: "Surat", href: "/admin/letters" },
        { label: "Kategori" },
      ]}
      stats={stats}
      actions={<Button onClick={openCreate}>Tambah Kategori</Button>}
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Belum ada kategori surat"
        searchPlaceholder="Cari kategori..."
        getRowId={(row) => String(row.id)}
      />

      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}
        title={editing ? "Edit Kategori" : "Kategori Baru"}
        onSubmit={handleSubmit}
        saving={saving}
        className="sm:max-w-lg"
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
            <FieldLabel>Kode</FieldLabel>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="UND, SK, SM-IN"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Start Number</FieldLabel>
              <Input
                type="number"
                min={1}
                value={form.start_number}
                onChange={(e) =>
                  setForm({ ...form, start_number: e.target.value })
                }
                required
              />
            </Field>
            <Field>
              <FieldLabel>Current Number</FieldLabel>
              <Input
                type="number"
                min={0}
                value={form.current_number}
                onChange={(e) =>
                  setForm({ ...form, current_number: e.target.value })
                }
                required
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Number Format Template</FieldLabel>
            <Textarea
              value={form.number_format_template}
              onChange={(e) =>
                setForm({ ...form, number_format_template: e.target.value })
              }
              rows={3}
              className="font-mono text-sm"
              placeholder={DEFAULT_TEMPLATE}
              required
            />
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              <p>
                <span className="font-medium">Sistem (otomatis):</span>{" "}
                {"{number}"} (default 3 digit), {"{number:3}"}, {"{code}"},{" "}
                {"{month_roman}"}, {"{year}"} — gunakan {"{number:0}"} jika
                tanpa zero-pad
              </p>
              <p>
                <span className="font-medium">Custom (diisi saat buat surat):</span>{" "}
                {"{unit}"}, {"{tujuan}"}, dll.
              </p>
              <p>
                <span className="font-medium">Literal:</span> teks bebas di
                template, mis. HIMATRIS
              </p>
              <p>
                Contoh:{" "}
                <button
                  type="button"
                  className="font-mono text-primary underline-offset-2 hover:underline"
                  onClick={() =>
                    setForm({ ...form, number_format_template: EXAMPLE_TEMPLATE })
                  }
                >
                  {EXAMPLE_TEMPLATE}
                </button>{" "}
                → 001/SPm-i/PAN-Stuband/HIMATRIS/VII/2026
              </p>
            </div>
          </Field>
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Hapus kategori?"
        description={
          deleting
            ? `Kategori "${deleting.name}" akan dihapus permanen. Kategori yang masih dipakai surat tidak bisa dihapus.`
            : undefined
        }
        confirmLabel="Hapus"
        confirming={confirming}
        onConfirm={handleDelete}
      />
    </AdvancedResourcePage>
  )
}
