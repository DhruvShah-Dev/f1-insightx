import Link from "next/link";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader } from "@/components/ui/site-header";

export default function NotFound() {
  return (
    <main className="subpage-shell not-found-page">
      <SiteHeader title="F1 InsightX" />
      <section className="not-found-page__panel">
        <p className="subpage-eyebrow">404</p>
        <h1 className="subpage-title">Page off track.</h1>
        <p className="section-copy">The route is unavailable or no longer exists.</p>
        <div className="not-found-page__actions">
          <Link href="/" className="hero__cta hero__cta--primary">
            Return home
          </Link>
          <Link href="/analytics" className="hero__cta hero__cta--secondary">
            Open Analytics
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
