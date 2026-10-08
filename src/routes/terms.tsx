import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { pageSeo } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () => pageSeo({ title: "Terms of Use | F1 InsightX", description: "Terms for using F1 InsightX accounts, analysis and picks.", path: "/terms" }),
  component: Terms,
});

function Terms() {
  return <LegalPage title="Terms of Use" updated="October 8, 2026">
    <p>These terms apply when you use f1insightx.live. By signing in or using the site, you agree to them. If you do not agree, do not use the site or create an account.</p>
    <h2>What the site provides</h2>
    <p>F1 InsightX offers independent race information, analysis, projections and prediction picks for entertainment and information. Data and projections may be delayed, incomplete or wrong. They are not official race results or betting, financial or professional advice. Check official sources before relying on a result or schedule.</p>
    <h2>Accounts and eligibility</h2>
    <p>You may sign in with Google. You are responsible for activity under your account and for keeping access to your Google account secure. Do not impersonate others, automate abusive requests, interfere with the site, or use it unlawfully. The site is intended for people aged 16 or older; do not create an account if you are younger.</p>
    <h2>Picks and scoring</h2>
    <p>Picks currently involve no stake, cash prize or purchase. Picks may lock at the stated time. Scores depend on the site's published rules and available results. We may correct errors, cancel a round affected by bad data, or change future rules; material changes will be shown on the site. Picks stored in your browser may not appear on another device.</p>
    <h2>Content and permitted use</h2>
    <p>You may view the site for personal, lawful use. Do not copy, republish, scrape at scale, or commercially exploit site content without permission from the applicable rights holder. Third-party names, marks, images and data remain the property of their respective owners. The site is independent and unofficial.</p>
    <h2>Availability and responsibility</h2>
    <p>We may update, suspend or discontinue features to maintain the site or fix errors. To the extent permitted by applicable law, the site is provided without warranties, and the operator is not liable for indirect or consequential loss arising from use of the site. Nothing here excludes rights or liabilities that cannot lawfully be excluded.</p>
    <h2>Changes and contact</h2>
    <p>We will post revised terms with a new date. If a change materially affects account use, we will give a prominent notice before it applies. Contact details and data-request options are in the <Link to="/privacy">Privacy Policy</Link>.</p>
  </LegalPage>;
}
