import Link from "next/link";
import type { CSSProperties } from "react";
import { AppFooter } from "@/components/ui/app-footer";
import { AssetImage } from "@/components/ui/asset-image";
import { RaceWeekSectorTrack } from "@/components/race-week/race-week-sector-track";
import { getRaceAnalysisConfidenceTier, listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";
import { formatSeasonRaceLabel, getSeasonState } from "@/lib/server/season-state";
import { getCircuitAsset, getTeamAsset, getTeamLogoPath } from "@/lib/ui/asset-manifest";
import { getCurrentDriverMetaByCode, getDriverImagePath } from "@/lib/ui/driver-asset-manifest";

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

function formatRaceCardTitle(value: string) {
  return value
    .replace(/\s+Grand Prix$/i, " GP")
    .replace(/^British GP$/i, "Britain GP");
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
  const winnerLogoPath = getTeamLogoPath(team, team.preferredLogoPlate === "light" ? "light" : "dark");
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
          {winnerLogoPath ? (
            <AssetImage
              src={winnerLogoPath}
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

async function RaceAnalysisArchiveCard({ race }: { race: RaceIndexItem }) {
  const team = getTeamAsset(race.winnerTeam);
  const logoPath = getTeamLogoPath(team, team.preferredLogoPlate === "light" ? "light" : "dark");
  const driverMeta = getCurrentDriverMetaByCode(race.winner);
  const circuit = getCircuitAsset(race.circuit);

  return (
    <Link
      href={`/race-analysis/${race.id}`}
      className="race-cinema-archive-tile"
      key={race.id}
      style={archiveStyle(race)}
    >
      <div className="race-cinema-archive-tile__map" aria-hidden="true">
        <RaceWeekSectorTrack
          circuitId={race.circuit}
          title={race.raceName}
          presentation="hero"
          showLegend={false}
          showMetadata={false}
          showSpecs={false}
        />
      </div>
      <div className="race-cinema-archive-tile__copy">
        <div className="race-cinema-archive-tile__topline">
          <span>{race.season} / Round {race.round}</span>
          <span>{getRaceAnalysisConfidenceTier(race.analysisQualityScore)}</span>
        </div>
        <h2>{formatRaceCardTitle(race.raceName)}</h2>
        <p>{circuit.displayName} / {formatDate(race.raceDate)}</p>
        <dl>
          <div>
            <dt>Winner</dt>
            <dd>{race.winner}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{race.dominantStrategy || "Strategy view"}</dd>
          </div>
        </dl>
      </div>
      <div className="race-cinema-archive-tile__driver">
        <AssetImage
          src={getDriverImagePath(driverMeta, "body")}
          fallbackSrc={driverMeta.fallbackPhotoPath}
          alt=""
          className="race-cinema-archive-tile__driver-image"
          fill
          sizes="(max-width: 760px) 48vw, 18rem"
          style={{
            objectFit: driverMeta.photoFit ?? "contain",
            objectPosition: driverMeta.photoPosition,
            transform: `translateX(${driverMeta.photoTranslateX ?? 0}px) scale(${driverMeta.photoScale ?? 1})`,
          }}
        />
      </div>
      <div className="race-cinema-archive-tile__winner">
        {logoPath ? (
          <AssetImage
            src={logoPath}
            fallbackSrc={team.fallbackImagePath}
            alt=""
            className="race-cinema-archive-tile__logo"
            width={54}
            height={54}
          />
        ) : null}
        <strong>{driverMeta.displayName}</strong>
        <small>{team.label}</small>
      </div>
      <div className="race-cinema-archive-tile__signals">
        <span>{podiumLabel(race.podium)}</span>
        <span>{race.raceControlAvailable ? "Track-status context" : "Track-status feed quiet"}</span>
      </div>
    </Link>
  );
}

async function RaceAnalysisArchiveGrid({ races }: { races: RaceIndexItem[] }) {
  const cards = await Promise.all(races.map((race) => RaceAnalysisArchiveCard({ race })));
  return (
    <section className="race-cinema-archive-grid" aria-label="Available race analysis">
      {cards}
    </section>
  );
}

export default async function RaceAnalysisIndexPage({ searchParams }: RaceAnalysisIndexPageProps) {
  const params = await searchParams;
  const [races, seasonState] = await Promise.all([listRaceAnalysisIndex(), getSeasonState()]);
  const seasons = [...new Set(races.map((race) => race.season))].sort((a, b) => b - a);
  const selectedSeason = Number(firstParam(params?.season)) || seasons[0];
  const visibleRaces = races.filter((race) => race.season === selectedSeason);
  const latestRace = races[0];
  const analysisLatest = seasonState?.race_analysis_available.latest_race ?? null;
  const latestResults = seasonState?.latest_completed_race_with_results ?? seasonState?.latest_completed_race ?? null;
  const showFreshnessNote = Boolean(
    analysisLatest &&
      latestResults &&
      analysisLatest.id &&
      latestResults.id &&
      analysisLatest.id !== latestResults.id,
  );

  return (
    <main className="race-analysis-page race-cinema-page">
      <RaceAnalysisIndexHero latestRace={latestRace} />

      {showFreshnessNote ? (
        <section className="race-analysis-freshness-note" aria-label="Race Analysis freshness">
          <span>Data status</span>
          <strong>{formatSeasonRaceLabel(latestResults)} race-analysis build pending.</strong>
          <p>Race Analysis is currently available through {formatSeasonRaceLabel(analysisLatest)}.</p>
        </section>
      ) : null}

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

      {await RaceAnalysisArchiveGrid({ races: visibleRaces })}

      <AppFooter />
    </main>
  );
}
