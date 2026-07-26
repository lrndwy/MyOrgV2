import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const protectedPrefixes = [
  "/dashboard",
  "/profile",
  "/events",
  "/my-permissions",
  "/my-violations",
  "/announcements",
  "/divisions",
  "/admin",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )

  if (!isProtected) {
    return NextResponse.next()
  }

  const token = request.cookies.get("token")?.value
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/events",
    "/events/:path*",
    "/my-permissions",
    "/my-permissions/:path*",
    "/my-violations",
    "/my-violations/:path*",
    "/announcements",
    "/announcements/:path*",
    "/divisions",
    "/divisions/:path*",
    "/admin",
    "/admin/:path*",
  ],
}
