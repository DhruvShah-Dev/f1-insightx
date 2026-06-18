import Link from "next/link";
import { AppFooter } from "@/components/ui/app-footer";
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

function podiumLabel(podium: string[]) {
  return podium.length ? podium.join(" / ") : "Podium data";
}

function RaceAnalysisIndexHero({ latestRace }: { latestRace: Awaited<ReturnType<typeof listRaceAnalysisIndex>>[number] | undefined }) {
  if (!latestRace) {
    return (
      <section className="race-analysis-archive-hero race-analysis-archive-hero--empty">
        <div>
          <span className="race-analysis-kicker">Race Intelligence Archive</span>
          <h1>Post-race reports are building.</h1>
          <p>Race Analysis appears when product views are generated.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="race-analysis-archive-hero">
      <div className="race-analysis-archive-hero__copy">
        <span className="race-analysis-kicker">Race Intelligence Archive</span>
        <h1>{latestRace.raceName}</h1>
        <p>{latestRace.raceShape || "Post-race intelligence report."}</p>
        <div className="race-analysis-archive-hero__chips">
          <span>Race Intelligence Available</span>
          <span>{latestRace.dominantStrategy || "Strategy view"}</span>
          <span>{shortWeather(latestRace.weatherSummary)}</span>
          <span>{latestRace.raceControlAvailable ? "Track-status context" : "Track-status feed quiet"}</span>
        </div>
      </div>
      <Link href={`/race-analysis/${latestRace.id}`} className="race-analysis-archive-hero__board">
        <span>Latest report</span>
        <strong>{latestRace.winner}</strong>
        <small>{latestRace.winnerTeam}</small>
        <div>
          <em>Podium</em>
          <b>{podiumLabel(latestRace.podium)}</b>
        </div>
        <div>
          <em>Quality</em>
          <b>{getRaceAnalysisConfidenceTier(latestRace.analysisQualityScore)}</b>
        </div>
      </Link>
    </section>
  );
}

function RaceAnalysisArchiveGrid({ races }: { races: Awaited<ReturnType<typeof listRaceAnalysisIndex>> }) {
  return (
    <section className="race-analysis-archive-grid" aria-label="Available race analysis">
      {races.map((race) => (
        <Link href={`/race-analysis/${race.id}`} className="race-analysis-archive-tile" key={race.id}>
          <div className="race-analysis-archive-tile__topline">
            <span>{race.season} · R{race.round}</span>
            <span>{race.freshnessStatus === "ready" ? "Race Intelligence Available" : race.freshnessStatus}</span>
          </div>
          <div className="race-analysis-archive-tile__main">
            <div>
              <h2>{race.raceName}</h2>
              <p>{formatCircuit(race.circuit)} / {formatDate(race.raceDate)}</p>
            </div>
            <div className="race-analysis-archive-tile__winner">
              <span>Winner</span>
              <strong>{race.winner}</strong>
              <small>{race.winnerTeam}</small>
            </div>
          </div>
          <div className="race-analysis-archive-tile__podium">
            <span>Podium</span>
            <strong>{podiumLabel(race.podium)}</strong>
          </div>
          <div className="race-analysis-archive-tile__chips">
            <span>{race.dominantStrategy || "Strategy view"}</span>
            <span>{race.raceShape || "Race shape"}</span>
            <span>{shortWeather(race.weatherSummary)}</span>
            <span>{getRaceAnalysisConfidenceTier(race.analysisQualityScore)}</span>
            <span>{race.raceControlAvailable ? "Track-status context" : "Track-status feed quiet"}</span>
          </div>
        </Link>
      ))}
    </section>
  );
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
      <RaceAnalysisIndexHero latestRace={latestRace} />

      <section className="race-analysis-command-strip" aria-label="Race analysis filters">
        <div className="race-analysis-command-strip__identity">
          <span>Post-race archive</span>
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

      <RaceAnalysisArchiveGrid races={visibleRaces} />

      <AppFooter />
    </main>
  );
}
