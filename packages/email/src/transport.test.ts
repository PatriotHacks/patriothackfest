import { describe, expect, it } from "vitest"

import { memoryTransport, smtpOptions, smtpTransport } from "./transport"

const message = {
  to: "ada@example.com",
  subject: "Hi",
  text: "Hello",
  html: "<p>Hello</p>",
}

describe("memoryTransport", () => {
  it("records messages and returns unique ids", async () => {
    const transport = memoryTransport()
    const first = await transport.send(message)
    const second = await transport.send({ ...message, to: "b@example.com" })
    expect(transport.messages).toEqual([
      message,
      { ...message, to: "b@example.com" },
    ])
    expect(first.messageId).not.toBe(second.messageId)
  })
})

const config = {
  host: "smtp.gmail.com",
  user: "events@example.com",
  password: "app-password",
  from: "Patriot HackFest <events@example.com>",
}

describe("smtpOptions", () => {
  it("uses implicit TLS on 465", () => {
    expect(smtpOptions({ ...config, port: 465 })).toEqual({
      pool: true,
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: "events@example.com", pass: "app-password" },
    })
  })

  it("requires STARTTLS on 587", () => {
    expect(smtpOptions({ ...config, port: 587 })).toMatchObject({
      port: 587,
      secure: false,
      requireTLS: true,
    })
  })
})

describe("smtpTransport", () => {
  it("creates a closable transport without connecting", () => {
    const transport = smtpTransport({ ...config, port: 587 })
    expect(typeof transport.send).toBe("function")
    transport.close()
  })
})
