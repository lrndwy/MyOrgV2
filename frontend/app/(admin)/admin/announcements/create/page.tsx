"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AttachmentUploadField } from "@/components/attachment-upload-field"
import { ImageUploadField } from "@/components/image-upload-field"
import { PageHeader } from "@/components/page-header"
import { RichTextEditor } from "@/components/rich-text-editor"
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
import { apiRequest } from "@/lib/api"

export default function CreateAnnouncementPage() {
  const router = useRouter()
  const [form, setForm] = useState({ title: "", content: "", target_type: "all" })
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = new FormData()
      body.append("title", form.title)
      body.append("content", form.content)
      body.append("target_type", form.target_type)
      if (bannerFile) body.append("banner", bannerFile)
      for (const file of attachments) {
        body.append("attachments", file)
      }
      await apiRequest("/announcements", { method: "POST", body })
      toast.success("Pengumuman dibuat")
      router.push("/admin/announcements")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pengumuman")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Buat Pengumuman"
        crumbs={[
          { label: "Admin", href: "/admin/settings" },
          { label: "Pengumuman", href: "/admin/announcements" },
          { label: "Buat Pengumuman" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Form Pengumuman</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Judul</FieldLabel>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>Banner</FieldLabel>
                  <ImageUploadField
                    value={bannerFile}
                    onChange={setBannerFile}
                  />
                </Field>
                <Field>
                  <FieldLabel>Isi Pengumuman</FieldLabel>
                  <RichTextEditor
                    value={form.content}
                    onChange={(content) => setForm({ ...form, content })}
                  />
                </Field>
                <Field>
                  <FieldLabel>Lampiran</FieldLabel>
                  <AttachmentUploadField
                    value={attachments}
                    onChange={setAttachments}
                  />
                </Field>
                <Field>
                  <FieldLabel>Target</FieldLabel>
                  <Input
                    value={form.target_type}
                    onChange={(e) =>
                      setForm({ ...form, target_type: e.target.value })
                    }
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Menyimpan..." : "Publikasikan"}
                  </Button>
                  <Button variant="outline" render={<Link href="/admin/announcements" />}>
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
