import Link from "next/link";
import { notFound } from "next/navigation";
import { AppFooter } from "@/components/ui/app-footer";
import { AppHeader } from "@/components/ui/app-header";
import {
  getRaceAnalysisConfidenceTier,
  getRaceAnalysisDetail,
  listRaceAnalysisIndex,
  type RaceAnalysisDetail,
  type RaceAnalysisPacePoint,
  type RaceAnalysisPositionPoint,
  type RaceAnalysisStint,
} from "@/lib/server/race-analysis-product";

type RaceAnalysisDetailPageProps = {
  params: Promise<{ raceId: string }>;
};

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

function formatCircuit(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function signed(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  if (Math.abs(value) < 0.005) return `0${unit}`;
  return `${value > 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}${unit}`;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined) return "Data limited";
  return getRaceAnalysisConfidenceTier(value);
}

function compoundClass(compound: string) {
  return `race-analysis-compound race-analysis-compound--${compound.toLowerCase()}`;
}

function maxLap(race: RaceAnalysisDetail) {
  return Math.max(
    1,
    ...race.stints.map((stint) => stint.endLap ?? 0),
    ...race.positionTimeline.map((point) => point.lapNumber ?? 0),
    ...race.paceEvolution.map((point) => point.lapNumber ?? 0),
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

function pointStyle(lapNumber: number | null | undefined, value: number | null | undefined, min: number, max: number, maxRaceLap: number) {
  if (value === null || value === undefined) return { left: `${lapPct(lapNumber, maxRaceLap)}%`, top: "50%" };
  const span = Math.max(1, max - min);
  const top = 100 - ((value - min) / span) * 100;
  return { left: `${lapPct(lapNumber, maxRaceLap)}%`, top: `${Math.max(6, Math.min(94, top))}%` };
}

function RaceStoryTimeline({ race }: { race: RaceAnalysisDetail }) {
  return (
    <section className="race-analysis-section">
      <div className="race-analysis-section__header">
        <span>01 · Race Story</span>
        <h2>Timeline</h2>
      </div>
      <div className="race-analysis-timeline">
        {race.storyPoints.map((point) => (
          <article className="race-analysis-timeline-card" key={point.id}>
            <div className="race-analysis-timeline-card__rail">
              <span>Lap {point.lapNumber ?? "-"}</span>
              <i style={{ height: `${Math.max(18, (point.impactScore ?? 0.4) * 72)}px` }} />
            </div>
            <div>
              <div className="race-analysis-chip-row">
                <span>{point.phase}</span>
                <span>{point.evidenceType}</span>
                <span>{pct(point.confidence)}</span>
              </div>
              <h3>{point.title}</h3>
              <p>{point.summary}</p>
              {point.dataLimitNote ? <small>{point.dataLimitNote}</small> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TyreStrategyOverview({ race }: { race: RaceAnalysisDetail }) {
  const max = maxLap(race);
  const grouped = groupByDriver<RaceAnalysisStint>(race.stints).slice(0, 8);

  return (
    <section className="race-analysis-section">
      <div className="race-analysis-section__header">
        <span>02 · Tyre Strategy</span>
        <h2>Stint architecture</h2>
      </div>
      <div className="race-analysis-stint-board">
        {grouped.map(([driver, stints]) => (
          <div className="race-analysis-stint-row" key={driver}>
            <div className="race-analysis-stint-row__label">
              <strong>{driver}</strong>
              <span>{stints[0]?.team}</span>
            </div>
            <div className="race-analysis-stint-track">
              {stints.map((stint) => {
                const left = lapPct(stint.startLap, max);
                const width = Math.max(3, lapPct((stint.endLap ?? 0) - (stint.startLap ?? 0) + 1, max));
                return (
                  <span
                    className={compoundClass(stint.compound)}
                    key={`${driver}-${stint.stintNumber}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${stint.compound} laps ${stint.startLap}-${stint.endLap}`}
                  >
                    {stint.compound.slice(0, 1)}
                  </span>
                );
              })}
            </div>
            <div className="race-analysis-stint-row__metric">
              {signed(stints.reduce((sum, stint) => sum + (stint.degradationSPerLap ?? 0), 0) / Math.max(1, stints.length), "s/lap")}
            </div>
          </div>
        ))}
      </div>
      <div className="race-analysis-pit-strip">
        {race.pitStops.slice(0, 10).map((stop) => (
          <div className="race-analysis-pit-card" key={`${stop.driver}-${stop.pitStopNumber}-${stop.pitLap}`}>
            <span>Lap {stop.pitLap}</span>
            <strong>{stop.driver}</strong>
            <small>{stop.compoundFrom} → {stop.compoundTo} · {signed(stop.netPositionChange)} pos</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function PositionEvolution({ race }: { race: RaceAnalysisDetail }) {
  const max = maxLap(race);
  const grouped = groupByDriver<RaceAnalysisPositionPoint>(race.positionTimeline).slice(0, 4);

  return (
    <section className="race-analysis-section race-analysis-section--wide">
      <div className="race-analysis-section__header">
        <span>03 · Position Evolution</span>
        <h2>Movement map</h2>
      </div>
      <div className="race-analysis-position-panel">
        <div className="race-analysis-position-chart">
          {grouped.map(([driver, points], driverIndex) => (
            <div className="race-analysis-position-line" key={driver}>
              <strong style={{ top: `${0.75 + driverIndex * 1.35}rem` }}>{driver}</strong>
              {points.map((point) => (
                <i
                  key={`${driver}-${point.lapNumber}`}
                  style={{
                    left: `${lapPct(point.lapNumber, max)}%`,
                    top: `${Math.max(5, Math.min(92, ((point.position ?? 20) / 22) * 90))}%`,
                    background: `hsl(${driverIndex * 62 + 2} 84% 58%)`,
                  }}
                  title={`${driver} lap ${point.lapNumber}: P${point.position}`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="race-analysis-swing-list">
          {race.positionSwings.slice(0, 6).map((swing) => (
            <article key={swing.id}>
              <span>{swing.eventType}</span>
              <strong>{swing.driver} {signed(swing.positionDelta)} pos</strong>
              <small>Lap {swing.startLap} · {swing.evidenceType} · not pass-by-pass verified</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PaceEvolution({ race }: { race: RaceAnalysisDetail }) {
  const grouped = groupByDriver<RaceAnalysisPacePoint>(race.paceEvolution).slice(0, 4);
  const values = race.paceEvolution.map((point) => point.rollingPaceDeltaS ?? 0);
  const min = Math.min(-1, ...values);
  const max = Math.max(1, ...values);
  const raceMaxLap = maxLap(race);

  return (
    <section className="race-analysis-section">
      <div className="race-analysis-section__header">
        <span>04 · Pace Evolution</span>
        <h2>Pace ribbons</h2>
      </div>
      <div className="race-analysis-ribbon-board">
        {grouped.map(([driver, points]) => (
          <div className="race-analysis-ribbon" key={driver}>
            <div>
              <strong>{driver}</strong>
              <span>{points[0]?.team}</span>
            </div>
            <div className="race-analysis-ribbon__track">
              {points.slice(0, 34).map((point) => (
                <i key={`${driver}-${point.lapNumber}`} style={pointStyle(point.lapNumber, point.rollingPaceDeltaS, min, max, raceMaxLap)} title={`${signed(point.rollingPaceDeltaS, "s")} rolling delta`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrafficContext({ race }: { race: RaceAnalysisDetail }) {
  const samples = race.trafficProxy.slice(0, 36);
  const maxDirtyAir = Math.max(0.1, ...samples.map((item) => item.dirtyAirProxyS ?? 0));

  return (
    <section className="race-analysis-section">
      <div className="race-analysis-section__header">
        <span>05 · Traffic & Status</span>
        <h2>Pressure field</h2>
      </div>
      <div className="race-analysis-pressure-grid">
        {samples.map((item) => (
          <div className="race-analysis-pressure-cell" key={`${item.driver}-${item.lapNumber}`}>
            <span>{item.driver} L{item.lapNumber}</span>
            <i style={{ width: `${Math.max(8, Math.min(100, ((item.dirtyAirProxyS ?? 0) / maxDirtyAir) * 100))}%` }} />
            <small>{item.trafficProxyLabel}</small>
          </div>
        ))}
      </div>
      <div className="race-analysis-neutralization-strip">
        {race.neutralizationPhases.length ? race.neutralizationPhases.map((phase) => (
          <div key={phase.id}>
            <strong>{phase.statusLabel}</strong>
            <span>Laps {phase.startLap}-{phase.endLap}</span>
            <small>{phase.causeAvailable ? "Cause sourced" : "Cause unavailable"}</small>
          </div>
        )) : (
          <div>
            <strong>Green-running context</strong>
            <span>No neutralization phases in product view</span>
            <small>Track-status feed only</small>
          </div>
        )}
      </div>
    </section>
  );
}

function WeatherStrip({ race }: { race: RaceAnalysisDetail }) {
  const samples = race.weatherContext.slice(0, 20);
  return (
    <div className="race-analysis-weather-strip" aria-label="Weather context">
      {samples.map((sample) => (
        <span key={`${sample.lapNumber}-${sample.weatherImpactLabel}`}>
          L{sample.lapNumber} · {sample.weatherState} · {sample.trackTempC?.toFixed(1) ?? "-"}C
        </span>
      ))}
    </div>
  );
}

function CrossLinks({ race }: { race: RaceAnalysisDetail }) {
  return (
    <section className="race-analysis-crosslinks">
      {race.links.map((link) => link.enabled ? (
        <Link key={link.surface} href={link.href}>
          <span>{link.label}</span>
          <strong>{link.relevanceNote}</strong>
        </Link>
      ) : (
        <div key={link.surface} aria-disabled="true">
          <span>{link.label}</span>
          <strong>{link.unavailableReason ?? "Unavailable"}</strong>
        </div>
      ))}
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
    <main className="race-analysis-page race-analysis-page--detail">
      <AppHeader title="F1 InsightX" eyebrow="Race Analysis" actionHref="/race-analysis" actionLabel="All races" />

      <section className="race-analysis-detail-hero">
        <div className="race-analysis-detail-hero__glow" aria-hidden="true" />
        <div className="race-analysis-detail-hero__copy">
          <span className="race-analysis-kicker">{race.season} · Round {race.round}</span>
          <h1>{race.raceName}</h1>
          <div className="race-analysis-hero-meta">
            <span>{formatCircuit(race.circuit)}</span>
            <span>{formatDate(race.raceDate)}</span>
            <span>{pct(race.summary.confidence)}</span>
          </div>
        </div>
        <div className="race-analysis-hero-board">
          <div>
            <span>Winner</span>
            <strong>{race.winner}</strong>
            <small>{race.winnerTeam}</small>
          </div>
          <div>
            <span>Podium</span>
            <strong>{race.podium.join(" · ")}</strong>
            <small>{race.summary.winningCompoundPath}</small>
          </div>
          <div>
            <span>Dominant strategy</span>
            <strong>{race.dominantStrategy}</strong>
            <small>{race.raceShape}</small>
          </div>
        </div>
        <div className="race-analysis-chip-row race-analysis-chip-row--hero">
          <span>{race.summary.keyPaceFactor}</span>
          <span>{race.weatherSummary}</span>
          <span>{race.neutralizationPhases.length ? "Track-status context available" : "Track-status feed quiet"}</span>
          <span>Telemetry-derived</span>
        </div>
      </section>

      <section className="race-analysis-command-grid">
        <article>
          <span>Strategy factor</span>
          <strong>{race.summary.keyStrategyFactor}</strong>
        </article>
        <article>
          <span>Position factor</span>
          <strong>{race.summary.keyPositionFactor}</strong>
        </article>
        <article>
          <span>Weakest assumption</span>
          <strong>{race.summary.weakestAssumption}</strong>
        </article>
      </section>

      <WeatherStrip race={race} />
      <RaceStoryTimeline race={race} />
      <TyreStrategyOverview race={race} />
      <PositionEvolution race={race} />
      <PaceEvolution race={race} />
      <TrafficContext race={race} />
      <CrossLinks race={race} />

      <AppFooter />
    </main>
  );
}
