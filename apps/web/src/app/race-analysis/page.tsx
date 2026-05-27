import Link from "next/link";
import { AppFooter } from "@/components/ui/app-footer";
import { AppHeader } from "@/components/ui/app-header";
import { getRaceAnalysisConfidenceTier, listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";

type RaceAnalysisIndexPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatCircuit(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function shortWeather(summary: string) {
  if (!summary) return "Weather context";
  return summary.split(",")[0]?.trim() || summary;
}

export default async function RaceAnalysisIndexPage({ searchParams }: RaceAnalysisIndexPageProps) {
  const params = await searchParams;
  const races = await listRaceAnalysisIndex();
  const seasons = [...new Set(races.map((race) => race.season))].sort((a, b) => b - a);
  const selectedSeason = Number(firstParam(params?.season)) || seasons[0];
  const visibleRaces = races.filter((race) => race.season === selectedSeason);
  const latestRace = races[0];

  return (
    <main className="race-analysis-page">
      <AppHeader title="F1 InsightX" eyebrow="Race Analysis" actionHref="/analytics" actionLabel="Open Analytics" />

      <section className="race-analysis-hero race-analysis-hero--index">
        <div className="race-analysis-hero__scan" aria-hidden="true" />
        <div className="race-analysis-hero__content">
          <div>
            <span className="race-analysis-kicker">Post-race intelligence</span>
            <h1>Relive the race through strategy and telemetry.</h1>
            <p>Story, stints, pace, position movement, and track-status context.</p>
          </div>
          {latestRace ? (
            <Link href={`/race-analysis/${latestRace.id}`} className="race-analysis-latest-card">
              <span>Latest analysis</span>
              <strong>{latestRace.raceName}</strong>
              <small>
                {latestRace.winner} won · {getRaceAnalysisConfidenceTier(latestRace.analysisQualityScore)}
              </small>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="race-analysis-toolbar" aria-label="Race analysis filters">
        <div>
          <span>Season</span>
          <strong>{selectedSeason}</strong>
        </div>
        <div className="race-analysis-season-switcher">
          {seasons.map((season) => (
            <Link key={season} href={`/race-analysis?season=${season}`} className={season === selectedSeason ? "is-active" : ""}>
              {season}
            </Link>
          ))}
        </div>
      </section>

      <section className="race-analysis-grid" aria-label="Available race analysis">
        {visibleRaces.map((race) => (
          <Link href={`/race-analysis/${race.id}`} className="race-analysis-card" key={race.id}>
            <div className="race-analysis-card__topline">
              <span>{race.season} · Round {race.round}</span>
              <span>{race.freshnessStatus === "ready" ? "Race Intelligence Available" : race.freshnessStatus}</span>
            </div>
            <div className="race-analysis-card__body">
              <h2>{race.raceName}</h2>
              <p>{formatCircuit(race.circuit)} · {formatDate(race.raceDate)}</p>
            </div>
            <div className="race-analysis-card__winner">
              <span>Winner</span>
              <strong>{race.winner}</strong>
              <small>{race.winnerTeam}</small>
            </div>
            <div className="race-analysis-card__chips">
              <span>{race.dominantStrategy || "Strategy view"}</span>
              <span>{shortWeather(race.weatherSummary)}</span>
              <span>{race.raceControlAvailable ? "Race-control context" : "Track-status context"}</span>
              <span>{getRaceAnalysisConfidenceTier(race.analysisQualityScore)}</span>
            </div>
          </Link>
        ))}
      </section>

      <AppFooter />
    </main>
  );
}
