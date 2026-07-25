"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { adminNavItems } from "@/lib/nav-config"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar navItems={adminNavItems} menuVariant="admin" />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
