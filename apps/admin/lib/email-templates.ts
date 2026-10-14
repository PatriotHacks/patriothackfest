import type {
  TemplateValues,
  TemplateVariable,
} from "@workspace/email/templates"

export const VARIABLE_INFO: Record<TemplateVariable, string> = {
  name: 'Applicant\'s full name, or "there" if they have not set one',
  event_name: "Event name",
  event_dates:
    "Event dates, like Nov 14–15, 2026. Sending fails if the event has no start date.",
  role: "Role applied for: participant, volunteer, or judge",
}

export const SAMPLE_VALUES: TemplateValues = {
  name: "Ada Lovelace",
  event_name: "Patriot HackFest 2026",
  event_dates: "Nov 14–15, 2026",
  role: "participant",
}

export const SAMPLE_DASHBOARD_URL = "https://example.com"
