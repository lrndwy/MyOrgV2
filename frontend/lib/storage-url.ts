import { getApiBase } from "./api"

/** Resolve storage paths returned by the API to browser-loadable URLs. */
export function storageUrl(url?: string | null): string {
  if (!url) return ""
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url
  }

  const needsPrefix =
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_DIRECT_API === "1"

  if (url.startsWith("/storage/")) {
    return needsPrefix ? `${getApiBase()}${url}` : url
  }
  if (url.startsWith("storage/")) {
    return needsPrefix ? `${getApiBase()}/${url}` : `/${url}`
  }
  return url
}
