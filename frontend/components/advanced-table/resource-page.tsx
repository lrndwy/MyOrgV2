"use client"

import type { ReactNode } from "react"
import { PageHeader } from "@/components/page-header"
import { StatCards, type StatCardItem } from "@/components/advanced-table/stat-cards"

export function AdvancedResourcePage({
  title,
  crumbs,
  stats,
  actions,
  children,
}: {
  title: string
  crumbs: { label: string; href?: string }[]
  stats?: StatCardItem[]
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {stats?.length ? <StatCards items={stats} /> : null}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
        {children}
      </div>
    </>
  )
}
