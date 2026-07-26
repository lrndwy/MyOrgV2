"use client"

import { useMemo } from "react"
import { FileTextIcon, ShieldAlertIcon } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/page-states"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useApi } from "@/hooks/use-api"
import { apiRequest } from "@/lib/api"
import { formatDate, unwrapList } from "@/lib/format"
import { storageUrl } from "@/lib/storage-url"
import type { Violation } from "@/lib/types"

export default function MyViolationsPage() {
  const { data, loading, error } = useApi(async () => {
    const result = await apiRequest<Violation[] | { items: Violation[] }>(
      "/violations/me"
    )
    return unwrapList(result)
  })

  const rows = useMemo(() => data ?? [], [data])
  const spCount = rows.filter((v) => v.sp_level).length

  return (
    <>
      <PageHeader
        title="Pelanggaran Saya"
        crumbs={[{ label: "Pelanggaran Saya" }]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {loading ? <LoadingState rows={4} /> : null}
        {error ? <ErrorState message={error} /> : null}

        {!loading && !error && rows.length === 0 ? (
          <EmptyState message="Tidak ada catatan pelanggaran. Pertahankan!" />
        ) : null}

        {!loading && spCount > 0 ? (
          <Alert variant="destructive">
            <ShieldAlertIcon />
            <AlertTitle>
              Anda tercatat menerima {spCount} surat peringatan (SP)
            </AlertTitle>
            <AlertDescription>
              Hubungi pengurus jika Anda merasa catatan ini tidak sesuai.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          {rows.map((item) => (
            <article key={item.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldAlertIcon className="size-4" />
                    <span className="text-xs">
                      Diterbitkan {formatDate(item.issued_date ?? item.issued_at)}
                    </span>
                  </div>
                  <h3 className="mt-1 font-heading text-base font-medium">
                    {item.violation_type || item.type || "Pelanggaran"}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description || "Tidak ada keterangan"}
                  </p>
                </div>
                {item.sp_level ? (
                  <Badge variant="destructive">{item.sp_level}</Badge>
                ) : (
                  <Badge variant="outline">Tanpa SP</Badge>
                )}
              </div>
              {item.document_url ? (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={storageUrl(item.document_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <FileTextIcon data-icon="inline-start" />
                    Lihat surat peringatan
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
