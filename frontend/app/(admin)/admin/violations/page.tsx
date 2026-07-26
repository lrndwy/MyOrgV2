"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  ConfirmDialog,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { FormSelect } from "@/components/form-select"
import { UserPicker } from "@/components/user-picker"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import type { User, Violation, ViolationType } from "@/lib/types"

export default function AdminViolationsPage() {
  const { data, loading, error, refetch } = useApi(async () => {
    const result = await apiRequest<Violation[] | { items: Violation[] }>(
      "/violations"
    )
    return unwrapList(result)
  })
  const users = useApi(() =>
    apiRequest<User[] | { items: User[] }>("/users").then(unwrapList)
  )
  const types = useApi(() =>
    apiRequest<ViolationType[] | { items: ViolationType[] }>(
      "/violation_types"
    ).then(unwrapList)
  )

  const [open, setOpen] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [deleting, setDeleting] = useState<Violation | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({
    user_id: "",
    type: "",
    description: "",
  })
  const [typeForm, setTypeForm] = useState({
    name: "",
    description: "",
    sp_level: "SP1",
  })

  const rows = useMemo(() => data ?? [], [data])
  const userMap = useMemo(
    () => new Map((users.data ?? []).map((u) => [u.id, u.full_name])),
    [users.data]
  )
  const typeOptions = useMemo(
    () =>
      (types.data ?? []).map((t) => ({
        value: t.name,
        label: t.sp_level ? `${t.name} (${t.sp_level})` : t.name,
      })),
    [types.data]
  )

  async function handleCreate() {
    setSaving(true)
    try {
      await apiRequest("/violations", {
        method: "POST",
        body: {
          user_id: Number(form.user_id),
          violation_type: form.type,
          description: form.description,
        },
      })
      setOpen(false)
      setForm({ user_id: "", type: "", description: "" })
      toast.success("Pelanggaran dicatat")
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateType() {
    setSaving(true)
    try {
      await apiRequest("/violation_types", { method: "POST", body: typeForm })
      setTypeOpen(false)
      setTypeForm({ name: "", description: "", sp_level: "SP1" })
      toast.success("Jenis pelanggaran ditambahkan")
      void types.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteType(id: number) {
    try {
      await apiRequest(`/violation_types/${id}`, { method: "DELETE" })
      toast.success("Jenis dihapus")
      void types.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    }
  }

  async function handleDelete() {
    if (!deleting) return
    setConfirming(true)
    try {
      await apiRequest(`/violations/${deleting.id}`, { method: "DELETE" })
      toast.success("Pelanggaran dihapus")
      setDeleting(null)
      void refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setConfirming(false)
    }
  }

  const columns = useMemo<ColumnDef<Violation>[]>(
    () => [
      {
        id: "pengguna",
        accessorFn: (row) =>
          row.user?.full_name ??
          userMap.get(row.user_id) ??
          `User #${row.user_id}`,
        header: sortableHeader("Pengguna"),
      },
      {
        id: "jenis",
        accessorFn: (row) => row.violation_type ?? row.type ?? "-",
        header: "Jenis",
      },
      {
        id: "deskripsi",
        accessorKey: "description",
        header: "Deskripsi",
        cell: ({ row }) => row.original.description ?? "-",
      },
      {
        id: "tanggal",
        accessorFn: (row) => row.issued_at ?? row.issued_date,
        header: sortableHeader("Tanggal"),
        cell: ({ row }) =>
          formatDate(row.original.issued_at ?? row.original.issued_date),
      },
      {
        id: "aksi",
        enableHiding: false,
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => (
          <div className="text-right">
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
    [userMap]
  )

  return (
    <AdvancedResourcePage
      title="Pelanggaran & SP"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Pelanggaran" },
      ]}
      stats={[
        { label: "Total Pelanggaran", value: rows.length },
        { label: "Jenis Terdaftar", value: types.data?.length ?? 0 },
      ]}
      actions={
        <Button onClick={() => setOpen(true)}>Catat Pelanggaran</Button>
      }
    >
      <Tabs defaultValue="violations">
        <TabsList>
          <TabsTrigger value="violations">Daftar Pelanggaran</TabsTrigger>
          <TabsTrigger value="types">Jenis Pelanggaran</TabsTrigger>
        </TabsList>
        <TabsContent value="violations" className="mt-4">
          <AdvancedDataTable
            columns={columns}
            data={rows}
            loading={loading}
            error={error}
            emptyMessage="Belum ada pelanggaran"
            searchPlaceholder="Cari pengguna, jenis..."
            getRowId={(row) => String(row.id)}
          />
        </TabsContent>
        <TabsContent value="types" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setTypeOpen(true)}>Tambah Jenis</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(types.data ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  {t.sp_level ? (
                    <p className="text-xs text-muted-foreground">{t.sp_level}</p>
                  ) : null}
                  {t.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteType(t.id)}
                >
                  Hapus
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Pelanggaran Baru"
        onSubmit={handleCreate}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Pengguna</FieldLabel>
            <UserPicker
              users={users.data ?? []}
              value={form.user_id}
              onValueChange={(v) => setForm({ ...form, user_id: v })}
            />
          </Field>
          <Field>
            <FieldLabel>Jenis Pelanggaran</FieldLabel>
            <FormSelect
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
              options={typeOptions}
              placeholder="Pilih jenis"
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

      <FormDialog
        open={typeOpen}
        onOpenChange={setTypeOpen}
        title="Jenis Pelanggaran Baru"
        onSubmit={handleCreateType}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama</FieldLabel>
            <Input
              value={typeForm.name}
              onChange={(e) =>
                setTypeForm({ ...typeForm, name: e.target.value })
              }
              required
            />
          </Field>
          <Field>
            <FieldLabel>Level SP</FieldLabel>
            <FormSelect
              value={typeForm.sp_level}
              onValueChange={(v) => setTypeForm({ ...typeForm, sp_level: v })}
              options={[
                { value: "SP1", label: "SP 1" },
                { value: "SP2", label: "SP 2" },
                { value: "SP3", label: "SP 3" },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Textarea
              value={typeForm.description}
              onChange={(e) =>
                setTypeForm({ ...typeForm, description: e.target.value })
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
        title="Hapus pelanggaran?"
        description="Data pelanggaran akan dihapus permanen."
        confirming={confirming}
        onConfirm={handleDelete}
      />
    </AdvancedResourcePage>
  )
}
