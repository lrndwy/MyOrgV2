"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DownloadIcon } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  sortableHeader,
} from "@/components/advanced-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Attendance, EventRecap } from "@/lib/types"

export default function EventRecapPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, loading, error } = useApi(
    () => apiRequest<EventRecap>(`/events/${id}/recap`),
    [id]
  )

  const rows = useMemo(() => data?.attendances ?? [], [data?.attendances])
  const stats = useMemo(
    () => [
      { label: "Hadir", value: data?.summary?.present ?? 0 },
      { label: "Izin", value: data?.summary?.permitted ?? 0 },
      { label: "Tidak Hadir", value: data?.summary?.absent ?? 0 },
      { label: "Total", value: data?.summary?.total ?? rows.length },
    ],
    [data?.summary, rows]
  )

  const columns = useMemo<ColumnDef<Attendance>[]>(
    () => [
      {
        id: "nama",
        accessorFn: (row) =>
          row.user?.full_name ??
          row.full_name ??
          row.user?.username ??
          `User #${row.user_id}`,
        header: sortableHeader("Nama"),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "waktu",
        accessorKey: "attended_at",
        header: sortableHeader("Waktu Absen"),
        cell: ({ row }) =>
          formatDate(row.original.attended_at ?? row.original.checked_in_at),
      },
    ],
    []
  )

  function exportPdf() {
    const doc = new jsPDF()
    const event = data?.event
    const title = event?.title ?? "Rekap Absensi"

    doc.setFontSize(16)
    doc.text(title, 14, 20)

    doc.setFontSize(10)
    let y = 28
    if (event?.start_time) {
      doc.text(`Tanggal: ${formatDate(event.start_time)}`, 14, y)
      y += 6
    }
    if (event?.location) {
      doc.text(`Lokasi: ${event.location}`, 14, y)
      y += 6
    }
    const present = data?.summary?.present ?? 0
    const permitted = data?.summary?.permitted ?? 0
    const absent = data?.summary?.absent ?? 0
    const total = data?.summary?.total ?? rows.length
    doc.text(
      `Hadir: ${present}  |  Izin: ${permitted}  |  Tidak Hadir: ${absent}  |  Total: ${total}`,
      14,
      y
    )
    y += 10

    autoTable(doc, {
      startY: y,
      head: [["No", "Nama", "Status", "Waktu Absen"]],
      body: rows.map((r, i) => [
        String(i + 1),
        r.user?.full_name ?? r.full_name ?? r.user?.username ?? `User #${r.user_id}`,
        r.status ?? "-",
        formatDate(r.attended_at ?? r.checked_in_at),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [51, 51, 51] },
    })

    doc.save(`rekap-${title.replace(/\s+/g, "_")}.pdf`)
  }

  return (
    <AdvancedResourcePage
      title="Rekap Absensi"
      crumbs={[
        { label: "Event", href: "/admin/events" },
        { label: "Rekap" },
      ]}
      stats={stats}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf}>
            <DownloadIcon className="size-4" />
            Export PDF
          </Button>
          <Button variant="outline" render={<Link href="/admin/events" />}>
            Kembali ke Daftar Event
          </Button>
        </div>
      }
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Belum ada data absensi"
        searchPlaceholder="Cari nama, status..."
        getRowId={(row) => String(row.id)}
      />
    </AdvancedResourcePage>
  )
}
