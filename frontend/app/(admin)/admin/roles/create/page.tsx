"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiRequest } from "@/lib/api"

export default function CreateRolePage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const role = await apiRequest<{ id: number }>("/roles", {
        method: "POST",
        body: form,
      })
      toast.success("Role dibuat")
      router.push(`/admin/roles/${role.id}/edit`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat role")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Tambah Role"
        crumbs={[
          { label: "Role", href: "/admin/roles" },
          { label: "Tambah" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>Role Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
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
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    Simpan & Atur Permission
                  </Button>
                  <Button variant="outline" render={<Link href="/admin/roles" />}>
                    Batal
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
