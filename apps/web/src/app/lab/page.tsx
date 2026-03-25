import Link from "next/link";
import { RaceLabWorkspace } from "@/components/lab/race-lab-workspace";
import { listRaces } from "@/lib/server/reference-data";

export default async function RaceLabPage() {
  const races = await listRaces({ season: 2024, limit: 24 });

  return (
    <main className="subpage-shell">
      <header className="subpage-header">
        <div>
          <p className="subpage-eyebrow">Race Prediction Lab</p>
          <h1 className="subpage-title">Scenario-driven race simulation.</h1>
        </div>
        <Link href="/" className="subpage-link">
          Back to overview
        </Link>
      </header>

      <section className="section-shell">
        <div className="section-meta">Engine</div>
        <p className="section-copy">
          Rule-based in v1, with transparent scoring across qualifying, form, overtaking,
          reliability, and strategy inputs.
        </p>
      </section>

      <RaceLabWorkspace races={races} />
    </main>
  );
}
