import Link from "next/link";
import { FantasyWorkspace } from "@/components/fantasy/fantasy-workspace";

export default function FantasyPage() {
  return (
    <main className="subpage-shell">
      <header className="subpage-header">
        <div>
          <p className="subpage-eyebrow">Fantasy Team Builder</p>
          <h1 className="subpage-title">Constraint-based lineup optimizer.</h1>
        </div>
        <Link href="/" className="subpage-link">
          Back to overview
        </Link>
      </header>

      <section className="section-shell">
        <div className="section-meta">Engine</div>
        <p className="section-copy">
          Searches valid lineups under budget and scores them for safe, balanced, or aggressive play.
        </p>
      </section>

      <FantasyWorkspace season={2024} />
    </main>
  );
}
