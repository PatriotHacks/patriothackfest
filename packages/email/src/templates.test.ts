import { describe, expect, it } from "vitest"

import { escapeHtml } from "./layout"
import {
  renderStatusUpdate,
  unknownVariables,
  usedVariables,
  validateTemplate,
  type TemplateValues,
} from "./templates"

const values: TemplateValues = {
  name: "Ada",
  event_name: "Patriot HackFest 2026",
  event_dates: "Nov 14–15, 2026",
  role: "participant",
}

const url = "https://app.patriothackfest.com"

function bodyCells(html: string) {
  return [
    ...html.matchAll(
      /<td style="padding: 0 0 (?:12|28)px 0; [^"]*">(.*?)<\/td>/g
    ),
  ].map((m) => m[1])
}

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;"
    )
  })
})

describe("renderStatusUpdate", () => {
  it("fills variables in the subject and body", () => {
    const email = renderStatusUpdate(
      {
        subject: "Update: {{ event_name }}",
        body: "Hi {{name}},\n\nSee you {{event_dates}} as a {{role}}.",
      },
      values,
      url
    )
    expect(email.subject).toBe("Update: Patriot HackFest 2026")
    expect(bodyCells(email.html)).toEqual([
      "Hi Ada,",
      "See you Nov 14–15, 2026 as a participant.",
    ])
  })

  it("splits paragraphs on blank lines and breaks single newlines", () => {
    const email = renderStatusUpdate(
      { subject: "s", body: "\n\nOne\r\ntwo\n  \n\n\nThree\n\n" },
      values,
      url
    )
    expect(bodyCells(email.html)).toEqual(["One<br>two", "Three"])
    expect(email.html).toContain('<td style="padding: 0 0 12px 0; ')
    expect(email.html).toContain('<td style="padding: 0 0 28px 0; ')
    expect(email.text.startsWith("One\ntwo\n\nThree\n\n")).toBe(true)
  })

  it("escapes template text and variable values", () => {
    const email = renderStatusUpdate(
      { subject: "s", body: "<b>Hi</b> {{name}} & co" },
      { ...values, name: `<script>alert("x")</script>` },
      url
    )
    expect(bodyCells(email.html)).toEqual([
      "&lt;b&gt;Hi&lt;/b&gt; &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co",
    ])
    expect(email.html).not.toContain("<script>")
    expect(email.text).toContain(`<script>alert("x")</script>`)
  })

  it("does not re-expand variables inside values", () => {
    const email = renderStatusUpdate(
      { subject: "{{name}}", body: "{{name}}" },
      { ...values, name: "{{event_name}}" },
      url
    )
    expect(email.subject).toBe("{{event_name}}")
    expect(bodyCells(email.html)).toEqual(["{{event_name}}"])
  })

  it("converts http, https, and mailto links", () => {
    const { html } = renderStatusUpdate(
      {
        subject: "s",
        body: "[Site](https://a.test/x) [Old](http://b.test) [Mail](mailto:hi@c.test)",
      },
      values,
      url
    )
    const style = 'style="color: #3A4A2B; text-decoration: underline;"'
    expect(bodyCells(html)).toEqual([
      `<a href="https://a.test/x" ${style}>Site</a> <a href="http://b.test" ${style}>Old</a> <a href="mailto:hi@c.test" ${style}>Mail</a>`,
    ])
  })

  it("leaves disallowed schemes and malformed links literal", () => {
    const { html } = renderStatusUpdate(
      {
        subject: "s",
        body: "[x](javascript:alert(1)) [y](ftp://z.test) [w](https://a b)",
      },
      values,
      url
    )
    expect(bodyCells(html)).toEqual([
      "[x](javascript:alert(1)) [y](ftp://z.test) [w](https://a b)",
    ])
  })

  it("escapes link text and URLs", () => {
    const { html } = renderStatusUpdate(
      {
        subject: "s",
        body: `[<b>"Hi"</b>](https://a.test/?q=1&r="x"><script>)`,
      },
      values,
      url
    )
    expect(bodyCells(html)).toEqual([
      `<a href="https://a.test/?q=1&amp;r=&quot;x&quot;&gt;&lt;script&gt;" style="color: #3A4A2B; text-decoration: underline;">&lt;b&gt;&quot;Hi&quot;&lt;/b&gt;</a>`,
    ])
  })

  it("keeps query strings with ampersands escaped once", () => {
    const { html } = renderStatusUpdate(
      { subject: "s", body: "[Go](https://a.test/?a=1&b=2)" },
      values,
      url
    )
    expect(bodyCells(html)[0]).toContain('href="https://a.test/?a=1&amp;b=2"')
  })

  it("fills variables in link text but not links inside values", () => {
    const { html } = renderStatusUpdate(
      { subject: "s", body: "[Hi {{name}}](https://a.test) {{role}}" },
      { ...values, name: "<Ada>", role: "[x](https://evil.test)" },
      url
    )
    expect(bodyCells(html)).toEqual([
      '<a href="https://a.test" style="color: #3A4A2B; text-decoration: underline;">Hi &lt;Ada&gt;</a> [x](https://evil.test)',
    ])
  })

  it("renders links as text followed by the URL in the text part", () => {
    const { text } = renderStatusUpdate(
      {
        subject: "s",
        body: "[Site](https://a.test/?a=1&b=2) and [Mail](mailto:hi@c.test) [x](javascript:y)",
      },
      values,
      url
    )
    expect(text).toContain(
      "Site (https://a.test/?a=1&b=2) and Mail (mailto:hi@c.test) [x](javascript:y)\n"
    )
  })

  it("throws on unknown or missing variables", () => {
    expect(() =>
      renderStatusUpdate(
        { subject: "s", body: "{{dashboard_url}}" },
        values,
        url
      )
    ).toThrow("Unknown variable {{dashboard_url}}")
    expect(() =>
      renderStatusUpdate(
        { subject: "{{event_dates}}", body: "b" },
        { ...values, event_dates: null },
        url
      )
    ).toThrow("No value for {{event_dates}}")
  })

  it("links the button to the escaped dashboard URL", () => {
    const { html } = renderStatusUpdate(
      { subject: "s", body: "b" },
      values,
      "https://x.test/?a=1&b=2"
    )
    expect(html).toMatch(/^<!DOCTYPE html>/)
    expect(html.match(/href="https:\/\/x\.test\/\?a=1&amp;b=2"/g)).toHaveLength(
      2
    )
    expect(html).toContain("View my status")
  })

  it("adds the dashboard URL and sign-off to the text part", () => {
    const { text } = renderStatusUpdate(
      { subject: "s", body: "Hi {{name}}," },
      values,
      url
    )
    expect(text).toContain(
      "Hi Ada,\n\nView my status: https://app.patriothackfest.com\n"
    )
    expect(text).toContain("— The Patriot HackFest Team")
  })
})

describe("validateTemplate", () => {
  it("accepts a valid template", () => {
    expect(
      validateTemplate({ subject: "Hi {{name}}", body: "{{event_name}}" })
    ).toEqual([])
  })

  it("lists unknown variables once each", () => {
    expect(
      unknownVariables({
        subject: "{{first_name}}",
        body: "{{ first_name }} {{Event}} {{name}} {{}}",
      })
    ).toEqual(["first_name", "Event", ""])
    expect(
      validateTemplate({ subject: "{{first_name}}", body: "{{dashboard_url}}" })
    ).toEqual(["Unknown variables: {{first_name}}, {{dashboard_url}}."])
  })

  it("rejects blank, long, and multi-line subjects and bodies", () => {
    expect(validateTemplate({ subject: " \t", body: "\n \n" })).toEqual([
      "Subject is required.",
      "Body is required.",
    ])
    expect(
      validateTemplate({ subject: "a".repeat(201), body: "b".repeat(10001) })
    ).toEqual([
      "Subject must be at most 200 characters.",
      "Body must be at most 10000 characters.",
    ])
    expect(validateTemplate({ subject: "a\nb", body: "b" })).toEqual([
      "Subject must be a single line.",
    ])
  })
})

describe("usedVariables", () => {
  it("lists each variable once in order of use", () => {
    expect(
      usedVariables({
        subject: "{{ event_dates }} {{name}}",
        body: "{{name}} {{bogus}}",
      })
    ).toEqual(["event_dates", "name", "bogus"])
  })
})
