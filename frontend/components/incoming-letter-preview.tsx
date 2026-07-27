"use client"

import { FileTextIcon, Loader2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FilePreview } from "@/components/file-preview"
import { cn } from "@/lib/utils"

export type IncomingParsePreview = {
  letter_code?: string
  extracted_text?: string
  detected?: boolean
  method?: string
}

export type IncomingPreviewKind = "pdf" | "image" | "docx" | "other" | null

export function detectIncomingPreviewKind(file: File): IncomingPreviewKind {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "pdf") return "pdf"
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image"
  if (ext === "docx") return "docx"
  return "other"
}

type IncomingLetterPreviewProps = {
  file: File | null
  previewUrl: string | null
  previewKind: IncomingPreviewKind
  parsePreview: IncomingParsePreview | null
  parsing?: boolean
  className?: string
}

function OriginalPreview({
  file,
  previewUrl,
  previewKind,
}: Pick<
  IncomingLetterPreviewProps,
  "file" | "previewUrl" | "previewKind"
>) {
  if (!file || !previewUrl) return null

  if (previewKind === "pdf") {
    return (
      <iframe
        title="Preview file asli"
        src={previewUrl}
        className="h-[min(700px,80vh)] w-full rounded-md border bg-muted"
      />
    )
  }

  if (previewKind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={file.name}
        className="max-h-[min(700px,80vh)] w-full rounded-md border bg-muted object-contain"
      />
    )
  }

  if (previewKind === "docx") {
    return (
      <FilePreview url={previewUrl} fileName={file.name} className="h-[min(700px,80vh)]" />
    )
  }

  return (
    <div className="flex h-[min(400px,60vh)] flex-col items-center justify-center gap-3 rounded-md border bg-muted/40 p-6 text-center">
      <FileTextIcon className="size-10 text-muted-foreground opacity-60" />
      <div>
        <p className="text-sm font-medium">{file.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Format file tidak mendukung preview visual. Gunakan panel hasil parse.
        </p>
      </div>
      <a
        href={previewUrl}
        download={file.name}
        className="text-xs text-primary underline-offset-4 hover:underline"
      >
        Unduh file untuk dibuka
      </a>
    </div>
  )
}

function ParsePreviewPanel({
  parsePreview,
  parsing,
}: Pick<IncomingLetterPreviewProps, "parsePreview" | "parsing">) {
  if (parsing) {
    return (
      <div className="flex h-[min(700px,80vh)] items-center justify-center rounded-md border bg-muted/30">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Memproses file...
        </div>
      </div>
    )
  }

  if (!parsePreview) {
    return (
      <div className="flex h-[min(400px,60vh)] items-center justify-center rounded-md border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
        Hasil parse akan muncul setelah file diunggah.
      </div>
    )
  }

  const text = parsePreview.extracted_text?.trim() || "(Tidak ada teks yang diekstrak)"
  const methodLabel =
    parsePreview.method === "ocr"
      ? "OCR (Tesseract)"
      : parsePreview.method === "native"
        ? "Teks PDF asli"
        : parsePreview.method === "docx"
          ? "Ekstraksi DOCX"
          : parsePreview.method ?? null

  return (
    <div className="flex h-[min(700px,80vh)] min-h-0 flex-col overflow-hidden rounded-md border">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Hasil Parse
        </span>
        {methodLabel ? (
          <Badge variant="outline" className="text-xs">
            {methodLabel}
          </Badge>
        ) : null}
        {parsePreview.detected && parsePreview.letter_code ? (
          <Badge variant="secondary" className="font-mono text-xs">
            Nomor: {parsePreview.letter_code}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Nomor tidak terdeteksi otomatis
          </Badge>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain no-scrollbar">
        <pre className="whitespace-pre-wrap p-3 font-sans text-sm leading-relaxed text-foreground">
          {text}
        </pre>
      </div>
    </div>
  )
}

export function IncomingLetterPreview({
  file,
  previewUrl,
  previewKind,
  parsePreview,
  parsing,
  className,
}: IncomingLetterPreviewProps) {
  if (!file) return null

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium">Bandingkan file asli & hasil parse</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            File Asli
          </p>
          <OriginalPreview
            file={file}
            previewUrl={previewUrl}
            previewKind={previewKind}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hasil Parse OCR / Ekstraksi
          </p>
          <ParsePreviewPanel parsePreview={parsePreview} parsing={parsing} />
        </div>
      </div>
    </div>
  )
}
