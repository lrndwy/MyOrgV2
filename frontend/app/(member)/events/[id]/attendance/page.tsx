"use client"

import { useEffect, useRef, useState, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { WebcamCapture } from "@/components/webcam-capture"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiRequest } from "@/lib/api"

function fillCanvasWhite(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}

function pointerPos(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number
) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

function fitCanvasSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  const width = Math.round(rect.width)
  const height = Math.round(rect.height)
  if (canvas.width === width && canvas.height === height) return false

  canvas.width = width
  canvas.height = height
  fillCanvasWhite(canvas)
  return true
}

function isCanvasBlank(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return true
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r !== 255 || g !== 255 || b !== 255) return false
  }
  return true
}

export default function EventAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [selfie, setSelfie] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    fitCanvasSize(canvas)

    const observer = new ResizeObserver(() => {
      fitCanvasSize(canvas)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    setDrawing(true)
    canvas.setPointerCapture(e.pointerId)
    const { x, y } = pointerPos(canvas, e.clientX, e.clientY)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const { x, y } = pointerPos(canvas, e.clientX, e.clientY)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#000000"
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function stopDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    setDrawing(false)
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  function clearSignature() {
    const canvas = canvasRef.current
    if (!canvas) return
    fillCanvasWhite(canvas)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selfie) {
      toast.error("Ambil foto selfie dari kamera terlebih dahulu")
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    if (isCanvasBlank(canvas)) {
      toast.error("Tanda tangan wajib diisi")
      return
    }

    setSubmitting(true)
    try {
      await apiRequest(`/events/${id}/attendance`, {
        method: "POST",
        body: {
          selfie,
          signature: canvas.toDataURL("image/png"),
        },
      })
      toast.success("Absensi berhasil dikirim")
      router.push(`/events/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim absensi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Absensi"
        crumbs={[
          { label: "Event", href: "/events" },
          { label: "Absensi" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Alert>
          <AlertTitle>Selfie via Kamera</AlertTitle>
          <AlertDescription>
            Foto selfie diambil langsung dari webcam perangkat Anda. Unggahan
            dari galeri tidak diizinkan untuk mencegah kecurangan.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Selfie</CardTitle>
              <CardDescription>
                Buka kamera dan ambil foto selfie saat ini
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WebcamCapture
                value={selfie}
                onChange={setSelfie}
                disabled={submitting}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tanda Tangan Digital</CardTitle>
              <CardDescription>Gambar tanda tangan di area berikut</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <canvas
                ref={canvasRef}
                className="h-44 w-full touch-none rounded-md border border-border bg-white"
                onPointerDown={startDraw}
                onPointerMove={draw}
                onPointerUp={stopDraw}
                onPointerLeave={stopDraw}
                onPointerCancel={stopDraw}
              />
              <Button type="button" variant="outline" onClick={clearSignature}>
                Hapus Tanda Tangan
              </Button>
            </CardContent>
          </Card>

          <div className="flex gap-2 lg:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Mengirim..." : "Kirim Absensi"}
            </Button>
            <Button
              type="button"
              variant="outline"
              render={<Link href={`/events/${id}`} />}
            >
              Batal
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
