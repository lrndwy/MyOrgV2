"use client"

import { useRef, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CameraIcon, Loader2Icon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ErrorState, LoadingState } from "@/components/page-states"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { storageUrl } from "@/lib/storage-url"
import type { Division, Role, User } from "@/lib/types"

export default function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const userQuery = useApi(() => apiRequest<User>(`/users/${id}`), [id])
  const divisions = useApi(() =>
    apiRequest<Division[] | { items: Division[] }>("/divisions").then(unwrapList)
  )
  const roles = useApi(() =>
    apiRequest<Role[] | { items: Role[] }>("/roles").then(unwrapList)
  )
  const [form, setForm] = useState<Partial<User> | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const user = form ?? userQuery.data

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar")
      return
    }
    setUploadingAvatar(true)
    try {
      const body = new FormData()
      body.append("avatar", file)
      const result = await apiRequest<{ avatar_url: string }>(`/users/${id}/avatar`, {
        method: "POST",
        body,
      })
      setForm({ ...user!, avatar_url: result.avatar_url })
      toast.success("Foto profil berhasil diperbarui")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto")
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ""
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      await apiRequest(`/users/${id}`, {
        method: "PUT",
        body: {
          full_name: user.full_name,
          email: user.email,
          division_id: user.division_id,
          role_id: user.role_id,
          status: user.status,
        },
      })
      toast.success("Pengguna diperbarui")
      router.push("/admin/users")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange() {
    if (!newPassword) return
    try {
      await apiRequest(`/users/${id}/password`, {
        method: "PUT",
        body: { new_password: newPassword },
      })
      setNewPassword("")
      toast.success("Password pengguna diperbarui")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah password")
    }
  }

  return (
    <>
      <PageHeader
        title="Edit Pengguna"
        crumbs={[
          { label: "Pengguna", href: "/admin/users" },
          { label: user?.full_name ?? "Edit" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {userQuery.loading ? <LoadingState rows={5} /> : null}
        {userQuery.error ? <ErrorState message={userQuery.error} /> : null}
        {user ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Foto Profil</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <Avatar size="lg">
                      <AvatarImage
                        src={user.avatar_url ? storageUrl(user.avatar_url) : ""}
                        alt={user.full_name}
                      />
                      <AvatarFallback>
                        {(user.full_name || user.username || "U")
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {uploadingAvatar && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
                        <Loader2Icon className="size-5 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      disabled={uploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <CameraIcon className="mr-2 size-4" />
                      {user.avatar_url ? "Ganti Foto" : "Unggah Foto"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WebP — maks. 5 MB
                    </p>
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Edit Data</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Username</FieldLabel>
                      <Input value={user.username} disabled />
                    </Field>
                    <Field>
                      <FieldLabel>Email</FieldLabel>
                      <Input
                        value={user.email}
                        onChange={(e) =>
                          setForm({ ...user, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Nama Lengkap</FieldLabel>
                      <Input
                        value={user.full_name}
                        onChange={(e) =>
                          setForm({ ...user, full_name: e.target.value })
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Divisi</FieldLabel>
                      <Select
                        value={String(user.division_id ?? "")}
                        onValueChange={(v) => {
                          if (v == null) return
                          setForm({ ...user, division_id: Number(v) })
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
                        value={String(user.role_id ?? "")}
                        onValueChange={(v) => {
                          if (v == null) return
                          setForm({ ...user, role_id: Number(v) })
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
                        Simpan
                      </Button>
                      <Button variant="outline" render={<Link href="/admin/users" />}>
                        Batal
                      </Button>
                    </div>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ganti Password</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field>
                  <FieldLabel>Password Baru</FieldLabel>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
                <Button type="button" onClick={handlePasswordChange}>
                  Ubah Password
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  )
}
