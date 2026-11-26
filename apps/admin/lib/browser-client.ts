import { createClient } from "@workspace/supabase/client"

import { AUTH_COOKIE } from "./auth-cookie"

let client: ReturnType<typeof createClient> | null = null

export function browserClient() {
  client ??= createClient(AUTH_COOKIE)
  return client
}
