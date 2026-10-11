import { OtpLoginForm } from "@/components/otp-login-form"

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Patriot HackFest Applications</h1>
      {error === "session" && (
        <p className="text-sm text-destructive">
          Your session has ended. Please sign in again with an email code.
        </p>
      )}
      <OtpLoginForm />
    </main>
  )
}
