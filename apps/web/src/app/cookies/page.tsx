import { LegalLinks } from "@/components/legal/legal-links";
import { SiteFooter } from "@/components/ui/site-footer";
import { makeMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = makeMetadata({
  title: "Cookie Notice",
  description: "Cookie Notice for F1 InsightX.",
  path: "/cookies",
  keywords: ["F1 InsightX cookie notice"],
});

const UPDATED_AT = "July 17, 2026";

export default function CookiesPage() {
  return (
    <main className="subpage-shell legal-page">
      <header className="legal-page__header">
        <p className="subpage-eyebrow">Cookie Notice</p>
        <h1 className="subpage-title">Cookies and storage technologies.</h1>
        <p className="legal-page__lede">
          This notice reflects the current product behavior. It should be updated before adding analytics, advertising,
          A/B testing, or other non-essential tracking.
        </p>
        <p className="legal-page__meta">Last updated {UPDATED_AT}</p>
        <LegalLinks />
      </header>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Current Categories</div>
        <div className="legal-page__copy">
          <p>Strictly necessary: authentication/session cookies set through Supabase to keep signed-in users authenticated.</p>
          <p>
            Preference: <code>f1ix_cookie_consent</code> stores whether you accepted or rejected non-essential cookies so
            the banner does not reappear on every page.
          </p>
          <p>Functional: none beyond account-session and cookie-preference behavior at this time.</p>
          <p>Analytics: none currently deployed.</p>
          <p>Advertising/marketing: none currently deployed.</p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Local Storage and Similar Storage</div>
        <div className="legal-page__copy">
          <p>The current app does not rely on localStorage or sessionStorage for account/profile persistence.</p>
          <p>
            If future releases add non-essential storage for analytics, personalization, or experimentation, consent and
            disclosure should be updated before rollout.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Cookie and Terms Popup</div>
        <div className="legal-page__copy">
          <p>
            F1 InsightX shows a cookie and terms popup so visitors can review the Cookie Notice, Privacy Policy, and Terms
            of Use. Accepting stores your cookie preference. Rejecting non-essential cookies keeps analytics and marketing
            cookies off.
          </p>
          <p>
            If analytics or marketing technologies are introduced later, a consent mechanism and preference controls should
            be added before launch in jurisdictions that require them.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">What Still Needs Review</div>
        <div className="legal-page__copy">
          <p>
            If the launch plan adds analytics, experimentation, ad tech, or third-party embeds, this notice should be
            updated alongside a jurisdiction-appropriate consent review before those tools are enabled publicly.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
