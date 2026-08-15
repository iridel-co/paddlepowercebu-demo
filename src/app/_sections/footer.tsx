import Image from "next/image"
import { localClientImg } from "@/lib/images"

/**
 * Footer / Contact — the cream + lime horizontal lockup on ink, the section
 * links, and the social handles. Contact is social link-out only.
 */

const LINKS = [
  { href: "#locations", label: "Locations" },
  { href: "#soon", label: "Coming Soon" },
  { href: "#faq", label: "FAQ" },
  { href: "#visit", label: "Visit" },
]

const SOCIALS = [
  { href: "https://instagram.com/paddlepowercebu", label: "Instagram" },
  {
    /* TODO: confirm Facebook page URL with client */
    href: "https://facebook.com/paddlepowercebu",
    label: "Facebook",
  },
]

export function DemoFooter() {
  return (
    <footer
      id="contact"
      className="bg-pp-ink scroll-mt-(--nav-h) px-5 py-14 lg:px-12 lg:py-16"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
          <div className="flex flex-col gap-5">
            <a href="#top" aria-label="Paddle Power Cebu">
              <Image
                src={localClientImg(
                  "paddle-power-cebu",
                  "paddle-power-horizontal.svg"
                )}
                alt="Paddle Power Cebu"
                width={913}
                height={95}
                className="h-6 w-auto"
              />
            </a>
            <p className="text-pp-tan/70 m-0 max-w-[38ch] text-sm leading-relaxed font-medium">
              Premium indoor pickleball in Cebu. Open 24/7 in Talisay — a new
              branch is coming soon near you.
            </p>
          </div>

          <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
            <nav aria-label="Footer" className="flex flex-col gap-3">
              <span className="text-pp-tan/60 text-[10px] font-bold tracking-[0.16em] uppercase">
                Explore
              </span>
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-pp-cream hover:text-pp-lime text-sm font-medium transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="flex flex-col gap-3">
              <span className="text-pp-tan/60 text-[10px] font-bold tracking-[0.16em] uppercase">
                Follow
              </span>
              {SOCIALS.map((social) => (
                <a
                  key={social.href}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pp-cream hover:text-pp-lime text-sm font-medium transition-colors"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-pp-tan/15 flex flex-col gap-3 border-t pt-7 sm:flex-row sm:items-center sm:justify-between">
          {/* /60 is the floor that clears WCAG AA (4.5:1) on the ink surface —
              /50 measured 4.15 and /40 measured 3.08 in an axe audit. */}
          <p className="text-pp-tan/60 m-0 text-xs font-medium">
            © {new Date().getFullYear()} Paddle Power Cebu. All rights reserved.
          </p>
          <a
            href="https://iridel.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pp-tan/60 hover:text-pp-tan/85 text-xs transition-colors"
          >
            Demo by iridel.com
          </a>
        </div>
      </div>
    </footer>
  )
}
