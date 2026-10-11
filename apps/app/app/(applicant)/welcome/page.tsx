import { redirect } from "next/navigation"

import { NameForm } from "@/components/name-form"
import { getFullName } from "@/lib/applicant"

export default async function WelcomePage() {
  if (await getFullName()) redirect("/")

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 pt-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Your name</h1>
        <p className="text-sm text-muted-foreground">
          Enter your full name as you want organizers to see it.
        </p>
      </div>
      <NameForm />
    </div>
  )
}
