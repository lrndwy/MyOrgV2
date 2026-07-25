"use client"

import { PageHeader } from "@/components/page-header"
import { CloudStorageBrowser } from "@/components/cloud-storage-browser"

export default function AdminStoragePage() {
  return (
    <>
      <PageHeader
        title="Penyimpanan Cloud"
        crumbs={[{ label: "Penyimpanan Cloud" }]}
      />
      <div className="flex flex-1 flex-col p-4 pt-0">
        <CloudStorageBrowser />
      </div>
    </>
  )
}
