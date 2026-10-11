export type Role = {
  id: "participant" | "volunteer" | "judge"
  title: string
  description: string
}

export type FaqItem = {
  question: string
  answer: string
}

export type SiteContent = {
  name: string
  tagline: string
  description: string
  about: string
  event: {
    name: string
    // ISO dates (YYYY-MM-DD); null until announced. endsOn requires startsOn.
    startsOn: string | null
    endsOn: string | null
    location: string | null
    applicationsOpen: boolean
  }
  roles: Role[]
  faq: FaqItem[]
  contactEmail: string | null
}

export const site: SiteContent = {
  name: "Patriot HackFest",
  tagline: "A weekend of building, learning, and collaborating.",
  description:
    "Patriot HackFest is a student hackathon. Apply to participate, volunteer, or judge.",
  about:
    "Patriot HackFest is a hackathon where students team up to design and build projects over a single event. Whether you are writing your first line of code or have shipped many projects, you are welcome to join, learn from others, and make something new.",
  event: {
    name: "Fall 2026",
    startsOn: "2026-11-14",
    endsOn: "2026-11-15",
    location: null,
    applicationsOpen: false,
  },
  roles: [
    {
      id: "participant",
      title: "Participant",
      description: "Form a team and build a project during the event.",
    },
    {
      id: "volunteer",
      title: "Volunteer",
      description: "Help run the event and support participants.",
    },
    {
      id: "judge",
      title: "Judge",
      description: "Review projects and give feedback to teams.",
    },
  ],
  faq: [
    {
      question: "Who can attend?",
      answer:
        "Students are welcome to apply. Eligibility details will be shared when applications open.",
    },
    {
      question: "How much does it cost?",
      answer: "Attending is free.",
    },
    {
      question: "How big can teams be?",
      answer:
        "Team size limits will be announced before the event. You can also come without a team and find one there.",
    },
    {
      question: "What should I bring?",
      answer:
        "A laptop, a charger, and anything else you need to be comfortable. More details will be sent to accepted applicants.",
    },
    {
      question: "Do I need experience?",
      answer:
        "No. Beginners are welcome, and there will be people around to help.",
    },
    {
      question: "How can I contact the organizers?",
      answer: "Use the contact information at the bottom of this page.",
    },
  ],
  contactEmail: null,
}
