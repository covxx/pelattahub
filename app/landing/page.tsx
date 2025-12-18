import type { Metadata } from "next";
import Link from "next/link";

const currentVersion = {
  version: "1.1",
  name: "Orion",
  releaseDate: "December 18, 2025",
  highlights: [
    "QuickBooks Online Auto-Sync Service",
    "Enhanced Invoice Sync Processing",
    "Improved deployment and configuration management",
  ],
};

const featureHighlights: { title: string; description: string; detail: string }[] = [
  {
    title: "PTI-Ready Lot Tracking",
    description: "Track every case by GTIN, lot, and voice pick code.",
    detail:
      "Built for fresh produce workflows with FIFO enforcement, per-lot visibility, and CRC16 voice pick codes to keep crews moving without sacrificing compliance.",
  },
  {
    title: "QuickBooks Online Integration",
    description: "Automated background sync with QuickBooks Online.",
    detail:
      "Seamless two-way synchronization of customers, products, vendors, and invoices. Background auto-sync service keeps data current without manual intervention.",
  },
  {
    title: "Zero-Silent-Writes Auditing",
    description: "Every change is recorded with user, action, and JSON diff.",
    detail:
      "Create, update, and delete operations automatically capture audit trails so QA, recalls, and third-party audits have the evidence they need in seconds.",
  },
  {
    title: "Order Management & FIFO",
    description: "Intelligent order fulfillment with automatic lot allocation.",
    detail:
      "Sales orders from QuickBooks invoices or manual entry. FIFO-based picking ensures oldest inventory moves first, with complete traceability from receipt to shipment.",
  },
  {
    title: "Case & LBS Aware",
    description: "Multi-unit handling with standard case weight.",
    detail:
      "Switch between cases and pounds without losing accuracy. Standard case weight is respected end-to-end for receiving, picking, production, and reporting.",
  },
  {
    title: "Production Module",
    description: "Track production batches with lot-level traceability.",
    detail:
      "Manage production orders, track raw materials and finished goods through production, and record yields and waste with full lot history.",
  },
];

const valuePillars: { title: string; description: string }[] = [
  {
    title: "Operational Control",
    description: "Live inventory, order status, and pick progress in one dashboard.",
  },
  {
    title: "Recall Readiness",
    description: "Lot-level traceability links inbound receipts to outbound orders instantly.",
  },
  {
    title: "Warehouse-First UX",
    description: "Touch-friendly flows, clear labeling, and browser-native ZPL printing.",
  },
  {
    title: "QuickBooks Integration",
    description: "Automated sync with QuickBooks Online for seamless operations.",
  },
];

const roadmapItems: { title: string; description: string; status: "upcoming" }[] = [
  {
    title: "Mobile Functions",
    description: "Native mobile experience optimized for warehouse operations on tablets and smartphones.",
    status: "upcoming",
  },
  {
    title: "Dark Mode",
    description: "System-wide dark theme support for improved visibility in low-light warehouse environments.",
    status: "upcoming",
  },
  {
    title: "Food Safety Features",
    description: "Enhanced food safety compliance tracking, HACCP integration, and safety documentation.",
    status: "upcoming",
  },
  {
    title: "Enhanced Reporting & Traceability",
    description: "Advanced reporting tools with deeper traceability insights and customizable analytics.",
    status: "upcoming",
  },
];

export const metadata: Metadata = {
  title: "PalettaHub | Fresh Produce WMS",
  description: "PalettaHub is the PTI-first WMS built for fresh produce teams.",
};

export default function LandingPage() {
  return (
    <div className="bg-gradient-to-b from-background via-muted/40 to-background text-foreground">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 opacity-40">
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.06),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(0,0,0,0.04),transparent_30%),radial-gradient(circle_at_60%_80%,rgba(0,0,0,0.03),transparent_25%)]" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:py-20 lg:py-24">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur">
              Built for fresh produce
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-primary/10 px-4 py-2 text-xs font-semibold text-primary shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              v{currentVersion.version} "{currentVersion.name}" • {currentVersion.releaseDate}
            </div>
          </div>
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="space-y-6">
              <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl">
                PalettaHub: the lot-accurate WMS that keeps your cold chain audit-ready.
              </h1>
              <p className="text-lg text-muted-foreground sm:text-xl">
                Receive, pick, produce, and ship with confidence. Every move is validated,
                logged, and traceable—without slowing down the floor. Now with automated QuickBooks Online synchronization.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-lg shadow-foreground/10 transition hover:-translate-y-0.5 hover:shadow-foreground/20"
                >
                  Sign in to PalettaHub
                </Link>
                <Link
                  href="mailto:sales@srjlabs.com"
                  className="inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold text-foreground transition hover:-translate-y-0.5 hover:border-foreground"
                >
                  Contact us
                </Link>
                <Link
                  href="/privacy"
                  className="inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold text-muted-foreground transition hover:-translate-y-0.5 hover:border-foreground"
                >
                  Review our approach
                </Link>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="space-y-1">
                  <div className="font-semibold text-foreground">Traceability</div>
                  <div>PTI-compliant barcodes, lot-first receiving, FIFO picking.</div>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-foreground">QuickBooks Sync</div>
                  <div>Automated background sync with QuickBooks Online.</div>
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-foreground">Audit Trail</div>
                  <div>JSON diffs on every create, update, and delete.</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-lg shadow-primary/10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-muted-foreground">Live Snapshot</div>
                  <div className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Warehouse Ready
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="text-sm text-muted-foreground">Lots in Motion</div>
                    <div className="text-3xl font-semibold">142</div>
                    <div className="text-xs text-muted-foreground">Across receiving, picking, production</div>
                  </div>
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="text-sm text-muted-foreground">On-Time Orders</div>
                    <div className="text-3xl font-semibold">98%</div>
                    <div className="text-xs text-muted-foreground">FIFO enforced, label-ready picks</div>
                  </div>
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="text-sm text-muted-foreground">Audit Coverage</div>
                    <div className="text-3xl font-semibold">100%</div>
                    <div className="text-xs text-muted-foreground">User + JSON diff on every change</div>
                  </div>
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <div className="text-sm text-muted-foreground">Unit Aware</div>
                    <div className="text-3xl font-semibold">CASE / LBS</div>
                    <div className="text-xs text-muted-foreground">Standard case weight respected end-to-end</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-24">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Why PalettaHub</p>
          <h2 className="text-balance text-3xl font-semibold sm:text-4xl">Built for produce, not retrofitted</h2>
          <p className="text-lg text-muted-foreground sm:text-xl">
            From inbound receipts to outbound labels, every workflow keeps PTI compliance, auditability, and speed in balance.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featureHighlights.map((feature) => (
            <div key={feature.title} className="rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="text-sm font-semibold text-primary">{feature.title}</div>
              <div className="mt-2 text-lg font-semibold">{feature.description}</div>
              <p className="mt-3 text-sm text-muted-foreground">{feature.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold sm:text-3xl">Warehouse operations without the guesswork</h3>
              <p className="text-lg text-muted-foreground">
                Clear queues for receiving, guided picks, production runs with lot holds, and outbound verification keep teams aligned while maintaining
                compliance guardrails.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {valuePillars.map((pillar) => (
                  <div key={pillar.title} className="rounded-xl border bg-background p-4 shadow-sm">
                    <div className="text-sm font-semibold text-primary">{pillar.title}</div>
                    <p className="mt-2 text-sm text-muted-foreground">{pillar.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6 shadow-lg shadow-primary/10">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-primary">Compliance Guardrails</div>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="rounded-lg border bg-muted/30 p-3 text-foreground">
                    PTI labels with GTIN + lot, voice pick code, and expiry in a 4x2 layout.
                  </li>
                  <li className="rounded-lg border bg-muted/30 p-3">
                    FIFO-first allocation prevents dead stock and stale inventory slipping into picks.
                  </li>
                  <li className="rounded-lg border bg-muted/30 p-3">
                    Audit logs capture user, action, entity, and JSON diff for every database write.
                  </li>
                  <li className="rounded-lg border bg-muted/30 p-3">
                    Browser-native ZPL printing keeps labels fast and OS-driver friendly—no USB Serial dependencies.
                  </li>
                </ul>
                <div className="pt-2 text-sm text-muted-foreground">
                  Need to see it with your data? Sign in to connect QuickBooks Online, seed test lots, and generate sample labels.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-24">
          <div className="space-y-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Roadmap</p>
            <h2 className="text-balance text-3xl font-semibold sm:text-4xl">What's Coming Next</h2>
            <p className="text-lg text-muted-foreground sm:text-xl">
              We're continuously improving PalettaHub based on feedback from warehouse teams. Here's what's on the horizon.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {roadmapItems.map((item) => (
              <div key={item.title} className="group relative rounded-2xl border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-sm font-semibold text-muted-foreground">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Upcoming</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20 lg:py-24">
        <div className="rounded-3xl border bg-gradient-to-r from-primary to-foreground px-6 py-10 text-background shadow-xl sm:px-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold sm:text-3xl">Ready when your warehouse is</h3>
              <p className="text-lg text-background/80">
                Bring the team into a single system that respects PTI, keeps audit logs unbroken, and speeds up receiving-to-shipping with lot certainty.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-background px-5 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-0.5"
              >
                Sign in
              </Link>
              <Link
                href="mailto:sales@srjlabs.com"
                className="inline-flex items-center justify-center rounded-full border border-background/40 px-5 py-3 text-sm font-semibold text-background transition hover:-translate-y-0.5 hover:border-background"
              >
                Contact us
              </Link>
              <Link
                href="/terms"
                className="inline-flex items-center justify-center rounded-full border border-background/40 px-5 py-3 text-sm font-semibold text-background/80 transition hover:-translate-y-0.5 hover:border-background"
              >
                Terms &amp; conditions
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
