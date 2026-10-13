import { redirect } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { NameForm } from "@/components/name-form"
import { getFullName } from "@/lib/applicant"

export default async function WelcomePage() {
  if (await getFullName()) redirect("/")

  return (
    <div className="flex justify-center sm:pt-6">
      <AuthCard
        title="Your name"
        description="Enter your full name as you want organizers to see it."
      >
        <NameForm />
      </AuthCard>
    </div>
  )
}
