"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { register } from "@/lib/auth"
import { ApiError } from "@/lib/api"
import { useSettings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { settings } = useSettings()
  const siteName = settings?.web_name || "MyOrg"
  const [form, setForm] = useState({
    username: "",
    email: "",
    full_name: "",
    password: "",
    confirm: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) {
      setError("Konfirmasi password tidak cocok")
      return
    }
    setLoading(true)
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        full_name: form.full_name,
      })
      window.location.assign("/dashboard")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registrasi gagal")
      setLoading(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Buat Akun {siteName}</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Registrasi mandiri jika diaktifkan oleh admin
          </p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <FieldLabel htmlFor="full_name">Nama Lengkap</FieldLabel>
          <Input
            id="full_name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm">Konfirmasi Password</FieldLabel>
          <Input
            id="confirm"
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            required
          />
        </Field>
        <Field>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Memproses..." : "Daftar"}
          </Button>
        </Field>
        <FieldDescription className="text-center">
          Sudah punya akun?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Masuk
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}
