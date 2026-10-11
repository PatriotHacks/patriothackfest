export type Decision = "accepted" | "waitlisted" | "rejected"
export type ApplicantRole = "participant" | "volunteer" | "judge"

export type DecisionEmailInput = {
  decision: Decision
  previousDecision?: Decision | "pending" | null
  name: string | null
  eventName: string
  role: ApplicantRole
  portalUrl: string
}

export type RenderedEmail = { subject: string; text: string; html: string }

const ORGANIZER = "Patriot HackFest"

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function content({
  decision,
  previousDecision,
  eventName,
  role,
}: DecisionEmailInput) {
  const fromWaitlist = previousDecision === "waitlisted"
  switch (decision) {
    case "accepted":
      return {
        subject: fromWaitlist
          ? `A spot opened up at ${eventName}`
          : `You're in: ${eventName}`,
        paragraphs: [
          fromWaitlist
            ? `Good news: a spot opened up, and you've been moved off the waitlist. You're now accepted as a ${role} for ${eventName}.`
            : `Congratulations! You've been accepted as a ${role} for ${eventName}.`,
          "Event details and updates will be posted in the applicant portal.",
          "If you can no longer attend, please decline your spot in the portal so we can offer it to someone on the waitlist.",
        ],
        signOff: "See you soon,",
      }
    case "waitlisted":
      return {
        subject: `You're on the waitlist for ${eventName}`,
        paragraphs: [
          `Thanks for applying to be a ${role} at ${eventName}. We received more applications than we have spots, so you're on our waitlist for now.`,
          "If a spot opens up, we'll email you right away.",
          "If your plans change, you can leave the waitlist in the applicant portal.",
        ],
        signOff: "Thanks for your patience,",
      }
    case "rejected":
      return {
        subject: `Your ${eventName} application`,
        paragraphs: [
          fromWaitlist
            ? `Thank you for your patience while on the waitlist for ${eventName}. Unfortunately, we aren't able to offer you a spot as a ${role} this time.`
            : `Thank you for applying to be a ${role} at ${eventName}. We received many strong applications, and unfortunately we aren't able to offer you a spot this time.`,
          `We truly appreciate your interest and hope you'll apply to a future ${ORGANIZER} event.`,
        ],
        signOff: "Best,",
      }
  }
}

export function decisionEmail(input: DecisionEmailInput): RenderedEmail {
  const { subject, paragraphs, signOff } = content(input)
  const greeting = input.name ? `Hi ${input.name},` : "Hi there,"
  const team = `The ${ORGANIZER} team`

  const text = [
    greeting,
    ...paragraphs,
    `Applicant portal: ${input.portalUrl}`,
    `${signOff}\n${team}`,
  ].join("\n\n")

  const p = (body: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#1f2937">${body}</p>`
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border-radius:8px">
${[greeting, ...paragraphs].map((s) => p(escapeHtml(s))).join("\n")}
<p style="margin:24px 0"><a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;padding:12px 20px;background:#006633;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px">Open the applicant portal</a></p>
${p(`${escapeHtml(signOff)}<br>${escapeHtml(team)}`)}
</div>
</body>
</html>`

  return { subject, text, html }
}
