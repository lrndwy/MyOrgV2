"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useAuth } from "@/components/providers/auth-provider"
import { useSettings } from "@/hooks/use-settings"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { hasPermission } from "@/lib/auth"
import { storageUrl } from "@/lib/storage-url"
import type { NavItem } from "@/lib/types"
import { Building2Icon } from "lucide-react"

function filterNavItems(items: NavItem[], permissions: string[]): NavItem[] {
  return items
    .filter((item) => hasPermission(permissions, item.permission))
    .map((item) => ({
      ...item,
      items: item.items?.filter((sub) =>
        hasPermission(permissions, sub.permission)
      ),
    }))
    .filter((item) => !item.items || item.items.length > 0)
}

export function AppSidebar({
  navItems,
  secondaryItems = [],
  menuVariant = "member",
  ...props
}: Omit<React.ComponentProps<typeof Sidebar>, "variant"> & {
  navItems: NavItem[]
  secondaryItems?: NavItem[]
  menuVariant?: "member" | "admin"
}) {
  const pathname = usePathname()
  const { user, permissions } = useAuth()
  const { settings } = useSettings()
  const siteName = settings?.web_name || "MyOrg"
  const logoUrl = settings?.logo_url ? storageUrl(settings.logo_url) : null

  const filteredMain = filterNavItems(navItems, permissions)
  const filteredSecondary = filterNavItems(secondaryItems, permissions)

  const navWithActive = filteredMain.map((item) => ({
    ...item,
    isActive:
      pathname === item.url || pathname.startsWith(`${item.url}/`),
  }))

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link
                  href={
                    menuVariant === "admin" ? "/admin/dashboard" : "/dashboard"
                  }
                />
              }
            >
              {logoUrl ? (
                <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary">
                  <img
                    src={logoUrl}
                    alt={siteName}
                    className="size-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2Icon className="size-4" />
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{siteName}</span>
                <span className="truncate text-xs">
                  {menuVariant === "admin" ? "Panel Admin" : "Anggota"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navWithActive} />
        {filteredSecondary.length > 0 ? (
          <NavSecondary items={filteredSecondary} className="mt-auto" />
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user?.full_name || user?.username || "Pengguna",
            email: user?.email || user?.username || "",
            avatar: user?.avatar_url ? storageUrl(user.avatar_url) : "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
