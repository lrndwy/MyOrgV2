"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  ChevronRightIcon,
  CloudUploadIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  Grid3x3Icon,
  HardDriveIcon,
  LayoutListIcon,
  MoreVerticalIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/advanced-table/form-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FilePreviewDialog } from "@/components/file-preview-dialog"
import { ErrorState, LoadingState } from "@/components/page-states"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import {
  formatBytes,
  getFileExtension,
  getFileIcon,
  getFileKindLabel,
  isDocxMime,
  isImageMime,
  isPdfMime,
  isSpreadsheetMime,
  isVideoMime,
  sortStorageFiles,
  type StorageSortKey,
} from "@/lib/storage-file-utils"
import { storageUrl } from "@/lib/storage-url"
import type { StorageFile, StorageFolder } from "@/lib/types"
import { cn } from "@/lib/utils"

type ViewMode = "grid" | "list"

// Tipe data khusus untuk drag & drop internal (pindah file antar folder),
// dibedakan dari drag file OS (upload).
const FILE_DRAG_TYPE = "application/x-myorg-file-id"

function isInternalDrag(e: React.DragEvent) {
  return e.dataTransfer.types.includes(FILE_DRAG_TYPE)
}

function buildFolderMap(folders: StorageFolder[]) {
  const byParent = new Map<number | null, StorageFolder[]>()
  for (const folder of folders) {
    const parent = folder.parent_id ?? null
    const list = byParent.get(parent) ?? []
    list.push(folder)
    byParent.set(parent, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "id"))
  }
  return byParent
}

function buildBreadcrumb(
  folderId: number | null,
  folders: StorageFolder[]
): StorageFolder[] {
  if (folderId == null) return []
  const byId = new Map(folders.map((f) => [f.id, f]))
  const path: StorageFolder[] = []
  let current = byId.get(folderId)
  while (current) {
    path.unshift(current)
    current =
      current.parent_id != null ? byId.get(current.parent_id) : undefined
  }
  return path
}

function FolderTree({
  folders,
  currentFolderId,
  onSelect,
  onDropFile,
}: {
  folders: StorageFolder[]
  currentFolderId: number | null
  onSelect: (id: number | null) => void
  onDropFile: (fileId: number, folderId: number | null) => void
}) {
  const byParent = useMemo(() => buildFolderMap(folders), [folders])
  const [dropTargetId, setDropTargetId] = useState<number | null | undefined>(
    undefined
  )

  function Node({
    folder,
    depth,
  }: {
    folder: StorageFolder | null
    depth: number
  }) {
    const id = folder?.id ?? null
    const children = byParent.get(id) ?? []
    const isActive = currentFolderId === id
    const label = folder?.name ?? "Semua File"

    return (
      <div>
        <button
          type="button"
          onClick={() => onSelect(id)}
          onDragOver={(e) => {
            if (!isInternalDrag(e)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = "move"
            setDropTargetId(id)
          }}
          onDragLeave={() => {
            setDropTargetId((prev) => (prev === id ? undefined : prev))
          }}
          onDrop={(e) => {
            if (!isInternalDrag(e)) return
            e.preventDefault()
            e.stopPropagation()
            setDropTargetId(undefined)
            const fileId = Number(e.dataTransfer.getData(FILE_DRAG_TYPE))
            if (fileId) onDropFile(fileId, id)
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
            isActive
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            dropTargetId === id && "ring-2 ring-primary"
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <FolderIcon
            className={cn(
              "size-4 shrink-0",
              isActive ? "text-primary" : "text-amber-500"
            )}
          />
          <span className="truncate">{label}</span>
        </button>
        {children.map((child) => (
          <Node key={child.id} folder={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      <Node folder={null} depth={0} />
    </div>
  )
}

export function CloudStorageBrowser() {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<StorageSortKey>("name")
  const [sortDesc, setSortDesc] = useState(false)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderName, setFolderName] = useState("")
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<StorageFolder | null>(null)
  const [dropFolderId, setDropFolderId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const folders = useApi(() =>
    apiRequest<StorageFolder[] | { items: StorageFolder[] }>(
      "/storage/folders"
    ).then(unwrapList)
  )
  const files = useApi(
    () =>
      apiRequest<StorageFile[] | { items: StorageFile[] }>("/storage/files", {
        params: currentFolderId ? { folder_id: currentFolderId } : undefined,
      }).then(unwrapList),
    [currentFolderId]
  )

  const allFolders = useMemo(() => folders.data ?? [], [folders.data])
  const breadcrumb = useMemo(
    () => buildBreadcrumb(currentFolderId, allFolders),
    [currentFolderId, allFolders]
  )
  const visibleFolders = useMemo(() => {
    const list = allFolders.filter((f) =>
      currentFolderId == null
        ? f.parent_id == null
        : f.parent_id === currentFolderId
    )
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter((f) => f.name.toLowerCase().includes(q))
  }, [allFolders, currentFolderId, search])

  // Di root hanya file tanpa folder yang ditampilkan; isi folder muncul
  // saat foldernya dibuka.
  const scopedFiles = useMemo(() => {
    const list = files.data ?? []
    if (currentFolderId == null) {
      return list.filter((f) => f.folder_id == null)
    }
    return list
  }, [files.data, currentFolderId])

  const visibleFiles = useMemo(() => {
    let list = scopedFiles
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((f) => f.name.toLowerCase().includes(q))
    }
    return sortStorageFiles(list, sortKey, sortDesc)
  }, [scopedFiles, search, sortKey, sortDesc])

  const totalSize = useMemo(
    () => scopedFiles.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0),
    [scopedFiles]
  )

  const refreshAll = useCallback(() => {
    void folders.refetch()
    void files.refetch()
  }, [folders, files])

  async function createFolder() {
    if (!folderName.trim()) return
    setCreatingFolder(true)
    try {
      await apiRequest("/storage/folders", {
        method: "POST",
        body: {
          name: folderName.trim(),
          parent_id: currentFolderId,
        },
      })
      setFolderName("")
      setFolderDialogOpen(false)
      toast.success("Folder dibuat")
      void folders.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat folder")
    } finally {
      setCreatingFolder(false)
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const list = Array.from(fileList)
    if (!list.length) return
    setUploading(true)
    let ok = 0
    try {
      for (const file of list) {
        const body = new FormData()
        body.append("file", file)
        if (currentFolderId) {
          body.append("folder_id", String(currentFolderId))
        }
        await apiRequest("/storage/files", { method: "POST", body })
        ok++
      }
      toast.success(
        ok === 1 ? "File diunggah" : `${ok} file berhasil diunggah`
      )
      void files.refetch()
    } catch (err) {
      toast.error(
        ok > 0
          ? `${ok} file terunggah, sisanya gagal: ${err instanceof Error ? err.message : "error"}`
          : err instanceof Error
            ? err.message
            : "Gagal upload"
      )
      if (ok > 0) void files.refetch()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function moveFile(fileId: number, folderId: number | null) {
    try {
      await apiRequest(`/storage/files/${fileId}`, {
        method: "PUT",
        body: { folder_id: folderId },
      })
      toast.success("File dipindahkan")
      void files.refetch()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memindahkan file"
      )
    }
  }

  async function deleteFolder() {
    if (!deleteFolderTarget) return
    try {
      await apiRequest(`/storage/folders/${deleteFolderTarget.id}`, {
        method: "DELETE",
      })
      toast.success(`Folder "${deleteFolderTarget.name}" dihapus`)
      if (currentFolderId === deleteFolderTarget.id) {
        setCurrentFolderId(deleteFolderTarget.parent_id ?? null)
      }
      refreshAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus folder")
    } finally {
      setDeleteFolderTarget(null)
    }
  }

  async function deleteFile(id: number) {
    try {
      await apiRequest(`/storage/files/${id}`, { method: "DELETE" })
      toast.success("File dihapus")
      if (previewFile?.id === id) setPreviewFile(null)
      void files.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal hapus")
    }
  }

  function FileActions({
    file,
    compact,
  }: {
    file: StorageFile
    compact?: boolean
  }) {
    const url = storageUrl(file.file_url)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant={compact ? "ghost" : "outline"}
              size={compact ? "icon-sm" : "sm"}
              aria-label={`Aksi ${file.name}`}
            />
          }
        >
          {compact ? (
            <MoreVerticalIcon className="size-4" />
          ) : (
            <>Aksi</>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setPreviewFile(file)}>
            Pratinjau
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={url} target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon className="size-4" />
            Buka tab baru
          </DropdownMenuItem>
          <DropdownMenuItem render={<a href={url} download={file.name} />}>
            <DownloadIcon className="size-4" />
            Unduh
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => deleteFile(file.id)}
          >
            <Trash2Icon className="size-4" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function FileThumbnail({ file }: { file: StorageFile }) {
    const url = storageUrl(file.file_url)
    const Icon = getFileIcon(file.mime_type, file.name)

    if (isImageMime(file.mime_type)) {
      return (
        <img
          src={url}
          alt={file.name}
          className="size-full object-cover"
          loading="lazy"
        />
      )
    }

    if (isPdfMime(file.mime_type)) {
      return (
        <div className="flex size-full flex-col items-center justify-center gap-1 bg-red-50 dark:bg-red-950/30">
          <FileTextIcon className="size-8 text-red-600 dark:text-red-400" />
          <span className="text-[10px] font-semibold uppercase text-red-700 dark:text-red-300">
            PDF
          </span>
        </div>
      )
    }

    if (isDocxMime(file.mime_type, file.name)) {
      return (
        <div className="flex size-full flex-col items-center justify-center gap-1 bg-blue-50 dark:bg-blue-950/30">
          <FileTextIcon className="size-8 text-blue-600 dark:text-blue-400" />
          <span className="text-[10px] font-semibold uppercase text-blue-700 dark:text-blue-300">
            DOCX
          </span>
        </div>
      )
    }

    if (isSpreadsheetMime(file.mime_type, file.name)) {
      return (
        <div className="flex size-full flex-col items-center justify-center gap-1 bg-emerald-50 dark:bg-emerald-950/30">
          <Icon className="size-8 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
            {getFileExtension(file.name) || "XLS"}
          </span>
        </div>
      )
    }

    if (isVideoMime(file.mime_type)) {
      return (
        <video
          src={url}
          className="size-full object-cover"
          muted
          preload="metadata"
        />
      )
    }

    const ext = getFileExtension(file.name)
    return (
      <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted/60">
        <Icon className="size-8 text-muted-foreground" />
        {ext ? (
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">
            {ext}
          </span>
        ) : null}
      </div>
    )
  }

  const isLoading = folders.loading || files.loading
  const hasError = folders.error || files.error
  const isEmpty =
    !isLoading &&
    !hasError &&
    visibleFolders.length === 0 &&
    visibleFiles.length === 0

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10">
              <FolderIcon className="size-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Folder</p>
              <p className="text-xl font-semibold">{visibleFolders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
              <HardDriveIcon className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">File di folder ini</p>
              <p className="text-xl font-semibold">{scopedFiles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <CloudUploadIcon className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total ukuran</p>
              <p className="text-xl font-semibold">{formatBytes(totalSize)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari folder atau file..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={`${sortKey}-${sortDesc ? "desc" : "asc"}`}
            onValueChange={(v) => {
              if (!v) return
              const [key, dir] = v.split("-") as [StorageSortKey, "asc" | "desc"]
              setSortKey(key)
              setSortDesc(dir === "desc")
            }}
          >
            <SelectTrigger size="sm" className="min-w-[140px]">
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Nama A–Z</SelectItem>
              <SelectItem value="name-desc">Nama Z–A</SelectItem>
              <SelectItem value="date-desc">Terbaru</SelectItem>
              <SelectItem value="date-asc">Terlama</SelectItem>
              <SelectItem value="size-desc">Ukuran terbesar</SelectItem>
              <SelectItem value="size-asc">Ukuran terkecil</SelectItem>
              <SelectItem value="type-asc">Tipe A–Z</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border p-0.5">
            <Button
              type="button"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("grid")}
              aria-label="Tampilan grid"
            >
              <Grid3x3Icon className="size-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setViewMode("list")}
              aria-label="Tampilan list"
            >
              <LayoutListIcon className="size-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isLoading}
          >
            <RefreshCwIcon className={cn("size-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFolderDialogOpen(true)}
          >
            <FolderPlusIcon className="size-4" />
            Folder Baru
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUploadIcon className="size-4" />
            {uploading ? "Mengunggah..." : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void uploadFiles(e.target.files ?? [])}
          />
        </div>
      </div>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => setCurrentFolderId(null)}
                  onDragOver={(e) => {
                    if (!isInternalDrag(e)) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                  }}
                  onDrop={(e) => {
                    if (!isInternalDrag(e)) return
                    e.preventDefault()
                    const fileId = Number(
                      e.dataTransfer.getData(FILE_DRAG_TYPE)
                    )
                    if (fileId) void moveFile(fileId, null)
                  }}
                />
              }
            >
              Semua File
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumb.map((folder) => (
            <span key={folder.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {folder.id === currentFolderId ? (
                  <BreadcrumbPage>{folder.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(folder.id)}
                      />
                    }
                  >
                    {folder.name}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex min-h-0 flex-1 gap-4">
        <aside className="hidden w-56 shrink-0 rounded-xl border bg-card p-3 lg:block">
          <p className="mb-2 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Folder
          </p>
          <FolderTree
            folders={allFolders}
            currentFolderId={currentFolderId}
            onSelect={setCurrentFolderId}
            onDropFile={(fileId, folderId) => void moveFile(fileId, folderId)}
          />
        </aside>

        <div
          className={cn(
            "relative min-h-[420px] min-w-0 flex-1 rounded-xl border bg-card",
            dragOver && "ring-2 ring-primary ring-offset-2"
          )}
          onDragOver={(e) => {
            if (isInternalDrag(e)) return // pindah file ditangani drop target folder
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDragOver(false)
            }
          }}
          onDrop={(e) => {
            if (isInternalDrag(e)) return
            e.preventDefault()
            setDragOver(false)
            void uploadFiles(e.dataTransfer.files)
          }}
        >
          {dragOver ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-background/90 px-8 py-6 shadow-lg">
                <CloudUploadIcon className="size-10 text-primary" />
                <p className="font-medium">Lepaskan file untuk mengunggah</p>
              </div>
            </div>
          ) : null}

          <div className="p-4">
            {isLoading ? <LoadingState rows={6} /> : null}
            {folders.error ? <ErrorState message={folders.error} /> : null}
            {files.error ? <ErrorState message={files.error} /> : null}

            {!isLoading && !hasError ? (
              <>
                {visibleFolders.length > 0 ? (
                  <section className="mb-6">
                    <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                      Folder
                    </h3>
                    {viewMode === "grid" ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {visibleFolders.map((folder) => (
                          <div
                            key={folder.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setCurrentFolderId(folder.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                setCurrentFolderId(folder.id)
                              }
                            }}
                            onDragOver={(e) => {
                              if (!isInternalDrag(e)) return
                              e.preventDefault()
                              e.dataTransfer.dropEffect = "move"
                              setDropFolderId(folder.id)
                            }}
                            onDragLeave={() =>
                              setDropFolderId((prev) =>
                                prev === folder.id ? null : prev
                              )
                            }
                            onDrop={(e) => {
                              if (!isInternalDrag(e)) return
                              e.preventDefault()
                              e.stopPropagation()
                              setDropFolderId(null)
                              const fileId = Number(
                                e.dataTransfer.getData(FILE_DRAG_TYPE)
                              )
                              if (fileId) void moveFile(fileId, folder.id)
                            }}
                            className={cn(
                              "group flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40",
                              dropFolderId === folder.id &&
                                "border-primary ring-2 ring-primary/40"
                            )}
                          >
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                              <FolderIcon className="size-6 text-amber-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{folder.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Klik untuk buka · tarik file ke sini
                              </p>
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Aksi folder ${folder.name}`}
                                    />
                                  }
                                >
                                  <MoreVerticalIcon className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setCurrentFolderId(folder.id)}
                                  >
                                    <ChevronRightIcon className="size-4" />
                                    Buka
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleteFolderTarget(folder)}
                                  >
                                    <Trash2Icon className="size-4" />
                                    Hapus Folder
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead className="w-[120px]">Tipe</TableHead>
                            <TableHead className="w-[60px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleFolders.map((folder) => (
                            <TableRow
                              key={folder.id}
                              className={cn(
                                "cursor-pointer",
                                dropFolderId === folder.id &&
                                  "bg-primary/10 outline-2 outline-primary"
                              )}
                              onClick={() => setCurrentFolderId(folder.id)}
                              onDragOver={(e) => {
                                if (!isInternalDrag(e)) return
                                e.preventDefault()
                                e.dataTransfer.dropEffect = "move"
                                setDropFolderId(folder.id)
                              }}
                              onDragLeave={() =>
                                setDropFolderId((prev) =>
                                  prev === folder.id ? null : prev
                                )
                              }
                              onDrop={(e) => {
                                if (!isInternalDrag(e)) return
                                e.preventDefault()
                                e.stopPropagation()
                                setDropFolderId(null)
                                const fileId = Number(
                                  e.dataTransfer.getData(FILE_DRAG_TYPE)
                                )
                                if (fileId) void moveFile(fileId, folder.id)
                              }}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FolderIcon className="size-4 text-amber-500" />
                                  <span className="font-medium">{folder.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                Folder
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Hapus folder ${folder.name}`}
                                  onClick={() => setDeleteFolderTarget(folder)}
                                >
                                  <Trash2Icon className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </section>
                ) : null}

                {visibleFiles.length > 0 ? (
                  <section>
                    <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                      File
                    </h3>
                    {viewMode === "grid" ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {visibleFiles.map((file) => (
                          <div
                            key={file.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                FILE_DRAG_TYPE,
                                String(file.id)
                              )
                              e.dataTransfer.effectAllowed = "move"
                            }}
                            className="group flex cursor-grab flex-col overflow-hidden rounded-xl border bg-background transition-shadow hover:shadow-md active:cursor-grabbing"
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="aspect-[4/3] w-full overflow-hidden border-b bg-muted/30"
                            >
                              <FileThumbnail file={file} />
                            </button>
                            <div className="flex items-start gap-2 p-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatBytes(file.size_bytes)} ·{" "}
                                  {getFileKindLabel(file.mime_type, file.name)}
                                </p>
                              </div>
                              <FileActions file={file} compact />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead className="hidden sm:table-cell">
                              Ukuran
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Tipe
                            </TableHead>
                            <TableHead className="hidden lg:table-cell">
                              Diunggah
                            </TableHead>
                            <TableHead className="w-[60px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleFiles.map((file) => {
                            const Icon = getFileIcon(file.mime_type, file.name)
                            return (
                              <TableRow
                                key={file.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(
                                    FILE_DRAG_TYPE,
                                    String(file.id)
                                  )
                                  e.dataTransfer.effectAllowed = "move"
                                }}
                                className="cursor-pointer"
                                onClick={() => setPreviewFile(file)}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate font-medium">
                                      {file.name}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden text-muted-foreground sm:table-cell">
                                  {formatBytes(file.size_bytes)}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge variant="secondary">
                                    {getFileKindLabel(file.mime_type, file.name)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden text-muted-foreground lg:table-cell">
                                  {formatDate(file.created_at)}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <FileActions file={file} compact />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </section>
                ) : null}

                {isEmpty ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                      <CloudUploadIcon className="size-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">
                      {search.trim()
                        ? "Tidak ada hasil pencarian"
                        : "Folder ini kosong"}
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {search.trim()
                        ? "Coba kata kunci lain atau hapus filter pencarian."
                        : "Unggah file atau buat folder baru. Anda juga bisa menarik & melepas file ke area ini."}
                    </p>
                    {!search.trim() ? (
                      <div className="mt-4 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setFolderDialogOpen(true)}
                        >
                          <FolderPlusIcon className="size-4" />
                          Buat Folder
                        </Button>
                        <Button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <CloudUploadIcon className="size-4" />
                          Upload File
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <FormDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        title="Folder Baru"
        description={
          currentFolderId
            ? "Folder akan dibuat di lokasi saat ini."
            : "Folder akan dibuat di root penyimpanan."
        }
        onSubmit={createFolder}
        saving={creatingFolder}
        submitLabel="Buat Folder"
        scrollable={false}
      >
        <Input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Nama folder"
          autoFocus
          required
        />
      </FormDialog>

      <ConfirmDialog
        open={deleteFolderTarget != null}
        onOpenChange={(v) => {
          if (!v) setDeleteFolderTarget(null)
        }}
        title={`Hapus Folder "${deleteFolderTarget?.name ?? ""}"`}
        description="Folder beserta SELURUH subfolder dan file di dalamnya akan dihapus permanen. Tindakan ini tidak dapat dibatalkan."
        onConfirm={deleteFolder}
      />

      <FilePreviewDialog
        open={previewFile != null}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        url={previewFile ? storageUrl(previewFile.file_url) : ""}
        fileName={previewFile?.name ?? ""}
        fileSize={previewFile?.size_bytes}
        fileDate={previewFile?.created_at ? formatDate(previewFile.created_at) : undefined}
        kindLabel={previewFile ? getFileKindLabel(previewFile.mime_type, previewFile.name) : undefined}
      />
    </div>
  )
}
