"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { CameraIcon, Loader2Icon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ErrorState, LoadingState } from "@/components/page-states"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { getMe } from "@/lib/auth"
import { storageUrl } from "@/lib/storage-url"
import type { User } from "@/lib/types"

const profileSchema = z.object({
  full_name: z.string().min(1, "Nama wajib diisi"),
  birth_date: z.string().optional(),
  hometown: z.string().optional(),
  phone: z.string().optional(),
})

const passwordSchema = z
  .object({
    old_password: z.string().min(1),
    new_password: z.string().min(8),
    confirm_password: z.string().min(8),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirm_password"],
  })

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const { data: user, loading, error, setData } = useApi(getMe)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: user?.full_name ?? "",
      birth_date: user?.birth_date?.slice(0, 10) ?? "",
      hometown: user?.hometown ?? "",
      phone: user?.phone ?? "",
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      confirm_password: "",
    },
  })

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran maksimal 5 MB")
      return
    }
    setUploadingAvatar(true)
    try {
      const body = new FormData()
      body.append("avatar", file)
      const result = await apiRequest<{ avatar_url: string }>("/me/avatar", {
        method: "POST",
        body,
      })
      setData({ ...user!, avatar_url: result.avatar_url })
      toast.success("Foto profil berhasil diperbarui")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto")
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ""
    }
  }

  async function onProfileSubmit(values: ProfileForm) {
    setSaving(true)
    try {
      const updated = await apiRequest<User>("/me", {
        method: "PUT",
        body: values,
      })
      setData(updated)
      toast.success("Profil berhasil diperbarui")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function onPasswordSubmit(values: PasswordForm) {
    setChangingPassword(true)
    try {
      await apiRequest("/me/password", {
        method: "PUT",
        body: {
          old_password: values.old_password,
          new_password: values.new_password,
        },
      })
      passwordForm.reset()
      toast.success("Password berhasil diubah")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah password")
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <>
      <PageHeader title="Profil" crumbs={[{ label: "Profil" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {loading ? <LoadingState rows={5} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {user ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Foto Profil</CardTitle>
                <CardDescription>
                  Foto profil akan ditampilkan di sidebar dan profil Anda
                </CardDescription>
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
                    onChange={onAvatarChange}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informasi Akun</CardTitle>
                <CardDescription>Data read-only dari sistem</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Username:</span>{" "}
                  {user.username}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {user.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Divisi:</span>{" "}
                  {typeof user.division === "string"
                    ? user.division
                    : user.division?.name ?? "-"}
                </p>
                <p>
                  <span className="text-muted-foreground">Role:</span>{" "}
                  {typeof user.role === "string"
                    ? user.role
                    : user.role?.name ?? "-"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Edit Profil</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Nama Lengkap</FieldLabel>
                      <Input {...profileForm.register("full_name")} />
                    </Field>
                    <Field>
                      <FieldLabel>Tanggal Lahir</FieldLabel>
                      <Input type="date" {...profileForm.register("birth_date")} />
                    </Field>
                    <Field>
                      <FieldLabel>Asal</FieldLabel>
                      <Input {...profileForm.register("hometown")} />
                    </Field>
                    <Field>
                      <FieldLabel>Telepon</FieldLabel>
                      <Input {...profileForm.register("phone")} />
                    </Field>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Menyimpan..." : "Simpan Profil"}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ubah Password</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Password Lama</FieldLabel>
                      <Input
                        type="password"
                        {...passwordForm.register("old_password")}
                      />
                    </Field>
                    <Separator />
                    <Field>
                      <FieldLabel>Password Baru</FieldLabel>
                      <Input
                        type="password"
                        {...passwordForm.register("new_password")}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Konfirmasi Password Baru</FieldLabel>
                      <Input
                        type="password"
                        {...passwordForm.register("confirm_password")}
                      />
                    </Field>
                    <Button type="submit" disabled={changingPassword}>
                      {changingPassword ? "Memproses..." : "Ubah Password"}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  )
}
