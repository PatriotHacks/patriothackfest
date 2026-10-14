import { brandedHtml, brandedText, type Cta } from "./layout"

const SIGNOFF = "Thanks for applying to Patriot HackFest!"

function cta(dashboardUrl: string): Cta {
  return {
    url: dashboardUrl,
    label: "View my status",
    note: "You'll sign in with a one-time code sent to this email.",
  }
}

export function statusUpdateHtml(paragraphs: string[], dashboardUrl: string) {
  return brandedHtml({
    preheader: "There's an update on your Patriot HackFest application",
    eyebrow: "STATUS UPDATE",
    heading: "Your application has an update",
    paragraphs,
    cta: cta(dashboardUrl),
    signoff: SIGNOFF,
  })
}

export function statusUpdateText(body: string, dashboardUrl: string) {
  return brandedText({ body, cta: cta(dashboardUrl), signoff: SIGNOFF })
}
