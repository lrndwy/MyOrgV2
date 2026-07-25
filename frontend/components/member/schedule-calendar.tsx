"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Event } from "@/lib/types"

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(d)
}

function dayLabel(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d)
}

function timeLabel(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return ""
  }
}

function buildMonthCells(viewMonth: Date) {
  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const first = new Date(year, month, 1)
  // Monday-first: JS getDay() Sunday=0 → shift
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function ScheduleCalendar({
  events,
  className,
}: {
  events: Event[]
  className?: string
}) {
  const today = startOfDay(new Date())
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [selected, setSelected] = useState(today)

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const event of events) {
      const start = new Date(event.start_time)
      if (Number.isNaN(start.getTime())) continue
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth])
  const selectedKey = `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`
  const selectedEvents = eventsByDay.get(selectedKey) ?? []

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[1.2fr_1fr]", className)}>
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Kalender jadwal</p>
            <h3 className="font-heading text-base font-medium capitalize">
              {monthLabel(viewMonth)}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
                )
              }
            >
              <ChevronLeftIcon />
              <span className="sr-only">Bulan sebelumnya</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                setSelected(today)
              }}
            >
              Hari ini
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setViewMonth(
                  new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
                )
              }
            >
              <ChevronRightIcon />
              <span className="sr-only">Bulan berikutnya</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 font-medium">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
            const dayEvents = eventsByDay.get(key) ?? []
            const isSelected = sameDay(date, selected)
            const isToday = sameDay(date, today)
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(date)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                  isToday && !isSelected && "ring-1 ring-primary/40"
                )}
              >
                <span className="leading-none">{date.getDate()}</span>
                {dayEvents.length > 0 ? (
                  <span
                    className={cn(
                      "mt-1 flex gap-0.5",
                      isSelected ? "text-primary-foreground" : "text-primary"
                    )}
                  >
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          "size-1 rounded-full",
                          isSelected ? "bg-primary-foreground" : "bg-primary"
                        )}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Agenda</p>
        <h3 className="font-heading text-base font-medium">{dayLabel(selected)}</h3>
        <div className="mt-4 flex flex-col gap-3">
          {selectedEvents.length === 0 ? (
            <p className="rounded-xl bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
              Tidak ada jadwal pada hari ini
            </p>
          ) : (
            selectedEvents.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-xl border p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium group-hover:text-primary">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {timeLabel(event.start_time)}
                      {event.end_time ? ` – ${timeLabel(event.end_time)}` : ""}
                    </p>
                    {event.location ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPinIcon className="size-3.5" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={event.status} />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
