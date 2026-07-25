"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DownloadIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FilePreviewDialog } from "@/components/file-preview-dialog"
import { FormSelect } from "@/components/form-select"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { unwrapList } from "@/lib/format"
import { storageUrl } from "@/lib/storage-url"
import type { LetterCategory, LetterTemplate } from "@/lib/types"

export default function LetterTemplatesPage() {
  const { data, loading, error, refetch } = useApi(() =>
    apiRequest<LetterTemplate[] | { items: LetterTemplate[] }>(
      "/letter_templates"
    ).then(unwrapList)
  )
  const categories = useApi(() =>
    apiRequest<LetterCategory[] | { items: LetterCategory[] }>(
      "/letter_categories"
    ).then(unwrapList)
  )

  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<LetterTemplate | null>(null)
  const [editId, setEditId] = useState<number | null>(null)

  const rows = useMemo(() => data ?? [], [data])
  const categoryMap = useMemo(
    () =>
      new Map((categories.data ?? []).map((c) => [c.id, c.name])),
    [categories.data]
  )
  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
    [categories.data]
  )

  async function handleCreate() {
    if (!templateFile) {
      toast.error("File template .docx wajib diunggah")
      return
    }
    setSaving(true)
    try {
      const body = new FormData()
      body.append("name", name)
      body.append("category_id", categoryId)
      body.append("template", templateFile)
      await apiRequest("/letter_templates", { method: "POST", body })
      setOpen(false)
      setName("")
      setCategoryId("")
      setTemplateFile(null)
      toast.success("Template ditambahkan")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  function openEdit(tpl: LetterTemplate) {
    setEditId(tpl.id)
    setName(tpl.name)
    setCategoryId(String(tpl.category_id))
    setTemplateFile(null)
    setEditOpen(true)
  }

  async function handleEdit() {
    if (editId == null) return
    setSaving(true)
    try {
      const body = new FormData()
      body.append("name", name)
      body.append("category_id", categoryId)
      if (templateFile) body.append("template", templateFile)
      await apiRequest(`/letter_templates/${editId}`, { method: "PUT", body })
      setEditOpen(false)
      setEditId(null)
      setName("")
      setCategoryId("")
      setTemplateFile(null)
      toast.success("Template diperbarui")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleteId == null) return
    try {
      await apiRequest(`/letter_templates/${deleteId}`, { method: "DELETE" })
      toast.success("Template dihapus")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setDeleteId(null)
    }
  }

  const columns = useMemo<ColumnDef<LetterTemplate>[]>(
    () => [
      {
        id: "nama",
        accessorKey: "name",
        header: sortableHeader("Nama"),
      },
      {
        id: "kategori",
        accessorKey: "category_id",
        header: "Kategori",
        cell: ({ row }) => categoryMap.get(row.original.category_id) ?? "—",
      },
      {
        id: "aksi",
        header: "Aksi",
        cell: ({ row }) => {
          const tpl = row.original
          return (
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEdit(tpl)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteId(tpl.id)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
              {tpl.template_url ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewTemplate(tpl)}
                  >
                    <EyeIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={storageUrl(tpl.template_url)}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    <DownloadIcon className="size-3.5" />
                  </Button>
                </>
              ) : null}
            </div>
          )
        },
      },
    ],
    [categoryMap]
  )

  return (
    <AdvancedResourcePage
      title="Template Surat"
      crumbs={[
        { label: "Surat", href: "/admin/letters/incoming" },
        { label: "Template" },
      ]}
      stats={[{ label: "Total Template", value: rows.length }]}
      actions={<Button onClick={() => setOpen(true)}>Upload Template</Button>}
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Belum ada template"
        getRowId={(row) => String(row.id)}
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Template Surat Baru"
        onSubmit={handleCreate}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama Template</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel>Kategori</FieldLabel>
            <FormSelect
              value={categoryId}
              onValueChange={setCategoryId}
              options={categoryOptions}
              placeholder="Pilih kategori"
            />
          </Field>
          <Field>
            <FieldLabel>File .docx</FieldLabel>
            <Input
              type="file"
              accept=".docx"
              onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
              required
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Template"
        onSubmit={handleEdit}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama Template</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field>
            <FieldLabel>Kategori</FieldLabel>
            <FormSelect
              value={categoryId}
              onValueChange={setCategoryId}
              options={categoryOptions}
              placeholder="Pilih kategori"
            />
          </Field>
          <Field>
            <FieldLabel>File .docx (kosongkan jika tidak diubah)</FieldLabel>
            <Input
              type="file"
              accept=".docx"
              onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title="Hapus Template"
        description="Apakah Anda yakin ingin menghapus template ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
      />

      <FilePreviewDialog
        open={previewTemplate != null}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
        url={previewTemplate?.template_url ? storageUrl(previewTemplate.template_url) : ""}
        fileName={previewTemplate ? `${previewTemplate.name}.docx` : ""}
        kindLabel={previewTemplate ? (categoryMap.get(previewTemplate.category_id) ?? "Template") : undefined}
      />
    </AdvancedResourcePage>
  )
}
