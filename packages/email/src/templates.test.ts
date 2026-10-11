import { describe, expect, it } from "vitest"

import { decisionEmail, escapeHtml, type DecisionEmailInput } from "./templates"

const base: DecisionEmailInput = {
  decision: "accepted",
  name: "Ada",
  eventName: "Patriot HackFest 2026",
  role: "participant",
  portalUrl: "https://app.patriothackfest.com",
}

describe("escapeHtml", () => {
  it("escapes markup characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;"
    )
  })
})

describe("decisionEmail", () => {
  it("congratulates accepted applicants and mentions declining", () => {
    const email = decisionEmail(base)
    expect(email.subject).toBe("You're in: Patriot HackFest 2026")
    expect(email.text).toContain("Hi Ada,")
    expect(email.text).toContain(
      "accepted as a participant for Patriot HackFest 2026"
    )
    expect(email.text).toContain("decline your spot in the portal")
    expect(email.text).toContain(
      "Applicant portal: https://app.patriothackfest.com"
    )
    expect(email.text).toContain("The Patriot HackFest team")
    expect(email.text).not.toContain("spot opened up")
    expect(email.html).toContain('href="https://app.patriothackfest.com"')
    expect(email.html).toContain("decline your spot in the portal")
  })

  it("says a spot opened up when promoted from the waitlist", () => {
    const email = decisionEmail({ ...base, previousDecision: "waitlisted" })
    expect(email.subject).toBe("A spot opened up at Patriot HackFest 2026")
    expect(email.text).toContain("a spot opened up")
    expect(email.text).toContain("moved off the waitlist")
    expect(email.text).not.toContain("Congratulations")
  })

  it("uses fresh wording without a previous final decision", () => {
    for (const previousDecision of ["pending", null, undefined] as const) {
      const email = decisionEmail({ ...base, previousDecision })
      expect(email.subject).toBe("You're in: Patriot HackFest 2026")
      expect(email.text).not.toContain("spot opened up")
    }
  })

  it("tells waitlisted applicants they can leave the waitlist", () => {
    const email = decisionEmail({
      ...base,
      decision: "waitlisted",
      role: "volunteer",
    })
    expect(email.subject).toBe(
      "You're on the waitlist for Patriot HackFest 2026"
    )
    expect(email.text).toContain("be a volunteer at Patriot HackFest 2026")
    expect(email.text).toContain("leave the waitlist in the applicant portal")
  })

  it("words rejections gently", () => {
    const email = decisionEmail({
      ...base,
      decision: "rejected",
      role: "judge",
    })
    expect(email.subject).toBe("Your Patriot HackFest 2026 application")
    expect(email.text).toContain("Thank you for applying to be a judge")
    expect(email.text).toContain("aren't able to offer you a spot")
    expect(email.text).toContain("hope you'll apply to a future")
    expect(email.text).not.toMatch(/reject/i)
    expect(email.html).not.toMatch(/reject/i)
  })

  it("words waitlisted to rejected as an update that thanks their patience", () => {
    const email = decisionEmail({
      ...base,
      decision: "rejected",
      previousDecision: "waitlisted",
    })
    expect(email.subject).toBe(
      "Update on your Patriot HackFest 2026 application"
    )
    expect(email.text).toContain("We have an update on your application")
    expect(email.text).toContain("patience while on the waitlist")
    expect(email.text).toContain("aren't able to offer you a spot")
    expect(email.text).not.toMatch(/reject/i)
  })

  it("words rejected to accepted as an update", () => {
    const email = decisionEmail({ ...base, previousDecision: "rejected" })
    expect(email.subject).toBe(
      "Update on your Patriot HackFest 2026 application"
    )
    expect(email.text).toContain("We have an update on your application")
    expect(email.text).toContain("you've been accepted")
    expect(email.text).toContain("decline your spot in the portal")
    expect(email.text).not.toContain("Congratulations")
    expect(email.text).not.toContain("spot opened up")
  })

  it("words accepted to waitlisted as an update with an apology", () => {
    const email = decisionEmail({
      ...base,
      decision: "waitlisted",
      previousDecision: "accepted",
    })
    expect(email.subject).toBe(
      "Update on your Patriot HackFest 2026 application"
    )
    expect(email.text).toContain("earlier acceptance has changed")
    expect(email.text).toContain("now on our waitlist instead")
    expect(email.text).toContain("apologize for any confusion")
    expect(email.text).not.toContain("Thanks for applying")
  })

  it("words rejected to waitlisted as an update", () => {
    const email = decisionEmail({
      ...base,
      decision: "waitlisted",
      previousDecision: "rejected",
    })
    expect(email.subject).toBe(
      "Update on your Patriot HackFest 2026 application"
    )
    expect(email.text).toContain("We took another look")
    expect(email.text).toContain("now on our waitlist")
    expect(email.text).not.toContain("earlier acceptance")
    expect(email.text).not.toMatch(/reject/i)
  })

  it("words accepted to rejected as an update with an apology", () => {
    const email = decisionEmail({
      ...base,
      decision: "rejected",
      previousDecision: "accepted",
    })
    expect(email.subject).toBe(
      "Update on your Patriot HackFest 2026 application"
    )
    expect(email.text).toContain("earlier acceptance has changed")
    expect(email.text).toContain("aren't able to offer you a spot")
    expect(email.text).toContain("apologize for any confusion")
    expect(email.html).toContain("We&#39;re sorry to share")
    expect(email.text).not.toMatch(/reject/i)
  })

  it("uses first-time wording when the previous decision is the same", () => {
    for (const decision of ["accepted", "waitlisted", "rejected"] as const) {
      const email = decisionEmail({
        ...base,
        decision,
        previousDecision: decision,
      })
      expect(email.subject).not.toContain("Update")
      expect(email.text).not.toContain("We have an update")
    }
  })

  it("greets applicants without a name", () => {
    expect(decisionEmail({ ...base, name: null }).text).toMatch(/^Hi there,/)
  })

  it("escapes interpolated values in HTML only", () => {
    const email = decisionEmail({
      ...base,
      name: `<script>alert("x")</script>`,
      eventName: "Hack & Learn",
      portalUrl: `https://example.com/?a=1&b="><img src=x>`,
    })
    expect(email.html).not.toContain("<script>")
    expect(email.html).not.toContain("<img")
    expect(email.html).toContain(
      "Hi &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;,"
    )
    expect(email.html).toContain("Hack &amp; Learn")
    expect(email.html).toContain(
      'href="https://example.com/?a=1&amp;b=&quot;&gt;&lt;img src=x&gt;"'
    )
    expect(email.text).toContain(`Hi <script>alert("x")</script>,`)
    expect(email.subject).toBe("You're in: Hack & Learn")
  })

  it("renders self-contained HTML without external assets", () => {
    for (const decision of ["accepted", "waitlisted", "rejected"] as const) {
      const { html } = decisionEmail({ ...base, decision })
      expect(html).not.toMatch(/<(img|link|script)\b/)
      expect(html).not.toContain("<style")
      expect(html).toMatch(/^<!doctype html>/)
    }
  })
})
