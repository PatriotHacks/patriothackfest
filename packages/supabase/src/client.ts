import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "./database.types"

export function createClient(cookieName: string) {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { name: cookieName } }
  )
}
