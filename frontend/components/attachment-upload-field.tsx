"use client"

import { useEffect, useRef, useState } from "react"
import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AttachmentUploadFieldProps = {
  value: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
  accept?: string
  className?: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(file: File) {
  return file.type.startsWith("image/")
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

export function AttachmentUploadField({
  value,
  onChange,
  disabled,
  accept,
  className,
}: AttachmentUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  useEffect(() => {
    const urls = value.map((file) =>
      isImage(file) ? URL.createObjectURL(file) : ""
    )
    setPreviewUrls(urls)
    return () => {
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    }
  }, [value])

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    onChange([...value, ...Array.from(fileList)])
    if (inputRef.current) inputRef.current.value = ""
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={cn("min-w-0 max-w-full space-y-3", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragOver(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (disabled) return
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <UploadCloudIcon className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">
          Tarik & lepas file, atau klik untuk memilih
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, gambar, dokumen — bisa lebih dari satu file
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => addFiles(e.target.files)}
      />

      {value.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {value.map((file, index) => {
            const preview = previewUrls[index]
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex min-w-0 items-start gap-3 rounded-lg border bg-muted/20 p-3"
              >
                {preview ? (
                  <div className="size-16 shrink-0 overflow-hidden rounded-md border bg-muted">
                    <img
                      src={preview}
                      alt={file.name}
                      className="size-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted">
                    {isPdf(file) ? (
                      <FileTextIcon className="size-7 text-muted-foreground" />
                    ) : (
                      <FileIcon className="size-7 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {isImage(file) ? (
                      <ImageIcon className="size-3.5 shrink-0" />
                    ) : isPdf(file) ? (
                      <FileTextIcon className="size-3.5 shrink-0" />
                    ) : (
                      <FileIcon className="size-3.5 shrink-0" />
                    )}
                    <span>{formatBytes(file.size)}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAt(index)}
                  disabled={disabled}
                  aria-label={`Hapus ${file.name}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
