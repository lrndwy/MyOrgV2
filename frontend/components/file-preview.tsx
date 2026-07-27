"use client"

import { useEffect, useRef, useState } from "react"
import { ExternalLinkIcon, Loader2Icon, AlertTriangleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FilePreviewKind = "docx" | "xlsx" | "pdf" | "image" | "video" | "other"

function detectKind(fileName: string, url?: string): FilePreviewKind {
  let ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  if (ext === fileName.toLowerCase()) ext = ""
  if (!ext && url) {
    try {
      const pathname = new URL(url).pathname
      ext = pathname.split(".").pop()?.toLowerCase() ?? ""
    } catch { /* ignore */ }
  }
  if (ext === "docx" || ext === "doc") return "docx"
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "xlsx"
  if (ext === "pdf") return "pdf"
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext)) return "image"
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return "video"
  return "other"
}

interface FilePreviewProps {
  url: string
  fileName: string
  className?: string
}

export function FilePreview({ url, fileName, className }: FilePreviewProps) {
  const kind = detectKind(fileName, url)

  if (kind === "pdf") {
    return (
      <iframe
        title={fileName}
        src={url}
        className={cn("min-h-[80vh] h-full w-full rounded-md border", className)}
      />
    )
  }

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={fileName}
        className={cn("mx-auto max-h-[60vh] w-full rounded-md border object-contain", className)}
      />
    )
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        className={cn("mx-auto max-h-[60vh] w-full rounded-md border p-2", className)}
      />
    )
  }

  if (kind === "docx") {
    return <DocxPreview url={url} className={className} />
  }

  if (kind === "xlsx") {
    return <XlsxPreview url={url} className={className} />
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-8 text-muted-foreground", className)}>
      <p className="text-sm">Pratinjau tidak tersedia untuk jenis file ini.</p>
      <Button render={<a href={url} target="_blank" rel="noreferrer" />}>
        <ExternalLinkIcon className="size-4" />
        Buka di Tab Baru
      </Button>
    </div>
  )
}

function DocxPreview({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false

    async function render() {
      try {
        setStatus("loading")
        el!.innerHTML = ""

        const [docxMod, blob] = await Promise.all([
          import("docx-preview"),
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`Gagal memuat file: ${r.status}`)
            return r.blob()
          }),
        ])

        if (cancelled) return

        await docxMod.renderAsync(blob, el!, undefined, {
          className: "docx-viewer",
          inWrapper: true,
          breakPages: true,
          ignoreFonts: false,
          useBase64URL: true,
        })

        if (!cancelled) setStatus("done")
      } catch (err) {
        if (!cancelled) {
          console.error("DOCX preview error:", err)
          setStatus("error")
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className={cn("relative min-h-[200px]", className)}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Memuat pratinjau DOCX...
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertTriangleIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Gagal memuat pratinjau DOCX.
            </p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          "overflow-auto rounded-md border bg-white p-4 text-sm dark:bg-white",
          status === "loading" && "invisible",
          status === "error" && "hidden"
        )}
        style={{ maxHeight: "80vh" }}
      />
    </div>
  )
}

function XlsxPreview({ url, className }: { url: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading")
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  const workbookRef = useRef<ReturnType<typeof import("xlsx").utils.book_new> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false

    async function render() {
      try {
        setStatus("loading")
        el!.innerHTML = ""

        const [xlsxMod, arrayBuffer] = await Promise.all([
          import("xlsx"),
          fetch(url).then((r) => {
            if (!r.ok) throw new Error(`Gagal memuat file: ${r.status}`)
            return r.arrayBuffer()
          }),
        ])

        if (cancelled) return

        const wb = xlsxMod.read(arrayBuffer, { type: "array" })
        workbookRef.current = wb
        const names = wb.SheetNames
        setSheetNames(names)
        setActiveSheet(0)

        renderSheet(wb, 0, el!, xlsxMod)
        if (!cancelled) setStatus("done")
      } catch (err) {
        if (!cancelled) {
          console.error("XLSX preview error:", err)
          setStatus("error")
        }
      }
    }

    render()

    return () => {
      cancelled = true
    }
  }, [url])

  function renderSheet(
    wb: ReturnType<typeof import("xlsx").utils.book_new>,
    idx: number,
    el: HTMLElement,
    xlsxMod: typeof import("xlsx")
  ) {
    const sheetName = wb.SheetNames[idx]
    if (!sheetName) return
    const sheet = wb.Sheets[sheetName]
    const data = xlsxMod.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    })

    const html = renderTableHtml(data)
    el.innerHTML = html
  }

  function handleSheetChange(idx: number) {
    setActiveSheet(idx)
    const el = containerRef.current
    if (!el || !workbookRef.current) return
    import("xlsx").then((xlsxMod) => {
      renderSheet(workbookRef.current!, idx, el, xlsxMod)
    })
  }

  return (
    <div className={cn("relative min-h-[200px]", className)}>
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Memuat pratinjau spreadsheet...
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertTriangleIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Gagal memuat pratinjau spreadsheet.
            </p>
          </div>
        </div>
      )}
      {sheetNames.length > 1 && (
        <div className="flex gap-1 border-b bg-muted/40 px-2 pt-1">
          {sheetNames.map((name, i) => (
            <button
              key={name}
              onClick={() => handleSheetChange(i)}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors",
                i === activeSheet
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        className={cn(
          "overflow-auto rounded-md border bg-white p-0 text-sm",
          status === "loading" && "invisible",
          status === "error" && "hidden"
        )}
        style={{ maxHeight: "80vh" }}
      />
    </div>
  )
}

function renderTableHtml(rows: unknown[][]): string {
  if (rows.length === 0) {
    return '<div class="flex items-center justify-center p-8 text-sm text-gray-500">Sheet kosong</div>'
  }

  const maxCols = Math.max(...rows.map((r) => r.length))
  const headerRow = rows[0]
  const bodyRows = rows.slice(1)

  let html =
    '<table class="w-full border-collapse text-sm"><thead><tr>'
  html +=
    '<th class="sticky top-0 border border-gray-200 bg-gray-50 px-2 py-1 text-left text-xs font-medium text-gray-500" style="width:40px"></th>'
  for (let c = 0; c < maxCols; c++) {
    const letter = columnLabel(c)
    html += `<th class="sticky top-0 border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500">${letter}</th>`
  }
  html += "</tr></thead><tbody>"

  for (let r = 0; r < bodyRows.length; r++) {
    const row = bodyRows[r]
    html += "<tr>"
    html += `<td class="sticky left-0 border border-gray-200 bg-gray-50 px-2 py-1 text-center text-xs text-gray-400">${r + 2}</td>`
    for (let c = 0; c < maxCols; c++) {
      const val = row[c]
      const text = val == null ? "" : String(val)
      html += `<td class="border border-gray-200 px-2 py-1 whitespace-nowrap">${escapeHtml(text)}</td>`
    }
    html += "</tr>"
  }

  html += "</tbody></table>"
  return html
}

function columnLabel(idx: number): string {
  let label = ""
  let n = idx
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  }
  return label
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export { detectKind as detectFilePreviewKind }
export type { FilePreviewKind }
