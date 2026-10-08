import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { pageSeo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => pageSeo({ title: "Privacy Policy | F1 InsightX", description: "How F1 InsightX handles account and site data.", path: "/privacy" }),
  component: Privacy,
});

function Privacy() {
  return <LegalPage title="Privacy Policy" updated="October 8, 2026">
    <p>F1 InsightX is a personal project operated from the United States. This policy explains how the site handles personal information when you visit, sign in, or use picks.</p>
    <h2>Information collected</h2>
    <ul>
      <li>When you sign in with Google, the authentication service receives your account identifier, email address and basic profile information supplied by Google.</li>
      <li>The site stores your username, avatar selection and account dates in a profile. It may store submitted picks in the account database. The current picks interface stores picks in your browser under a key tied to your account ID.</li>
      <li>Hosting and security services may process IP addresses, device and request information, and error logs to deliver and protect the site.</li>
    </ul>
    <h2>Why information is used</h2>
    <p>We use account data to authenticate you, provide your profile and picks, secure the service, respond to requests, and diagnose failures. Depending on the applicable law, the basis is providing the service you request, legitimate interests in security and operation, or compliance with legal obligations. We do not currently use account data for marketing emails or targeted advertising.</p>
    <h2>Who receives information</h2>
    <p>Google provides sign-in; Supabase provides authentication and account storage; the hosting and site-platform providers deliver the website and may process technical logs. Each provider processes information under its own terms and applicable agreements. We do not sell personal information. Provider systems may process information in countries outside your own, including the United States.</p>
    <h2>How long information is kept</h2>
    <p>We keep account and profile information while your account is active, and remove the active account record when you delete it, subject to legal requirements and provider backup retention. Picks saved in your browser remain there until you clear them, clear browser storage, or delete the account from that browser. Platform logs follow the applicable provider's retention settings.</p>
    <h2>Your choices and rights</h2>
    <p>From your <Link to="/account">account</Link>, you can download your account data or permanently delete your account and picks on the current browser. You can also ask for access, correction, deletion, or other rights available where you live. We may need to verify your identity before acting. If you use several devices, clear browser-only picks on each device. You may also complain to your local data protection authority where that right applies.</p>
    <h2>Children</h2>
    <p>Accounts are intended for people aged 16 or older. Do not create an account if you are younger. If we learn that an underage user created one, we will review and remove the account as required by law.</p>
    <h2>Browser storage and changes</h2>
    <p>See the <Link to="/cookies">Cookie and Storage Notice</Link> for details about sessions and local picks. We will update this page if our data practices change and post a new date; material changes will receive a prominent notice.</p>
    <h2>Contact</h2>
    <p>For privacy questions or requests, email <a href="mailto:f1.insightx@gmail.com">f1.insightx@gmail.com</a>. Signed-in users can also use the account controls. F1 InsightX is operated as a personal project from the United States.</p>
  </LegalPage>;
}
