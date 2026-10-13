import type {
  TemplateKey,
  TemplateValues,
  TemplateVariable,
} from "@workspace/email/templates"

export const TEMPLATE_INFO: Record<
  TemplateKey,
  { title: string; description: string }
> = {
  accepted: {
    title: "Accepted",
    description: "First decision email for accepted applicants.",
  },
  accepted_from_waitlisted: {
    title: "Accepted from the waitlist",
    description: "Sent when a waitlisted applicant is accepted.",
  },
  accepted_from_rejected: {
    title: "Changed to accepted",
    description: "Sent when a not accepted applicant is accepted.",
  },
  waitlisted: {
    title: "Waitlisted",
    description: "First decision email for waitlisted applicants.",
  },
  waitlisted_from_accepted: {
    title: "Changed from accepted to waitlisted",
    description: "Sent when an accepted applicant is moved to the waitlist.",
  },
  waitlisted_from_rejected: {
    title: "Changed from not accepted to waitlisted",
    description: "Sent when a not accepted applicant is moved to the waitlist.",
  },
  rejected: {
    title: "Not accepted",
    description: "First decision email for applicants who were not accepted.",
  },
  rejected_from_accepted: {
    title: "Changed from accepted to not accepted",
    description: "Sent when an accepted applicant is no longer accepted.",
  },
  rejected_from_waitlisted: {
    title: "Not accepted from the waitlist",
    description: "Sent when a waitlisted applicant is not accepted.",
  },
}

export const VARIABLE_INFO: Record<TemplateVariable, string> = {
  name: 'Applicant\'s full name, or "there" if they have not set one',
  event_name: "Event name",
  event_dates:
    "Event dates, like Nov 14–15, 2026. Sending fails if the event has no start date.",
  role: "Role applied for: participant, volunteer, or judge",
  dashboard_url: "Applicant portal URL",
}

export const SAMPLE_VALUES: TemplateValues = {
  name: "Ada Lovelace",
  event_name: "Patriot HackFest 2026",
  event_dates: "Nov 14–15, 2026",
  role: "participant",
  dashboard_url: "https://example.com",
}
