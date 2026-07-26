"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FormDialog } from "@/components/advanced-table"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { apiRequest } from "@/lib/api"

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Gagal membaca file"))
    reader.readAsDataURL(file)
  })
}

export function IzinRequestDialog({
  eventId,
  open,
  onOpenChange,
  onSuccess,
}: {
  eventId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const [reason, setReason] = useState("")
  const [proof, setProof] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!reason.trim()) {
      toast.error("Alasan izin wajib diisi")
      return
    }
    setSaving(true)
    try {
      const proofData = proof ? await fileToDataUrl(proof) : ""
      await apiRequest("/permission_requests", {
        method: "POST",
        body: {
          event_id: eventId,
          reason: reason.trim(),
          proof: proofData,
        },
      })
      toast.success("Pengajuan izin terkirim, menunggu persetujuan")
      onOpenChange(false)
      setReason("")
      setProof(null)
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengajukan izin")
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajukan Izin"
      onSubmit={handleSubmit}
      saving={saving}
      submitLabel="Kirim Pengajuan"
    >
      <FieldGroup>
        <Field>
          <FieldLabel>Alasan</FieldLabel>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan alasan Anda tidak dapat hadir"
            rows={4}
            required
          />
        </Field>
        <Field>
          <FieldLabel>Bukti Pendukung (opsional)</FieldLabel>
          <Input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            Foto/dokumen pendukung, mis. surat keterangan sakit.
          </p>
        </Field>
      </FieldGroup>
    </FormDialog>
  )
}
