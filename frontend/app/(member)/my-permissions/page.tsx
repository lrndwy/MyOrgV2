"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ClipboardListIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import type { PermissionRequest } from "@/lib/types"

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Disetujui" },
  { id: "rejected", label: "Ditolak" },
] as const

export default function MyPermissionsPage() {
  const { data, loading, error } = useApi(async () => {
    const result = await apiRequest<
      PermissionRequest[] | { items: PermissionRequest[] }
    >("/permission_requests/me")
    return unwrapList(result)
  })
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]["id"]>("all")

  const rows = useMemo(() => data ?? [], [data])
  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      approved: rows.filter((r) => r.status === "approved").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
    }),
    [rows]
  )

  const filtered = useMemo(
    () =>
      rows
        .filter((item) => (filter === "all" ? true : item.status === filter))
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime()
        ),
    [rows, filter]
  )

  return (
    <>
      <PageHeader
        title="Perizinan Saya"
        crumbs={[{ label: "Perizinan Saya" }]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-4">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={
                filter === item.id
                  ? "rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-left"
                  : "rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
              }
            >
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {counts[item.id]}
              </p>
            </button>
          ))}
        </div>

        {loading ? <LoadingState rows={4} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState message="Belum ada pengajuan perizinan" />
        ) : null}

        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ClipboardListIcon className="size-4" />
                    <span className="text-xs">
                      Diajukan {formatDate(item.created_at)}
                    </span>
                  </div>
                  <h3 className="mt-1 font-heading text-base font-medium">
                    {item.event?.title ?? `Event #${item.event_id}`}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.reason || "Tidak ada alasan tertulis"}
                  </p>
                  {item.note ? (
                    <p className="mt-2 rounded-xl bg-muted/50 px-3 py-2 text-xs">
                      Catatan admin: {item.note}
                    </p>
                  ) : null}
                </div>
                <StatusBadge status={item.status} />
              </div>
              {item.event_id ? (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/events/${item.event_id}`} />}
                  >
                    Buka event
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
