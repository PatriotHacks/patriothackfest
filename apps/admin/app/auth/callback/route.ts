import { createClient } from "@workspace/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

import { AUTH_COOKIE } from "@/lib/auth-cookie"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")

  if (code) {
    const supabase = await createClient(AUTH_COOKIE)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.redirect(new URL("/login?error=auth", request.url))
}
