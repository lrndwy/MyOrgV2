"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  ConfirmDialog,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { FormSelect } from "@/components/form-select"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { unwrapList } from "@/lib/format"
import type { Division, Role, User } from "@/lib/types"

const emptyForm = {
  username: "",
  email: "",
  password: "",
  full_name: "",
  division_id: "",
  role_id: "",
  status: "active",
}

export default function AdminUsersPage() {
  const { data, loading, error, refetch } = useApi(async () => {
    const result = await apiRequest<User[] | { items: User[] }>("/users")
    return unwrapList(result)
  })
  const divisions = useApi(() =>
    apiRequest<Division[] | { items: Division[] }>("/divisions").then(unwrapList)
  )
  const roles = useApi(() =>
    apiRequest<Role[] | { items: Role[] }>("/roles").then(unwrapList)
  )

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const rows = useMemo(() => data ?? [], [data])
  const divisionOptions = useMemo(
    () =>
      (divisions.data ?? []).map((d) => ({
        value: String(d.id),
        label: d.name,
      })),
    [divisions.data]
  )
  const divisionMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const d of divisions.data ?? []) {
      map.set(d.id, d.name)
    }
    return map
  }, [divisions.data])

  const resolveDivision = (user: User) => {
    if (typeof user.division === "string" && user.division) return user.division
    if (user.division && typeof user.division === "object" && "name" in user.division) {
      return user.division.name
    }
    if (user.division_id) return divisionMap.get(user.division_id) ?? "-"
    return "-"
  }

  const roleOptions = useMemo(
    () =>
      (roles.data ?? []).map((r) => ({
        value: String(r.id),
        label: r.name,
      })),
    [roles.data]
  )

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k])

  const stats = useMemo(() => {
    const active = rows.filter((u) => u.status === "active").length
    const inactive = rows.filter((u) => u.status && u.status !== "active").length
    return [
      { label: "Total Pengguna", value: rows.length },
      { label: "Aktif", value: active },
      { label: "Nonaktif / Lainnya", value: inactive },
    ]
  }, [rows])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(user: User) {
    setEditing(user)
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      full_name: user.full_name,
      division_id: user.division_id ? String(user.division_id) : "",
      role_id: user.role_id ? String(user.role_id) : "",
      status: user.status ?? "active",
    })
    setOpen(true)
  }

  async function handleSubmit() {
    setSaving(true)
    try {
      if (editing) {
        await apiRequest(`/users/${editing.id}`, {
          method: "PUT",
          body: {
            full_name: form.full_name,
            email: form.email,
            division_id: form.division_id ? Number(form.division_id) : null,
            role_id: form.role_id ? Number(form.role_id) : null,
            status: form.status,
          },
        })
        toast.success("Pengguna diperbarui")
      } else {
        await apiRequest("/users", {
          method: "POST",
          body: {
            username: form.username,
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            division_id: Number(form.division_id),
            role_id: Number(form.role_id),
          },
        })
        toast.success("Pengguna berhasil dibuat")
      }
      setOpen(false)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setConfirming(true)
    try {
      await apiRequest(`/users/${deleting.id}`, { method: "DELETE" })
      toast.success("Pengguna dihapus")
      setDeleting(null)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setConfirming(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    setBulkDeleting(true)
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiRequest(`/users/${id}`, { method: "DELETE" })
        )
      )
      toast.success(`${selectedIds.length} pengguna dihapus`)
      setRowSelection({})
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setBulkDeleting(false)
    }
  }

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "nama",
        accessorKey: "full_name",
        header: sortableHeader("Nama"),
        cell: ({ row }) => row.original.full_name,
      },
      {
        id: "username",
        accessorKey: "username",
        header: sortableHeader("Username"),
      },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
      },
      {
        id: "divisi",
        accessorFn: (row) => resolveDivision(row),
        header: "Divisi",
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
              onClick={() => openEdit(row.original)}
            >
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleting(row.original)}
            >
              Hapus
            </Button>
          </div>
        ),
      },
    ],
    [divisionMap]
  )

  return (
    <AdvancedResourcePage
      title="Pengguna"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Pengguna" },
      ]}
      stats={stats}
      actions={
        <>
          {selectedIds.length > 0 ? (
            <Button
              variant="destructive"
              disabled={bulkDeleting}
              onClick={handleBulkDelete}
            >
              Hapus ({selectedIds.length})
            </Button>
          ) : null}
          <Button onClick={openCreate}>Tambah Pengguna</Button>
          <Button variant="outline" render={<Link href="/admin/users/import" />}>
            Import Pengguna
          </Button>
        </>
      }
    >
      <AdvancedDataTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        emptyMessage="Belum ada pengguna"
        searchPlaceholder="Cari nama, username, email..."
        getRowId={(row) => String(row.id)}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Pengguna" : "Tambah Pengguna"}
        onSubmit={handleSubmit}
        saving={saving}
        className="sm:max-w-lg"
      >
        <FieldGroup>
          {!editing ? (
            <Field>
              <FieldLabel>Username</FieldLabel>
              <Input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel>Nama Lengkap</FieldLabel>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          {!editing ? (
            <Field>
              <FieldLabel>Password Sementara</FieldLabel>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </Field>
          ) : null}
          <Field>
            <FieldLabel>Divisi</FieldLabel>
            <FormSelect
              value={form.division_id}
              onValueChange={(v) => setForm({ ...form, division_id: v })}
              options={divisionOptions}
              placeholder="Pilih divisi"
            />
          </Field>
          <Field>
            <FieldLabel>Role</FieldLabel>
            <FormSelect
              value={form.role_id}
              onValueChange={(v) => setForm({ ...form, role_id: v })}
              options={roleOptions}
              placeholder="Pilih role"
            />
          </Field>
          {editing ? (
            <Field>
              <FieldLabel>Status</FieldLabel>
              <FormSelect
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
                options={[
                  { value: "active", label: "Aktif" },
                  { value: "inactive", label: "Nonaktif" },
                ]}
              />
            </Field>
          ) : null}
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(next) => {
          if (!next) setDeleting(null)
        }}
        title="Hapus pengguna?"
        description={`Pengguna "${deleting?.full_name}" akan dihapus.`}
        confirming={confirming}
        onConfirm={handleDelete}
      />
    </AdvancedResourcePage>
  )
}
