"use client"

import Image from "next/image"
import { SiteBrand } from "@/components/site-brand"
import allPengurus from "@/public/all-pengurus-2627.jpeg"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <SiteBrand size="sm" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-muted lg:block">
        <Image
          src={allPengurus}
          alt="Pengurus HIMATRIS"
          fill
          priority
          sizes="50vw"
          className="object-cover"
          placeholder="blur"
        />
        {/* Overlay gelap agar teks tetap terbaca di atas foto */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        <div className="absolute inset-0 flex items-end justify-center p-12">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-white">
              Kelola organisasi Anda
            </h2>
            <p className="text-white/80">
              Event, absensi, perizinan, surat, keuangan, dan pengumuman — semua
              dalam satu platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
