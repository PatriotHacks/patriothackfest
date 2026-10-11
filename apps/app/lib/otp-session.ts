import type { JwtPayload } from "@workspace/supabase/proxy"

export function isOtpSession(claims: JwtPayload) {
  return (
    claims.amr?.some(
      (entry) => typeof entry !== "string" && entry.method === "otp"
    ) === true
  )
}
