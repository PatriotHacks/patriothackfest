import type { EmailMessage, EmailTransport } from "./transport"

export type SendResult =
  | { id: string; ok: true; messageId: string }
  | { id: string; ok: false; error: string }

export async function sendBatch<T extends { id: string }>(
  items: readonly T[],
  transport: EmailTransport,
  buildMessage: (item: T) => EmailMessage,
  onResult: (result: SendResult) => Promise<void>
) {
  const results: SendResult[] = []
  for (const item of items) {
    let result: SendResult
    try {
      const { messageId } = await transport.send(buildMessage(item))
      result = { id: item.id, ok: true, messageId }
    } catch (error) {
      result = {
        id: item.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    await onResult(result)
    results.push(result)
  }
  return results
}
