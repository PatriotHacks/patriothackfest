import { readFileSync } from "node:fs"

const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF } = process.env
if (!SUPABASE_ACCESS_TOKEN || !SUPABASE_PROJECT_REF) {
  throw new Error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env")
}

const config = readFileSync("supabase/config.toml", "utf8")

function template(type) {
  const match = config.match(
    new RegExp(
      `^\\[auth\\.email\\.template\\.${type}\\]\\nsubject = "(.*)"\\ncontent_path = "(.*)"$`,
      "m"
    )
  )
  if (!match) throw new Error(`Missing [auth.email.template.${type}]`)
  return { subject: match[1], content: readFileSync(match[2], "utf8") }
}

const confirmation = template("confirmation")
const magicLink = template("magic_link")

const response = await fetch(
  `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`,
  {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mailer_subjects_confirmation: confirmation.subject,
      mailer_templates_confirmation_content: confirmation.content,
      mailer_subjects_magic_link: magicLink.subject,
      mailer_templates_magic_link_content: magicLink.content,
    }),
  }
)
if (!response.ok) {
  throw new Error(`${response.status} ${await response.text()}`)
}
console.log(`Pushed auth email templates to ${SUPABASE_PROJECT_REF}`)
