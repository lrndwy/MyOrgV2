"use client"

import Link from "next/link"
import {
  ArrowRightIcon,
  CalendarIcon,
  ClipboardListIcon,
  MegaphoneIcon,
} from "lucide-react"
import { ScheduleCalendar } from "@/components/member/schedule-calendar"
import { PageHeader } from "@/components/page-header"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import type { Announcement, Event, PermissionRequest } from "@/lib/types"

export default function DashboardPage() {
  const events = useApi(async () => {
    const data = await apiRequest<Event[] | { items: Event[] }>("/events")
    return unwrapList(data)
  })
  const announcements = useApi(async () => {
    const data = await apiRequest<Announcement[] | { items: Announcement[] }>(
      "/announcements"
    )
    return unwrapList(data).slice(0, 4)
  })
  const permissions = useApi(async () => {
    const data = await apiRequest<
      PermissionRequest[] | { items: PermissionRequest[] }
    >("/permission_requests/me")
    return unwrapList(data)
      .filter((item) => item.status === "pending")
      .slice(0, 3)
  })

  const upcoming = (events.data ?? [])
    .filter((e) => e.status === "upcoming" || e.status === "ongoing")
    .slice(0, 4)

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        {events.loading ? <LoadingState rows={4} /> : null}
        {events.error ? <ErrorState message={events.error} /> : null}
        {!events.loading && !events.error ? (
          <ScheduleCalendar events={events.data ?? []} />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon />
                  Event mendatang
                </CardTitle>
                <CardDescription>
                  Ringkasan kegiatan yang perlu Anda ikuti
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/events" />}
              >
                Semua
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {upcoming.length === 0 ? (
                <EmptyState message="Belum ada event mendatang" />
              ) : (
                upcoming.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.start_time)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={event.status} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardListIcon />
                  Perizinan pending
                </CardTitle>
                <CardDescription>Menunggu keputusan admin</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {permissions.loading ? <LoadingState rows={2} /> : null}
                {!permissions.loading &&
                (permissions.data?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Tidak ada pengajuan pending
                  </p>
                ) : null}
                {permissions.data?.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    <p className="font-medium">
                      {item.event?.title ?? `Event #${item.event_id}`}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {item.reason ?? "Tanpa alasan"}
                    </p>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  render={<Link href="/my-permissions" />}
                >
                  Lihat perizinan
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MegaphoneIcon />
                    Pengumuman
                  </CardTitle>
                  <CardDescription>Info terbaru organisasi</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href="/announcements" />}
                >
                  Semua
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {announcements.loading ? <LoadingState rows={2} /> : null}
                {announcements.error ? (
                  <ErrorState message={announcements.error} />
                ) : null}
                {!announcements.loading &&
                (announcements.data?.length ?? 0) === 0 ? (
                  <EmptyState message="Belum ada pengumuman" />
                ) : null}
                {announcements.data?.map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {item.content}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
