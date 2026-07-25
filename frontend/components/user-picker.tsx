"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import type { User } from "@/lib/types"

type UserPickerProps = {
  users: User[]
  value: string
  onValueChange: (userId: string) => void
  placeholder?: string
}

export function UserPicker({
  users,
  value,
  onValueChange,
  placeholder = "Cari nama atau username...",
}: UserPickerProps) {
  const [query, setQuery] = useState("")
  const selected = users.find((u) => String(u.id) === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users.slice(0, 8)
    return users
      .filter(
        (u) =>
          u.full_name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [users, query])

  return (
    <div className="space-y-2">
      {selected ? (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
          <span>
            {selected.full_name}{" "}
            <span className="text-muted-foreground">@{selected.username}</span>
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onValueChange("")}
          >
            Ganti
          </button>
        </div>
      ) : (
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
          />
          {filtered.length > 0 ? (
            <ul className="max-h-40 overflow-auto rounded-lg border">
              {filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      onValueChange(String(u.id))
                      setQuery("")
                    }}
                  >
                    <span className="font-medium">{u.full_name}</span>
                    <span className="text-xs text-muted-foreground">
                      @{u.username} · {u.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  )
}
