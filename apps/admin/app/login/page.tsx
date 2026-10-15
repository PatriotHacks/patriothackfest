import { AuthCard } from "@workspace/ui/components/auth-card"

import { FormError } from "@/components/form-error"
import { GoogleSignInButton } from "@/components/google-sign-in-button"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-svh items-center justify-center bg-white p-4 sm:p-6">
      <AuthCard
        title="Admin sign in"
        description="Sign in with the Google account on the admin list."
      >
        <div className="flex flex-col gap-3">
          {error && <FormError>Sign in failed. Please try again.</FormError>}
          <GoogleSignInButton />
        </div>
      </AuthCard>
    </main>
  )
}
