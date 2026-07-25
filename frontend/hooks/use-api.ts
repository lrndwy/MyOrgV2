"use client"

import { useCallback, useEffect, useState } from "react"
import { ApiError } from "@/lib/api"

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat data")
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    queueMicrotask(() => {
      void refetch()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, setData, refetch }
}
