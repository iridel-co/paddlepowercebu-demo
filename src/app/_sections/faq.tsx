"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { MinusIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { VariableWeightText } from "@/components/ui/variable-weight-text"

/* Talisay is the only bookable branch right now — the next branch is under
   construction. Button links to booking there, same as the Hero and Visit
   sections' booking CTAs. */

/**
 * FAQ — the chat-bubble accordion from the reference: the question sits left
 * as a pill, the answer drops in right as a reply bubble.
 *
 * Opening is hover- and click-driven, not scroll-driven. A real mouse hover
 * (or keyboard focus) opens an item; clicking toggles it, so a clicked-open
 * item on desktop closes again. The last opened item stays open when the
 * pointer leaves the list — closing on leave made the whole section flicker
 * on the way past.
 *
 * Hover- and focus-opening are both gated to non-touch input. A tap emits
 * compatibility `mouseenter` + focus *before* `click`, so ungated handlers
 * opened the item and then let the click toggle it straight back closed —
 * which is why tapping an FAQ on mobile appeared to do nothing. With the
 * gate, touch runs on `click` alone: one open item at a time, and tapping a
 * new question swaps the open one for it.
 */

const FAQS = [
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

const SOCIALS = [
  { href: "https://instagram.com/paddlepowercebu", label: "Instagram" },
  {
    /* TODO: confirm Facebook page URL with client */
    href: "https://facebook.com/paddlepowercebu",
    label: "Facebook",
  },
]

/* Same weight-sweep headline treatment as the Locations "Your court. One
   tap." heading — fast enough to land as one gesture rather than a
   per-letter crawl. Second span's delay lets the sweep read as a single
   continuous pass across the line. */
const HEADLINE_STAGGER = 0.014
const HEADLINE_ANIM = { type: "spring", duration: 0.35, bounce: 0 } as const
const FIRST_WORDS = "Questions,"
const SECOND_WORD_DELAY = (FIRST_WORDS.length + 1) * HEADLINE_STAGGER

/* iMessage-style bubble tails, built from two pseudo-elements: `before` is a
   thick coloured side border with one rounded corner, which flares out of the
   bubble's bottom edge and fills its rounded corner back in; `after` is a
   cream chip with the opposite corner rounded, painted on top to bite the
   outer half of that flare off and leave the hooked point.
 *
 * `before`'s border colour has to match the bubble fill exactly, which is why
 * the closed question bubble uses the opaque `pp-ink-wash` token rather than
 * `pp-ink/5` — a translucent fill would double its alpha under the tail.
 *
 * The geometry is tuned to a 1.15rem bubble radius; change one, change both. */
const TAIL_BASE =
  "relative before:absolute before:bottom-[-0.1rem] before:h-4 before:-translate-y-px before:transition-colors before:duration-300 before:content-[''] after:absolute after:bottom-[-0.1rem] after:h-4 after:w-[10px] after:-translate-x-[30px] after:-translate-y-[2px] after:bg-pp-cream after:content-['']"

/* Question — tail on the bottom-left, pointing back at the asker. */
const TAIL_LEFT =
  "before:left-[-0.35rem] before:rounded-br-[0.8rem_0.7rem] before:border-l-[1rem] after:left-[20px] after:rounded-br-[0.5rem]"

/* Answer — mirrored, tail on the bottom-right. */
const TAIL_RIGHT =
  "before:right-[-0.35rem] before:rounded-bl-[0.8rem_0.7rem] before:border-r-[1rem] before:border-r-pp-ink after:right-[-40px] after:rounded-bl-[0.5rem]"

export function DemoFaq() {
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id)

  return (
    <section
      id="faq"
      className="border-pp-ink/10 bg-pp-cream scroll-mt-(--nav-h) border-t px-5 py-16 lg:px-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-[860px] flex-col gap-10 lg:gap-14">
        <div className="flex flex-col gap-4">
          <h2
            className="text-pp-ink m-0 max-w-[20ch] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase"
            style={{ fontSize: "clamp(44px, 6.2vw, 84px)" }}
          >
            <VariableWeightText
              text={FIRST_WORDS}
              staggerTiming={HEADLINE_STAGGER}
              animationConfig={HEADLINE_ANIM}
            />{" "}
            <VariableWeightText
              text="answered."
              className="text-pp-lime-light"
              staggerTiming={HEADLINE_STAGGER}
              animationConfig={HEADLINE_ANIM}
              startDelay={SECOND_WORD_DELAY}
            />
          </h2>
          <p className="text-pp-charcoal/80 m-0 max-w-[52ch] text-base leading-relaxed font-medium lg:text-lg">
            Everything first-timers ask before their first game at Paddle Power
            Cebu.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:gap-6">
          {FAQS.map((item) => {
            const isOpen = openId === item.id
            return (
              <div
                key={item.id}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setOpenId(item.id)
                }}
                className="flex flex-col"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  /* `:focus-visible` keeps this to keyboard focus — a tap
                     focuses the button too, and would re-open the race. */
                  onFocus={(event) => {
                    if (event.currentTarget.matches(":focus-visible"))
                      setOpenId(item.id)
                  }}
                  className="focus-visible:outline-pp-ink flex w-full items-center justify-start gap-x-4 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <span
                    className={`rounded-[1.15rem] px-5 py-3 text-base font-bold transition-colors duration-300 lg:text-lg ${TAIL_BASE} ${TAIL_LEFT} ${
                      isOpen
                        ? "bg-pp-lime-light before:border-l-pp-lime-light text-white"
                        : "bg-pp-ink-wash before:border-l-pp-ink-wash text-pp-charcoal"
                    }`}
                  >
                    {item.question}
                  </span>
                  <span
                    className={`shrink-0 transition-colors duration-300 ${
                      isOpen ? "text-pp-lime-light" : "text-pp-charcoal/50"
                    }`}
                    aria-hidden
                  >
                    {isOpen ? (
                      <MinusIcon className="size-5" />
                    ) : (
                      <PlusIcon className="size-5" />
                    )}
                  </span>
                </button>

                <motion.div
                  id={`faq-answer-${item.id}`}
                  initial={false}
                  animate={isOpen ? "open" : "collapsed"}
                  variants={{
                    open: { opacity: 1, height: "auto" },
                    collapsed: { opacity: 0, height: 0 },
                  }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  {/* `pr-3` keeps the answer tail's cutout chip inside the
                      collapsing `overflow-hidden` wrapper. */}
                  <div className="flex justify-end pt-3 pr-3 pl-8 lg:pl-16">
                    <div
                      className={`bg-pp-ink m-0 flex max-w-md flex-col gap-4 rounded-[1.15rem] px-5 py-3 ${TAIL_BASE} ${TAIL_RIGHT}`}
                    >
                      <p className="text-pp-cream m-0 text-base leading-relaxed font-medium">
                        {item.answer}
                      </p>
                      {item.showBookingButtons && (
                        <div className="flex flex-wrap justify-end gap-3">
                          <Button
                            variant="brand"
                            asChild
                            className="bg-pp-lime-light hover:bg-pp-lime-light/90 min-h-11"
                          >
                            <a href="#locations">Book Talisay on Onda</a>
                          </Button>
                        </div>
                      )}
                      {item.showSocialLinks && (
                        <div className="flex flex-wrap justify-end gap-3">
                          {SOCIALS.map((social) => (
                            <Button
                              key={social.href}
                              variant="brand"
                              asChild
                              className="bg-pp-lime-light hover:bg-pp-lime-light/90 min-h-11"
                            >
                              <a
                                href={social.href}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {social.label}
                              </a>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
