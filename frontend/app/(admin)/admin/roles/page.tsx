"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  ConfirmDialog,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { unwrapList } from "@/lib/format"
import type { Role } from "@/lib/types"

export default function AdminRolesPage() {
  const router = useRouter()
  const { data, loading, error } = useApi(async () => {
    const result = await apiRequest<Role[] | { items: Role[] }>("/roles")
    return unwrapList(result)
  })
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Role | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", description: "" })

  const rows = useMemo(() => data ?? [], [data])
  const stats = useMemo(
    () => [
      { label: "Total Role", value: rows.length },
      {
        label: "System Role",
        value: rows.filter((r) => r.is_system).length,
      },
      {
        label: "Total Pengguna Terikat",
        value: rows.reduce((sum, r) => sum + (r.user_count ?? 0), 0),
      },
    ],
    [rows]
  )

  async function handleCreate() {
    setSaving(true)
    try {
      const role = await apiRequest<{ id: number }>("/roles", {
        method: "POST",
        body: form,
      })
      toast.success("Role dibuat")
      setOpen(false)
      setForm({ name: "", description: "" })
      router.push(`/admin/roles/${role.id}/edit`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat role")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await apiRequest(`/roles/${deleting.id}`, { method: "DELETE" })
      toast.success("Role dihapus")
      setDeleting(null)
      void router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    }
  }

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      {
        id: "nama",
        accessorKey: "name",
        header: sortableHeader("Nama"),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "deskripsi",
        accessorKey: "description",
        header: "Deskripsi",
        cell: ({ row }) => row.original.description ?? "-",
      },
      {
        id: "pengguna",
        accessorKey: "user_count",
        header: sortableHeader("Pengguna"),
        cell: ({ row }) => row.original.user_count ?? 0,
      },
      {
        id: "aksi",
        enableHiding: false,
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/roles/${row.original.id}/edit`} />}
            >
              Edit Matrix
            </Button>
            {!row.original.is_system ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleting(row.original)}
              >
                Hapus
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    []
  )

  return (
    <AdvancedResourcePage
      title="Role & Akses"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Role" },
      ]}
      stats={stats}
      actions={<Button onClick={() => setOpen(true)}>Tambah Role</Button>}
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Belum ada role"
        searchPlaceholder="Cari role..."
        getRowId={(row) => String(row.id)}
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Tambah Role"
        description="Setelah dibuat, Anda akan diarahkan ke matrix permission."
        onSubmit={handleCreate}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama Role</FieldLabel>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Hapus Role"
        description={`Apakah Anda yakin ingin menghapus role "${deleting?.name}"?`}
        onConfirm={handleDelete}
      />
    </AdvancedResourcePage>
  )
}
