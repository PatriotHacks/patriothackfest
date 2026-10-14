import { describe, expect, it } from "vitest"

import { BROADCAST_VARIABLES, renderBroadcast } from "./broadcast"
import { unknownVariables, validateTemplate } from "./templates"

const values = { name: "Ada", event_name: "Patriot HackFest 2026" }

describe("renderBroadcast", () => {
  it("fills variables and uses the subject as the heading", () => {
    const email = renderBroadcast(
      {
        subject: "News for {{event_name}}",
        body: "Hi {{ name }},\n\nSee you.",
      },
      values
    )
    expect(email.subject).toBe("News for Patriot HackFest 2026")
    expect(email.html).toContain(
      "<title>News for Patriot HackFest 2026</title>"
    )
    expect(email.html).toContain(">Hi Ada,</td>")
    expect(
      email.text.startsWith("Hi Ada,\n\nSee you.\n\nStay Connected\n")
    ).toBe(true)
  })

  it("escapes the subject heading, body, and values", () => {
    const { html, subject } = renderBroadcast(
      { subject: "<b>{{name}}</b>", body: "<i>x</i> {{name}}" },
      { ...values, name: `"Bob" & <Co>` }
    )
    expect(subject).toBe(`<b>"Bob" & <Co></b>`)
    expect(html).toContain(
      "&lt;b&gt;&quot;Bob&quot; &amp; &lt;Co&gt;&lt;/b&gt;</td>"
    )
    expect(html).toContain(
      "&lt;i&gt;x&lt;/i&gt; &quot;Bob&quot; &amp; &lt;Co&gt;</td>"
    )
    expect(html).not.toContain("<b>")
    expect(html).not.toContain("<Co>")
  })

  it("has no eyebrow, button, or sign-off line", () => {
    const { html, text } = renderBroadcast({ subject: "s", body: "b" }, values)
    expect(html).not.toContain('class="btn-table"')
    expect(html).not.toContain("v:roundrect")
    expect(html).not.toContain("STATUS UPDATE")
    expect(html).not.toContain("Thanks")
    expect(text).not.toContain("Thanks")
    expect(html).toContain(
      '<td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #444444;">\n                      <strong style="color: #1a1a1a;">&mdash; The Patriot HackFest Team</strong>'
    )
    expect(text).toContain(
      "hello@patriothackfest.com\n\n— The Patriot HackFest Team\nhttps://patriothackfest.com\n"
    )
    expect(html).toContain("Stay Connected")
  })

  it("rejects variables outside the broadcast list", () => {
    expect(() =>
      renderBroadcast({ subject: "s", body: "{{role}}" }, values)
    ).toThrow("Unknown variable {{role}}")
  })
})

describe("validateTemplate with a variable list", () => {
  it("only accepts the listed variables", () => {
    const template = { subject: "{{name}}", body: "{{event_dates}} {{role}}" }
    expect(validateTemplate(template)).toEqual([])
    expect(validateTemplate(template, BROADCAST_VARIABLES)).toEqual([
      "Unknown variables: {{event_dates}}, {{role}}.",
    ])
    expect(unknownVariables(template, ["role"])).toEqual([
      "name",
      "event_dates",
    ])
  })
})
