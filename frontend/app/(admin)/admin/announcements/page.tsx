"use client"

import { useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { EyeIcon, FileIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  ConfirmDialog,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { AttachmentUploadField } from "@/components/attachment-upload-field"
import { ImageUploadField } from "@/components/image-upload-field"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import { storageUrl } from "@/lib/storage-url"
import type { Announcement, AnnouncementAttachment } from "@/lib/types"

export default function AdminAnnouncementsPage() {
  const { data, loading, error, refetch } = useApi(async () => {
    const result = await apiRequest<
      Announcement[] | { items: Announcement[] }
    >("/announcements")
    return unwrapList(result)
  })
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Announcement | null>(null)
  const [viewing, setViewing] = useState<Announcement | null>(null)
  const [viewAttachments, setViewAttachments] = useState<AnnouncementAttachment[]>([])
  const [loadingViewAttachments, setLoadingViewAttachments] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: "",
    content: "",
    target_type: "all",
  })
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])

  useEffect(() => {
    if (!viewing) {
      setViewAttachments([])
      return
    }
    setLoadingViewAttachments(true)
    apiRequest<AnnouncementAttachment[] | { items: AnnouncementAttachment[] }>(
      `/announcements/${viewing.id}/attachments`
    )
      .then((res) => setViewAttachments(unwrapList(res)))
      .catch(() => setViewAttachments([]))
      .finally(() => setLoadingViewAttachments(false))
  }, [viewing?.id])

  const stats = useMemo(
    () => [{ label: "Total Pengumuman", value: data?.length ?? 0 }],
    [data]
  )

  async function handleCreate() {
    setSaving(true)
    try {
      const body = new FormData()
      body.append("title", form.title)
      body.append("content", form.content)
      body.append("target_type", form.target_type)
      if (bannerFile) body.append("banner", bannerFile)
      for (const file of attachments) {
        body.append("attachments", file)
      }
      await apiRequest("/announcements", { method: "POST", body })
      setOpen(false)
      setForm({ title: "", content: "", target_type: "all" })
      setBannerFile(null)
      setAttachments([])
      toast.success("Pengumuman dibuat")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pengumuman")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await apiRequest(`/announcements/${deleting.id}`, { method: "DELETE" })
      toast.success("Pengumuman dihapus")
      setDeleting(null)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    }
  }

  const columns = useMemo<ColumnDef<Announcement>[]>(
    () => [
      {
        id: "judul",
        accessorKey: "title",
        header: sortableHeader("Judul"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        id: "target",
        accessorKey: "target_type",
        header: "Target",
        cell: ({ row }) => row.original.target_type ?? "all",
      },
      {
        id: "tanggal",
        accessorKey: "created_at",
        header: sortableHeader("Tanggal"),
        cell: ({ row }) => formatDate(row.original.created_at),
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
              onClick={() => setViewing(row.original)}
            >
              <EyeIcon className="mr-1 size-4" />
              Lihat
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
      title="Pengumuman"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Pengumuman" },
      ]}
      stats={stats}
      actions={<Button onClick={() => setOpen(true)}>Buat Pengumuman</Button>}
    >
      <AdvancedDataTable
        columns={columns}
        data={data ?? []}
        loading={loading}
        error={error}
        emptyMessage="Belum ada pengumuman"
        searchPlaceholder="Cari pengumuman..."
        getRowId={(row) => String(row.id)}
      />

      <FormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setForm({ title: "", content: "", target_type: "all" })
            setBannerFile(null)
            setAttachments([])
          }
        }}
        title="Pengumuman Baru"
        onSubmit={handleCreate}
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
            <FieldLabel>Banner</FieldLabel>
            <ImageUploadField
              value={bannerFile}
              onChange={setBannerFile}
            />
          </Field>
          <Field>
            <FieldLabel>Isi Pengumuman</FieldLabel>
            <RichTextEditor
              value={form.content}
              onChange={(content) => setForm({ ...form, content })}
            />
          </Field>
          <Field>
            <FieldLabel>Lampiran</FieldLabel>
            <AttachmentUploadField
              value={attachments}
              onChange={setAttachments}
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Hapus Pengumuman"
        description={`Apakah Anda yakin ingin menghapus pengumuman "${deleting?.title}"?`}
        onConfirm={handleDelete}
      />

      <Dialog
        open={!!viewing}
        onOpenChange={(next) => {
          if (!next) setViewing(null)
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 pt-5 pb-4">
            <DialogTitle>{viewing?.title ?? "Pengumuman"}</DialogTitle>
            {viewing?.created_at ? (
              <DialogDescription>
                {formatDate(viewing.created_at)}
              </DialogDescription>
            ) : null}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
            {viewing?.banner_url ? (
              <img
                src={storageUrl(viewing.banner_url)}
                alt={viewing.title}
                className="mb-4 w-full rounded-lg object-cover"
              />
            ) : null}

            <div
              className="max-w-none text-sm [&_a]:underline [&_b]:font-medium [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_li]:ml-4 [&_li]:list-disc [&_ol]:list-decimal [&_p]:mb-1 [&_ul]:ml-4 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{
                __html: viewing?.content ?? "-",
              }}
            />

            {viewAttachments.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Lampiran</p>
                {viewAttachments.map((att) => (
                  <a
                    key={att.id}
                    href={storageUrl(att.file_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border p-2 text-sm text-foreground hover:bg-muted/50"
                  >
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">
                      {att.file_url.split("/").pop()}
                    </span>
                    <DownloadIcon className="size-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            ) : loadingViewAttachments ? (
              <p className="mt-4 text-xs text-muted-foreground">Memuat lampiran...</p>
            ) : null}
          </div>

          <DialogFooter className="border-t px-6 py-3">
            <Button variant="outline" onClick={() => setViewing(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdvancedResourcePage>
  )
}
