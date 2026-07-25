"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImageIcon, Trash2Icon, UploadCloudIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ImageUploadFieldProps = {
  value: File | null
  onChange: (file: File | null) => void
  existingUrl?: string | null
  disabled?: boolean
  maxSizeMB?: number
  accept?: string
  className?: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImageUploadField({
  value,
  onChange,
  existingUrl,
  disabled,
  maxSizeMB = 5,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  className,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingHidden, setExistingHidden] = useState(false)

  useEffect(() => {
    setExistingHidden(false)
  }, [existingUrl])

  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [value])

  const displayUrl =
    previewUrl ?? (existingHidden ? null : existingUrl) ?? null

  const validateAndSet = useCallback(
    (file: File | null) => {
      if (!file) {
        onChange(null)
        return
      }
      if (!file.type.startsWith("image/")) {
        toast.error("File harus berupa gambar (JPG, PNG, WebP, GIF)")
        return
      }
      const maxBytes = maxSizeMB * 1024 * 1024
      if (file.size > maxBytes) {
        toast.error(`Ukuran maksimal ${maxSizeMB} MB`)
        return
      }
      onChange(file)
    },
    [maxSizeMB, onChange]
  )

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0]
    if (file) validateAndSet(file)
  }

  function handleClear() {
    onChange(null)
    if (existingUrl) setExistingHidden(true)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className={cn("min-w-0 max-w-full space-y-2", className)}>
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
          handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          "relative w-full max-w-full overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        {displayUrl ? (
          <div className="group relative aspect-[16/9] w-full bg-muted">
            <img
              src={displayUrl}
              alt="Preview banner"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                }}
              >
                Ganti
              </Button>
              {(value || existingUrl) && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClear()
                  }}
                >
                  <Trash2Icon className="size-4" />
                  Hapus
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex aspect-[16/9] flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <UploadCloudIcon className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">
              Tarik & lepas gambar, atau klik untuk memilih
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP, GIF — maks. {maxSizeMB} MB
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5 shrink-0" />
          <span className="truncate font-medium text-foreground">{value.name}</span>
          <span className="shrink-0">{formatBytes(value.size)}</span>
        </div>
      ) : existingUrl ? (
        <p className="text-xs text-muted-foreground">
          Banner saat ini akan diganti jika Anda unggah file baru.
        </p>
      ) : null}
    </div>
  )
}
