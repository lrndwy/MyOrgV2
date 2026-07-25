import {
  FileArchiveIcon,
  FileAudioIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  ImageIcon,
  type LucideIcon,
} from "lucide-react"

export function formatBytes(bytes?: number | null) {
  if (bytes == null || bytes <= 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function isImageMime(mime?: string) {
  return !!mime?.startsWith("image/")
}

export function isPdfMime(mime?: string) {
  return mime === "application/pdf"
}

export function isVideoMime(mime?: string) {
  return !!mime?.startsWith("video/")
}

export function isAudioMime(mime?: string) {
  return !!mime?.startsWith("audio/")
}

export function isSpreadsheetMime(mime?: string, name?: string) {
  if (
    mime?.includes("spreadsheet") ||
    mime?.includes("excel") ||
    mime === "text/csv"
  ) {
    return true
  }
  return /\.(csv|xls|xlsx)$/i.test(name ?? "")
}

export function isDocxMime(mime?: string, name?: string) {
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return true
  if (mime === "application/msword") return true
  return /\.(docx|doc)$/i.test(name ?? "")
}

export function isArchiveMime(mime?: string, name?: string) {
  if (mime?.includes("zip") || mime?.includes("archive")) return true
  return /\.(zip|rar|7z|tar|gz)$/i.test(name ?? "")
}

export function getFileExtension(name?: string) {
  if (!name) return ""
  const i = name.lastIndexOf(".")
  return i >= 0 ? name.slice(i + 1).toUpperCase() : ""
}

export function getFileKindLabel(mime?: string, name?: string) {
  if (isImageMime(mime)) return "Gambar"
  if (isPdfMime(mime)) return "PDF"
  if (isVideoMime(mime)) return "Video"
  if (isAudioMime(mime)) return "Audio"
  if (isSpreadsheetMime(mime, name)) return "Spreadsheet"
  if (isArchiveMime(mime, name)) return "Arsip"
  if (mime?.startsWith("text/")) return "Teks"
  const ext = getFileExtension(name)
  return ext || mime?.split("/")[1]?.toUpperCase() || "File"
}

export function getFileIcon(mime?: string, name?: string): LucideIcon {
  if (isImageMime(mime)) return ImageIcon
  if (isPdfMime(mime)) return FileTextIcon
  if (isVideoMime(mime)) return FileVideoIcon
  if (isAudioMime(mime)) return FileAudioIcon
  if (isSpreadsheetMime(mime, name)) return FileSpreadsheetIcon
  if (isArchiveMime(mime, name)) return FileArchiveIcon
  if (mime?.startsWith("text/")) return FileTextIcon
  return FileIcon
}

export type StorageSortKey = "name" | "size" | "date" | "type"

export function sortStorageFiles<T extends {
  name: string
  size_bytes?: number
  mime_type?: string
  created_at?: string
}>(
  items: T[],
  key: StorageSortKey,
  desc: boolean
): T[] {
  const sorted = [...items].sort((a, b) => {
    switch (key) {
      case "size":
        return (a.size_bytes ?? 0) - (b.size_bytes ?? 0)
      case "date":
        return (
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime()
        )
      case "type":
        return getFileKindLabel(a.mime_type, a.name).localeCompare(
          getFileKindLabel(b.mime_type, b.name),
          "id"
        )
      default:
        return a.name.localeCompare(b.name, "id")
    }
  })
  return desc ? sorted.reverse() : sorted
}
