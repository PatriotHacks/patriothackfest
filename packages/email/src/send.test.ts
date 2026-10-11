import { describe, expect, it } from "vitest"

import { sendBatch, type SendResult } from "./send"
import { memoryTransport, type EmailMessage } from "./transport"

const items = [
  { id: "a", email: "a@example.com" },
  { id: "b", email: "b@example.com" },
  { id: "c", email: "c@example.com" },
]

const build = (item: { email: string }): EmailMessage => ({
  to: item.email,
  subject: "Hi",
  text: "Hello",
  html: "<p>Hello</p>",
})

const noop = async () => {}

describe("sendBatch", () => {
  it("sends every item in order and reports message ids", async () => {
    const transport = memoryTransport()
    const results = await sendBatch(items, transport, build, noop)
    expect(transport.messages.map((m) => m.to)).toEqual([
      "a@example.com",
      "b@example.com",
      "c@example.com",
    ])
    expect(results).toEqual([
      { id: "a", ok: true, messageId: "memory-1" },
      { id: "b", ok: true, messageId: "memory-2" },
      { id: "c", ok: true, messageId: "memory-3" },
    ])
  })

  it("returns an empty result for no items", async () => {
    expect(await sendBatch([], memoryTransport(), build, noop)).toEqual([])
  })

  it("records per-item failures and keeps sending", async () => {
    const memory = memoryTransport()
    const transport = {
      async send(message: EmailMessage) {
        if (message.to === "b@example.com") throw new Error("550 rejected")
        return memory.send(message)
      },
    }
    const results = await sendBatch(items, transport, build, noop)
    expect(results).toEqual([
      { id: "a", ok: true, messageId: "memory-1" },
      { id: "b", ok: false, error: "550 rejected" },
      { id: "c", ok: true, messageId: "memory-2" },
    ])
  })

  it("handles non-Error rejections and build failures", async () => {
    const transport = {
      send: () => Promise.reject("connection reset"),
    }
    const results = await sendBatch(
      items.slice(0, 2),
      transport,
      (item) => {
        if (item.id === "b") throw new Error("missing template data")
        return build(item)
      },
      noop
    )
    expect(results).toEqual([
      { id: "a", ok: false, error: "connection reset" },
      { id: "b", ok: false, error: "missing template data" },
    ])
  })

  it("sends sequentially", async () => {
    let active = 0
    let maxActive = 0
    const transport = {
      async send() {
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise((resolve) => setTimeout(resolve, 1))
        active -= 1
        return { messageId: "x" }
      },
    }
    await sendBatch(items, transport, build, noop)
    expect(maxActive).toBe(1)
  })

  it("awaits onResult for each item before sending the next", async () => {
    const memory = memoryTransport()
    const events: string[] = []
    const transport = {
      async send(message: EmailMessage) {
        events.push(`send ${message.to}`)
        if (message.to === "b@example.com") throw new Error("550 rejected")
        return memory.send(message)
      },
    }
    await sendBatch(items, transport, build, async (result: SendResult) => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      events.push(`done ${result.id} ${result.ok}`)
    })
    expect(events).toEqual([
      "send a@example.com",
      "done a true",
      "send b@example.com",
      "done b false",
      "send c@example.com",
      "done c true",
    ])
  })

  it("stops when onResult rejects", async () => {
    const transport = memoryTransport()
    await expect(
      sendBatch(items, transport, build, async (result) => {
        if (result.id === "a") throw new Error("finish failed")
      })
    ).rejects.toThrow("finish failed")
    expect(transport.messages).toHaveLength(1)
  })
})
