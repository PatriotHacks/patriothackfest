import { describe, expect, it } from "vitest"

import {
  escapeHtml,
  renderTemplate,
  templateKey,
  unknownVariables,
  validateTemplate,
  type TemplateValues,
} from "./templates"

const values: TemplateValues = {
  name: "Ada",
  event_name: "Patriot HackFest 2026",
  event_dates: "Nov 14–15, 2026",
  role: "participant",
  dashboard_url: "https://app.patriothackfest.com",
}

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;"
    )
  })
})

describe("templateKey", () => {
  it("uses the decision alone without a different previous decision", () => {
    for (const previous of [null, undefined, "pending"] as const) {
      expect(templateKey("accepted", previous)).toBe("accepted")
      expect(templateKey("waitlisted", previous)).toBe("waitlisted")
      expect(templateKey("rejected", previous)).toBe("rejected")
    }
    expect(templateKey("waitlisted", "waitlisted")).toBe("waitlisted")
  })

  it("selects the change variant for a different previous decision", () => {
    expect(templateKey("accepted", "waitlisted")).toBe(
      "accepted_from_waitlisted"
    )
    expect(templateKey("accepted", "rejected")).toBe("accepted_from_rejected")
    expect(templateKey("waitlisted", "accepted")).toBe(
      "waitlisted_from_accepted"
    )
    expect(templateKey("waitlisted", "rejected")).toBe(
      "waitlisted_from_rejected"
    )
    expect(templateKey("rejected", "accepted")).toBe("rejected_from_accepted")
    expect(templateKey("rejected", "waitlisted")).toBe(
      "rejected_from_waitlisted"
    )
  })
})

describe("renderTemplate", () => {
  it("fills variables in the subject and body", () => {
    const email = renderTemplate(
      {
        subject: "You're in: {{ event_name }}",
        body: "Hi {{name}},\n\nSee you {{event_dates}} as a {{role}}.",
      },
      values
    )
    expect(email.subject).toBe("You're in: Patriot HackFest 2026")
    expect(email.text).toBe(
      "Hi Ada,\n\nSee you Nov 14–15, 2026 as a participant."
    )
  })

  it("splits paragraphs on blank lines and breaks single newlines", () => {
    const email = renderTemplate(
      { subject: "s", body: "\n\nOne\r\ntwo\n  \n\n\nThree\n\n" },
      values
    )
    expect(email.text).toBe("One\ntwo\n\nThree")
    const paragraphs = [...email.html.matchAll(/<p [^>]*>(.*?)<\/p>/g)].map(
      (m) => m[1]
    )
    expect(paragraphs).toEqual(["One<br>two", "Three"])
  })

  it("escapes template text and variable values", () => {
    const email = renderTemplate(
      { subject: "s", body: "<b>Hi</b> {{name}} & co" },
      { ...values, name: `<script>alert("x")</script>` }
    )
    expect(email.html).toContain(
      "&lt;b&gt;Hi&lt;/b&gt; &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co"
    )
    expect(email.html).not.toContain("<script>")
    expect(email.text).toContain(`<script>alert("x")</script>`)
  })

  it("autolinks URLs without trailing punctuation", () => {
    const email = renderTemplate(
      {
        subject: "s",
        body: "Portal: {{dashboard_url}}. Docs (https://x.test/a?b=1&c=2), ok",
      },
      values
    )
    expect(email.html).toContain(
      '<a href="https://app.patriothackfest.com" style="color:#006633">https://app.patriothackfest.com</a>.'
    )
    expect(email.html).toContain(
      '(<a href="https://x.test/a?b=1&amp;c=2" style="color:#006633">https://x.test/a?b=1&amp;c=2</a>), ok'
    )
  })

  it("does not link URLs in applicant names", () => {
    const email = renderTemplate(
      { subject: "s", body: "Hi {{name}}," },
      { ...values, name: "https://evil.test" }
    )
    expect(email.html).toContain("Hi https://evil.test,")
    expect(email.html).not.toContain("<a ")
  })

  it("does not re-expand variables inside values", () => {
    const email = renderTemplate(
      { subject: "{{name}}", body: "{{name}}" },
      { ...values, name: "{{event_name}}" }
    )
    expect(email.subject).toBe("{{event_name}}")
    expect(email.text).toBe("{{event_name}}")
  })

  it("throws on unknown or missing variables", () => {
    expect(() =>
      renderTemplate({ subject: "s", body: "{{nope}}" }, values)
    ).toThrow("Unknown variable {{nope}}")
    expect(() =>
      renderTemplate(
        { subject: "{{event_dates}}", body: "b" },
        { ...values, event_dates: null }
      )
    ).toThrow("No value for {{event_dates}}")
  })

  it("wraps the body in the branded layout", () => {
    const { html } = renderTemplate({ subject: "s", body: "Hello" }, values)
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain("background:#f3f4f6")
    expect(html).toContain("max-width:560px")
  })
})

describe("validateTemplate", () => {
  it("accepts a valid template", () => {
    expect(
      validateTemplate({ subject: "Hi {{name}}", body: "{{dashboard_url}}" })
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
      validateTemplate({ subject: "{{first_name}}", body: "{{portal}}" })
    ).toEqual(["Unknown variables: {{first_name}}, {{portal}}."])
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
