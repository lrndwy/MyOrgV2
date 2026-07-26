"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { DownloadIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiRequest } from "@/lib/api"

const TEMPLATE_COLUMNS = [
  ["username", "Ya", "johndoe"],
  ["email", "Ya", "john@example.com"],
  ["full_name", "Ya", "John Doe"],
  ["division", "Ya", "Umum (nama divisi harus sudah ada)"],
  ["role", "Ya", "Anggota (nama role harus sudah ada)"],
  ["password", "Tidak", "kosongkan = changeme123"],
  ["phone", "Tidak", "081234567890"],
] as const

type ImportResult = {
  success_count: number
  failures?: { row?: string; error?: string }[] | null
}

export default function ImportUsersPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleDownloadTemplate() {
    try {
      const XLSX = await import("xlsx")
      const rows = [
        ["username", "email", "full_name", "division", "role", "password", "phone"],
        ["johndoe", "john@example.com", "John Doe", "Umum", "Anggota", "Rahasia123", "081234567890"],
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws["!cols"] = [
        { wch: 16 },
        { wch: 26 },
        { wch: 22 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Pengguna")
      XLSX.writeFile(wb, "template_import_pengguna.xlsx")
    } catch {
      toast.error("Gagal membuat template")
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      // Backend hanya menerima CSV berpemisah koma. File XLSX (atau CSV hasil
      // simpan Excel yang bisa berpemisah titik koma) dinormalisasi dulu di sini.
      const XLSX = await import("xlsx")
      const wb = XLSX.read(await file.arrayBuffer())
      const sheet = wb.Sheets[wb.SheetNames[0]]
      if (!sheet) throw new Error("File tidak berisi data")
      const csv = XLSX.utils.sheet_to_csv(sheet)
      const form = new FormData()
      form.append(
        "file",
        new File([csv], "import.csv", { type: "text/csv" })
      )
      const data = await apiRequest<ImportResult>("/users/import", {
        method: "POST",
        body: form,
      })
      setResult(data)
      if ((data.failures?.length ?? 0) === 0) {
        toast.success(`Import selesai: ${data.success_count} pengguna dibuat`)
      } else {
        toast.warning(
          `Import selesai dengan ${data.failures!.length} baris gagal`
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import gagal")
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Import Pengguna"
        crumbs={[
          { label: "Pengguna", href: "/admin/users" },
          { label: "Import" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>Import dari CSV/XLSX</CardTitle>
            <CardDescription>
              Unduh template terlebih dahulu, isi data, lalu unggah file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Kolom</th>
                    <th className="px-4 py-2 text-left font-medium">Wajib</th>
                    <th className="px-4 py-2 text-left font-medium">Contoh / Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATE_COLUMNS.map(([col, req, ex]) => (
                    <tr key={col} className="border-t">
                      <td className="px-4 py-2 font-mono">{col}</td>
                      <td className="px-4 py-2">{req}</td>
                      <td className="px-4 py-2 text-muted-foreground">{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <DownloadIcon data-icon="inline-start" />
              Download Template (.xlsx)
            </Button>
            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <Label htmlFor="file">File Import</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx"
                  className="mt-2"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={uploading || !file}>
                  {uploading ? "Mengunggah..." : "Upload & Import"}
                </Button>
                <Button variant="outline" render={<Link href="/admin/users" />}>
                  Kembali
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle>Hasil Import</CardTitle>
              <CardDescription>
                {result.success_count} pengguna berhasil dibuat
                {result.failures?.length
                  ? `, ${result.failures.length} baris gagal`
                  : ""}
                .
              </CardDescription>
            </CardHeader>
            {result.failures?.length ? (
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">
                          Baris (username)
                        </th>
                        <th className="px-4 py-2 text-left font-medium">
                          Alasan Gagal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.failures.map((f, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-4 py-2 font-mono">
                            {f.row || "(kosong)"}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {f.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            ) : null}
          </Card>
        ) : null}
      </div>
    </>
  )
}
