import { OtpLoginForm } from "@/components/otp-login-form"
import { projectReturnPath } from "@/lib/project-return-path"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, next } = await searchParams

  return (
    <main className="flex min-h-svh items-center justify-center bg-white p-4 sm:p-6">
      <OtpLoginForm
        sessionEnded={error === "session"}
        returnTo={projectReturnPath(next)}
      />
    </main>
  )
}
