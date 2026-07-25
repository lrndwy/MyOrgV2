"use client"

import { useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  className?: string
  placeholder?: string
}

export function RichTextEditor({
  value,
  onChange,
  className,
  placeholder = "Tulis isi pengumuman...",
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
  }, [value])

  function exec(cmd: string) {
    document.execCommand(cmd, false)
    ref.current?.focus()
    onChange(ref.current?.innerHTML ?? "")
  }

  return (
    <div className={cn("rounded-lg border", className)}>
      <div className="flex flex-wrap gap-1 border-b p-2">
        <Button type="button" variant="outline" size="sm" onClick={() => exec("bold")}>
          B
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("italic")}>
          I
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("underline")}>
          U
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("insertUnorderedList")}>
          • List
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => exec("insertOrderedList")}>
          1. List
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="min-h-[160px] p-3 text-sm outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        data-placeholder={placeholder}
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
      />
    </div>
  )
}
