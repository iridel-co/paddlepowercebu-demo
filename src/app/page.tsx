import { SiteHeader } from "./_sections/site-header"
import { DemoHero } from "./_sections/hero"
import { DemoLocations } from "./_sections/locations"
import { DemoComingSoon } from "./_sections/coming-soon"
import { DemoFaq } from "./_sections/faq"
import { DemoVisit } from "./_sections/visit"
import { DemoFooter } from "./_sections/footer"

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <DemoHero />
        {/* The body of the page is pulled up over the tail of the hero's
            scroll track: it rides across the pinned stage on plain scroll while
            the rally keeps scrubbing underneath, instead of waiting for the
            track to finish. No transform, no snap — just the overlap. */}
        <div id="after-hero" className="relative z-10 -mt-[70svh]">
          <div className="bg-white">
            <DemoLocations />
          </div>
          <DemoComingSoon />
          <DemoFaq />
          <DemoVisit />
        </div>
      </main>
      <DemoFooter />
    </>
  )
}
