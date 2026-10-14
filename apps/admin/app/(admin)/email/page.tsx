import { redirect } from "next/navigation"

import { EmailTemplateEditor } from "@/components/email-template-editor"
import { getAdmin } from "@/lib/admin"
import { EMAIL_NOT_CONFIGURED, isEmailConfigured } from "@/lib/email"
import { hasLevel } from "@/lib/levels"

export default async function EmailPage() {
  const { supabase, level, email } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")

  const { data, error } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("key", "status_update")
    .single()
  if (error) throw new Error(error.message)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Email</h1>
        <p className="text-muted-foreground">
          The status update email sent when decisions are released. Edits apply
          to every email sent afterward, including emails already queued.
        </p>
      </div>
      <EmailTemplateEditor
        initialSubject={data.subject}
        initialBody={data.body}
        adminEmail={email}
        emailDisabledReason={isEmailConfigured() ? null : EMAIL_NOT_CONFIGURED}
      />
    </div>
  )
}
