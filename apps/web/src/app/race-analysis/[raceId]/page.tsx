import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { AppFooter } from "@/components/ui/app-footer";
import { AssetImage } from "@/components/ui/asset-image";
import {
  PositionMovementExplorer,
  type PositionMovementSeries,
} from "@/components/race-analysis/position-movement-explorer";
import { TrackMap } from "@/components/ui/track-map";
import {
  getRaceAnalysisConfidenceTier,
  getRaceAnalysisDetail,
  listRaceAnalysisIndex,
  type RaceAnalysisDetail,
  type RaceAnalysisPacePoint,
  type RaceAnalysisPitStop,
  type RaceAnalysisPositionPoint,
  type RaceAnalysisStint,
  type RaceAnalysisStoryPoint,
  type RaceAnalysisTrafficPoint,
} from "@/lib/server/race-analysis-product";
import { getCircuitAsset, getTeamAsset } from "@/lib/ui/asset-manifest";
import { getCurrentDriverMetaByCode } from "@/lib/ui/driver-asset-manifest";

type RaceAnalysisDetailPageProps = {
  params: Promise<{ raceId: string }>;
};

type SectionIconName = "story" | "strategy" | "position" | "pace" | "traffic" | "data";

const sectionNav: Array<{ id: string; label: string; icon: SectionIconName }> = [
  { id: "story", label: "Story", icon: "story" },
  { id: "strategy", label: "Strategy", icon: "strategy" },
  { id: "position", label: "Position", icon: "position" },
  { id: "pace", label: "Pace", icon: "pace" },
  { id: "traffic", label: "Traffic", icon: "traffic" },
  { id: "data", label: "Data", icon: "data" },
];

export async function generateStaticParams() {
  const races = await listRaceAnalysisIndex();
  return races.slice(0, 12).map((race) => ({ raceId: race.id }));
}

export async function generateMetadata({ params }: RaceAnalysisDetailPageProps) {
  const { raceId } = await params;
  const race = await getRaceAnalysisDetail(raceId);
  return {
    title: race ? `${race.raceName} Race Analysis | F1 InsightX` : "Race Analysis | F1 InsightX",
  };
}

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function signed(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 0.005) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}${unit}`;
}

function qualityLabel(value: number | null | undefined) {
  return getRaceAnalysisConfidenceTier(value);
}

function qualityPct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function maxLap(race: RaceAnalysisDetail) {
  return Math.max(
    1,
    ...race.stints.map((stint) => stint.endLap ?? 0),
    ...race.positionTimeline.map((point) => point.lapNumber ?? 0),
    ...race.paceEvolution.map((point) => point.lapNumber ?? 0),
    ...race.storyPoints.map((point) => point.lapNumber ?? 0),
  );
}

function lapPct(lap: number | null | undefined, max: number) {
  if (!lap) return 0;
  return Math.max(0, Math.min(100, (lap / max) * 100));
}

function groupByDriver<T extends { driver: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const list = groups.get(row.driver) ?? [];
    list.push(row);
    groups.set(row.driver, list);
  }
  return [...groups.entries()];
}

function finalPositionMap(race: RaceAnalysisDetail) {
  const latest = new Map<string, RaceAnalysisPositionPoint>();
  for (const point of race.positionTimeline) {
    if (!point.driver || point.lapNumber === null || point.position === null) continue;
    const current = latest.get(point.driver);
    if (!current || (point.lapNumber ?? 0) >= (current.lapNumber ?? 0)) {
      latest.set(point.driver, point);
    }
  }
  return new Map([...latest.entries()].map(([driver, point]) => [driver, point.position ?? null]));
}

function classificationOrder(race: RaceAnalysisDetail) {
  const finalPositions = finalPositionMap(race);
  const podiumOrder = [race.winner, ...race.podium.filter((driver) => driver !== race.winner)].filter(Boolean);
  const podiumRank = new Map(podiumOrder.map((driver, index) => [driver, index + 1]));
  const drivers = new Set<string>();
  for (const driver of podiumOrder) if (driver) drivers.add(driver);
  for (const row of race.positionTimeline) if (row.driver) drivers.add(row.driver);
  for (const row of race.stints) if (row.driver) drivers.add(row.driver);
  for (const row of race.pitStops) if (row.driver) drivers.add(row.driver);

  return [...drivers].sort((a, b) => {
    const aPodium = podiumRank.get(a);
    const bPodium = podiumRank.get(b);
    if (aPodium && bPodium) return aPodium - bPodium;
    if (aPodium) return -1;
    if (bPodium) return 1;
    const aPosition = finalPositions.get(a);
    const bPosition = finalPositions.get(b);
    if (aPosition !== null && aPosition !== undefined && bPosition !== null && bPosition !== undefined) {
      return aPosition - bPosition;
    }
    if (aPosition !== null && aPosition !== undefined) return -1;
    if (bPosition !== null && bPosition !== undefined) return 1;
    return a.localeCompare(b);
  });
}

function classificationRankMap(race: RaceAnalysisDetail) {
  return new Map(classificationOrder(race).map((driver, index) => [driver, index + 1]));
}

type StintDriverGroup = {
  driver: string;
  stints: RaceAnalysisStint[];
  team: string | null;
  finalPosition: number | null;
};

function buildStintGroups(race: RaceAnalysisDetail): StintDriverGroup[] {
  const grouped = new Map(groupByDriver<RaceAnalysisStint>(race.stints));
  const ranks = classificationRankMap(race);
  return classificationOrder(race)
    .map((driver) => {
      const stints = (grouped.get(driver) ?? []).toSorted((a, b) => (a.stintNumber ?? 0) - (b.stintNumber ?? 0));
      return {
        driver,
        stints,
        team: stints[0]?.team ?? driverTeam(race, driver),
        finalPosition: ranks.get(driver) ?? null,
      };
    })
    .filter((item) => item.stints.length > 0);
}

function buildPositionSeries(race: RaceAnalysisDetail): PositionMovementSeries[] {
  const grouped = new Map(groupByDriver<RaceAnalysisPositionPoint>(race.positionTimeline));
  const ranks = classificationRankMap(race);
  return classificationOrder(race)
    .map((driver) => {
      const points = (grouped.get(driver) ?? [])
        .filter((point) => point.lapNumber !== null && point.position !== null)
        .toSorted((a, b) => (a.lapNumber ?? 0) - (b.lapNumber ?? 0));
      const teamName = points[0]?.team ?? driverTeam(race, driver);
      const team = getTeamAsset(teamName);
      const first = points[0];
      const last = points.at(-1);
      return {
        driver,
        team: team.label,
        color: team.primary,
        secondaryColor: team.secondary,
        finalPosition: ranks.get(driver) ?? last?.position ?? null,
        startPosition: first?.position ?? null,
        positionDelta: first?.position !== null && first?.position !== undefined && last?.position !== null && last?.position !== undefined
          ? first.position - last.position
          : null,
        points: points.map((point) => ({
          lap: point.lapNumber ?? 0,
          position: point.position ?? 0,
          phase: point.phase,
          status: point.trackStatusLabel,
        })),
      };
    })
    .filter((item) => item.points.length > 1);
}

function driverTeam(race: RaceAnalysisDetail, driver: string) {
  return (
    race.stints.find((stint) => stint.driver === driver)?.team
    ?? race.pitStops.find((stop) => stop.driver === driver)?.team
    ?? race.positionTimeline.find((point) => point.driver === driver)?.team
    ?? race.paceEvolution.find((point) => point.driver === driver)?.team
    ?? (driver === race.winner ? race.winnerTeam : null)
  );
}

function raceStyle(race: RaceAnalysisDetail): CSSProperties {
  const team = getTeamAsset(race.winnerTeam);
  return {
    "--race-team-primary": team.primary,
    "--race-team-secondary": team.secondary,
    "--race-team-accent": team.accent,
  } as CSSProperties;
}

function driverStyle(teamName: string | null | undefined): CSSProperties {
  const team = getTeamAsset(teamName);
  return {
    "--driver-team-primary": team.primary,
    "--driver-team-secondary": team.secondary,
  } as CSSProperties;
}

function compoundClass(compound: string) {
  return `race-cinema-compound race-cinema-compound--${compound.toLowerCase()}`;
}

function SectionIcon({ name }: { name: SectionIconName }) {
  const paths: Record<SectionIconName, string[]> = {
    story: ["M5 5h14v14H5z", "M8 9h8", "M8 13h5"],
    strategy: ["M4 16l4-8 4 5 4-7 4 10", "M4 20h16"],
    position: ["M5 18V9", "M12 18V5", "M19 18v-7", "M4 18h16"],
    pace: ["M12 20a8 8 0 1 0-8-8", "M12 12l4-4", "M8 12h1"],
    traffic: ["M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M17 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M4 21v-4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4"],
    data: ["M5 7c0-2 14-2 14 0v10c0 2-14 2-14 0z", "M5 12c0 2 14 2 14 0"],
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name].map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function RaceAnalysisRail() {
  return (
    <nav className="race-cinema-section-rail" aria-label="Race analysis sections">
      {sectionNav.map((item, index) => (
        <a href={`#${item.id}`} key={item.id}>
          <SectionIcon name={item.icon} />
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{item.label}</strong>
        </a>
      ))}
    </nav>
  );
}

async function RaceHero({ race }: { race: RaceAnalysisDetail }) {
  const winnerTeam = getTeamAsset(race.winnerTeam);
  const circuit = getCircuitAsset(race.circuit);
  const raceMax = maxLap(race);
  const quality = qualityPct(race.summary.confidence);
  const trackMap = await TrackMap({ circuitId: race.circuit, title: circuit.displayName, variant: "hero" });

  return (
    <section className="race-cinema-hero">
      <div className="race-cinema-atmosphere" aria-hidden="true">
        {winnerTeam.carImagePath ? (
          <AssetImage
            src={winnerTeam.carImagePath}
            fallbackSrc={winnerTeam.fallbackImagePath}
            alt=""
            className="race-cinema-atmosphere__car"
            fill
            priority
            sizes="100vw"
            style={{ objectPosition: winnerTeam.imagePosition, objectFit: winnerTeam.imageFit ?? "cover" }}
          />
        ) : null}
        <div className="race-cinema-atmosphere__grid" />
        <div className="race-cinema-atmosphere__speed" />
      </div>

      <div className="race-cinema-hero__copy">
        <span>Race Analysis</span>
        <h1>{race.raceName}</h1>
        <div className="race-cinema-hero__meta">
          <strong>{race.season} / Round {race.round}</strong>
          <strong>{formatDate(race.raceDate)}</strong>
          <strong>{circuit.displayName}</strong>
        </div>
      </div>

      <div className="race-cinema-hero__stage">
        <div className="race-cinema-track-panel">
          {trackMap}
          <div className="race-cinema-track-panel__sectors">
            <span>Story points {race.storyPoints.length}</span>
            <span>Max lap {raceMax}</span>
            <span>{race.raceShape || "Race shape"}</span>
          </div>
        </div>
        <div className="race-cinema-hero__summary">
          <article>
            <span>Winner</span>
            <strong>{race.winner}</strong>
            <small>{race.winnerTeam}</small>
          </article>
          <article>
            <span>Podium</span>
            <strong>{race.podium.join(" / ") || "Podium data"}</strong>
            <small>{race.summary.winningCompoundPath}</small>
          </article>
          <article>
            <span>Dominant strategy</span>
            <strong>{race.dominantStrategy}</strong>
            <small>{race.summary.keyStrategyFactor}</small>
          </article>
          <article>
            <span>Data confidence</span>
            <strong>{qualityLabel(race.summary.confidence)}</strong>
            {quality !== null ? <small>{quality}% product confidence</small> : <small>Data limited</small>}
          </article>
        </div>
      </div>
    </section>
  );
}

function RaceContextRail({ race }: { race: RaceAnalysisDetail }) {
  const podium = [race.winner, ...race.podium.filter((driver) => driver !== race.winner)].slice(0, 6);
  const quality = qualityPct(race.summary.confidence);

  return (
    <aside className="race-cinema-context-rail" aria-label="Race context">
      <div className="race-cinema-context-rail__header">
        <span>Classification</span>
        <strong>{race.dominantStrategy || "Strategy read"}</strong>
      </div>
      <div className="race-cinema-driver-stack">
        {podium.map((driver, index) => {
          const teamName = driverTeam(race, driver);
          const team = getTeamAsset(teamName);
          const driverMeta = getCurrentDriverMetaByCode(driver);
          return (
            <article key={`${driver}-${index}`} style={driverStyle(teamName)}>
              <span>{index + 1}</span>
              <div className="race-cinema-driver-stack__portrait">
                <AssetImage
                  src={driverMeta.photoPath ?? driverMeta.fallbackPhotoPath}
                  fallbackSrc={driverMeta.fallbackPhotoPath}
                  alt=""
                  className="race-cinema-driver-stack__photo"
                  fill
                  sizes="64px"
                  style={{
                    objectFit: driverMeta.photoFit ?? "contain",
                    objectPosition: driverMeta.photoPosition,
                    transform: `translateX(${driverMeta.photoTranslateX ?? 0}px) scale(${driverMeta.photoScale ?? 1})`,
                  }}
                />
              </div>
              <div>
                <strong>{driver}</strong>
                <small>{team.label}</small>
              </div>
              <div className={`race-cinema-driver-stack__logo-plate ${team.badgePlate === "light" ? "race-cinema-driver-stack__logo-plate--light" : ""}`}>
                {team.badgeAssetPath ? (
                  <AssetImage
                    src={team.badgeAssetPath}
                    fallbackSrc={team.fallbackImagePath}
                    alt={`${team.label} logo`}
                    className="race-cinema-driver-stack__logo"
                    width={48}
                    height={48}
                  />
                ) : (
                  <span>{team.shortLabel}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="race-cinema-rail-panel">
        <span>Weakest assumption</span>
        <strong>{race.summary.weakestAssumption}</strong>
      </div>
      <div className="race-cinema-rail-panel">
        <span>Data confidence</span>
        <div className="race-cinema-confidence-meter">
          <i><b style={{ width: `${quality ?? 0}%` }} /></i>
          <strong>{quality ?? "--"}%</strong>
        </div>
        <small>{qualityLabel(race.summary.confidence)}</small>
      </div>
    </aside>
  );
}

function RaceStorySection({ race }: { race: RaceAnalysisDetail }) {
  const raceMax = maxLap(race);
  const phaseNames = ["Launch", "Build", "Decide"];
  const laneForPoint = (point: RaceAnalysisStoryPoint) => {
    const phase = point.phase.toLowerCase();
    if (phase.includes("early") || phase.includes("opening") || (point.lapNumber ?? 0) < raceMax * 0.34) return 0;
    if (phase.includes("late") || phase.includes("closing") || (point.lapNumber ?? 0) > raceMax * 0.68) return 2;
    return 1;
  };
  return (
    <section id="story" className="race-cinema-section race-cinema-section--story">
      <div className="race-cinema-section__header">
        <span>01 / Story</span>
        <h2>Race timeline</h2>
        <p>{race.summary.primaryStory}</p>
      </div>
      <div className="race-cinema-timeline-scale">
        <div className="race-cinema-timeline-scale__axis" aria-hidden="true">
          <span>Lap 1</span>
          <span>Lap {Math.max(1, Math.round(raceMax / 2))}</span>
          <span>Lap {raceMax}</span>
        </div>
        {phaseNames.map((phase, index) => (
          <div className="race-cinema-timeline-lane" key={phase} style={{ "--story-lane": index } as CSSProperties}>
            <span>{phase}</span>
          </div>
        ))}
        {race.storyPoints.map((point) => (
          <article
            key={point.id}
            className="race-cinema-story-marker"
            style={{
              left: `${lapPct(point.lapNumber, raceMax)}%`,
              "--story-impact": `${Math.max(18, (point.impactScore ?? 0.4) * 72)}px`,
              "--story-lane": laneForPoint(point),
            } as CSSProperties}
          >
            <span>Lap {point.lapNumber ?? "-"}</span>
            <strong>{point.title}</strong>
            <small>{point.evidenceType} / {qualityLabel(point.confidence)}</small>
          </article>
        ))}
      </div>
      <div className="race-cinema-story-list">
        {race.storyPoints.map((point) => (
          <article key={point.id}>
            <span>{point.phase}</span>
            <h3>{point.title}</h3>
            <p>{point.summary}</p>
            {point.dataLimitNote ? <small>{point.dataLimitNote}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function StrategySection({ race }: { race: RaceAnalysisDetail }) {
  const raceMax = maxLap(race);
  const grouped = buildStintGroups(race);
  const topFive = grouped.slice(0, 5);
  const rest = grouped.slice(5);

  return (
    <section id="strategy" className="race-cinema-section race-cinema-section--strategy">
      <div className="race-cinema-section__header">
        <span>02 / Strategy</span>
        <h2>Stint architecture</h2>
        <p>{race.summary.keyStrategyFactor}</p>
      </div>
      <div className="race-cinema-stint-board">
        {topFive.map((group) => <StintRow group={group} raceMax={raceMax} key={group.driver} />)}
        {rest.length ? (
          <details className="race-cinema-stint-details">
            <summary>
              <strong>View full field</strong>
              <span>{rest.length} more drivers</span>
            </summary>
            <div>
              {rest.map((group) => <StintRow group={group} raceMax={raceMax} key={group.driver} />)}
            </div>
          </details>
        ) : null}
      </div>
      <PitImpactStrip stops={race.pitStops} />
    </section>
  );
}

function StintRow({ group, raceMax }: { group: StintDriverGroup; raceMax: number }) {
  const averageDegradation = group.stints.reduce((sum, stint) => sum + (stint.degradationSPerLap ?? 0), 0) / Math.max(1, group.stints.length);
  return (
    <div className="race-cinema-stint-row" style={driverStyle(group.team)}>
      <div className="race-cinema-stint-row__label">
        <strong>{group.finalPosition ? `P${group.finalPosition} ` : ""}{group.driver}</strong>
        <span>{group.team}</span>
      </div>
      <div className="race-cinema-stint-track">
        {group.stints.map((stint) => {
          const left = lapPct(stint.startLap, raceMax);
          const width = Math.max(3, lapPct((stint.endLap ?? 0) - (stint.startLap ?? 0) + 1, raceMax));
          return (
            <span
              className={compoundClass(stint.compound)}
              key={`${group.driver}-${stint.stintNumber}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${stint.compound} laps ${stint.startLap}-${stint.endLap}`}
            >
              {stint.compound.slice(0, 1)}
            </span>
          );
        })}
        {group.stints.slice(1).map((stint) => (
          <i
            aria-hidden="true"
            className="race-cinema-stint-change"
            key={`${group.driver}-change-${stint.stintNumber}`}
            style={{ left: `${lapPct(stint.startLap, raceMax)}%` }}
            title={`Tyre change lap ${stint.startLap}`}
          />
        ))}
      </div>
      <div className="race-cinema-stint-row__metric">
        {signed(averageDegradation, "s/lap")}
      </div>
    </div>
  );
}

function PitImpactStrip({ stops }: { stops: RaceAnalysisPitStop[] }) {
  return (
    <div className="race-cinema-pit-strip" aria-label="Pit stop impact">
      {stops.slice(0, 8).map((stop) => (
        <article key={`${stop.driver}-${stop.pitStopNumber}-${stop.pitLap}`} style={driverStyle(stop.team)}>
          <span>Lap {stop.pitLap}</span>
          <strong>{stop.driver}</strong>
          <small>{stop.compoundFrom} to {stop.compoundTo} / {signed(stop.netPositionChange)} pos</small>
        </article>
      ))}
    </div>
  );
}

function PositionSection({ race }: { race: RaceAnalysisDetail }) {
  const raceMax = maxLap(race);
  const series = buildPositionSeries(race);
  const defaultDrivers = series.slice(0, 5).map((item) => item.driver);
  const fieldSize = Math.max(20, ...series.flatMap((item) => item.points.map((point) => point.position)));

  return (
    <section id="position" className="race-cinema-section race-cinema-section--position">
      <div className="race-cinema-section__header">
        <span>03 / Position</span>
        <h2>Position movement proxy</h2>
        <p>{race.summary.keyPositionFactor}</p>
      </div>
      <div className="race-cinema-position-grid">
        <div>
          <PositionMovementExplorer
            series={series}
            defaultDrivers={defaultDrivers}
            maxLap={raceMax}
            fieldSize={fieldSize}
          />
          <p className="race-cinema-proxy-note">
            Position movement proxy uses lap-position snapshots from the product view. It shows field movement over time, not pass-by-pass attribution.
          </p>
        </div>
        <div className="race-cinema-swing-list">
          {race.positionSwings.slice(0, 7).map((swing) => (
            <article key={swing.id} style={driverStyle(swing.team)}>
              <span>{swing.eventType}</span>
              <strong>{swing.driver} {signed(swing.positionDelta)} pos</strong>
              <small>Lap {swing.startLap} / {swing.evidenceType}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PaceSection({ race }: { race: RaceAnalysisDetail }) {
  const grouped = groupByDriver<RaceAnalysisPacePoint>(race.paceEvolution).slice(0, 5);
  const values = race.paceEvolution.map((point) => point.rollingPaceDeltaS ?? 0);
  const min = Math.min(-1, ...values);
  const max = Math.max(1, ...values);
  const raceMax = maxLap(race);

  return (
    <section id="pace" className="race-cinema-section race-cinema-section--pace">
      <div className="race-cinema-section__header">
        <span>04 / Pace</span>
        <h2>Pace ribbons</h2>
        <p>{race.summary.keyPaceFactor}</p>
      </div>
      <div className="race-cinema-ribbon-board">
        {grouped.map(([driver, points]) => (
          <div className="race-cinema-ribbon" key={driver} style={driverStyle(points[0]?.team)}>
            <div>
              <strong>{driver}</strong>
              <span>{points[0]?.team}</span>
            </div>
            <div className="race-cinema-ribbon__track">
              {points.slice(0, 42).map((point) => {
                const span = Math.max(1, max - min);
                const top = 100 - (((point.rollingPaceDeltaS ?? 0) - min) / span) * 100;
                return (
                  <i
                    key={`${driver}-${point.lapNumber}`}
                    style={{
                      left: `${lapPct(point.lapNumber, raceMax)}%`,
                      top: `${Math.max(7, Math.min(93, top))}%`,
                    }}
                    title={`${signed(point.rollingPaceDeltaS, "s")} rolling delta`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrafficSection({ race }: { race: RaceAnalysisDetail }) {
  const samples = race.trafficProxy.slice(0, 42);
  const maxDirtyAir = Math.max(0.1, ...samples.map((item) => item.dirtyAirProxyS ?? 0));

  return (
    <section id="traffic" className="race-cinema-section race-cinema-section--traffic">
      <div className="race-cinema-section__header">
        <span>05 / Traffic</span>
        <h2>Traffic and status field</h2>
        <p>Traffic proxy and neutralization context stay labelled as source-limited where needed.</p>
      </div>
      <div className="race-cinema-pressure-grid">
        {samples.map((item) => (
          <TrafficCell key={`${item.driver}-${item.lapNumber}`} item={item} maxDirtyAir={maxDirtyAir} />
        ))}
      </div>
      <div className="race-cinema-neutralization-strip">
        {race.neutralizationPhases.length ? race.neutralizationPhases.map((phase) => (
          <article key={phase.id}>
            <strong>{phase.statusLabel}</strong>
            <span>Laps {phase.startLap}-{phase.endLap}</span>
            <small>{phase.causeAvailable ? "Cause sourced" : "Cause unavailable"}</small>
          </article>
        )) : (
          <article>
            <strong>Green-running context</strong>
            <span>No neutralization phases in product view</span>
            <small>Track-status feed only</small>
          </article>
        )}
      </div>
    </section>
  );
}

function TrafficCell({ item, maxDirtyAir }: { item: RaceAnalysisTrafficPoint; maxDirtyAir: number }) {
  return (
    <div className="race-cinema-pressure-cell" style={driverStyle(item.team)}>
      <span>{item.driver} L{item.lapNumber}</span>
      <i><b style={{ width: `${Math.max(8, Math.min(100, ((item.dirtyAirProxyS ?? 0) / maxDirtyAir) * 100))}%` }} /></i>
      <small>{item.trafficProxyLabel}</small>
    </div>
  );
}

function DataSection({ race }: { race: RaceAnalysisDetail }) {
  const quality = qualityPct(race.summary.confidence);
  return (
    <section id="data" className="race-cinema-section race-cinema-section--data">
      <div className="race-cinema-section__header">
        <span>06 / Data</span>
        <h2>Source confidence</h2>
        <p>Product honesty labels are preserved on proxy-derived analysis.</p>
      </div>
      <div className="race-cinema-data-grid">
        <article>
          <span>Confidence</span>
          <strong>{qualityLabel(race.summary.confidence)}</strong>
          <small>{quality !== null ? `${quality}%` : "Data limited"}</small>
        </article>
        <article>
          <span>Weakest assumption</span>
          <strong>{race.summary.weakestAssumption}</strong>
        </article>
        <article>
          <span>Track status</span>
          <strong>{race.raceControlAvailable ? "Track-status context available" : "Track-status feed quiet"}</strong>
        </article>
        <article>
          <span>Weather</span>
          <strong>{race.weatherSummary || "Weather context unavailable"}</strong>
        </article>
      </div>
      <div className="race-cinema-weather-strip" aria-label="Weather context">
        {race.weatherContext.slice(0, 20).map((sample) => (
          <span key={`${sample.lapNumber}-${sample.weatherImpactLabel}`}>
            L{sample.lapNumber} / {sample.weatherState} / {sample.trackTempC?.toFixed(1) ?? "-"}C
          </span>
        ))}
      </div>
    </section>
  );
}

export default async function RaceAnalysisDetailPage({ params }: RaceAnalysisDetailPageProps) {
  const { raceId } = await params;
  const race = await getRaceAnalysisDetail(raceId);
  if (!race) {
    notFound();
  }

  return (
    <main className="race-analysis-page race-cinema-page race-cinema-detail" style={raceStyle(race)}>
      {await RaceHero({ race })}
      <div className="race-cinema-workspace">
        <RaceAnalysisRail />
        <div className="race-cinema-workspace__main">
          <RaceStorySection race={race} />
          <StrategySection race={race} />
          <PositionSection race={race} />
          <PaceSection race={race} />
          <TrafficSection race={race} />
          <DataSection race={race} />
        </div>
        <RaceContextRail race={race} />
      </div>
      <AppFooter />
    </main>
  );
}
