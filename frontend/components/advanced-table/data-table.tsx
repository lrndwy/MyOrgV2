"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  type OnChangeFn,
} from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns3Icon,
  SearchIcon,
} from "lucide-react"
import {
  AutoRecordDetail,
  RecordDetailSheet,
} from "@/components/advanced-table/record-detail-sheet"
import { ErrorState, LoadingState } from "@/components/page-states"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { pickTitle, rowToRecord } from "@/lib/record-detail-utils"
import { cn } from "@/lib/utils"

function createGlobalFilterFn<TData>(): FilterFn<TData> {
  return (row, _columnId, filterValue) => {
    const q = String(filterValue ?? "")
      .trim()
      .toLowerCase()
    if (!q) return true
    return Object.values(row.original as Record<string, unknown>).some(
      (value) => {
        if (value == null) return false
        if (typeof value === "object") {
          try {
            return JSON.stringify(value).toLowerCase().includes(q)
          } catch {
            return false
          }
        }
        return String(value).toLowerCase().includes(q)
      }
    )
  }
}

export function sortableHeader(label: string) {
  return function SortableHeader({
    column,
  }: {
    column: {
      toggleSorting: (desc?: boolean) => void
      getIsSorted: () => false | "asc" | "desc"
    }
  }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <ArrowUpDownIcon className="size-3.5 opacity-60" />
      </Button>
    )
  }
}

export type AdvancedDataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  loading?: boolean
  error?: string | null
  emptyMessage?: string
  searchPlaceholder?: string
  toolbar?: React.ReactNode
  initialPageSize?: number
  pageSizeOptions?: number[]
  getRowId?: (row: TData) => string
  className?: string
  enableRowSelection?: boolean
  rowSelection?: RowSelectionState
  onRowSelectionChange?: OnChangeFn<RowSelectionState>
  enableRowDetail?: boolean
  renderRowDetail?: (row: TData) => React.ReactNode
  getDetailTitle?: (row: TData) => string
  getDetailDescription?: (row: TData) => string
}

export function AdvancedDataTable<TData>({
  columns,
  data,
  loading,
  error,
  emptyMessage = "Tidak ada data",
  searchPlaceholder = "Cari...",
  toolbar,
  initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  getRowId,
  className,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  enableRowDetail = true,
  renderRowDetail,
  getDetailTitle,
  getDetailDescription,
}: AdvancedDataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  })
  const [detailRow, setDetailRow] = React.useState<TData | null>(null)

  const detailEnabled = enableRowDetail !== false

  function handleRowClick(row: TData, event: React.MouseEvent) {
    if (!detailEnabled) return
    const target = event.target as HTMLElement
    if (
      target.closest(
        'button, a, input, textarea, select, label, [role="checkbox"], [data-no-row-click]'
      )
    ) {
      return
    }
    setDetailRow(row)
  }

  const table = useReactTable({
    data,
    columns,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      pagination,
      ...(enableRowSelection ? { rowSelection: rowSelection ?? {} } : {}),
    },
    enableRowSelection: !!enableRowSelection,
    onRowSelectionChange,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    globalFilterFn: createGlobalFilterFn<TData>(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const pageCount = table.getPageCount()
  const pageIndex = table.getState().pagination.pageIndex

  if (loading) return <LoadingState rows={6} />
  if (error) return <ErrorState message={error} />

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => {
              setGlobalFilter(e.target.value)
              setPagination((prev) => ({ ...prev, pageIndex: 0 }))
            }}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              <Columns3Icon className="size-4" />
              Kolom
              <ChevronDownIcon className="size-4 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Tampilkan kolom</DropdownMenuLabel>
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                      className="capitalize"
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {toolbar}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(
                    detailEnabled &&
                      "cursor-pointer transition-colors hover:bg-muted/50"
                  )}
                  onClick={(e) => handleRowClick(row.original, e)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Menampilkan{" "}
          <span className="font-medium text-foreground">
            {filteredCount === 0
              ? 0
              : pageIndex * pagination.pageSize + 1}
            –
            {Math.min(
              (pageIndex + 1) * pagination.pageSize,
              filteredCount
            )}
          </span>{" "}
          dari{" "}
          <span className="font-medium text-foreground">{filteredCount}</span>{" "}
          data
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Baris</span>
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => {
                if (value == null) return
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="size-4" />
              <span className="sr-only">Sebelumnya</span>
            </Button>
            <span className="min-w-16 text-center text-xs text-muted-foreground">
              {pageCount === 0 ? 0 : pageIndex + 1}/{pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="size-4" />
              <span className="sr-only">Berikutnya</span>
            </Button>
          </div>
        </div>
      </div>

      {detailEnabled && detailRow ? (
        <RecordDetailSheet
          open={!!detailRow}
          onOpenChange={(open) => {
            if (!open) setDetailRow(null)
          }}
          title={
            renderRowDetail
              ? getDetailTitle
                ? getDetailTitle(detailRow)
                : pickTitle(rowToRecord(detailRow))
              : undefined
          }
          description={
            getDetailDescription ? getDetailDescription(detailRow) : undefined
          }
        >
          {renderRowDetail ? (
            renderRowDetail(detailRow)
          ) : (
            <AutoRecordDetail row={detailRow} />
          )}
        </RecordDetailSheet>
      ) : null}
    </div>
  )
}
