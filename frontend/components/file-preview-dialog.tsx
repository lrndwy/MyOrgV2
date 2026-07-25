"use client"

import { DownloadIcon, ExternalLinkIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FilePreview } from "@/components/file-preview"
import { formatBytes } from "@/lib/storage-file-utils"

interface FilePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string
  fileName: string
  fileSize?: number | null
  fileDate?: string | null
  kindLabel?: string
}

export function FilePreviewDialog({
  open,
  onOpenChange,
  url,
  fileName,
  fileSize,
  fileDate,
  kindLabel,
}: FilePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 pt-5 pb-4">
          <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
          <DialogDescription>
            {kindLabel ? `${kindLabel} · ` : ""}
            {fileSize != null ? formatBytes(fileSize) : ""}
            {fileDate ? ` · ${fileDate}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/10 p-4">
          <FilePreview url={url} fileName={fileName} className="h-full" />
        </div>

        <DialogFooter className="border-t px-6 py-3">
          <Button
            render={
              <a href={url} target="_blank" rel="noreferrer" />
            }
          >
            <ExternalLinkIcon className="size-4" />
            Buka di Tab Baru
          </Button>
          <Button
            variant="outline"
            render={
              <a href={url} download={fileName} />
            }
          >
            <DownloadIcon className="size-4" />
            Unduh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
