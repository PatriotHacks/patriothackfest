import "server-only"

import type { SmtpConfig } from "@workspace/email"
import * as z from "zod"

const envSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.enum(["465", "587"]).transform((p) => (p === "465" ? 465 : 587)),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  APP_URL: z.url(),
})

export const EMAIL_NOT_CONFIGURED =
  "Email is not configured. Set SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASSWORD, EMAIL_FROM, and APP_URL."

export function isEmailConfigured() {
  return envSchema.safeParse(process.env).success
}

export function emailSettings(): { smtp: SmtpConfig; portalUrl: string } {
  const result = envSchema.safeParse(process.env)
  if (!result.success) throw new Error(EMAIL_NOT_CONFIGURED)
  const env = result.data
  return {
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.EMAIL_FROM,
    },
    portalUrl: env.APP_URL,
  }
}
