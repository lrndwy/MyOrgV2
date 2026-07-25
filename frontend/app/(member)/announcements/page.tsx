"use client"

import { useEffect, useMemo, useState } from "react"
import { MegaphoneIcon, SearchIcon, FileIcon, DownloadIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/page-states"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import { storageUrl } from "@/lib/storage-url"
import type { Announcement, AnnouncementAttachment } from "@/lib/types"

export default function AnnouncementsPage() {
  const { data, loading, error } = useApi(async () => {
    const result = await apiRequest<
      Announcement[] | { items: Announcement[] }
    >("/announcements")
    return unwrapList(result)
  })
  const [query, setQuery] = useState("")
  const [viewing, setViewing] = useState<Announcement | null>(null)
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)

  useEffect(() => {
    if (!viewing) {
      setAttachments([])
      return
    }
    setLoadingAttachments(true)
    apiRequest<AnnouncementAttachment[] | { items: AnnouncementAttachment[] }>(
      `/announcements/${viewing.id}/attachments`
    )
      .then((res) => setAttachments(unwrapList(res)))
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttachments(false))
  }, [viewing?.id])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? [])
      .filter((item) => {
        if (!q) return true
        return (
          item.title.toLowerCase().includes(q) ||
          (item.content ?? "").toLowerCase().includes(q)
        )
      })
      .sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      )
  }, [data, query])

  return (
    <>
      <PageHeader title="Pengumuman" crumbs={[{ label: "Pengumuman" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="relative w-full max-w-md">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pengumuman..."
            className="pl-8"
          />
        </div>

        {loading ? <LoadingState rows={4} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState message="Belum ada pengumuman" />
        ) : null}

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {filtered.map((item) => {
            const bannerUrl = item.banner_url
              ? storageUrl(item.banner_url)
              : null
            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border bg-card transition-colors hover:bg-muted/20"
              >
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt={item.title}
                    className="h-48 w-full object-cover"
                  />
                ) : null}
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <MegaphoneIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </p>
                      <h3 className="mt-1 font-heading text-lg font-medium">
                        {item.title}
                      </h3>
                      <div
                        className="mt-2 line-clamp-3 text-sm text-muted-foreground [&_a]:underline [&_b]:font-medium [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_li]:ml-4 [&_li]:list-disc [&_ol]:list-decimal [&_p]:mb-1 [&_ul]:ml-4 [&_ul]:list-disc"
                        dangerouslySetInnerHTML={{
                          __html: item.content || "Tidak ada isi pengumuman",
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 px-0"
                        onClick={() => setViewing(item)}
                      >
                        Baca selengkapnya
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

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

            {attachments.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Lampiran</p>
                {attachments.map((att) => (
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
            ) : loadingAttachments ? (
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
    </>
  )
}
