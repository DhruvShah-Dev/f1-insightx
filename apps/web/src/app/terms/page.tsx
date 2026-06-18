import { LegalLinks } from "@/components/legal/legal-links";
import { SiteFooter } from "@/components/ui/site-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | F1 InsightX",
  description: "Terms of Use for F1 InsightX.",
};

const UPDATED_AT = "April 6, 2026";

export default function TermsPage() {
  return (
    <main className="subpage-shell legal-page">
      <header className="legal-page__header">
        <p className="subpage-eyebrow">Terms of Use</p>
        <h1 className="subpage-title">Terms for using F1 InsightX.</h1>
        <p className="legal-page__lede">
          These terms are an engineering-ready launch draft. They should be reviewed and adapted for the jurisdictions
          and business model you actually launch under.
        </p>
        <p className="legal-page__meta">Last updated {UPDATED_AT}</p>
        <LegalLinks />
      </header>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Use of Service</div>
        <div className="legal-page__copy">
          <p>F1 InsightX provides motorsport analytics, strategy simulations, race analysis, and profile features for informational use.</p>
          <p>You agree not to abuse the service, bypass rate limits, interfere with normal operation, or use the app for unlawful activity.</p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Accounts</div>
        <div className="legal-page__copy">
          <p>You are responsible for the activity that occurs through your account and for maintaining the security of your credentials.</p>
          <p>You must provide accurate account information and use a username that complies with the in-product restrictions.</p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Analytics Disclaimer</div>
        <div className="legal-page__copy">
          <p>
            Strategy, prediction, and race-analysis outputs are analytical tools, not guarantees. They should not be presented as professional
            financial, betting, or sporting advice.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Availability</div>
        <div className="legal-page__copy">
          <p>The service may change, pause, or become unavailable without notice, especially during active development or portfolio use.</p>
          <p>We may suspend or restrict access where needed to protect the service, comply with law, or address abuse.</p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Intellectual Property and Branding</div>
        <div className="legal-page__copy">
          <p>
            This product references Formula 1-related names, teams, and drivers for commentary and analytics purposes. Trademark and licensing
            review should be completed before commercial launch or broader branding usage.
          </p>
          <p>
            Unless a separate written agreement says otherwise, F1 InsightX is not endorsed by, affiliated with, or
            sponsored by Formula 1, the FIA, or any team, driver, or championship rights holder.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Changes and Legal Review</div>
        <div className="legal-page__copy">
          <p>
            These terms may be updated as the product, infrastructure, and business model change. Material commercial or
            jurisdiction-specific launches should receive dedicated legal review before relying on this draft.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
