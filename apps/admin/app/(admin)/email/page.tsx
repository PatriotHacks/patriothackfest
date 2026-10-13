import { TEMPLATE_KEYS, type TemplateKey } from "@workspace/email/templates"
import { formatInZone } from "@workspace/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import Link from "next/link"
import { redirect } from "next/navigation"

import { getAdmin } from "@/lib/admin"
import { TEMPLATE_INFO } from "@/lib/email-templates"
import { hasLevel } from "@/lib/levels"

export default async function EmailTemplatesPage() {
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")

  const { data, error } = await supabase
    .from("email_templates")
    .select("key, subject, updated_at")
  if (error) throw new Error(error.message)

  const order = (key: string) => TEMPLATE_KEYS.indexOf(key as TemplateKey)
  const templates = data.sort((a, b) => order(a.key) - order(b.key))

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Email</h1>
        <p className="text-muted-foreground">
          Decision email templates. Edits apply to every email sent afterward,
          including emails already queued.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Decision templates</CardTitle>
          <CardDescription>
            The template is chosen from the new decision and the decision the
            applicant was last emailed about.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {templates.map((t) => {
              const info = TEMPLATE_INFO[t.key as TemplateKey]
              return (
                <li key={t.key}>
                  <Link
                    href={`/email/${t.key}`}
                    className="group flex flex-col gap-1 py-3"
                  >
                    <span className="font-medium group-hover:underline">
                      {info.title}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {info.description}
                    </span>
                    <span className="text-sm">Subject: {t.subject}</span>
                    <span className="text-xs text-muted-foreground">
                      Updated {formatInZone(t.updated_at)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
