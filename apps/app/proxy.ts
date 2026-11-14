import { updateSession } from "@workspace/supabase/proxy"
import type { NextRequest } from "next/server"

import { AUTH_COOKIE } from "@/lib/auth-cookie"
import { isOtpSession } from "@/lib/otp-session"
import { projectReturnPath } from "@/lib/project-return-path"

export async function proxy(request: NextRequest) {
  const response = await updateSession(request, {
    cookieName: AUTH_COOKIE,
    publicPaths: ["/login"],
    loginPath: "/login",
    isValidSession: isOtpSession,
  })
  const returnTo = projectReturnPath(request.nextUrl.pathname)
  const location = response.headers.get("location")
  if (returnTo !== "/start" && location) {
    const url = new URL(location, request.url)
    if (url.origin === request.nextUrl.origin && url.pathname === "/login") {
      url.searchParams.set("next", returnTo)
      response.headers.set("location", url.toString())
    }
  }
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
