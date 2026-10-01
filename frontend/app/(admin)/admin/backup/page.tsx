"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { API_PROXY_BASE, getApiBase } from "@/lib/api"
import { getStoredToken, setStoredToken } from "@/lib/auth"

type RestoreMode = "replace" | "merge"

type RestoreResult = {
  mode?: RestoreMode
  files_restored: number
  files_failed?: number
  database: Record<string, number>
  skipped?: Record<string, number>
}

export default function AdminBackupPage() {
  const router = useRouter()
  const [mode, setMode] = useState<RestoreMode>("replace")
  const [restoring, setRestoring] = useState(false)
  const [result, setResult] = useState<RestoreResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return
    if (mode === "replace") {
      const confirmed = window.confirm(
        "Mode REPLACE akan MENGOSONGKAN seluruh tabel backup lalu mengisinya ulang dari ZIP. Data lokal yang tidak ada di arsip akan hilang. Setelah selesai Anda harus login ulang. Lanjutkan?"
      )
      if (!confirmed) return
      const typed = window.prompt('Ketik REPLACE (huruf besar) untuk konfirmasi:')
      if ((typed ?? "").trim() !== "REPLACE") {
        toast.error("Dibatalkan — teks konfirmasi tidak cocok.")
        return
      }
    } else {
      const confirmed = window.confirm(
        "Mode MERGE menimpa baris yang ada di arsip, menambahkan baris baru, dan mempertahankan data lokal yang tidak ada di arsip. Lanjutkan?"
      )
      if (!confirmed) return
    }
    setRestoring(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("mode", mode)
      const token = getStoredToken()
      const res = await fetch(`${getApiBase()}/backup`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const text = await res.text()
      let json: { success?: boolean; message?: string; data?: unknown } | null = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        // Proxy/gateway membalas teks (mis. "Internal Server Error"), bukan envelope JSON.
        throw new Error(
          res.ok
            ? `Respons tidak valid dari server: ${text.slice(0, 200)}`
            : `Server error ${res.status}: ${text.slice(0, 200)}`
        )
      }
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Gagal restore (HTTP ${res.status})`)
      }
      setResult(json.data as RestoreResult)
      if (mode === "replace") {
        setStoredToken(null)
        toast.success("Backup berhasil dipulihkan (replace). Silakan login ulang.")
        router.replace("/login")
        return
      }
      toast.success("Backup berhasil digabungkan (merge).")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal restore")
    } finally {
      setRestoring(false)
    }
  }

  const restoredTables = result
    ? Object.entries(result.database).filter(([, n]) => n > 0)
    : []
  const skippedTables = result?.skipped
    ? Object.entries(result.skipped).filter(([, n]) => n > 0)
    : []

  return (
    <>
      <PageHeader
        title="Backup & Restore"
        crumbs={[
          { label: "Admin", href: "/admin/settings" },
          { label: "Backup" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>Export Backup</CardTitle>
            <CardDescription>
              Unduh arsip ZIP berisi seluruh data database (data.json) dan
              semua file di storage lokal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button render={<a href={`${API_PROXY_BASE}/backup`} download />}>
              Download Backup ZIP
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Restore Backup</CardTitle>
            <CardDescription>
              Pulihkan database dan file storage dari arsip ZIP. Pilih mode{" "}
              <span className="font-medium text-foreground">Replace</span> untuk
              mengosongkan tabel lalu mengisi ulang, atau{" "}
              <span className="font-medium text-foreground">Merge</span> untuk
              menimpa hanya baris yang ada di arsip. File storage selalu
              ditimpa per key, tidak dihapus massal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert
              variant={mode === "replace" ? "destructive" : "default"}
              className="mb-4"
            >
              <AlertTitle>
                {mode === "replace" ? "Operasi destruktif" : "Operasi gabung"}
              </AlertTitle>
              <AlertDescription>
                {mode === "replace"
                  ? "Replace mengganti seluruh isi database dengan isi arsip; data lokal yang tidak ada di arsip ikut terhapus. Session login saat ini tidak berlaku lagi setelah selesai."
                  : "Merge menimpa baris yang cocok (id, lalu kolom unik seperti email/username/kode), menambahkan baris baru, dan mempertahankan baris lokal yang tidak ada di arsip. Baris yang gagal dilewati. Session login tetap berlaku."}
              </AlertDescription>
            </Alert>
            <form onSubmit={handleRestore} className="space-y-3">
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="restore-mode"
                    value="replace"
                    checked={mode === "replace"}
                    onChange={() => setMode("replace")}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span>
                    <span className="font-medium">Replace</span> — hapus semua
                    isi tabel backup lalu isi ulang dari arsip.
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="restore-mode"
                    value="merge"
                    checked={mode === "merge"}
                    onChange={() => setMode("merge")}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span>
                    <span className="font-medium">Merge</span> — timpa baris
                    yang ada di arsip, pertahankan data lokal lainnya.
                  </span>
                </label>
              </div>
              <Input ref={fileRef} type="file" accept=".zip" required />
              <Button
                type="submit"
                variant={mode === "replace" ? "destructive" : "default"}
                disabled={restoring}
              >
                {restoring
                  ? "Memulihkan..."
                  : mode === "replace"
                    ? "Restore (Replace) dari ZIP"
                    : "Restore (Merge) dari ZIP"}
              </Button>
            </form>
            {result ? (
              <div className="mt-4 rounded-lg border p-4 text-sm">
                <p className="font-medium">
                  Mode {result.mode ?? "replace"}: {result.files_restored} file
                  storage dipulihkan
                  {result.files_failed
                    ? ` (${result.files_failed} gagal)`
                    : ""}
                </p>
                {restoredTables.length > 0 ? (
                  <ul className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                    {restoredTables.map(([table, n]) => (
                      <li key={table}>
                        {table}: {n} baris
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    Tidak ada data database di dalam arsip.
                  </p>
                )}
                {skippedTables.length > 0 ? (
                  <p className="mt-2 text-destructive">
                    Dilewati (relasi/unique tidak cocok):{" "}
                    {skippedTables
                      .map(([table, n]) => `${table}: ${n}`)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
