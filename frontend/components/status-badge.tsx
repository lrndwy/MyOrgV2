import { Badge } from "@/components/ui/badge"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  upcoming: "secondary",
  ongoing: "default",
  finished: "outline",
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  present: "default",
  permitted: "secondary",
  absent: "destructive",
}

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <Badge variant="outline">-</Badge>
  const key = status.toLowerCase()
  return (
    <Badge variant={statusVariant[key] ?? "outline"} className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  )
}
