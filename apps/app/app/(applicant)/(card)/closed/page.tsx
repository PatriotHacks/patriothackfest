import { AuthCard } from "@workspace/ui/components/auth-card"

import { SignOutLink } from "@/components/auth/sign-out-link"

export default function ClosedPage() {
  return (
    <AuthCard
      title="Applications closed"
      description="No applications are open right now. Check back soon."
    >
      <SignOutLink />
    </AuthCard>
  )
}
