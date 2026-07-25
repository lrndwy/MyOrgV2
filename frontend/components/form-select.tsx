"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type FormSelectOption = {
  value: string
  label: string
}

type FormSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: FormSelectOption[]
  placeholder?: string
  className?: string
}

/** Select dengan label yang benar (Base UI menampilkan value mentah tanpa ini). */
export function FormSelect({
  value,
  onValueChange,
  options,
  placeholder = "Pilih...",
  className,
}: FormSelectProps) {
  const selected = options.find((o) => o.value === value)

  return (
    <Select value={value} onValueChange={(v) => v != null && onValueChange(v)}>
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder}>
          {selected?.label ?? placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
