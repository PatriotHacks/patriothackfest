import { updateSession } from "@workspace/supabase/proxy"
import type { NextRequest } from "next/server"

import { AUTH_COOKIE } from "@/lib/auth-cookie"

export async function proxy(request: NextRequest) {
  return await updateSession(request, {
    cookieName: AUTH_COOKIE,
    publicPaths: ["/login", "/auth"],
    loginPath: "/login",
  })
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
