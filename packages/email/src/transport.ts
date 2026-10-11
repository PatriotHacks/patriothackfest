import { createTransport } from "nodemailer"

export type EmailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<{ messageId: string }>
}

export type SmtpConfig = {
  host: string
  port: 465 | 587
  user: string
  password: string
  from: string
}

export function smtpOptions(config: SmtpConfig) {
  return {
    pool: true as const,
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port === 587,
    auth: { user: config.user, pass: config.password },
  }
}

export function smtpTransport(config: SmtpConfig) {
  const transporter = createTransport(smtpOptions(config))
  return {
    async send(message: EmailMessage) {
      const info = await transporter.sendMail({ from: config.from, ...message })
      return { messageId: info.messageId }
    },
    close() {
      transporter.close()
    },
  } satisfies EmailTransport & { close(): void }
}

export function memoryTransport() {
  const messages: EmailMessage[] = []
  return {
    messages,
    async send(message: EmailMessage) {
      messages.push(message)
      return { messageId: `memory-${messages.length}` }
    },
  } satisfies EmailTransport & { messages: EmailMessage[] }
}
