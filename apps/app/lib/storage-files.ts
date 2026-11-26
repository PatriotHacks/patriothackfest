import { createClient } from "@workspace/supabase/client"

import { AUTH_COOKIE } from "./auth-cookie"

let client: ReturnType<typeof createClient> | null = null

export function browserClient() {
  client ??= createClient(AUTH_COOKIE)
  return client
}

export async function removeFiles(bucket: string, paths: string[]) {
  if (paths.length === 0) return
  await browserClient().storage.from(bucket).remove(paths)
}
