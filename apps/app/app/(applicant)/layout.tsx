import { getApplicant } from "@/lib/applicant"

export default async function ApplicantLayout({ children }: LayoutProps<"/">) {
  await getApplicant()
  return children
}
