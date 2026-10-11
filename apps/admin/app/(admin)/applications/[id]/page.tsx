import { formatInZone, publishedSchemaSchema } from "@workspace/forms"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { getAdmin } from "@/lib/admin"
import {
  filteredApplications,
  filtersQuery,
  parseFilters,
  parsePage,
} from "@/lib/application-filters"
import { hasLevel } from "@/lib/levels"
import { DECISION_LABELS, ROLE_LABELS, STATUS_LABELS } from "@/lib/roles"

const answersSchema = z.record(z.string(), z.unknown())

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
      "id, role, status, answers, created_at, submitted_at, withdrawn_at, declined_at, profiles(full_name, email), events(name), forms(id, title, published_schema, decisions_released_at), application_decisions(decision, decided_at, profiles(email))"
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!application) notFound()

  const at = `"${application.created_at}"`
  const after = (op: "gt" | "lt") =>
    `created_at.${op}.${at},and(created_at.eq.${at},id.${op}.${id})`

  const [newer, older, archives, emails] = await Promise.all([
    filteredApplications(supabase, filters)
      .or(after("gt"))
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    filteredApplications(supabase, filters)
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
            "id, decision, status, recipient, attempts, created_at, sent_at, error"
          )
          .eq("application_id", id)
          .order("created_at", { ascending: false })
      : null,
  ])
  if (newer.error) throw new Error(newer.error.message)
  if (older.error) throw new Error(older.error.message)
  if (archives.error) throw new Error(archives.error.message)
  if (emails?.error) throw new Error(emails.error.message)

  const form = application.forms
  const decision = application.application_decisions
  const schema = form.published_schema
    ? publishedSchemaSchema.parse(form.published_schema)
    : null
  const answers = answersSchema.parse(application.answers)

  const timeline = [
    { label: "Started", at: application.created_at },
    ...archives.data.map((a) => ({
      label: `Role changed from ${ROLE_LABELS[a.from_role]} to ${ROLE_LABELS[a.to_role]}`,
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
            {ROLE_LABELS[application.role]}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {STATUS_LABELS[application.status]}
            </Badge>
            {application.declined_at && (
              <Badge variant="outline">Declined</Badge>
            )}
            <DecisionBadge decision={decision?.decision ?? null} />
            {form.decisions_released_at && (
              <Badge variant="outline">Released</Badge>
            )}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Answers</CardTitle>
          <CardDescription>{form.title}</CardDescription>
        </CardHeader>
        <CardContent>
          {schema ? (
            <AnswersView schema={schema} answers={answers} />
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
              Archived {ROLE_LABELS[archive.from_role]} answers
            </CardTitle>
            <CardDescription>
              Moved to {ROLE_LABELS[archive.to_role]} on{" "}
              {formatInZone(archive.created_at)}
              {archive.profiles && ` by ${archive.profiles.email}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnswersView
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
                No decision emails for this application.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Queued</TableHead>
                    <TableHead>Decision</TableHead>
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
                      <TableCell>{DECISION_LABELS[email.decision]}</TableCell>
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
