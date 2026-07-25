"use client"

import { useState } from "react"
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
import { getApiBase } from "@/lib/api"
import { getStoredToken } from "@/lib/auth"

export default function AdminBackupPage() {
  const [restoring, setRestoring] = useState(false)

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault()
    const input = document.getElementById("backup-file") as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    setRestoring(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const token = getStoredToken()
      const res = await fetch(`${getApiBase()}/backup/import`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message)
      toast.success("Backup berhasil dipulihkan")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal restore")
    } finally {
      setRestoring(false)
    }
  }

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
              Unduh arsip ZIP berisi data JSON dan semua file di storage lokal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              render={
                <a href={`${getApiBase()}/backup/export`} download />
              }
            >
              Download Backup ZIP
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Restore Backup</CardTitle>
            <CardDescription>
              Pulihkan file storage dari arsip ZIP backup. Data database perlu
              ditinjau manual dari data.json di dalam arsip.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRestore} className="space-y-3">
              <Input id="backup-file" type="file" accept=".zip" required />
              <Button type="submit" disabled={restoring}>
                {restoring ? "Memulihkan..." : "Restore dari ZIP"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
