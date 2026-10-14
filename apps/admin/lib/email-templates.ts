import type {
  BroadcastValues,
  BroadcastVariable,
} from "@workspace/email/broadcast"
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

export const BROADCAST_SAMPLE_VALUES: BroadcastValues = {
  name: SAMPLE_VALUES.name,
  event_name: SAMPLE_VALUES.event_name,
  event_dates: SAMPLE_VALUES.event_dates,
}

export const BROADCAST_VARIABLE_INFO: Record<BroadcastVariable, string> = {
  name: VARIABLE_INFO.name,
  event_name: VARIABLE_INFO.event_name,
  event_dates: VARIABLE_INFO.event_dates,
}
