import type { SupabaseClient } from "@supabase/supabase-js"

export const SIGNED_URL_SECONDS = 60

export async function signedFileUrl(
  client: Pick<SupabaseClient, "storage">,
  bucket: string,
  path: string
): Promise<{ error: string | null; url?: string }> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS)
  return error ? { error: error.message } : { error: null, url: data.signedUrl }
}
