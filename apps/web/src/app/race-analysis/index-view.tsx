import Link from "next/link";
import type { CSSProperties } from "react";
import { AppFooter } from "@/components/ui/app-footer";
import { AssetImage } from "@/components/ui/asset-image";
import { RaceWeekSectorTrack } from "@/components/race-week/race-week-sector-track";
import { getRaceAnalysisConfidenceTier, listRaceAnalysisIndex } from "@/lib/server/race-analysis-product";
import { formatSeasonRaceLabel, getSeasonState } from "@/lib/server/season-state";
import { getCircuitAsset, getTeamAsset, getTeamLogoPath } from "@/lib/ui/asset-manifest";
import { getCurrentDriverMetaByCode, getDriverImagePath } from "@/lib/ui/driver-asset-manifest";
import { formatDateLabel, formatDateTimeLabel } from "@/lib/ui/format-date";


type RaceIndexItem = Awaited<ReturnType<typeof listRaceAnalysisIndex>>[number];

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return formatDateLabel(value);
}

function podiumLabel(podium: string[]) {
  return podium.length ? podium.join(" / ") : "Podium data";
}

const STOP_WORDS: Record<number, string> = {
  0: "no-stop",
  1: "one-stop",
  2: "two-stop",
  3: "three-stop",
};

/**
 * Guard against implausible strategy labels (e.g. "5-stop majority" produced by
 * a pit-detection artefact). Anything above three stops is reported as
 * "multi-stop" rather than presented with false precision.
 */
function formatStrategyLabel(value: string | null | undefined) {
  if (!value) return "Strategy view";
  return value.replace(/\b(\d+)[-\s]?stop\b/i, (match, digits: string) => {
    const stops = Number.parseInt(digits, 10);
    if (!Number.isFinite(stops)) return match;
    return STOP_WORDS[stops] ?? "multi-stop";
  });
}

const TOP_CONFIDENCE_TIER = "Strong telemetry agreement";

/** Only surface signals that deviate from the norm — repeating the same badge on every card is noise. */
function exceptionSignals(race: RaceIndexItem) {
  const signals: string[] = [];
  const tier = getRaceAnalysisConfidenceTier(race.analysisQualityScore);
  if (tier !== TOP_CONFIDENCE_TIER) signals.push(tier);
  if (race.raceControlAvailable) signals.push("Track-status context");
  return signals;
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
          <div className="race-cinema-latest-panel__identity">
            <strong>{getCurrentDriverMetaByCode(latestRace.winner).displayName}</strong>
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
            <dd>{formatStrategyLabel(latestRace.dominantStrategy)}</dd>
          </div>
          <div>
            <dt>Quality</dt>
            <dd>{getRaceAnalysisConfidenceTier(latestRace.analysisQualityScore)}</dd>
          </div>
        </dl>
        <span className="race-cinema-latest-panel__cta">View full report →</span>
      </Link>
    </section>
  );
}

async function RaceAnalysisArchiveCard({ race }: { race: RaceIndexItem }) {
  const team = getTeamAsset(race.winnerTeam);
  const logoPath = getTeamLogoPath(team, team.preferredLogoPlate === "light" ? "light" : "dark");
  const driverMeta = getCurrentDriverMetaByCode(race.winner);
  const circuit = getCircuitAsset(race.circuit);
  const signals = exceptionSignals(race);

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
        </div>
        <h2>{formatRaceCardTitle(race.raceName)}</h2>
        <p>{circuit.displayName} / {formatDate(race.raceDate)}</p>
        <dl>
          <div>
            <dt>Podium</dt>
            <dd>{podiumLabel(race.podium)}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{formatStrategyLabel(race.dominantStrategy)}</dd>
          </div>
        </dl>
      </div>
      <div className="race-cinema-archive-tile__driver" aria-hidden="true">
        <AssetImage
          src={getDriverImagePath(driverMeta, "body")}
          fallbackSrc={driverMeta.fallbackPhotoPath}
          alt=""
          className="race-cinema-archive-tile__driver-image"
          fill
          sizes="(max-width: 760px) 40vw, 14rem"
          style={{ objectFit: "contain", objectPosition: "center bottom" }}
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
        <div className="race-cinema-archive-tile__identity">
          <strong>{driverMeta.displayName}</strong>
          <small>{team.label}</small>
        </div>
        <span className="race-cinema-archive-tile__cta">View report →</span>
      </div>
      {signals.length ? (
        <div className="race-cinema-archive-tile__signals">
          {signals.map((signal) => (
            <span key={signal}>{signal}</span>
          ))}
        </div>
      ) : null}
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

export async function RaceAnalysisIndexView({ season }: { season?: number }) {
  const [races, seasonState] = await Promise.all([listRaceAnalysisIndex(), getSeasonState()]);
  const seasons = [...new Set(races.map((race) => race.season))].sort((a, b) => b - a);
  const selectedSeason = season && seasons.includes(season) ? season : seasons[0];
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
          <strong>
            {visibleRaces.length} {visibleRaces.length === 1 ? "report" : "reports"}
          </strong>
          <p className="race-cinema-command-strip__legend">Card accent colour shows the winning team.</p>
        </div>
        <div className="race-cinema-season-switcher" role="group" aria-label="Season">
          {seasons.map((season) => (
            <Link
              key={season}
              href={season === seasons[0] ? "/race-analysis" : `/race-analysis/season/${season}`}
              className={season === selectedSeason ? "is-active" : ""}
              aria-current={season === selectedSeason ? "true" : undefined}
            >
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
