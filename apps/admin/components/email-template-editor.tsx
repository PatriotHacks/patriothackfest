"use client"

import {
  BODY_MAX_LENGTH,
  renderStatusUpdate,
  SUBJECT_MAX_LENGTH,
  TEMPLATE_VARIABLES,
  validateTemplate,
} from "@workspace/email/templates"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import { saveEmailTemplate, sendTestEmail } from "@/app/(admin)/email/actions"
import { BodyField } from "@/components/body-field"
import {
  SAMPLE_DASHBOARD_URL,
  SAMPLE_VALUES,
  VARIABLE_INFO,
} from "@/lib/email-templates"

type Props = {
  initialSubject: string
  initialBody: string
  adminEmail: string
  emailDisabledReason: string | null
}

function preview(subject: string, body: string) {
  try {
    return {
      email: renderStatusUpdate(
        { subject, body },
        SAMPLE_VALUES,
        SAMPLE_DASHBOARD_URL
      ),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export function EmailTemplateEditor({
  initialSubject,
  initialBody,
  adminEmail,
  emailDisabledReason,
}: Props) {
  const id = useId()
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState(initialBody)
  const [saved, setSaved] = useState({
    subject: initialSubject,
    body: initialBody,
  })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [testing, startTest] = useTransition()

  const errors = validateTemplate({ subject, body })
  const rendered = errors.length === 0 ? preview(subject, body) : null
  const dirty = subject !== saved.subject || body !== saved.body

  function save() {
    setMessage(null)
    setError(null)
    startSave(async () => {
      const result = await saveEmailTemplate(subject, body)
      if (result.error) return setError(result.error)
      setSaved({ subject, body })
      setMessage("Template saved.")
    })
  }

  function sendTest() {
    setMessage(null)
    setError(null)
    startTest(async () => {
      const result = await sendTestEmail(subject, body)
      if (result.error) return setError(result.error)
      setMessage(`Test email sent to ${adminEmail}.`)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>
            Plain text. A blank line starts a new paragraph and a single line
            break stays a line break. The heading, status button, and sign-off
            are added automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-subject`}>Subject</Label>
            <Input
              id={`${id}-subject`}
              value={subject}
              maxLength={SUBJECT_MAX_LENGTH}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <BodyField
            id={`${id}-body`}
            value={body}
            onChange={setBody}
            maxLength={BODY_MAX_LENGTH}
            variables={TEMPLATE_VARIABLES}
            info={VARIABLE_INFO}
            className="min-h-80"
          />
          {errors.length > 0 && (
            <ul className="text-sm text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={save}
              disabled={saving || !dirty || errors.length > 0}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={sendTest}
              disabled={
                testing || errors.length > 0 || emailDisabledReason !== null
              }
            >
              {testing ? "Sending..." : "Send test to me"}
            </Button>
            {dirty && (
              <span className="text-sm text-muted-foreground">
                Unsaved changes
              </span>
            )}
          </div>
          {emailDisabledReason && (
            <p className="text-sm text-muted-foreground">
              {emailDisabledReason}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm">{message}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Rendered with sample data. Test emails use the real applicant portal
            URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rendered?.email ? (
            <>
              <p className="text-sm">
                <span className="text-muted-foreground">Subject: </span>
                {rendered.email.subject}
              </p>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={rendered.email.html}
                className="h-[600px] w-full rounded-lg border"
              />
            </>
          ) : (
            <p className="text-sm text-destructive">
              {rendered?.error ?? "Fix the errors to see a preview."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
