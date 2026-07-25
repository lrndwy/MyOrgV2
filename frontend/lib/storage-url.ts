/** Resolve storage paths returned by the API to browser-loadable URLs. */
export function storageUrl(url?: string | null): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url
  }
  if (url.startsWith("/storage/")) return url
  if (url.startsWith("storage/")) return `/${url}`
  return url
}
