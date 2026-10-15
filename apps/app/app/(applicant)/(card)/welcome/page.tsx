import { AuthCard } from "@workspace/ui/components/auth-card"
import { redirect } from "next/navigation"

import { SignOutLink } from "@/components/auth/sign-out-link"
import { NameForm } from "@/components/name-form"
import { getFullName } from "@/lib/applicant"

export default async function WelcomePage() {
  if (await getFullName()) redirect("/start")

  return (
    <AuthCard
      title="Your name"
      description="Enter your full name as you want organizers to see it."
    >
      <NameForm />
      <SignOutLink />
    </AuthCard>
  )
}
