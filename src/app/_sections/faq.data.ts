/**
 * The FAQ content, pulled just far enough out of `faq.tsx` that the JSON-LD
 * builder can read the same array the section renders.
 *
 * Two copies of these seven answers would drift, and the copy Google quotes
 * drifting from the copy on the page is worse than the small break from
 * keeping section content inline. It stays next to the section that renders
 * it rather than moving to a shared constants file.
 *
 * `answer` is always the prose alone. The flags below add buttons or links
 * beside it on the page; the structured data ignores them.
 */
export type FaqEntry = {
  id: string
  question: string
  answer: string
  showBookingButtons?: boolean
  showSocialLinks?: boolean
}

export const FAQS: FaqEntry[] = [
  {
    id: "booking",
    question: "How do I book a court?",
    answer: "Book online through Onda. Pick your date and time.",
    showBookingButtons: true,
  },
  {
    id: "hours",
    question: "What are your opening hours?",
    answer:
      "The Talisay branch is open 24/7, including weekends and holidays. A new branch is coming soon near you.",
  },
  {
    id: "gear",
    question: "Do I need my own paddle and balls?",
    answer:
      "No. Paddle rental and match-grade balls are available at the counter, so you can turn up with nothing but court shoes.",
  },
  {
    id: "beginner",
    question: "I've never played pickleball. Can I still come?",
    answer:
      "Absolutely, most of our players started here. Beginner-friendly open play runs through the week, and coaching clinics launch soon.",
  },
  {
    id: "group",
    question: "Can I reserve multiple courts for a group?",
    answer:
      "Yes. Birthdays, corporate nights, and league play can take several courts at once. Send us a message with your headcount and we'll map out the schedule.",
  },
  {
    id: "branches",
    question: "Do you only have one branch?",
    answer:
      "For now, yes, Talisay is our only branch. A new branch is opening soon, so keep an eye out for updates! 👀",
  },
  {
    id: "partnerships",
    question: "Are you open to partnerships?",
    answer:
      "Yes, we're always open to partnering up, especially for events. Reach out to us on our socials below and let's talk.",
    showSocialLinks: true,
  },
]
