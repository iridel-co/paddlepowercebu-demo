import {
  BarChart2Icon,
  BrainCircuitIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/common/navbar"
import { HeroSection } from "@/components/common/hero-section"
import { StatGrid, StatItem } from "@/components/common/stat-grid"
import { FeatureRow } from "@/components/common/feature-row"
import { FeatureGrid, FeatureItem } from "@/components/common/feature-grid"
import { TestimonialCard } from "@/components/common/testimonial-section"
import { CtaBanner } from "@/components/common/cta-banner"
import { placeholderImg } from "@/lib/images"

export default function Home() {
  return (
    <>
      {/* ─── Navigation ─────────────────────────────────────────────────── */}
      <Navbar
        start={
          <span className="text-foreground text-sm font-semibold tracking-tight">
            Iridel
          </span>
        }
        end={
          <Button variant="brand" size="sm">
            Get a demo
          </Button>
        }
      />

      <main>
        {/* ─── Hero ─────────────────────────────────────────────────────── */}
        <HeroSection
          variant="image"
          imageSrc={placeholderImg("3Mhgvrk4tjM", 1600, 700)}
          imageAlt="Modern collaborative workspace"
          eyebrow="Iridel Platform"
          heading="Turn client data into polished demos — fast."
          subtext="Go from raw brief to a live, branded demo experience in hours. Iridel handles the design system so your team can focus on the story."
          actions={
            <>
              <Button variant="brand" size="lg">
                Start free trial
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              >
                Watch a demo
              </Button>
            </>
          }
        />

        {/* ─── Stats ────────────────────────────────────────────────────── */}
        <div className="container mx-auto max-w-7xl px-4 py-16">
          <StatGrid divided>
            <StatItem
              value="2,400+"
              label="Active clients"
              trend="+18% YoY"
              trendDirection="up"
            />
            <StatItem value="99.9%" label="Uptime SLA" serif />
            <StatItem
              value="4.7s"
              label="Avg. report generation"
              trend="−22% vs last quarter"
              trendDirection="up"
            />
            <StatItem value="$1.2B" label="Data processed monthly" serif />
          </StatGrid>
        </div>

        {/* ─── Feature rows (alternating) ───────────────────────────────── */}
        <FeatureRow
          eyebrow="Workflow"
          heading="Build demo pages in minutes, not days."
          body="Drag in your client's data, pick a layout, and export a polished interactive page. Every component adapts to your brand tokens automatically — no bespoke CSS required."
          imageSrc={placeholderImg("hpjSkU2UYSU", 800, 600)}
          imageAlt="Dashboard configuration screen"
          action={<Button variant="default">See how it works</Button>}
        />

        <FeatureRow
          reverse
          eyebrow="Collaboration"
          heading="Share live previews with your whole team."
          body="Every demo generates a shareable URL with real-time commenting. Stakeholders leave contextual feedback directly on the page — no more screenshot threads."
          imageSrc={placeholderImg("gMsnXqILjp4", 800, 600)}
          imageAlt="Real-time collaboration interface"
          action={<Button variant="outline">Invite your team</Button>}
        />

        {/* ─── Feature grid ─────────────────────────────────────────────── */}
        <section className="bg-muted/40 py-20">
          <div className="container mx-auto max-w-7xl space-y-12 px-4">
            <div className="space-y-3">
              <p className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
                Capabilities
              </p>
              <h2 className="text-foreground text-3xl font-semibold tracking-tight">
                Everything you need to impress clients.
              </h2>
            </div>

            <FeatureGrid>
              <FeatureItem
                icon={<ZapIcon />}
                iconVariant="brand"
                heading="Instant previews"
                description="See exactly what your client will see. Live preview updates as you edit — no refresh needed."
              />
              <FeatureItem
                icon={<ShieldCheckIcon />}
                iconVariant="success"
                heading="SOC 2 compliant"
                description="Enterprise-grade security built in. Client data never leaves your isolated workspace."
              />
              <FeatureItem
                icon={<BarChart2Icon />}
                iconVariant="brand"
                heading="Live data connectors"
                description="Pull real numbers directly from your data sources. Charts and tables stay in sync automatically."
              />
              <FeatureItem
                icon={<UsersIcon />}
                iconVariant="muted"
                heading="Team workspaces"
                description="Shared asset libraries, comment threads, and version history keep your whole team aligned."
              />
              <FeatureItem
                icon={<TrendingUpIcon />}
                iconVariant="brand"
                heading="Analytics built in"
                description="See how long clients spend on each section. Know what resonates before the follow-up call."
              />
              <FeatureItem
                icon={<BrainCircuitIcon />}
                iconVariant="muted"
                heading="AI-assisted layouts"
                description="Describe the page you need and get a starter layout in seconds. Refine from there."
              />
            </FeatureGrid>
          </div>
        </section>

        {/* ─── Testimonials ─────────────────────────────────────────────── */}
        <div className="container mx-auto max-w-7xl space-y-12 px-4 py-20">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight">
            What teams are saying.
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <TestimonialCard
              quote="We cut demo prep time from two days to two hours. Clients can't believe we built it so quickly — they assume we have a much bigger team."
              authorName="Sarah Chen"
              authorTitle="Head of Sales, Vertex Solutions"
              authorFallback="SC"
            />
            <TestimonialCard
              quote="The design system is genuinely the best part. Our demos look consistent and professional without any designer involvement. That's rare."
              authorName="Marcus Reid"
              authorTitle="Senior Engineer, Luminary Labs"
              authorFallback="MR"
            />
            <TestimonialCard
              quote="Iridel changed how we pitch. We show a working prototype instead of slides — close rates went up 30% in the first quarter."
              authorName="Priya Kapoor"
              authorTitle="Founder, Anchor Analytics"
              authorFallback="PK"
            />
          </div>
        </div>

        {/* ─── CTA Banner ───────────────────────────────────────────────── */}
        <CtaBanner
          variant="brand"
          eyebrow="Get started today"
          heading="Ready to ship better demos?"
          subtext="Join over 2,400 teams already using Iridel to build client-facing experiences they're proud of."
          actions={
            <>
              <Button variant="secondary" size="lg">
                Start for free
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="text-brand-foreground hover:bg-brand-foreground/10 hover:text-brand-foreground"
              >
                Talk to sales
              </Button>
            </>
          }
        />
      </main>
    </>
  )
}
