"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { memberNavItems, memberSecondaryNav } from "@/lib/nav-config"

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        navItems={memberNavItems}
        secondaryItems={memberSecondaryNav}
        menuVariant="member"
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
