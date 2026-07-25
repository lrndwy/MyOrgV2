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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { unwrapList } from "@/lib/format"
import type { Division, Role } from "@/lib/types"

export default function CreateUserPage() {
  const router = useRouter()
  const divisions = useApi(() =>
    apiRequest<Division[] | { items: Division[] }>("/divisions").then(unwrapList)
  )
  const roles = useApi(() =>
    apiRequest<Role[] | { items: Role[] }>("/roles").then(unwrapList)
  )
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    division_id: "",
    role_id: "",
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiRequest("/users", {
        method: "POST",
        body: {
          ...form,
          division_id: Number(form.division_id),
          role_id: Number(form.role_id),
        },
      })
      toast.success("Pengguna berhasil dibuat")
      router.push("/admin/users")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pengguna")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Tambah Pengguna"
        crumbs={[
          { label: "Pengguna", href: "/admin/users" },
          { label: "Tambah" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card>
          <CardHeader>
            <CardTitle>Form Pengguna Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Username</FieldLabel>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
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
                <Field>
                  <FieldLabel>Password Sementara</FieldLabel>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Nama Lengkap</FieldLabel>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Divisi</FieldLabel>
                  <Select
                    value={form.division_id}
                    onValueChange={(v) => {
                      if (v == null) return
                      setForm({ ...form, division_id: v })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih divisi" />
                    </SelectTrigger>
                    <SelectContent>
                      {divisions.data?.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Role</FieldLabel>
                  <Select
                    value={form.role_id}
                    onValueChange={(v) => {
                      if (v == null) return
                      setForm({ ...form, role_id: v })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.data?.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Menyimpan..." : "Simpan"}
                  </Button>
                  <Button variant="outline" render={<Link href="/admin/users" />}>
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
