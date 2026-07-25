"use client"

import { useCallback, useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  sortableHeader,
} from "@/components/advanced-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import type { PermissionRequest } from "@/lib/types"

export default function AdminPermissionsPage() {
  const { data, loading, error, setData } = useApi(async () => {
    const result = await apiRequest<
      PermissionRequest[] | { items: PermissionRequest[] }
    >("/attendance/permission_requests")
    return unwrapList(result)
  })

  const rows = useMemo(() => data ?? [], [data])
  const stats = useMemo(
    () => [
      { label: "Total", value: rows.length },
      {
        label: "Pending",
        value: rows.filter((r) => r.status === "pending").length,
      },
      {
        label: "Disetujui",
        value: rows.filter((r) => r.status === "approved").length,
      },
      {
        label: "Ditolak",
        value: rows.filter((r) => r.status === "rejected").length,
      },
    ],
    [rows]
  )

  const handleAction = useCallback(
    async (id: number, action: "approve" | "reject") => {
      try {
        await apiRequest(`/attendance/permission_requests/${id}`, {
          method: "PUT",
          body: { action },
        })
        setData(
          (prev) =>
            prev?.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: action === "approve" ? "approved" : "rejected",
                  }
                : item
            ) ?? null
        )
        toast.success(
          `Pengajuan ${action === "approve" ? "disetujui" : "ditolak"}`
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memproses")
      }
    },
    [setData]
  )

  const columns = useMemo<ColumnDef<PermissionRequest>[]>(
    () => [
      {
        id: "pengaju",
        accessorFn: (row) => row.user?.full_name ?? `User #${row.user_id}`,
        header: sortableHeader("Pengaju"),
      },
      {
        id: "event",
        accessorFn: (row) => row.event?.title ?? `Event #${row.event_id}`,
        header: "Event",
      },
      {
        id: "alasan",
        accessorKey: "reason",
        header: "Alasan",
        cell: ({ row }) => row.original.reason ?? "-",
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "diajukan",
        accessorKey: "created_at",
        header: sortableHeader("Diajukan"),
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        id: "aksi",
        enableHiding: false,
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) =>
          row.original.status === "pending" ? (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                onClick={() => handleAction(row.original.id, "approve")}
              >
                Setujui
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction(row.original.id, "reject")}
              >
                Tolak
              </Button>
            </div>
          ) : (
            <div className="text-right text-muted-foreground">-</div>
          ),
      },
    ],
    [handleAction]
  )

  return (
    <AdvancedResourcePage
      title="Approval Perizinan"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Approval Perizinan" },
      ]}
      stats={stats}
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Tidak ada pengajuan"
        searchPlaceholder="Cari pengaju, event, alasan..."
        getRowId={(row) => String(row.id)}
      />
    </AdvancedResourcePage>
  )
}
