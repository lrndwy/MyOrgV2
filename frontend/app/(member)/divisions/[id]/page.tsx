"use client"

import { use } from "react"
import { PageHeader } from "@/components/page-header"
import { ErrorState, LoadingState } from "@/components/page-states"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { unwrapList } from "@/lib/format"
import type { Division } from "@/lib/types"

export default function DivisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, loading, error } = useApi(async () => {
    const list = unwrapList(
      await apiRequest<Division[] | { items: Division[] }>("/divisions")
    )
    return list.find((d) => String(d.id) === id) ?? null
  }, [id])

  return (
    <>
      <PageHeader title="Divisi" crumbs={[{ label: data?.name ?? "Divisi" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {loading ? <LoadingState rows={3} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {data ? (
          <Card>
            <CardHeader>
              <CardTitle>{data.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">
                {data.description ?? "Tidak ada deskripsi"}
              </p>
            </CardContent>
          </Card>
        ) : !loading && !error ? (
          <ErrorState message="Divisi tidak ditemukan" />
        ) : null}
      </div>
    </>
  )
}
