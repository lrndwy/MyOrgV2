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
  Wallet,
} from "@/lib/types"

type TxForm = {
  category_id: string
  wallet_id: string
  type: string
  amount: string
  description: string
  transaction_date: string
}

const EMPTY_FORM: TxForm = {
  category_id: "",
  wallet_id: "",
  type: "",
  amount: "",
  description: "",
  transaction_date: "",
}

type WalletForm = {
  name: string
  description: string
  initial_balance: string
  is_active: boolean
}

const EMPTY_WALLET_FORM: WalletForm = {
  name: "",
  description: "",
  initial_balance: "",
  is_active: true,
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
  const wallets = useApi(() =>
    apiRequest<Wallet[] | { items: Wallet[] }>("/wallets").then(unwrapList)
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
  const [walletOpen, setWalletOpen] = useState(false)
  const [walletEditId, setWalletEditId] = useState<number | null>(null)
  const [walletForm, setWalletForm] = useState<WalletForm>(EMPTY_WALLET_FORM)
  const [deleteWalletId, setDeleteWalletId] = useState<number | null>(null)

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

  const walletList = useMemo(() => wallets.data ?? [], [wallets.data])
  const walletMap = useMemo(
    () => new Map(walletList.map((w) => [w.id, w])),
    [walletList]
  )
  const walletOptions = useMemo(
    () => [
      { value: "", label: "Tanpa wallet" },
      ...walletList
        .filter((w) => w.is_active !== false)
        .map((w) => ({ value: String(w.id), label: w.name })),
    ],
    [walletList]
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
        label: "Total Saldo",
        value: formatCurrency(financeSummary?.balance ?? 0),
        description: `Saldo awal wallet ${formatCurrency(
          financeSummary?.initial_balance ?? 0
        )} + pemasukan − pengeluaran`,
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
      if (form.wallet_id) body.append("wallet_id", form.wallet_id)
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
      wallet_id: tx.wallet_id ? String(tx.wallet_id) : "",
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
          wallet_id: form.wallet_id ? Number(form.wallet_id) : null,
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

  function openCreateWallet() {
    setWalletEditId(null)
    setWalletForm(EMPTY_WALLET_FORM)
    setWalletOpen(true)
  }

  function openEditWallet(w: Wallet) {
    setWalletEditId(w.id)
    setWalletForm({
      name: w.name,
      description: w.description ?? "",
      initial_balance: String(w.initial_balance ?? 0),
      is_active: w.is_active !== false,
    })
    setWalletOpen(true)
  }

  async function handleSaveWallet() {
    setSaving(true)
    try {
      const body = {
        name: walletForm.name,
        description: walletForm.description,
        initial_balance: Number(walletForm.initial_balance) || 0,
        is_active: walletForm.is_active,
      }
      if (walletEditId == null) {
        await apiRequest("/wallets", { method: "POST", body })
        toast.success("Wallet ditambahkan")
      } else {
        await apiRequest(`/wallets/${walletEditId}`, { method: "PUT", body })
        toast.success("Wallet diperbarui")
      }
      setWalletOpen(false)
      setWalletEditId(null)
      setWalletForm(EMPTY_WALLET_FORM)
      void wallets.refetch()
      void summary.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan wallet")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteWallet() {
    if (deleteWalletId == null) return
    try {
      await apiRequest(`/wallets/${deleteWalletId}`, { method: "DELETE" })
      toast.success("Wallet dihapus")
      void wallets.refetch()
      void summary.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus wallet")
    } finally {
      setDeleteWalletId(null)
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
        id: "wallet",
        accessorFn: (row) =>
          row.wallet_id ? walletMap.get(row.wallet_id)?.name ?? "-" : "-",
        header: "Wallet",
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
    [catMap, walletMap]
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
      {walletList.length > 0 ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {walletList.map((w) => (
            <div key={w.id} className="rounded-lg border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {w.name}
                {w.is_active === false ? " (nonaktif)" : ""}
              </p>
              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrency(w.balance ?? 0)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Saldo awal {formatCurrency(w.initial_balance ?? 0)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transaksi</TabsTrigger>
          <TabsTrigger value="wallets">Wallet</TabsTrigger>
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
        <TabsContent value="wallets" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateWallet}>
              <PlusIcon data-icon="inline-start" />
              Tambah Wallet
            </Button>
          </div>
          {walletList.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Belum ada wallet. Buat wallet (mis. Kas Tunai, Rekening Bank)
              untuk melacak saldo per sumber dana.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {walletList.map((w) => (
                <div key={w.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {w.name}
                        {w.is_active === false ? (
                          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Nonaktif
                          </span>
                        ) : null}
                      </p>
                      {w.description ? (
                        <p className="text-xs text-muted-foreground">
                          {w.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditWallet(w)}
                      >
                        <PencilIcon className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteWalletId(w.id)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">
                    {formatCurrency(w.balance ?? 0)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p>
                      Masuk:{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(w.total_income ?? 0)}
                      </span>
                    </p>
                    <p>
                      Keluar:{" "}
                      <span className="text-red-600 dark:text-red-400">
                        {formatCurrency(w.total_expense ?? 0)}
                      </span>
                    </p>
                    <p>Saldo awal: {formatCurrency(w.initial_balance ?? 0)}</p>
                    <p>{w.transaction_count ?? 0} transaksi</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            <FieldLabel>Wallet</FieldLabel>
            <FormSelect
              value={form.wallet_id}
              onValueChange={(v) => setForm({ ...form, wallet_id: v })}
              options={walletOptions}
              placeholder="Tanpa wallet"
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
            <FieldLabel>Wallet</FieldLabel>
            <FormSelect
              value={form.wallet_id}
              onValueChange={(v) => setForm({ ...form, wallet_id: v })}
              options={walletOptions}
              placeholder="Tanpa wallet"
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

      <FormDialog
        open={walletOpen}
        onOpenChange={setWalletOpen}
        title={walletEditId == null ? "Wallet Baru" : "Edit Wallet"}
        onSubmit={handleSaveWallet}
        saving={saving}
      >
        <FieldGroup>
          <Field>
            <FieldLabel>Nama</FieldLabel>
            <Input
              value={walletForm.name}
              onChange={(e) =>
                setWalletForm({ ...walletForm, name: e.target.value })
              }
              placeholder="mis. Kas Tunai, Rekening BCA"
              required
            />
          </Field>
          <Field>
            <FieldLabel>Deskripsi</FieldLabel>
            <Input
              value={walletForm.description}
              onChange={(e) =>
                setWalletForm({ ...walletForm, description: e.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel>Saldo Awal</FieldLabel>
            <Input
              type="number"
              value={walletForm.initial_balance}
              onChange={(e) =>
                setWalletForm({
                  ...walletForm,
                  initial_balance: e.target.value,
                })
              }
            />
          </Field>
          {walletEditId != null ? (
            <Field>
              <FieldLabel>Status</FieldLabel>
              <FormSelect
                value={walletForm.is_active ? "active" : "inactive"}
                onValueChange={(v) =>
                  setWalletForm({ ...walletForm, is_active: v === "active" })
                }
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
        open={deleteWalletId != null}
        onOpenChange={(v) => { if (!v) setDeleteWalletId(null) }}
        title="Hapus Wallet"
        description="Wallet hanya bisa dihapus jika tidak memiliki transaksi. Lanjutkan?"
        onConfirm={handleDeleteWallet}
      />

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
