import type { EmailMessage, EmailTransport } from "./transport"

export type SendResult =
  | { id: string; ok: true; messageId: string }
  | { id: string; ok: false; error: string }

export async function sendBatch<T extends { id: string }>(
  items: readonly T[],
  transport: EmailTransport,
  buildMessage: (item: T) => EmailMessage
) {
  const results: SendResult[] = []
  for (const item of items) {
    try {
      const { messageId } = await transport.send(buildMessage(item))
      results.push({ id: item.id, ok: true, messageId })
    } catch (error) {
      results.push({
        id: item.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return results
}
