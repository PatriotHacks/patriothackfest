import { parsePhoneNumberFromString } from "libphonenumber-js"

import type { Profile } from "@/lib/basic-info"

import { FormSection, SectionHeading } from "./form-controls"

const dateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeZone: "UTC",
})

export function BasicInfoView({
  profile,
  email,
}: {
  profile: Profile
  email: string
}) {
  const rows = [
    ["Full name", profile.full_name],
    ["Email", email],
    ["School", profile.school],
    [
      "Phone number",
      profile.phone &&
        (parsePhoneNumberFromString(profile.phone)?.formatInternational() ??
          profile.phone),
    ],
    [
      "Date of birth",
      profile.date_of_birth &&
        dateFormat.format(new Date(`${profile.date_of_birth}T00:00:00Z`)),
    ],
  ] as const

  return (
    <FormSection muted aria-labelledby="basic-information">
      <SectionHeading id="basic-information" title="Basic Information" />
      <dl className="flex flex-col gap-[16px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-[4px]">
            <dt className="text-[15px] font-semibold">{label}</dt>
            <dd className="text-[15px]">{value || "Not provided"}</dd>
          </div>
        ))}
      </dl>
    </FormSection>
  )
}
