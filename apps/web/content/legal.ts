import { site } from "@/content/site"

export type LegalDetails = {
  legalName: string
  contactEmail: string
  privacyEmail: string
  governingLaw: string
  effectiveDate: string
  broadcastOptOut: string
  hostingProvider: string
}

export const legalDetails: LegalDetails = {
  legalName: "PatriotHacks",
  contactEmail: "hello@patriothackfest.com",
  privacyEmail: "hello@patriothackfest.com",
  governingLaw: "Virginia",
  effectiveDate: "2026-10-20",
  broadcastOptOut:
    "Reply to any announcement email, or email hello@patriothackfest.com, and we will stop sending announcement emails to that address.",
  hostingProvider: "Vercel",
}

export type LegalSection = {
  heading: string
  paragraphs?: string[]
  items?: string[]
}

export type LegalDocument = {
  title: string
  intro: string[]
  sections: LegalSection[]
}

const d = legalDetails

export const privacyPolicy: LegalDocument = {
  title: "Privacy Policy",
  intro: [
    `This policy explains what personal information ${site.name} collects through the website, the applicant portal, and the admin console, how we use it, who can see it, and the choices you have. Effective date: ${d.effectiveDate}.`,
  ],
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `${site.name} is operated by ${d.legalName}. We handle all correspondence by email.`,
        `For privacy questions or requests, email ${d.privacyEmail}. For general questions, email ${d.contactEmail}.`,
      ],
    },
    {
      heading: "Information we collect",
      items: [
        "Account details: your email address. Applicants sign in with a six-digit code sent to that address and do not have a password. Organizers and reviewers sign in with Google, and we receive the name on that Google account.",
        "Profile details you enter: your name, the school you enter or choose, your phone number, and your date of birth.",
        "Application answers: your answers to the questions on the form for the role you apply for. Organizers write these questions for each event. They can ask for free text, links, dates, choices, and PDF files of up to 10 MB each.",
        "Application status: whether you have submitted, withdrawn, or declined, any decision (accepted, waitlisted, or not accepted), and a history of role changes. When an organizer moves your application to another role, your earlier answers are kept in an archive.",
        "Email records: the emails we send you, the address they were sent to, and their delivery status.",
        "Technical data: session cookies that keep you signed in, and a cookie that remembers the sidebar state. Our hosting and database providers may keep server logs, which can include IP addresses and request times. Server logs are kept for 30 days.",
      ],
    },
    {
      heading: "How we use it",
      items: [
        "Create and secure your account.",
        "Show your application, save your drafts, and process your submission.",
        "Review applications, make decisions, and move applications between roles.",
        "Send decision emails and announcements about the event.",
        "Give event organizers exports of applications.",
        'Show organizers an "Under 18" flag on applications, based on your date of birth and the event start date.',
      ],
    },
    {
      heading: "Who can see your information",
      paragraphs: [
        "You can see your own profile, application, and status. Decisions appear to you only after organizers release them for your form.",
        "Staff can see applicant information based on their role:",
      ],
      items: [
        "Reviewers can view all applications, answers, uploaded files, profile details (name, email, school, phone number, and date of birth), and application history. They can set decisions until release.",
        "Organizers can also export applications, send decision and announcement emails, change decisions and roles, and view the email log.",
        "Owners can also manage who has staff access.",
      ],
    },
    {
      heading: "Sponsors and other sharing",
      paragraphs: [
        "The system does not send applicant information to sponsors.",
      ],
    },
    {
      heading: "Service providers",
      paragraphs: ["We use these providers to process information for us:"],
      items: [
        "Supabase, for the database, sign-in, and file storage.",
        "Google, for staff sign-in and for the Google Workspace email account that sends our email.",
        `${d.hostingProvider}, for hosting the website and applicant portal.`,
      ],
    },
    {
      heading: "Where information is stored",
      paragraphs: [
        "Our database and file storage are hosted by Supabase. Providers may process information in other countries.",
      ],
    },
    {
      heading: "Email",
      items: [
        "Decision emails tell you a decision is available and ask you to sign in to see it. They are sent after organizers release decisions, and again if a decision changes after release.",
        "Announcement emails are one-off messages that organizers send to submitted applicants for an event or role.",
        `How to opt out of announcement emails: ${d.broadcastOptOut}`,
      ],
    },
    {
      heading: "Cookies",
      paragraphs: [
        "The applicant portal and admin console use only the cookies needed to keep you signed in, plus a cookie that remembers the sidebar state. We do not currently use analytics or advertising cookies.",
      ],
    },
    {
      heading: "Storage and security",
      items: [
        "Uploaded files are stored in private storage. Only the applicant who uploaded a file and staff with reviewer access can open it, and staff open files through links that expire after 60 seconds.",
        "Row-level security in the database limits what each signed-in user can read and change.",
        "No system is completely secure. We will notify affected people of a breach as required by applicable law.",
      ],
    },
    {
      heading: "Retention",
      paragraphs: [
        "Accounts, profiles, applications, files, and email records are kept for two years after the event ends and then deleted. The system does not delete information automatically, so organizers delete these records manually at the end of that period.",
      ],
    },
    {
      heading: "Your choices",
      items: [
        "Profile details: you can change your name, school, phone number, and date of birth while you have a draft application. After you submit, they are locked until the event has ended.",
        "Withdrawal: you can withdraw until your decision is visible. Withdrawing is final and ends your application. It does not delete your information.",
        `Access, correction, deletion, and copies of your information: the applicant portal has no self-service delete or export. To ask for these, email ${d.privacyEmail}.`,
      ],
    },
    {
      heading: "Children and minors",
      paragraphs: [
        "Applicants must enter a date of birth to submit an application. We do not ask for a parent or guardian's consent.",
        "Applicants must be at least 13 years old to apply. Applicants under 18 need a parent or guardian's consent to apply.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        `We will post changes on this page and update the effective date. Effective date: ${d.effectiveDate}.`,
      ],
    },
  ],
}

export const termsOfUse: LegalDocument = {
  title: "Terms of Use",
  intro: [
    `These terms apply to the ${site.name} website, the applicant portal, and the admin console. By using them you agree to these terms and to our Privacy Policy. Effective date: ${d.effectiveDate}.`,
  ],
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        `${site.name} is operated by ${d.legalName}. We handle all correspondence by email. For questions, email ${d.contactEmail}.`,
      ],
    },
    {
      heading: "Eligibility",
      paragraphs: [
        "Eligibility to apply is set by event organizers for each event. Applicants must be at least 13 years old, and applicants under 18 need a parent or guardian's consent to apply.",
      ],
    },
    {
      heading: "Accounts",
      items: [
        "Use an email address you control, and keep your sign-in codes private.",
        "You are responsible for activity on your account.",
        "Staff accounts use Google sign-in and must be on the organizers' staff list.",
      ],
    },
    {
      heading: "Applications",
      items: [
        "Answer accurately and completely.",
        "Each applicant can have one application per event.",
        "You can edit a draft until you submit. After you submit, you can change your answers until the form's edit deadline.",
        "Organizers decide acceptances, waitlist places, and rejections. Submitting an application does not guarantee a place.",
        "Organizers may move your application to another role. If they do, you may need to complete and submit the new role's form.",
        "You can withdraw until your decision is visible. Withdrawing is final and you cannot apply again to that event. Declining an accepted or waitlisted offer is also final.",
      ],
    },
    {
      heading: "Your answers and files",
      paragraphs: [
        "You are responsible for what you submit. Upload only files you have the right to share, and do not include other people's personal information unless the form asks for it. Files must be PDFs no larger than 10 MB.",
      ],
    },
    {
      heading: "Your projects and content",
      paragraphs: [
        "You keep ownership of the projects you build. Organizers may display project names and the descriptions you submit in event materials.",
      ],
    },
    {
      heading: "Acceptable use",
      items: [
        "Do not access accounts, files, or data that are not yours.",
        "Do not interfere with the website or the applicant portal, or try to get around their access controls.",
        "Do not give false information, impersonate anyone, or copy the site's data.",
      ],
    },
    {
      heading: "Event information",
      paragraphs: [
        "Dates, location, schedule, and other event details may change. The website states that attending is free. Organizers may change or cancel the event.",
      ],
    },
    {
      heading: "Ending access",
      paragraphs: [
        "Organizers may decide not to accept an application that breaks these terms.",
      ],
    },
    {
      heading: "Disclaimers and limits of liability",
      paragraphs: [
        `The website and applicant portal are provided as is, without warranties of any kind. To the fullest extent permitted by law, ${d.legalName} is not liable for indirect or consequential losses arising from your use of them. You agree to indemnify ${d.legalName} against claims arising from content you submit that breaks these terms.`,
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        `These terms are governed by the laws of ${d.governingLaw}, without regard to its conflict of law rules. Any dispute will be brought in the state or federal courts located in ${d.governingLaw}.`,
      ],
    },
    {
      heading: "Changes to these terms",
      paragraphs: [
        `We may update these terms. Changes take effect when posted, and we will update the effective date. Effective date: ${d.effectiveDate}.`,
      ],
    },
  ],
}
