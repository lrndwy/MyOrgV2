"use client"

import type { ReactNode } from "react"
import { ExternalLinkIcon } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  buildDetailItems,
  extractImages,
  pickHeroImage,
  pickSubtitle,
  pickTitle,
  rowToRecord,
  type DetailItem,
} from "@/lib/record-detail-utils"
import { storageUrl } from "@/lib/storage-url"

function DetailValue({ item }: { item: DetailItem }) {
  if (item.type === "badge" && item.value !== "-") {
    return <StatusBadge status={item.value} />
  }
  if (item.type === "link" && item.value !== "-") {
    const href = storageUrl(String(item.raw ?? item.value))
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
      >
        Buka
        <ExternalLinkIcon className="size-3.5 shrink-0" />
      </a>
    )
  }
  if (item.type === "html" && typeof item.raw === "string") {
    return (
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: item.raw }}
      />
    )
  }
  return (
    <span className="break-words text-foreground">{item.value}</span>
  )
}

export function AutoRecordDetail({ row }: { row: unknown }) {
  const record = rowToRecord(row)
  const title = pickTitle(record)
  const subtitle = pickSubtitle(record)
  const hero = pickHeroImage(record)
  const images = extractImages(record).filter((img) => img.url !== hero)
  const items = buildDetailItems(record)
  const content =
    typeof record.content === "string" && record.content.trim()
      ? record.content
      : null

  return (
    <div className="flex flex-col gap-6 pb-2">
      {hero ? (
        <div className="relative -mx-6 -mt-2 overflow-hidden">
          <div className="aspect-[16/9] w-full bg-muted">
            <img
              src={hero}
              alt={title}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute right-0 bottom-0 left-0 p-6 text-white">
            <p className="text-lg font-semibold drop-shadow-sm">{title}</p>
            {subtitle ? (
              <p className="mt-1 line-clamp-2 text-sm text-white/85">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {!hero ? (
        <div className="space-y-1">
          <p className="text-lg font-semibold">{title}</p>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      ) : null}

      {typeof record.status === "string" ? (
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={record.status} />
          {typeof record.type === "string" ? (
            <Badge variant="secondary">{record.type}</Badge>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Informasi
        </h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-xl border bg-muted/20 p-3",
                item.type === "html" && "sm:col-span-2"
              )}
            >
              <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {item.label}
              </dt>
              <dd className="mt-1.5 text-sm">
                <DetailValue item={item} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {images.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Media
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {images.map((img) => (
              <a
                key={img.url}
                href={img.url}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-xl border bg-muted/30"
              >
                <img
                  src={img.url}
                  alt={img.label}
                  className="aspect-video w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                  {img.label}
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {content ? (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Konten
          </h3>
          <div
            className="prose prose-sm max-w-none rounded-xl border bg-muted/20 p-4 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </section>
      ) : null}
    </div>
  )
}

export function RecordDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden p-0 sm:max-w-xl md:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          {title ? <SheetTitle>{title}</SheetTitle> : null}
          <SheetDescription>
            {description ?? "Klik baris lain untuk melihat detail berbeda."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
