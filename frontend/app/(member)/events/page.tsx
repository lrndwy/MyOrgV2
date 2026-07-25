"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarIcon,
  MapPinIcon,
  SearchIcon,
} from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import { eventBannerUrl } from "@/lib/event-banner"
import { cn } from "@/lib/utils"
import type { Event } from "@/lib/types"

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "upcoming", label: "Mendatang" },
  { id: "ongoing", label: "Berlangsung" },
  { id: "finished", label: "Selesai" },
] as const

export default function EventsPage() {
  const { data, loading, error } = useApi(async () => {
    const result = await apiRequest<Event[] | { items: Event[] }>("/events")
    return unwrapList(result)
  })
  const [query, setQuery] = useState("")
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]["id"]>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data ?? [])
      .filter((event) => (filter === "all" ? true : event.status === filter))
      .filter((event) => {
        if (!q) return true
        return (
          event.title.toLowerCase().includes(q) ||
          (event.location ?? "").toLowerCase().includes(q) ||
          (event.description ?? "").toLowerCase().includes(q)
        )
      })
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
  }, [data, filter, query])

  return (
    <>
      <PageHeader title="Event" crumbs={[{ label: "Event" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari event atau lokasi..."
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={filter === item.id ? "default" : "outline"}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? <LoadingState rows={4} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState message="Tidak ada event yang cocok" />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => {
            const banner = eventBannerUrl(event)
            return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border bg-card transition-all",
                "hover:border-primary/30 hover:bg-muted/20"
              )}
            >
              <div className="relative aspect-[16/9] bg-muted">
                {banner ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={banner}
                    alt={event.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <CalendarIcon className="size-10 opacity-40" />
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <StatusBadge status={event.status} />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="font-heading text-base font-medium group-hover:text-primary">
                  {event.title}
                </h3>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {event.description || "Tidak ada deskripsi"}
                </p>
                <div className="mt-auto flex flex-col gap-1 pt-2 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5" />
                    {formatDate(event.start_time)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPinIcon className="size-3.5" />
                    {event.location || "Lokasi belum diisi"}
                  </p>
                </div>
                <span className="mt-3 text-sm font-medium text-primary">
                  Lihat detail →
                </span>
              </div>
            </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
