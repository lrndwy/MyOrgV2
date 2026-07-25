import type { Event } from "@/lib/types"
import { storageUrl } from "@/lib/storage-url"

/** Resolve event banner from API (`banner_url` or legacy `banner_image_url`). */
export function eventBannerUrl(
  event: Pick<Event, "banner_url" | "banner_image_url">
): string | null {
  const raw = event.banner_image_url ?? event.banner_url
  if (!raw) return null
  const url = storageUrl(raw)
  return url || null
}
