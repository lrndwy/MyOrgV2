"use client"

import { SiteBrand } from "@/components/site-brand"

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
      <div className="relative hidden bg-muted lg:block">
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Kelola organisasi Anda
            </h2>
            <p className="text-muted-foreground">
              Event, absensi, perizinan, surat, keuangan, dan pengumuman — semua
              dalam satu platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
