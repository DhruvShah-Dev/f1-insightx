import Link from "next/link";
import { SiteFooter } from "@/components/ui/site-footer";
import { makeMetadata } from "@/lib/seo";

export const metadata = makeMetadata({
  title: "Fantasy",
  description: "Fantasy is not part of the current F1 InsightX product surface.",
  path: "/fantasy",
  index: false,
});

export default function FantasyPage() {
  return (
    <main className="subpage-shell">
      <section className="subpage-header fantasy-hold">
        <div>
          <p className="subpage-eyebrow">Coming Later</p>
          <h1 className="subpage-title">Fantasy is off the main grid.</h1>
          <p className="section-copy">The current deployment focuses on telemetry, race analysis, strategy, and race-week intelligence.</p>
        </div>
        <div className="not-found-page__actions">
          <Link href="/race-analysis" className="hero__cta hero__cta--primary">
            Open Race Analysis
          </Link>
          <Link href="/" className="hero__cta hero__cta--secondary">
            Back home
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
