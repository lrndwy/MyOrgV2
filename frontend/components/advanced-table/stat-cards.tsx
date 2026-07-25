"use client"

import type { ReactNode } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatCardItem = {
  label: string
  value: ReactNode
  description?: string
  className?: string
}

export function StatCards({
  items,
  className,
}: {
  items: StatCardItem[]
  className?: string
}) {
  if (!items.length) return null

  const cols =
    items.length >= 4
      ? "md:grid-cols-4"
      : items.length === 3
        ? "md:grid-cols-3"
        : items.length === 2
          ? "md:grid-cols-2"
          : "md:grid-cols-1"

  return (
    <div className={cn("grid gap-4", cols, className)}>
      {items.map((item) => (
        <Card key={item.label} size="sm" className={item.className}>
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">
              {item.value}
            </CardTitle>
          </CardHeader>
          {item.description ? (
            <CardContent className="text-muted-foreground">
              {item.description}
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  )
}
