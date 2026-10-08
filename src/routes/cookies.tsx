import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { pageSeo } from "@/lib/seo";

export const Route = createFileRoute("/cookies")({
  head: () => pageSeo({ title: "Cookie and Storage Notice | F1 InsightX", description: "How F1 InsightX uses browser storage and cookies.", path: "/cookies" }),
  component: Cookies,
});

function Cookies() {
  return <LegalPage title="Cookie and Storage Notice" updated="October 8, 2026">
    <p>This notice covers cookies and similar browser storage. It describes the storage used by the current F1 InsightX app. A browser or hosting provider may also set security or delivery cookies.</p>
    <h2>Storage used by the app</h2>
    <ul>
      <li><strong>Supabase authentication:</strong> when you sign in, the app stores a session in local storage so you stay signed in. It is removed when you sign out or delete your account, subject to the browser's behavior.</li>
      <li><strong>Prediction picks:</strong> the app stores picks in local storage under a key tied to your account ID. This lets the current picks interface remember them on that device. You can clear them in the picks interface or delete your account.</li>
      <li><strong>Sidebar preference:</strong> a sidebar component can save its open/closed state in a first-party cookie for seven days when that component is used.</li>
    </ul>
    <h2>Analytics and advertising</h2>
    <p>The current app source does not load advertising pixels or third-party behavioral analytics. If those are added, this notice and the site's consent controls must be updated before they are enabled where consent is required.</p>
    <h2>Your controls</h2>
    <p>You can sign out, clear site data in your browser settings, or use the account's data controls. Clearing browser storage signs you out and removes picks saved only on that device. Browser settings can also block cookies, though that may affect some site features.</p>
    <p>See the <Link to="/privacy">Privacy Policy</Link> for account data and requests.</p>
  </LegalPage>;
}
