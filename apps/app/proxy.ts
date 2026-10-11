import { updateSession } from "@workspace/supabase/proxy"
import type { NextRequest } from "next/server"

import { AUTH_COOKIE } from "@/lib/auth-cookie"
import { isOtpSession } from "@/lib/otp-session"

export async function proxy(request: NextRequest) {
  return await updateSession(request, {
    cookieName: AUTH_COOKIE,
    publicPaths: ["/login"],
    loginPath: "/login",
    isValidSession: isOtpSession,
  })
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
