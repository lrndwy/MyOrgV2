"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { AdvancedDataTable, AdvancedResourcePage, sortableHeader } from "@/components/advanced-table"
import { Badge } from "@/components/ui/badge"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import type { ActivityLog } from "@/lib/types"

const actionBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  delete: "destructive",
  update: "outline",
  login: "secondary",
}

export default function AdminActivityPage() {
  const { data, loading, error } = useApi(async () => {
    const result = await apiRequest<ActivityLog[] | { items: ActivityLog[] }>("/activity_logs")
    return unwrapList(result)
  })

  const stats = useMemo(
    () => [{ label: "Total Aktivitas", value: data?.length ?? 0 }],
    [data]
  )

  const columns = useMemo<ColumnDef<ActivityLog>[]>(
    () => [
      {
        id: "pengguna",
        accessorKey: "user_name",
        header: sortableHeader("Pengguna"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.user_name || "-"}</span>
        ),
      },
      {
        id: "aksi",
        accessorKey: "action",
        header: "Aksi",
        cell: ({ row }) => (
          <Badge variant={actionBadge[row.original.action] ?? "secondary"}>
            {row.original.action}
          </Badge>
        ),
      },
      {
        id: "deskripsi",
        accessorKey: "description",
        header: "Deskripsi",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-[300px] whitespace-normal break-words text-sm text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        id: "resource",
        accessorKey: "resource_type",
        header: "Resource",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.resource_type}
            {row.original.resource_id > 0 ? ` #${row.original.resource_id}` : ""}
          </span>
        ),
      },
      {
        id: "ip",
        accessorKey: "ip_address",
        header: "IP",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.ip_address || "-"}
          </span>
        ),
      },
      {
        id: "tanggal",
        accessorKey: "created_at",
        header: sortableHeader("Tanggal"),
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    []
  )

  return (
    <AdvancedResourcePage
      title="Log Aktivitas"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Aktivitas" },
      ]}
      stats={stats}
    >
      <AdvancedDataTable
        columns={columns}
        data={data ?? []}
        loading={loading}
        error={error}
        emptyMessage="Belum ada aktivitas"
        searchPlaceholder="Cari aktivitas..."
        getRowId={(row) => String(row.id)}
      />
    </AdvancedResourcePage>
  )
}
