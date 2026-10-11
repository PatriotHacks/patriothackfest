import { getApplicant } from "@/lib/applicant"

export default async function Page() {
  const { email } = await getApplicant()

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Applications</h1>
      <p className="text-muted-foreground">Signed in as {email}.</p>
    </div>
  )
}
