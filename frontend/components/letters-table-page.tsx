"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { PencilIcon, EyeIcon } from "lucide-react"
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
import {
  IncomingLetterPreview,
  detectIncomingPreviewKind,
  type IncomingParsePreview,
  type IncomingPreviewKind,
} from "@/components/incoming-letter-preview"
import { useApi } from "@/hooks/use-api"
import { apiRequest, getApiBase } from "@/lib/api"
import { getStoredToken } from "@/lib/auth"
import { formatDate, unwrapList } from "@/lib/format"
import { storageUrl } from "@/lib/storage-url"
import {
  buildOutgoingVariableValues,
  extractCustomNumberPlaceholders,
  filterDocxTemplateVars,
  humanizeNumberPlaceholder,
  humanizeTemplateVar,
  pickRecipientFromVars,
} from "@/lib/letter-template-vars"
import type { Letter, LetterCategory, LetterTemplate } from "@/lib/types"

type LettersTablePageProps = {
  letterType: "incoming" | "outgoing"
}

type ParsePreview = IncomingParsePreview

export function LettersTablePage({ letterType }: LettersTablePageProps) {
  const title = letterType === "incoming" ? "Surat Masuk" : "Surat Keluar"

  const { data, loading, error, refetch } = useApi(async () => {
    const result = await apiRequest<Letter[] | { items: Letter[] }>(
      `/letters?type=${letterType}`
    )
    return unwrapList(result)
  })
  const templates = useApi(() =>
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
  const [saving, setSaving] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [form, setForm] = useState({
    subject: "",
    letter_code: "",
    sender: "",
    template_id: "",
    category_id: "",
  })
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(
    null
  )
  const [attachmentPreviewKind, setAttachmentPreviewKind] =
    useState<IncomingPreviewKind>(null)
  const [parsing, setParsing] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const [parsePreview, setParsePreview] = useState<ParsePreview | null>(null)
  const [templateVars, setTemplateVars] = useState<string[]>([])
  const [numberPlaceholders, setNumberPlaceholders] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [numberSegmentValues, setNumberSegmentValues] = useState<
    Record<string, string>
  >({})
  const [nextNumberPreview, setNextNumberPreview] = useState<string | null>(
    null
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [previewLetter, setPreviewLetter] = useState<Letter | null>(null)

  const rows = useMemo(() => data ?? [], [data])
  const templateOptions = useMemo(
    () =>
      (templates.data ?? []).map((t) => ({
        value: String(t.id),
        label: t.name,
      })),
    [templates.data]
  )
  const categoryMap = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c.name])),
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

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  function clearAttachmentPreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setAttachmentPreviewUrl(null)
    setAttachmentPreviewKind(null)
  }

  function setIncomingAttachment(file: File | null) {
    clearAttachmentPreview()
    setAttachment(file)
    setParsePreview(null)
    if (!file) return
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setAttachmentPreviewUrl(url)
    setAttachmentPreviewKind(detectIncomingPreviewKind(file))
    void parseIncomingFile(file)
  }

  async function parseIncomingFile(file: File) {
    setParsing(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const preview = await apiRequest<ParsePreview>("/letters/parse_incoming", {
        method: "POST",
        body,
      })
      setParsePreview(preview)
      if (preview.letter_code) {
        setForm((f) =>
          f.letter_code ? f : { ...f, letter_code: preview.letter_code ?? "" }
        )
      }
    } catch {
      setParsePreview(null)
      toast.error("Gagal mem-parse file surat")
    } finally {
      setParsing(false)
    }
  }

  async function loadTemplateVars(templateId: string) {
    if (!templateId) {
      setTemplateVars([])
      setVarValues({})
      setNumberPlaceholders([])
      setNumberSegmentValues({})
      setCategoryId(null)
      setNextNumberPreview(null)
      return
    }
    try {
      const res = await apiRequest<{
        variables?: string[]
        user_variables?: string[]
        next_number_preview?: string
        category_id?: number
        number_format_template?: string
        number_placeholders?: string[]
      }>(`/letter_templates/${templateId}/variables`)

      let numberKeys = res.number_placeholders ?? []
      let formatTemplate = res.number_format_template ?? ""

      if (!numberKeys.length && formatTemplate) {
        numberKeys = extractCustomNumberPlaceholders(formatTemplate)
      }

      const catId = res.category_id ?? null
      if (!numberKeys.length && catId != null) {
        let categoryList = categories.data ?? []
        if (categoryList.length === 0) {
          categoryList = await apiRequest<
            LetterCategory[] | { items: LetterCategory[] }
          >("/letter_categories").then(unwrapList)
        }
        const cat = categoryList.find((c) => c.id === catId)
        if (cat?.number_format_template) {
          formatTemplate = cat.number_format_template
          numberKeys = extractCustomNumberPlaceholders(formatTemplate)
        }
      }

      const vars = filterDocxTemplateVars(
        res.user_variables ?? res.variables ?? [],
        numberKeys
      )
      setTemplateVars(vars)
      setNumberPlaceholders(numberKeys)
      setCategoryId(catId)
      setNextNumberPreview(res.next_number_preview ?? null)
      const defaults: Record<string, string> = {}
      for (const v of vars) {
        defaults[v] = ""
      }
      setVarValues(defaults)
      const segmentDefaults: Record<string, string> = {}
      for (const key of numberKeys) {
        segmentDefaults[key] = ""
      }
      setNumberSegmentValues(segmentDefaults)
    } catch (err) {
      setTemplateVars([])
      setNumberPlaceholders([])
      setCategoryId(null)
      setNextNumberPreview(null)
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal memuat metadata template surat"
      )
    }
  }

  useEffect(() => {
    if (letterType !== "outgoing" || !categoryId) return
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true)
      try {
        const res = await apiRequest<{
          preview?: string
        }>(`/letter_categories/${categoryId}/preview_number`, {
          method: "POST",
          body: { segments: numberSegmentValues },
        })
        setNextNumberPreview(res.preview ?? null)
      } catch {
        // keep last preview
      } finally {
        setPreviewLoading(false)
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [letterType, categoryId, numberSegmentValues])

  async function handleCreate() {
    if (letterType === "outgoing" && !form.template_id) {
      toast.error("Pilih template surat terlebih dahulu")
      return
    }
    if (letterType === "outgoing") {
      for (const key of numberPlaceholders) {
        if (!numberSegmentValues[key]?.trim()) {
          toast.error(
            `Segmen nomor surat "${humanizeNumberPlaceholder(key)}" wajib diisi`
          )
          return
        }
      }
    }
    setSaving(true)
    try {
      if (letterType === "incoming") {
        const body = new FormData()
        body.append("type", "incoming")
        body.append("subject", form.subject)
        if (form.category_id) body.append("category_id", form.category_id)
        if (form.letter_code) body.append("letter_code", form.letter_code)
        if (form.sender) body.append("sender", form.sender)
        if (attachment) body.append("file", attachment)
        await apiRequest("/letters", { method: "POST", body })
      } else {
        const values = buildOutgoingVariableValues(
          form.subject,
          varValues,
          numberSegmentValues
        )
        await apiRequest("/letters", {
          method: "POST",
          body: {
            type: "outgoing",
            subject: form.subject,
            template_id: Number(form.template_id),
            recipient: pickRecipientFromVars(values),
            variable_values: values,
          },
        })
      }
      setOpen(false)
      resetForm()
      toast.success("Surat ditambahkan")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah surat")
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setForm({
      subject: "",
      letter_code: "",
      sender: "",
      template_id: "",
      category_id: "",
    })
    setAttachment(null)
    clearAttachmentPreview()
    setParsePreview(null)
    setParsing(false)
    setTemplateVars([])
    setNumberPlaceholders([])
    setCategoryId(null)
    setNumberSegmentValues({})
    setNextNumberPreview(null)
    setPreviewLoading(false)
    setVarValues({})
  }

  function openEdit(letter: Letter) {
    setEditId(letter.id)
    setForm({
      subject: letter.subject ?? "",
      letter_code: letter.letter_code ?? "",
      sender: (letter as any).sender ?? "",
      template_id: "",
      category_id: letter.category_id ? String(letter.category_id) : "",
    })
    setAttachment(null)
    clearAttachmentPreview()
    setParsePreview(null)
    setEditOpen(true)
  }

  async function handleEdit() {
    if (editId == null) return
    setSaving(true)
    try {
      const body = new FormData()
      body.append("subject", form.subject)
      if (form.category_id) body.append("category_id", form.category_id)
      if (letterType === "incoming") {
        if (form.letter_code) body.append("letter_code", form.letter_code)
        if (form.sender) body.append("sender", form.sender)
      }
      if (attachment) body.append("file", attachment)
      await apiRequest(`/letters/${editId}`, { method: "PUT", body })
      setEditOpen(false)
      setEditId(null)
      resetForm()
      toast.success("Surat diperbarui")
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
      await apiRequest(`/letters/${deleteId}`, { method: "DELETE" })
      toast.success("Surat dihapus")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setDeleteId(null)
    }
  }

  async function handleBulkDelete() {
    const ids = Object.keys(rowSelection).map(Number).filter(Boolean)
    if (!ids.length) return
    try {
      await apiRequest("/letters/bulk_delete", {
        method: "POST",
        body: { ids },
      })
      setRowSelection({})
      toast.success(`${ids.length} surat dihapus`)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal hapus massal")
    }
  }

  async function handleExport() {
    const token = getStoredToken()
    const url = `${getApiBase()}/letters/export?type=${letterType}&format=csv`
    const res = await fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      toast.error("Gagal export")
      return
    }
    const blob = await res.blob()
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `letters-${letterType}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const columns = useMemo<ColumnDef<Letter>[]>(
    () => [
      {
        id: "kode",
        accessorKey: "letter_code",
        header: sortableHeader("Nomor"),
        cell: ({ row }) => row.original.letter_code ?? "-",
      },
      {
        id: "subjek",
        accessorKey: "subject",
        header: "Perihal",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[260px] whitespace-normal break-words">
            {row.original.subject || "-"}
          </span>
        ),
      },
      {
        id: "kategori",
        header: "Kategori",
        cell: ({ row }) => categoryMap.get(row.original.category_id ?? 0) ?? "-",
      },
      {
        id: "tanggal",
        accessorKey: "created_at",
        header: sortableHeader("Tanggal"),
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: "aksi",
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => {
          const letter = row.original
          const url = letter.type === "outgoing" ? letter.document_url : letter.attachment_url
          return (
            <div className="flex justify-end gap-1">
              {url ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewLetter(letter)}
                >
                  <EyeIcon className="size-3.5" />
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={`${getApiBase()}/letters/${letter.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                Unduh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEdit(letter)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteId(letter.id)}
              >
                Hapus
              </Button>
            </div>
          )
        },
      },
    ],
    [categoryMap]
  )

  const selectedCount = Object.keys(rowSelection).length

  return (
    <AdvancedResourcePage
      title={title}
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Surat", href: "/admin/letters/incoming" },
        { label: title },
      ]}
      stats={[{ label: `Total ${title}`, value: rows.length }]}
      actions={
        <div className="flex gap-2">
          {selectedCount > 0 ? (
            <Button variant="destructive" onClick={handleBulkDelete}>
              Hapus ({selectedCount})
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleExport}>
            Export CSV
          </Button>
          <Button
            onClick={() => {
              resetForm()
              setOpen(true)
            }}
          >
            Tambah {title}
          </Button>
        </div>
      }
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage={`Belum ada ${title.toLowerCase()}`}
        searchPlaceholder="Cari nomor, perihal..."
        getRowId={(row) => String(row.id)}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />

      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetForm()
        }}
        title={`${title} Baru`}
        onSubmit={handleCreate}
        saving={saving}
        className={letterType === "incoming" ? "sm:max-w-5xl" : "sm:max-w-lg"}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Perihal</FieldLabel>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
            />
          </Field>
          {letterType === "incoming" ? (
            <>
              <Field>
                <FieldLabel>Kategori</FieldLabel>
                <FormSelect
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                  options={categoryOptions}
                  placeholder="Pilih kategori"
                />
              </Field>
              <Field>
                <FieldLabel>Nomor Surat</FieldLabel>
                <Input
                  value={form.letter_code}
                  onChange={(e) =>
                    setForm({ ...form, letter_code: e.target.value })
                  }
                  placeholder="Kosongkan jika akan di-parse otomatis"
                />
              </Field>
              <Field>
                <FieldLabel>Pengirim</FieldLabel>
                <Input
                  value={form.sender}
                  onChange={(e) => setForm({ ...form, sender: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel>Upload File Surat</FieldLabel>
                <Input
                  type="file"
                  accept=".pdf,.docx,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setIncomingAttachment(file)
                  }}
                />
              </Field>
              <IncomingLetterPreview
                file={attachment}
                previewUrl={attachmentPreviewUrl}
                previewKind={attachmentPreviewKind}
                parsePreview={parsePreview}
                parsing={parsing}
              />
            </>
          ) : (
            <>
              <Field>
                <FieldLabel>Template Surat</FieldLabel>
                <FormSelect
                  value={form.template_id}
                  onValueChange={(v) => {
                    setForm({ ...form, template_id: v })
                    void loadTemplateVars(v)
                  }}
                  options={templateOptions}
                  placeholder="Pilih template .docx"
                />
              </Field>
              {form.template_id && numberPlaceholders.length > 0 ? (
                <>
                  <p className="text-sm font-medium">Segmen Nomor Surat</p>
                  {numberPlaceholders.map((key) => (
                    <Field key={key}>
                      <FieldLabel>{humanizeNumberPlaceholder(key)}</FieldLabel>
                      <Input
                        value={numberSegmentValues[key] ?? ""}
                        onChange={(e) =>
                          setNumberSegmentValues({
                            ...numberSegmentValues,
                            [key]: e.target.value,
                          })
                        }
                        placeholder={`Contoh: PAN-Stuband`}
                        required
                      />
                    </Field>
                  ))}
                </>
              ) : form.template_id ? (
                <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Kategori template ini belum memiliki segmen dinamis. Edit kategori
                  surat dan tambahkan placeholder seperti{" "}
                  <span className="font-mono">{"{unit}"}</span> pada Number Format
                  Template, lalu simpan.
                </p>
              ) : null}
              {form.template_id && nextNumberPreview ? (
                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Preview nomor surat
                    {previewLoading ? " (memperbarui…)" : ""}
                  </p>
                  <p className="font-mono text-sm break-all">{nextNumberPreview}</p>
                </div>
              ) : null}
              {form.template_id && templateVars.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Lengkapi parameter template di bawah ini.
                </p>
              ) : null}
              {templateVars.map((v) => (
                <Field key={v}>
                  <FieldLabel>{humanizeTemplateVar(v)}</FieldLabel>
                  <Input
                    value={varValues[v] ?? ""}
                    onChange={(e) =>
                      setVarValues({ ...varValues, [v]: e.target.value })
                    }
                    required
                  />
                </Field>
              ))}
            </>
          )}
        </FieldGroup>
      </FormDialog>

      <FormDialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next)
          if (!next) resetForm()
        }}
        title={`Edit ${title}`}
        onSubmit={handleEdit}
        saving={saving}
        className={letterType === "incoming" ? "sm:max-w-5xl" : "sm:max-w-lg"}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Perihal</FieldLabel>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
            />
          </Field>
          {letterType === "incoming" ? (
            <>
              <Field>
                <FieldLabel>Kategori</FieldLabel>
                <FormSelect
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                  options={categoryOptions}
                  placeholder="Pilih kategori"
                />
              </Field>
              <Field>
                <FieldLabel>Nomor Surat</FieldLabel>
                <Input
                  value={form.letter_code}
                  onChange={(e) =>
                    setForm({ ...form, letter_code: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Pengirim</FieldLabel>
                <Input
                  value={form.sender}
                  onChange={(e) => setForm({ ...form, sender: e.target.value })}
                />
              </Field>
            </>
          ) : null}
          <Field>
            <FieldLabel>Upload File Surat (kosongkan jika tidak diubah)</FieldLabel>
            <Input
              type="file"
              accept=".pdf,.docx,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setIncomingAttachment(file)
              }}
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title="Hapus Surat"
        description="Apakah Anda yakin ingin menghapus surat ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
      />

      <FilePreviewDialog
        open={previewLetter != null}
        onOpenChange={(open) => !open && setPreviewLetter(null)}
        url={
          previewLetter
            ? storageUrl(
                (previewLetter.type === "outgoing"
                  ? previewLetter.document_url
                  : previewLetter.attachment_url) ?? ""
              )
            : ""
        }
        fileName={previewLetter?.subject ?? "surat"}
        kindLabel={previewLetter?.letter_code}
      />
    </AdvancedResourcePage>
  )
}
