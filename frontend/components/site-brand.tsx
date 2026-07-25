"use client"

import Link from "next/link"
import { Building2Icon } from "lucide-react"
import { useSettings } from "@/hooks/use-settings"
import { storageUrl } from "@/lib/storage-url"

export function SiteBrand({ size = "md" }: { size?: "sm" | "md" }) {
  const { settings } = useSettings()
  const name = settings?.web_name || "MyOrg"
  const logoUrl = settings?.logo_url ? storageUrl(settings.logo_url) : null

  return (
    <Link href="/" className="flex items-center gap-2 font-medium">
      {logoUrl ? (
        <div
          className={`flex items-center justify-center overflow-hidden rounded-md bg-primary ${size === "sm" ? "size-6" : "size-8"}`}
        >
          <img src={logoUrl} alt={name} className="size-full object-contain" />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded-md bg-primary text-primary-foreground ${size === "sm" ? "size-6" : "size-8"}`}
        >
          <Building2Icon className={size === "sm" ? "size-4" : "size-5"} />
        </div>
      )}
      <span className={size === "sm" ? "text-sm" : "text-base"}>{name}</span>
    </Link>
  )
}
