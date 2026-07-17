import Link from "next/link";
import { LegalLinks } from "@/components/legal/legal-links";
import { SiteFooter } from "@/components/ui/site-footer";
import { getPrivacyContactEmail, getPrivacyMailtoHref } from "@/lib/public-config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | F1 InsightX",
  description: "Privacy Policy and data collection notice for F1 InsightX.",
};

const UPDATED_AT = "July 17, 2026";

export default function PrivacyPage() {
  const contactEmail = getPrivacyContactEmail();
  const privacyHref = getPrivacyMailtoHref("F1 InsightX privacy request");

  return (
    <main className="subpage-shell legal-page">
      <header className="legal-page__header">
        <p className="subpage-eyebrow">Privacy Policy</p>
        <h1 className="subpage-title">Privacy and data use.</h1>
        <p className="legal-page__lede">
          This policy describes the current F1 InsightX product behavior: account data, profile preferences, Picks entries,
          cookies, and operational logs used to run and protect the service.
        </p>
        <p className="legal-page__meta">Last updated {UPDATED_AT}</p>
        <LegalLinks />
      </header>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Notice at Collection</div>
        <div className="workspace-panel__headline">We collect only the data needed to operate accounts and the product.</div>
        <div className="legal-page__copy">
          <p>
            We currently collect account and profile data, authentication session data, profile preferences, and basic
            operational logs needed to keep the service available and secure.
          </p>
          <p>
            We do not currently run advertising trackers or sell personal information. If non-essential analytics or
            marketing technologies are added later, this notice and the cookie experience should be updated before launch.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Data We Process</div>
        <div className="legal-page__copy">
          <p>
            Account data: email address, authentication provider, account identifier, and Supabase session cookies used
            to keep you signed in.
          </p>
          <p>
            Profile data: username, favorite constructor, favorite driver, avatar preference, onboarding state, and the
            related timestamps and cooldown fields used to manage profile changes.
          </p>
          <p>
            Picks data: entertainment-only race picks, timestamps, point totals, and leaderboard display names when you
            choose to submit Picks while signed in.
          </p>
          <p>
            Operational data: limited server logs, rate-limit identifiers derived from hashed client/network information,
            and request metadata used to secure the API and diagnose failures.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">How We Use Data</div>
        <div className="legal-page__copy">
          <p>To authenticate accounts, persist your profile settings, and render your personalized profile experience.</p>
          <p>To save entertainment-only Picks, calculate points, and show race or season leaderboard positions.</p>
          <p>To secure the app, rate-limit sensitive routes, investigate failures, and prevent abuse of account flows.</p>
          <p>To deliver the core race analytics product surfaces and the profile preferences you choose inside the app.</p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Privacy Basis Baseline</div>
        <div className="legal-page__copy">
          <p>
            Where privacy law requires a legal basis, the current launch baseline relies primarily on contract or
            pre-contract necessity for account features, legitimate interests for service security and abuse prevention,
            and consent if non-essential tracking is introduced later.
          </p>
          <p>
            Privacy obligations vary by jurisdiction. This policy should be reviewed when the product adds paid features,
            prizes, advertising, analytics tracking, or broader international distribution.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Cookies and Similar Technologies</div>
        <div className="legal-page__copy">
          <p>
            The app currently relies on strictly necessary authentication/session cookies provided through Supabase to
            support sign-in and account persistence, plus a first-party preference cookie that stores your cookie banner choice.
          </p>
          <p>
            We do not currently deploy advertising cookies or non-essential analytics cookies in the product experience.
            See the <Link href="/cookies">Cookie Notice</Link> for more detail.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Third Parties</div>
        <div className="legal-page__copy">
          <p>Supabase is used for authentication, account storage, and profile persistence.</p>
          <p>Vercel or equivalent hosting infrastructure may process requests, logs, and deployment telemetry needed to run the app.</p>
          <p>Google sign-in may be available if enabled in Supabase Authentication providers.</p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Retention and Deletion</div>
        <div className="legal-page__copy">
          <p>Profile data is retained while your account remains active, unless deletion is requested or the data is removed manually.</p>
          <p>Operational logs should be retained only for a limited period needed for security and reliability review.</p>
          <p>Auth/session retention is also subject to Supabase platform configuration and provider behavior.</p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Your Rights</div>
        <div className="legal-page__copy">
          <p>You can access and correct your profile information directly in the account area.</p>
          <p>You can export your current account/profile data from the account page.</p>
          <p>
            Account deletion and broader privacy requests are currently handled manually.
            {contactEmail ? (
              <>
                {" "}Contact <a href={privacyHref ?? undefined}>{contactEmail}</a> for deletion, access, or correction requests
                that you cannot complete in-product.
              </>
            ) : (
              " Configure a launch contact address before public rollout so users have a clear privacy request channel."
            )}
          </p>
          <p>
            If you receive a rights request through email today, fulfillment still depends on manual review and operator
            action. Automated deletion workflows are not yet implemented.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">International Use</div>
        <div className="legal-page__copy">
          <p>
            If you access the service from outside the country where its infrastructure operates, your data may be
            processed in other jurisdictions, including the United States.
          </p>
        </div>
      </section>

      <section className="workspace-panel legal-page__section">
        <div className="workspace-panel__eyebrow">Children</div>
        <div className="legal-page__copy">
          <p>
            The product is not designed for children under 13 and should not be positioned or marketed as a child-directed service.
          </p>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
