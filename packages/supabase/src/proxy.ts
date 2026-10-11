import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "./database.types"

export async function updateSession(
  request: NextRequest,
  {
    cookieName,
    publicPaths,
    loginPath,
  }: { cookieName: string; publicPaths: string[]; loginPath: string }
) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { name: cookieName },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const path = request.nextUrl.pathname

  if (
    !data?.claims &&
    !publicPaths.some((p) => path === p || path.startsWith(`${p}/`))
  ) {
    const url = request.nextUrl.clone()
    url.pathname = loginPath
    url.search = ""
    return NextResponse.redirect(url)
  }

  return response
}
