"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import {
  AdvancedDataTable,
  AdvancedResourcePage,
  FormDialog,
  sortableHeader,
} from "@/components/advanced-table"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FormSelect } from "@/components/form-select"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatCurrency, formatDate, unwrapList } from "@/lib/format"
import type {
  FinanceCategory,
  FinanceDashboard,
  FinanceTransaction,
} from "@/lib/types"

type TxForm = {
  category_id: string
  type: string
  amount: string
  description: string
  transaction_date: string
}

const EMPTY_FORM: TxForm = {
  category_id: "",
  type: "",
  amount: "",
  description: "",
  transaction_date: "",
}

export default function AdminFinancePage() {
  const summary = useApi(() =>
    apiRequest<FinanceDashboard>("/finance_transactions/dashboard")
  )
  const txData = useApi(() =>
    apiRequest<{
      items?: FinanceTransaction[]
      categories?: FinanceCategory[]
    }>("/finance_transactions")
  )
  const categories = useApi(() =>
    apiRequest<FinanceCategory[] | { items: FinanceCategory[] }>(
      "/finance_categories"
    ).then(unwrapList)
  )

  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [catEditOpen, setCatEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [form, setForm] = useState<TxForm>(EMPTY_FORM)
  const [editId, setEditId] = useState<number | null>(null)
  const [catForm, setCatForm] = useState({ name: "", type: "expense", description: "" })
  const [catEditId, setCatEditId] = useState<number | null>(null)
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null)
  const [deleteCatId, setDeleteCatId] = useState<number | null>(null)

  const catList = useMemo(() => {
    const fromTx = txData.data?.categories
    if (fromTx && fromTx.length > 0) return fromTx
    return categories.data ?? []
  }, [txData.data, categories.data])

  const rows = useMemo(() => txData.data?.items ?? [], [txData.data])
  const financeSummary = summary.data?.summary

  const catMap = useMemo(
    () => new Map(catList.map((c) => [c.id, c])),
    [catList]
  )

  const stats = useMemo(
    () => [
      {
        label: "Pemasukan",
        value: formatCurrency(
          financeSummary?.total_income ?? financeSummary?.income ?? 0
        ),
      },
      {
        label: "Pengeluaran",
        value: formatCurrency(
          financeSummary?.total_expense ?? financeSummary?.expense ?? 0
        ),
      },
      {
        label: "Saldo",
        value: formatCurrency(financeSummary?.balance ?? 0),
      },
      { label: "Transaksi", value: rows.length },
    ],
    [financeSummary, rows]
  )

  const categoryOptions = useMemo(
    () =>
      catList
        .filter((c) => !form.type || c.type === form.type)
        .map((c) => ({
          value: String(c.id),
          label: `${c.name} (${c.type === "income" ? "Pemasukan" : "Pengeluaran"})`,
        })),
    [catList, form.type]
  )

  const editCategoryOptions = useMemo(
    () =>
      catList
        .filter((c) => !form.type || c.type === form.type)
        .map((c) => ({
          value: String(c.id),
          label: `${c.name} (${c.type === "income" ? "Pemasukan" : "Pengeluaran"})`,
        })),
    [catList, form.type]
  )

  function openCreate() {
    setForm(EMPTY_FORM)
    setReceiptFile(null)
    setOpen(true)
  }

  async function handleCreate() {
    setSaving(true)
    try {
      const body = new FormData()
      body.append("category_id", form.category_id)
      body.append("type", form.type)
      body.append("amount", form.amount)
      body.append("description", form.description)
      if (form.transaction_date) body.append("transaction_date", form.transaction_date)
      if (receiptFile) body.append("receipt", receiptFile)
      await apiRequest("/finance_transactions", { method: "POST", body })
      setOpen(false)
      setForm(EMPTY_FORM)
      setReceiptFile(null)
      toast.success("Transaksi ditambahkan")
      void txData.refetch()
      void summary.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah transaksi")
    } finally {
      setSaving(false)
    }
  }

  function openEdit(tx: FinanceTransaction) {
    setEditId(tx.id)
    setForm({
      category_id: String(tx.category_id ?? ""),
      type: tx.type ?? "",
      amount: String(tx.amount ?? ""),
      description: tx.description ?? "",
      transaction_date: tx.transaction_date
        ? tx.transaction_date.slice(0, 10)
        : "",
    })
    setReceiptFile(null)
    setEditOpen(true)
  }

  async function handleEdit() {
    if (editId == null) return
    setSaving(true)
    try {
      await apiRequest(`/finance_transactions/${editId}`, {
        method: "PUT",
        body: {
          category_id: Number(form.category_id),
          type: form.type,
          amount: Number(form.amount),
          description: form.description,
          transaction_date: form.transaction_date,
        },
      })
      setEditOpen(false)
      setEditId(null)
      setForm(EMPTY_FORM)
      toast.success("Transaksi diperbarui")
      void txData.refetch()
      void summary.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleteTxId == null) return
    try {
      await apiRequest(`/finance_transactions/${deleteTxId}`, { method: "DELETE" })
      toast.success("Transaksi dihapus")
      void txData.refetch()
      void summary.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setDeleteTxId(null)
    }
  }

  async function handleCreateCategory() {
    setSaving(true)
    try {
      await apiRequest("/finance_categories", { method: "POST", body: catForm })
      setCatOpen(false)
      setCatForm({ name: "", type: "expense", description: "" })
      toast.success("Kategori ditambahkan")
      void categories.refetch()
      void txData.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah kategori")
    } finally {
      setSaving(false)
    }
  }

  function openEditCategory(c: FinanceCategory) {
    setCatEditId(c.id)
    setCatForm({ name: c.name, type: c.type ?? "expense", description: "" })
    setCatEditOpen(true)
  }

  async function handleEditCategory() {
    if (catEditId == null) return
    setSaving(true)
    try {
      await apiRequest(`/finance_categories/${catEditId}`, {
        method: "PUT",
        body: catForm,
      })
      setCatEditOpen(false)
      setCatEditId(null)
      setCatForm({ name: "", type: "expense", description: "" })
      toast.success("Kategori diperbarui")
      void categories.refetch()
      void txData.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCategory() {
    if (deleteCatId == null) return
    try {
      await apiRequest(`/finance_categories/${deleteCatId}`, { method: "DELETE" })
      toast.success("Kategori dihapus")
      void categories.refetch()
      void txData.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
    } finally {
      setDeleteCatId(null)
    }
  }

  const columns = useMemo<ColumnDef<FinanceTransaction>[]>(
    () => [
      {
        id: "tanggal",
        accessorKey: "transaction_date",
        header: sortableHeader("Tanggal"),
        cell: ({ row }) => formatDate(row.original.transaction_date),
      },
      {
        id: "tipe",
        accessorKey: "type",
        header: "Tipe",
        cell: ({ row }) => {
          const t = row.original.type
          return (
            <span
              className={
                t === "income"
                  ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }
            >
              {t === "income" ? "Pemasukan" : "Pengeluaran"}
            </span>
          )
        },
      },
      {
        id: "kategori",
        accessorFn: (row) => catMap.get(row.category_id ?? 0)?.name ?? "-",
        header: "Kategori",
      },
      {
        id: "deskripsi",
        accessorKey: "description",
        header: "Deskripsi",
        cell: ({ row }) => row.original.description ?? "-",
      },
      {
        id: "jumlah",
        accessorKey: "amount",
        header: () => <div className="text-right">Jumlah</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {formatCurrency(row.original.amount)}
          </div>
        ),
      },
      {
        id: "aksi",
        header: "Aksi",
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(row.original)}
            >
              <PencilIcon className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTxId(row.original.id)}
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [catMap]
  )

  return (
    <AdvancedResourcePage
      title="Keuangan"
      crumbs={[
        { label: "Admin", href: "/admin/settings" },
        { label: "Keuangan" },
      ]}
      stats={stats}
      actions={<Button onClick={openCreate}>Tambah Transaksi</Button>}
    >
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transaksi</TabsTrigger>
          <TabsTrigger value="categories">Kategori</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions" className="mt-4">
          <AdvancedDataTable
            columns={columns}
            data={rows}
            loading={txData.loading || summary.loading}
            error={txData.error || summary.error}
            emptyMessage="Belum ada transaksi"
            searchPlaceholder="Cari transaksi..."
            getRowId={(row) => String(row.id)}
          />
        </TabsContent>
        <TabsContent value="categories" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setCatOpen(true)}>Tambah Kategori</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(catList).map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {c.type === "income" ? "Pemasukan" : "Pengeluaran"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditCategory(c)}
                  >
                    <PencilIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteCatId(c.id)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Transaksi Baru"
        onSubmit={handleCreate}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Tipe</FieldLabel>
            <FormSelect
              value={form.type}
              onValueChange={(v) =>
                setForm({ ...form, type: v, category_id: "" })
              }
              options={[
                { value: "income", label: "Pemasukan" },
                { value: "expense", label: "Pengeluaran" },
              ]}
              placeholder="Pilih tipe"
            />
          </Field>
          <Field>
            <FieldLabel>Kategori</FieldLabel>
            <FormSelect
              value={form.category_id}
              onValueChange={(v) => setForm({ ...form, category_id: v })}
              options={categoryOptions}
              placeholder={
                form.type ? "Pilih kategori" : "Pilih tipe terlebih dahulu"
              }
            />
          </Field>
          <Field>
            <FieldLabel>Jumlah</FieldLabel>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel>Tanggal</FieldLabel>
            <Input
              type="date"
              value={form.transaction_date}
              onChange={(e) =>
                setForm({ ...form, transaction_date: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel>Bukti Transaksi</FieldLabel>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Transaksi"
        onSubmit={handleEdit}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Tipe</FieldLabel>
            <FormSelect
              value={form.type}
              onValueChange={(v) =>
                setForm({ ...form, type: v, category_id: "" })
              }
              options={[
                { value: "income", label: "Pemasukan" },
                { value: "expense", label: "Pengeluaran" },
              ]}
              placeholder="Pilih tipe"
            />
          </Field>
          <Field>
            <FieldLabel>Kategori</FieldLabel>
            <FormSelect
              value={form.category_id}
              onValueChange={(v) => setForm({ ...form, category_id: v })}
              options={editCategoryOptions}
              placeholder={
                form.type ? "Pilih kategori" : "Pilih tipe terlebih dahulu"
              }
            />
          </Field>
          <Field>
            <FieldLabel>Jumlah</FieldLabel>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel>Tanggal</FieldLabel>
            <Input
              type="date"
              value={form.transaction_date}
              onChange={(e) =>
                setForm({ ...form, transaction_date: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel>Bukti Transaksi</FieldLabel>
            <Input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <FormDialog
        open={catOpen}
        onOpenChange={setCatOpen}
        title="Kategori Baru"
        onSubmit={handleCreateCategory}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama</FieldLabel>
            <Input
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Tipe</FieldLabel>
            <FormSelect
              value={catForm.type}
              onValueChange={(v) => setCatForm({ ...catForm, type: v })}
              options={[
                { value: "income", label: "Pemasukan" },
                { value: "expense", label: "Pengeluaran" },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Input
              value={catForm.description}
              onChange={(e) =>
                setCatForm({ ...catForm, description: e.target.value })
              }
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <FormDialog
        open={catEditOpen}
        onOpenChange={setCatEditOpen}
        title="Edit Kategori"
        onSubmit={handleEditCategory}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama</FieldLabel>
            <Input
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              required
            />
          </Field>
          <Field>
            <FieldLabel>Tipe</FieldLabel>
            <FormSelect
              value={catForm.type}
              onValueChange={(v) => setCatForm({ ...catForm, type: v })}
              options={[
                { value: "income", label: "Pemasukan" },
                { value: "expense", label: "Pengeluaran" },
              ]}
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Input
              value={catForm.description}
              onChange={(e) =>
                setCatForm({ ...catForm, description: e.target.value })
              }
            />
          </Field>
        </FieldGroup>
      </FormDialog>

      <ConfirmDialog
        open={deleteTxId != null}
        onOpenChange={(v) => { if (!v) setDeleteTxId(null) }}
        title="Hapus Transaksi"
        description="Apakah Anda yakin ingin menghapus transaksi ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={deleteCatId != null}
        onOpenChange={(v) => { if (!v) setDeleteCatId(null) }}
        title="Hapus Kategori"
        description="Apakah Anda yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDeleteCategory}
      />
    </AdvancedResourcePage>
  )
}
