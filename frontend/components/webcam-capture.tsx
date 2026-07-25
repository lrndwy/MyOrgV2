"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CameraIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type WebcamCaptureProps = {
  value: string | null
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  className?: string
}

export function WebcamCapture({
  value,
  onChange,
  disabled,
  className,
}: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setActive(false)
  }, [])

  const bindStreamToVideo = useCallback(async () => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return

    video.srcObject = stream
    try {
      await video.play()
    } catch {
      setError("Gagal memutar preview kamera.")
    }
  }, [])

  useEffect(() => {
    if (!active) return
    void bindStreamToVideo()
  }, [active, bindStreamToVideo])

  const startCamera = useCallback(async () => {
    if (disabled) return
    try {
      setError(null)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      setActive(true)
    } catch {
      setError(
        "Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan di browser."
      )
      setActive(false)
    }
  }, [disabled])

  useEffect(() => () => stopStream(), [stopStream])

  function capture() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      toastCaptureError()
      return
    }

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.save()
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.restore()

    const timestamp = new Date().toLocaleString("id-ID")
    ctx.font = "bold 14px sans-serif"
    const textWidth = ctx.measureText(timestamp).width
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)"
    ctx.fillRect(12, canvas.height - 36, textWidth + 16, 26)
    ctx.fillStyle = "#ffffff"
    ctx.fillText(timestamp, 20, canvas.height - 18)

    onChange(canvas.toDataURL("image/jpeg", 0.88))
    stopStream()
  }

  function toastCaptureError() {
    setError("Preview kamera belum siap. Tunggu sebentar lalu coba lagi.")
  }

  function retake() {
    onChange(null)
    void startCamera()
  }

  if (value) {
    return (
      <div className={cn("space-y-3", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Selfie"
          className="aspect-[4/3] w-full rounded-md border object-cover"
        />
        <Button
          type="button"
          variant="outline"
          onClick={retake}
          disabled={disabled}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Ambil Ulang
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!active ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-md border bg-muted/40 p-4 text-center">
          <CameraIcon className="size-10 text-muted-foreground opacity-70" />
          <p className="text-sm text-muted-foreground">
            Selfie harus diambil langsung dari kamera, bukan unggahan galeri.
          </p>
          <Button type="button" onClick={startCamera} disabled={disabled}>
            <CameraIcon data-icon="inline-start" />
            Buka Kamera
          </Button>
        </div>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-md border bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-[4/3] w-full scale-x-[-1] object-cover"
            />
          </div>
          <Button type="button" onClick={capture} disabled={disabled}>
            Ambil Foto
          </Button>
        </>
      )}
    </div>
  )
}
