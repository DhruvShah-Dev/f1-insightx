import Link from "next/link";
import { AppHeader } from "@/components/ui/app-header";
import { SiteFooter } from "@/components/ui/site-footer";

export default function FantasyPage() {
  return (
    <main className="subpage-shell">
      <AppHeader title="F1 InsightX" eyebrow="Future Surface" actionHref="/analytics" actionLabel="Open Analytics" compact />
      <section className="subpage-header fantasy-hold">
        <div>
          <p className="subpage-eyebrow">Coming Later</p>
          <h1 className="subpage-title">Fantasy is off the main grid.</h1>
          <p className="section-copy">The current deployment focuses on telemetry, race analysis, strategy, and race-week intelligence.</p>
        </div>
        <div className="not-found-page__actions">
          <Link href="/analytics" className="hero__cta hero__cta--primary">
            Open Analytics
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
