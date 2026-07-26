"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  BellIcon,
  CalendarIcon,
  ClipboardListIcon,
  MailIcon,
  MegaphoneIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { useAuth } from "@/components/providers/auth-provider"
import { PageHeader } from "@/components/page-header"
import { ErrorState, LoadingState } from "@/components/page-states"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatCurrency, formatDate, unwrapList } from "@/lib/format"
import type {
  Event,
  FinanceDashboard,
  Letter,
  PermissionRequest,
  User,
  Violation,
  Announcement,
} from "@/lib/types"

type StatCard = {
  label: string
  value: number | string
  hint?: string
  href: string
  icon: React.ReactNode
  show: boolean
}

const eventChartConfig = {
  count: { label: "Event", color: "var(--primary)" },
} satisfies ChartConfig

export default function AdminDashboardPage() {
  const { hasPermission } = useAuth()

  const canUsers = hasPermission("users.view")
  const canEvents = hasPermission("events.view")
  const canPermissions = hasPermission("attendance.approve")
  const canViolations = hasPermission("violations.view")
  const canLetters = hasPermission("letters.view")
  const canAnnouncements = hasPermission("announcement.create")
  const canFinance = hasPermission("finance.view")
  const users = useApi(async () => {
    if (!canUsers) return [] as User[]
    return apiRequest<User[] | { items: User[] }>("/users").then(unwrapList)
  }, [canUsers])

  const events = useApi(async () => {
    if (!canEvents) return [] as Event[]
    return apiRequest<Event[] | { items: Event[] }>("/events").then(unwrapList)
  }, [canEvents])

  const permissions = useApi(async () => {
    if (!canPermissions) return [] as PermissionRequest[]
    return apiRequest<
      PermissionRequest[] | { items: PermissionRequest[] }
    >("/attendance/permission_requests").then(unwrapList)
  }, [canPermissions])

  const violations = useApi(async () => {
    if (!canViolations) return [] as Violation[]
    return apiRequest<Violation[] | { items: Violation[] }>("/violations").then(
      unwrapList
    )
  }, [canViolations])

  const letters = useApi(async () => {
    if (!canLetters) return [] as Letter[]
    return apiRequest<Letter[] | { items: Letter[] }>("/letters").then(
      unwrapList
    )
  }, [canLetters])

  const announcements = useApi(async () => {
    if (!canAnnouncements) return [] as Announcement[]
    return apiRequest<
      Announcement[] | { items: Announcement[] }
    >("/announcements").then(unwrapList)
  }, [canAnnouncements])

  const finance = useApi(async () => {
    if (!canFinance) return null
    return apiRequest<FinanceDashboard>("/finance_transactions/dashboard")
  }, [canFinance])

  const loading =
    (canUsers && users.loading) ||
    (canEvents && events.loading) ||
    (canPermissions && permissions.loading) ||
    (canViolations && violations.loading) ||
    (canLetters && letters.loading) ||
    (canAnnouncements && announcements.loading) ||
    (canFinance && finance.loading)

  const firstError =
    users.error ||
    events.error ||
    permissions.error ||
    violations.error ||
    letters.error ||
    announcements.error ||
    finance.error

  const userRows = users.data ?? []
  const eventRows = useMemo(() => events.data ?? [], [events.data])
  const permissionRows = useMemo(() => permissions.data ?? [], [permissions.data])
  const violationRows = violations.data ?? []
  const letterRows = letters.data ?? []
  const announcementRows = announcements.data ?? []
  const financeSummary = finance.data?.summary

  const pendingPermissions = useMemo(
    () => permissionRows.filter((p) => p.status === "pending").slice(0, 5),
    [permissionRows]
  )

  const upcomingEvents = useMemo(
    () =>
      eventRows
        .filter((e) => e.status === "upcoming" || e.status === "ongoing")
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        .slice(0, 5),
    [eventRows]
  )

  const eventChartData = useMemo(() => {
    const upcoming = eventRows.filter((e) => e.status === "upcoming").length
    const ongoing = eventRows.filter((e) => e.status === "ongoing").length
    const finished = eventRows.filter((e) => e.status === "finished").length
    return [
      { status: "Mendatang", count: upcoming },
      { status: "Berlangsung", count: ongoing },
      { status: "Selesai", count: finished },
    ]
  }, [eventRows])

  const stats: StatCard[] = [
    {
      label: "Pengguna",
      value: userRows.length,
      hint: `${userRows.filter((u) => u.status === "active").length} aktif`,
      href: "/admin/users",
      icon: <UsersIcon />,
      show: canUsers,
    },
    {
      label: "Event",
      value: eventRows.length,
      hint: `${eventRows.filter((e) => e.status === "ongoing").length} berlangsung`,
      href: "/admin/events",
      icon: <CalendarIcon />,
      show: canEvents,
    },
    {
      label: "Perizinan pending",
      value: permissionRows.filter((p) => p.status === "pending").length,
      hint: `${permissionRows.length} total pengajuan`,
      href: "/admin/permissions",
      icon: <BellIcon />,
      show: canPermissions,
    },
    {
      label: "Pelanggaran",
      value: violationRows.length,
      href: "/admin/violations",
      icon: <ClipboardListIcon />,
      show: canViolations,
    },
    {
      label: "Surat",
      value: letterRows.length,
      hint: `${letterRows.filter((l) => l.type === "incoming").length} masuk · ${letterRows.filter((l) => l.type === "outgoing").length} keluar`,
      href: "/admin/letters",
      icon: <MailIcon />,
      show: canLetters,
    },
    {
      label: "Pengumuman",
      value: announcementRows.length,
      href: "/admin/announcements",
      icon: <MegaphoneIcon />,
      show: canAnnouncements,
    },
    {
      label: "Saldo keuangan",
      value: formatCurrency(financeSummary?.balance ?? 0),
      hint: `Masuk ${formatCurrency(financeSummary?.total_income ?? financeSummary?.income ?? 0)}`,
      href: "/admin/finance",
      icon: <WalletIcon />,
      show: canFinance,
    },
  ].filter((s) => s.show)

  const quickLinks = [
    { label: "Tambah pengguna", href: "/admin/users", show: canUsers },
    { label: "Buat event", href: "/admin/events", show: canEvents },
    {
      label: "Approval perizinan",
      href: "/admin/permissions",
      show: canPermissions,
    },
    {
      label: "Buat pengumuman",
      href: "/admin/announcements",
      show: canAnnouncements,
    },
    { label: "Keuangan", href: "/admin/finance", show: canFinance },
    { label: "Surat", href: "/admin/letters", show: canLetters },
  ].filter((l) => l.show)

  return (
    <>
      <PageHeader
        title="Dashboard Admin"
        crumbs={[
          { label: "Admin", href: "/admin/dashboard" },
          { label: "Dashboard" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
        {loading ? <LoadingState rows={4} /> : null}
        {firstError ? <ErrorState message={firstError} /> : null}

        {!loading ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">
                        {stat.value}
                      </p>
                      {stat.hint ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stat.hint}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary [&_svg]:size-4">
                      {stat.icon}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {quickLinks.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Aksi cepat</CardTitle>
                  <CardDescription>
                    Pintasan modul operasional yang sering dipakai
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {quickLinks.map((link) => (
                    <Button
                      key={link.href + link.label}
                      variant="outline"
                      size="sm"
                      render={<Link href={link.href} />}
                    >
                      {link.label}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              {canEvents ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Status event</CardTitle>
                    <CardDescription>
                      Sebaran event berdasarkan status
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={eventChartConfig}
                      className="aspect-auto h-56 w-full"
                    >
                      <BarChart data={eventChartData} accessibilityLayer>
                        <CartesianGrid vertical={false} />
                        <XAxis
                          dataKey="status"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          width={28}
                        />
                        <ChartTooltip
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                          dataKey="count"
                          fill="var(--color-count)"
                          radius={8}
                        />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              ) : null}

              {canFinance ? (
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle>Ringkasan keuangan</CardTitle>
                      <CardDescription>
                        Snapshot pemasukan dan pengeluaran
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href="/admin/finance" />}
                    >
                      Detail
                    </Button>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Pemasukan</p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {formatCurrency(
                          financeSummary?.total_income ??
                            financeSummary?.income ??
                            0
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Pengeluaran
                      </p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {formatCurrency(
                          financeSummary?.total_expense ??
                            financeSummary?.expense ??
                            0
                        )}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">
                        Total Saldo
                      </p>
                      <p className="mt-1 font-semibold tabular-nums">
                        {formatCurrency(financeSummary?.balance ?? 0)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Termasuk saldo awal wallet
                      </p>
                    </div>
                  </CardContent>
                  {(finance.data?.wallets?.length ?? 0) > 0 ? (
                    <CardContent className="border-t pt-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Rekap per wallet
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {finance.data!.wallets!.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                          >
                            <span className="truncate text-muted-foreground">
                              {w.name}
                              {w.is_active === false ? " (nonaktif)" : ""}
                            </span>
                            <span className="ml-2 shrink-0 font-medium tabular-nums">
                              {formatCurrency(w.balance ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  ) : null}
                </Card>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {canPermissions ? (
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle>Perizinan menunggu</CardTitle>
                      <CardDescription>
                        Butuh tindakan approval segera
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href="/admin/permissions" />}
                    >
                      Semua
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {pendingPermissions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Tidak ada pengajuan pending
                      </p>
                    ) : (
                      pendingPermissions.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-xl border p-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {item.user?.full_name ?? `User #${item.user_id}`}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.event?.title ?? `Event #${item.event_id}`}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {item.reason || "Tanpa alasan"}
                            </p>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {canEvents ? (
                <Card>
                  <CardHeader className="flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle>Event mendatang</CardTitle>
                      <CardDescription>
                        Jadwal kegiatan organisasi
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      render={<Link href="/admin/events" />}
                    >
                      Semua
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {upcomingEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Belum ada event mendatang
                      </p>
                    ) : (
                      upcomingEvents.map((event) => (
                        <Link
                          key={event.id}
                          href={`/admin/events/${event.id}/recap`}
                          className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {event.title}
                            </p>
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
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}
