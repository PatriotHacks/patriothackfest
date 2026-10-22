import {
  answersSchema,
  formatInZone,
  publishedSchemaSchema,
} from "@workspace/forms"
import { ROLES, roleLabel } from "@workspace/supabase/roles"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Pill } from "@workspace/ui/components/pill"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import Link from "next/link"
import { notFound } from "next/navigation"
import * as z from "zod"

import { AnswersView } from "@/components/answers-view"
import { DecisionBadge } from "@/components/decision-badge"
import { DecisionControl } from "@/components/decision-control"
import { RoleChangeDialog } from "@/components/role-change-dialog"
import { getAdmin } from "@/lib/admin"
import {
  applyFilters,
  filterEmbeds,
  filtersQuery,
  parseFilters,
  parsePage,
} from "@/lib/application-filters"
import { decisionBlockedReason } from "@/lib/decisions"
import { hasLevel } from "@/lib/levels"
import { DECISION_LABELS, STATUS_LABELS } from "@/lib/roles"

export default async function ApplicationPage({
  params,
  searchParams,
}: PageProps<"/applications/[id]">) {
  const { id } = await params
  if (!z.guid().safeParse(id).success) notFound()
  const query = await searchParams
  const filters = parseFilters(query)
  const listQuery = filtersQuery(filters, { page: String(parsePage(query)) })
  const { supabase, level } = await getAdmin()
  const isOrganizer = hasLevel(level, "organizer")

  const { data: application, error } = await supabase
    .from("applications")
    .select(
      "id, event_id, role, status, answers, created_at, submitted_at, withdrawn_at, declined_at, under_18, profiles(full_name, email, school, phone, date_of_birth), events(name, slug), forms(id, title, published_schema, decisions_released_at), application_decisions(decision, decided_at, profiles(email))"
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!application) notFound()

  const at = `"${application.created_at}"`
  const after = (op: "gt" | "lt") =>
    `created_at.${op}.${at},and(created_at.eq.${at},id.${op}.${id})`

  const [newer, older, archives, emails, eventForms] = await Promise.all([
    applyFilters(
      supabase.from("applications").select(filterEmbeds("id", filters)),
      filters
    )
      .or(after("gt"))
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    applyFilters(
      supabase.from("applications").select(filterEmbeds("id", filters)),
      filters
    )
      .or(after("lt"))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("application_archives")
      .select(
        "id, from_role, to_role, schema, answers, created_at, profiles!application_archives_changed_by_fkey(email)"
      )
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    isOrganizer
      ? supabase
          .from("email_log")
          .select(
            "id, decision, status, recipient, attempts, created_at, sent_at, error, email_broadcasts(subject)"
          )
          .eq("application_id", id)
          .order("created_at", { ascending: false })
      : null,
    isOrganizer
      ? supabase
          .from("forms")
          .select("role, status, submissions_close_at")
          .eq("event_id", application.event_id)
      : null,
  ])
  if (newer.error) throw new Error(newer.error.message)
  if (older.error) throw new Error(older.error.message)
  if (archives.error) throw new Error(archives.error.message)
  if (emails?.error) throw new Error(emails.error.message)
  if (eventForms?.error) throw new Error(eventForms.error.message)

  const form = application.forms
  const decision = application.application_decisions
  const schema = form.published_schema
    ? publishedSchemaSchema.parse(form.published_schema)
    : null
  const answers = answersSchema.parse(application.answers)

  const now = Date.now()
  const roleOptions = eventForms
    ? ROLES.map((role) => {
        const target = eventForms.data.find((f) => f.role === role)
        const reason =
          role === application.role
            ? "current role"
            : !target
              ? "no form"
              : target.status !== "published"
                ? "form not published"
                : target.submissions_close_at !== null &&
                    now >= Date.parse(target.submissions_close_at)
                  ? "form closed"
                  : null
        return { role, label: roleLabel(role, application.events.slug), reason }
      })
    : null
  const roleBlockedReason =
    application.status === "withdrawn"
      ? "Withdrawn applications cannot change role."
      : application.declined_at
        ? "Declined applications cannot change role."
        : null

  const timeline = [
    { label: "Started", at: application.created_at },
    ...archives.data.map((a) => ({
      label: `Role changed from ${roleLabel(a.from_role, application.events.slug)} to ${roleLabel(a.to_role, application.events.slug)}`,
      at: a.created_at,
    })),
    { label: "Submitted", at: application.submitted_at },
    { label: "Withdrawn", at: application.withdrawn_at },
    { label: "Declined the offer", at: application.declined_at },
    {
      label: decision
        ? `Decision set to ${DECISION_LABELS[decision.decision]}${decision.profiles ? ` by ${decision.profiles.email}` : ""}`
        : "",
      at: decision?.decided_at ?? null,
    },
    { label: "Decisions released", at: form.decisions_released_at },
  ]
    .filter((e): e is { label: string; at: string } => e.at !== null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <nav
        aria-label="Applications"
        className="flex flex-wrap items-center gap-2"
      >
        <Button asChild variant="ghost" size="sm">
          <Link href={`/applications${listQuery}`}>Back to list</Link>
        </Button>
        <div className="ml-auto flex gap-2">
          {newer.data && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/applications/${newer.data.id}${listQuery}`}>
                Previous
              </Link>
            </Button>
          )}
          {older.data && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/applications/${older.data.id}${listQuery}`}>
                Next
              </Link>
            </Button>
          )}
        </div>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {application.profiles.full_name ?? "No name"}
          </CardTitle>
          <CardDescription>
            {application.profiles.email} · {application.events.name} ·{" "}
            {roleLabel(application.role, application.events.slug)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            {(
              [
                ["School", application.profiles.school],
                ["Phone", application.profiles.phone],
                ["Date of birth", application.profiles.date_of_birth],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="flex items-center gap-2">
                  {value ?? "Not provided"}
                  {label === "Date of birth" && application.under_18 && (
                    <Pill tone="brick" size="sm">
                      Under 18
                    </Pill>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Pill tone="sage">{STATUS_LABELS[application.status]}</Pill>
            {application.declined_at && <Pill tone="outline">Declined</Pill>}
            <DecisionBadge decision={decision?.decision ?? null} />
            {form.decisions_released_at && <Pill tone="outline">Released</Pill>}
          </div>
          <ol className="flex flex-col gap-1 text-sm">
            {timeline.map((event) => (
              <li key={`${event.label}-${event.at}`} className="flex gap-3">
                <span className="w-52 shrink-0 text-muted-foreground">
                  {formatInZone(event.at)}
                </span>
                <span>{event.label}</span>
              </li>
            ))}
          </ol>
          <DecisionControl
            key={id}
            applicationId={id}
            decision={decision?.decision ?? null}
            blockedReason={decisionBlockedReason(
              {
                status: application.status,
                declined_at: application.declined_at,
                released: form.decisions_released_at !== null,
              },
              isOrganizer
            )}
          />
          {roleOptions && (
            <RoleChangeDialog
              applicationId={id}
              options={roleOptions}
              blockedReason={roleBlockedReason}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answers</CardTitle>
          <CardDescription>{form.title}</CardDescription>
        </CardHeader>
        <CardContent>
          {schema ? (
            <AnswersView applicationId={id} schema={schema} answers={answers} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This form has not been published.
            </p>
          )}
        </CardContent>
      </Card>

      {archives.data.map((archive) => (
        <Card key={archive.id}>
          <CardHeader>
            <CardTitle>
              Archived {roleLabel(archive.from_role, application.events.slug)}{" "}
              answers
            </CardTitle>
            <CardDescription>
              Moved to {roleLabel(archive.to_role, application.events.slug)} on{" "}
              {formatInZone(archive.created_at)}
              {archive.profiles && ` by ${archive.profiles.email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnswersView
              applicationId={id}
              schema={publishedSchemaSchema.parse(archive.schema)}
              answers={answersSchema.parse(archive.answers)}
            />
          </CardContent>
        </Card>
      ))}

      {emails && (
        <Card>
          <CardHeader>
            <CardTitle>Emails</CardTitle>
          </CardHeader>
          <CardContent>
            {emails.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No emails for this application.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Queued</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.data.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>{formatInZone(email.created_at)}</TableCell>
                      <TableCell className="whitespace-normal">
                        {email.decision
                          ? DECISION_LABELS[email.decision]
                          : `Broadcast: ${email.email_broadcasts?.subject}`}
                      </TableCell>
                      <TableCell>{email.status}</TableCell>
                      <TableCell>{email.recipient}</TableCell>
                      <TableCell>{email.attempts}</TableCell>
                      <TableCell>
                        {email.sent_at ? formatInZone(email.sent_at) : ""}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {email.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
