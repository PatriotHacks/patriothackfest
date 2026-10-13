import { TEMPLATE_KEYS } from "@workspace/email/templates"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import * as z from "zod"

import { EmailTemplateEditor } from "@/components/email-template-editor"
import { getAdmin } from "@/lib/admin"
import { EMAIL_NOT_CONFIGURED, isEmailConfigured } from "@/lib/email"
import { TEMPLATE_INFO } from "@/lib/email-templates"
import { hasLevel } from "@/lib/levels"

export default async function EmailTemplatePage({
  params,
}: PageProps<"/email/[templateKey]">) {
  const { templateKey } = await params
  const key = z.enum(TEMPLATE_KEYS).safeParse(templateKey)
  if (!key.success) notFound()
  const { supabase, level, email } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")

  const { data, error } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("key", key.data)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) notFound()

  const info = TEMPLATE_INFO[key.data]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{info.title}</h1>
          <p className="text-muted-foreground">{info.description}</p>
        </div>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link href="/email">All templates</Link>
        </Button>
      </div>
      <EmailTemplateEditor
        templateKey={key.data}
        initialSubject={data.subject}
        initialBody={data.body}
        adminEmail={email}
        emailDisabledReason={isEmailConfigured() ? null : EMAIL_NOT_CONFIGURED}
      />
    </div>
  )
}
