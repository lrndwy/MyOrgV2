"use client"

import { useCallback, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { EyeIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  ConfirmDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import { storageUrl } from "@/lib/storage-url"
import type { PermissionRequest } from "@/lib/types"

type PendingAction = {
  type: "approve" | "reject" | "delete"
  row: PermissionRequest
}

const ACTION_COPY: Record<
  PendingAction["type"],
  { title: string; confirmLabel: string; destructive: boolean }
> = {
  approve: {
    title: "Setujui pengajuan izin?",
    confirmLabel: "Setujui",
    destructive: false,
  },
  reject: {
    title: "Tolak pengajuan izin?",
    confirmLabel: "Tolak",
    destructive: true,
  },
  delete: {
    title: "Hapus pengajuan izin?",
    confirmLabel: "Hapus",
    destructive: true,
  },
}

export default function AdminPermissionsPage() {
  const { data, loading, error, setData } = useApi(async () => {
    const result = await apiRequest<
      PermissionRequest[] | { items: PermissionRequest[] }
    >("/attendance/permission_requests")
    return unwrapList(result)
  })
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [processing, setProcessing] = useState(false)
  const [previewProof, setPreviewProof] = useState<PermissionRequest | null>(
    null
  )

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

  const runPendingAction = useCallback(async () => {
    if (!pendingAction) return
    const { type, row } = pendingAction
    setProcessing(true)
    try {
      if (type === "delete") {
        await apiRequest(`/attendance/permission_requests/${row.id}`, {
          method: "DELETE",
        })
        setData((prev) => prev?.filter((item) => item.id !== row.id) ?? null)
        toast.success("Pengajuan izin dihapus")
      } else {
        await apiRequest(`/attendance/permission_requests/${row.id}`, {
          method: "PUT",
          body: { action: type },
        })
        setData(
          (prev) =>
            prev?.map((item) =>
              item.id === row.id
                ? {
                    ...item,
                    status: type === "approve" ? "approved" : "rejected",
                  }
                : item
            ) ?? null
        )
        toast.success(
          `Pengajuan ${type === "approve" ? "disetujui" : "ditolak"}`
        )
      }
      setPendingAction(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses")
    } finally {
      setProcessing(false)
    }
  }, [pendingAction, setData])

  const columns = useMemo<ColumnDef<PermissionRequest>[]>(
    () => [
      {
        id: "pengaju",
        accessorFn: (row) =>
          row.user?.full_name || row.user?.username || `User #${row.user_id}`,
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
        id: "bukti",
        enableSorting: false,
        header: "Bukti",
        cell: ({ row }) =>
          row.original.proof_url ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPreviewProof(row.original)}
            >
              <EyeIcon data-icon="inline-start" />
              Lihat
            </Button>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
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
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.status === "pending" ? (
              <>
                <Button
                  size="sm"
                  onClick={() =>
                    setPendingAction({ type: "approve", row: row.original })
                  }
                >
                  Setujui
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setPendingAction({ type: "reject", row: row.original })
                  }
                >
                  Tolak
                </Button>
              </>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              aria-label="Hapus pengajuan"
              onClick={() =>
                setPendingAction({ type: "delete", row: row.original })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const actionCopy = pendingAction ? ACTION_COPY[pendingAction.type] : null
  const actionTarget = pendingAction
    ? `${
        pendingAction.row.user?.full_name ??
        pendingAction.row.user?.username ??
        `User #${pendingAction.row.user_id}`
      } — ${pendingAction.row.event?.title ?? `Event #${pendingAction.row.event_id}`}`
    : ""

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

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null)
        }}
        title={actionCopy?.title ?? ""}
        description={
          pendingAction
            ? pendingAction.type === "delete"
              ? `Pengajuan izin ${actionTarget} akan dihapus permanen. Jika izin sudah disetujui/ditolak, catatan absensinya ikut dihapus sehingga anggota bisa absen atau mengajukan izin ulang.`
              : `Pengajuan izin ${actionTarget} akan ${
                  pendingAction.type === "approve" ? "disetujui" : "ditolak"
                }.`
            : undefined
        }
        confirmLabel={actionCopy?.confirmLabel}
        destructive={actionCopy?.destructive}
        confirming={processing}
        onConfirm={runPendingAction}
      />

      <Dialog
        open={Boolean(previewProof)}
        onOpenChange={(open) => {
          if (!open) setPreviewProof(null)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bukti Pendukung</DialogTitle>
          </DialogHeader>
          {previewProof?.proof_url ? (
            <div className="flex flex-col gap-3">
              {/* Bukti bisa berupa PDF; kalau bukan gambar biarkan gagal render
                  dan pakai tombol buka tab baru di bawah. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={storageUrl(previewProof.proof_url)}
                alt="Bukti pendukung"
                className="max-h-[60vh] w-full rounded-md border object-contain"
              />
              <Button
                variant="outline"
                className="w-fit"
                render={
                  <a
                    href={storageUrl(previewProof.proof_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLinkIcon data-icon="inline-start" />
                Buka di tab baru
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdvancedResourcePage>
  )
}
