import { NextResponse, type NextRequest } from "next/server"
import { TOKEN_COOKIE } from "@/lib/auth"

const PUBLIC = ["/login", "/api/", "/health", "/_next/", "/favicon.ico"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes, API routes, and static assets
  if (PUBLIC.some(p => pathname.startsWith(p)) || pathname === "/") {
    return NextResponse.next()
  }

  // Also allow existing admin/review/tasks routes (legacy, no auth gate yet)
  // TODO: Remove /agents and /preview from whitelist after preview is done
  if (pathname.startsWith("/admin") || pathname.startsWith("/review") || pathname.startsWith("/tasks") || pathname.startsWith("/agents") || pathname.startsWith("/preview")) {
    return NextResponse.next()
  }

  // Check auth token for (main) routes
  const token = request.cookies.get(TOKEN_COOKIE)?.value
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
