import Link from "next/link";
import type { CSSProperties } from "react";
import { AppFooter } from "@/components/ui/app-footer";
import { AssetImage } from "@/components/ui/asset-image";
import { getRaceAnalysisConfidenceTier, listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";
import { getCircuitAsset, getTeamAsset } from "@/lib/ui/asset-manifest";

type RaceAnalysisIndexPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RaceIndexItem = Awaited<ReturnType<typeof listRaceAnalysisIndex>>[number];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function podiumLabel(podium: string[]) {
  return podium.length ? podium.join(" / ") : "Podium data";
}

function archiveStyle(race: RaceIndexItem | undefined): CSSProperties {
  const team = getTeamAsset(race?.winnerTeam);
  return {
    "--race-team-primary": team.primary,
    "--race-team-secondary": team.secondary,
    "--race-team-accent": team.accent,
  } as CSSProperties;
}

function RaceAnalysisIndexHero({ latestRace }: { latestRace: RaceIndexItem | undefined }) {
  if (!latestRace) {
    return (
      <section className="race-cinema-archive-hero race-cinema-archive-hero--empty">
        <div className="race-cinema-archive-hero__copy">
          <span>Race Analysis</span>
          <h1>Post-race reports are building.</h1>
          <p>Race Analysis appears when product views are generated.</p>
        </div>
      </section>
    );
  }

  const team = getTeamAsset(latestRace.winnerTeam);
  const circuit = getCircuitAsset(latestRace.circuit);

  return (
    <section className="race-cinema-archive-hero" style={archiveStyle(latestRace)}>
      <div className="race-cinema-atmosphere" aria-hidden="true">
        {team.carImagePath ? (
          <AssetImage
            src={team.carImagePath}
            fallbackSrc={team.fallbackImagePath}
            alt=""
            className="race-cinema-atmosphere__car"
            fill
            priority
            sizes="100vw"
            style={{ objectPosition: team.imagePosition, objectFit: team.imageFit ?? "cover" }}
          />
        ) : null}
        <div className="race-cinema-atmosphere__grid" />
        <div className="race-cinema-atmosphere__speed" />
      </div>

      <div className="race-cinema-archive-hero__copy">
        <span>Race Analysis</span>
        <h1>{latestRace.raceName}</h1>
        <p>{latestRace.raceShape || "Post-race intelligence report."}</p>
        <div className="race-cinema-archive-hero__meta">
          <strong>{latestRace.season} R{latestRace.round}</strong>
          <strong>{formatDate(latestRace.raceDate)}</strong>
          <strong>{circuit.displayName}</strong>
        </div>
      </div>

      <Link href={`/race-analysis/${latestRace.id}`} className="race-cinema-latest-panel">
        <span>Latest report</span>
        <div className="race-cinema-latest-panel__winner">
          {team.badgeAssetPath ? (
            <AssetImage
              src={team.badgeAssetPath}
              fallbackSrc={team.fallbackImagePath}
              alt=""
              className="race-cinema-latest-panel__logo"
              width={72}
              height={72}
            />
          ) : null}
          <div>
            <strong>{latestRace.winner}</strong>
            <small>{latestRace.winnerTeam}</small>
          </div>
        </div>
        <dl>
          <div>
            <dt>Podium</dt>
            <dd>{podiumLabel(latestRace.podium)}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{latestRace.dominantStrategy || "Strategy view"}</dd>
          </div>
          <div>
            <dt>Quality</dt>
            <dd>{getRaceAnalysisConfidenceTier(latestRace.analysisQualityScore)}</dd>
          </div>
        </dl>
      </Link>
    </section>
  );
}

function RaceAnalysisArchiveGrid({ races }: { races: RaceIndexItem[] }) {
  return (
    <section className="race-cinema-archive-grid" aria-label="Available race analysis">
      {races.map((race) => {
        const team = getTeamAsset(race.winnerTeam);
        const circuit = getCircuitAsset(race.circuit);
        return (
          <Link
            href={`/race-analysis/${race.id}`}
            className="race-cinema-archive-tile"
            key={race.id}
            style={archiveStyle(race)}
          >
            <div className="race-cinema-archive-tile__stripe" />
            <div className="race-cinema-archive-tile__topline">
              <span>{race.season} / Round {race.round}</span>
              <span>{getRaceAnalysisConfidenceTier(race.analysisQualityScore)}</span>
            </div>
            <div className="race-cinema-archive-tile__main">
              <div>
                <h2>{race.raceName}</h2>
                <p>{circuit.displayName} / {formatDate(race.raceDate)}</p>
              </div>
              {team.badgeAssetPath ? (
                <AssetImage
                  src={team.badgeAssetPath}
                  fallbackSrc={team.fallbackImagePath}
                  alt=""
                  className="race-cinema-archive-tile__logo"
                  width={54}
                  height={54}
                />
              ) : null}
            </div>
            <div className="race-cinema-archive-tile__winner">
              <span>Winner</span>
              <strong>{race.winner}</strong>
              <small>{race.winnerTeam}</small>
            </div>
            <div className="race-cinema-archive-tile__signals">
              <span>{podiumLabel(race.podium)}</span>
              <span>{race.dominantStrategy || "Strategy view"}</span>
              <span>{race.raceControlAvailable ? "Track-status context" : "Track-status feed quiet"}</span>
            </div>
          </Link>
        );
      })}
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
    <main className="race-analysis-page race-cinema-page">
      <RaceAnalysisIndexHero latestRace={latestRace} />

      <section className="race-cinema-command-strip" aria-label="Race analysis filters">
        <div className="race-cinema-command-strip__identity">
          <span>Post-race archive</span>
          <strong>{selectedSeason}</strong>
        </div>
        <div className="race-cinema-season-switcher">
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
