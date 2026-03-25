import { TrackLayoutCard } from "@/components/ui/track-layout-card";
import { listRaces } from "@/lib/server/reference-data";

export async function SeasonStrip() {
  const races = await listRaces({ season: 2024, limit: 6 });

  if (races.length === 0) {
    return (
      <div className="section-shell">
        <div className="section-meta">2024 calendar</div>
        <p className="section-copy">Connect local data or Supabase to load the calendar.</p>
      </div>
    );
  }

  return (
    <section className="section-shell overflow-hidden">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="section-meta">2024 calendar</div>
          <h3 className="section-title">Upcoming rounds and circuit layouts.</h3>
        </div>
        <p className="section-copy max-w-sm">
          Pulled from the live reference layer rather than static page content.
        </p>
      </div>

      <div className="track-strip mt-8">
        {races.map((race) => (
          <article key={race.id} className="track-strip__item">
            <TrackLayoutCard circuitId={race.circuitId} compact />
            <span className="track-strip__round">R{race.round}</span>
            <h4>{race.raceName}</h4>
            <p>{new Date(race.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            <span>{race.sprintWeekend ? "Sprint weekend" : "Grand Prix"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
