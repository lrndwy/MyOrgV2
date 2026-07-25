"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
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
import { getApiBase } from "@/lib/api"
import { getStoredToken } from "@/lib/auth"

export default function ImportUsersPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const token = getStoredToken()
      const response = await fetch(`${getApiBase()}/users/import`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.message || "Import gagal")
      }
      setResult(JSON.stringify(json.data, null, 2))
      toast.success("Import selesai")
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
                    <th className="px-4 py-2 text-left font-medium">Contoh</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["username", "Ya", "johndoe"],
                    ["email", "Ya", "john@example.com"],
                    ["full_name", "Ya", "John Doe"],
                    ["password", "Ya", "Pass123!"],
                    ["division_name", "Ya", "Umum"],
                    ["role_name", "Ya", "Admin"],
                  ].map(([col, req, ex]) => (
                    <tr key={col} className="border-t">
                      <td className="px-4 py-2 font-mono">{col}</td>
                      <td className="px-4 py-2">{req}</td>
                      <td className="px-4 py-2 text-muted-foreground">{ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="outline"
              render={
                <a href={`${getApiBase()}/users/import/template`} download />
              }
            >
              Download Template
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
            {result ? (
              <pre className="overflow-auto rounded-lg border bg-muted p-4 text-xs">
                {result}
              </pre>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
