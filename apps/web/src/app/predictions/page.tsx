import Link from "next/link";
import type { CSSProperties } from "react";
import { SiteFooter } from "@/components/ui/site-footer";
import { StatePanel } from "@/components/ui/state-panel";
import { TeamBadge } from "@/components/ui/team-badge";
import { RaceWeekSectorTrack } from "@/components/race-week/race-week-sector-track";
import { RaceWeekTimeToggle } from "@/components/race-week/race-week-time-toggle";
import { getRaceWeekProductResult, type RaceWeekPredictionModeId, type RaceWeekProduct } from "@/lib/server/race-week-product";
import { formatSeasonRaceLabel, getSeasonState } from "@/lib/server/season-state";
import { getCircuitAsset } from "@/lib/ui/asset-manifest";

type RaceTheme = {
  deck: string;
  shell: string;
  accent: string;
  accentSoft: string;
};

const raceThemeByCircuit: Record<string, RaceTheme> = {
  catalunya: {
    deck: "Long loaded corners, tyre stress, and balance through the final sector make race pace hard to fake here.",
    shell: "#10151b",
    accent: "#e10600",
    accentSoft: "#f4f6f8",
  },
  miami: {
    deck: "Warm night energy, long straights, and enough volatility to punish overconfident reads.",
    shell: "#10151b",
    accent: "#00a3ad",
    accentSoft: "#f4f6f8",
  },
  monaco: {
    deck: "Track position dominates here. One-lap shape and execution quality matter more than brute pace alone.",
    shell: "#10151b",
    accent: "#d7cfbf",
    accentSoft: "#ffffff",
  },
  red_bull_ring: {
    deck: "Short laps, heavy braking, and quick weather swings make traffic, track limits, and tyre warm-up hard to separate.",
    shell: "#10151b",
    accent: "#e10600",
    accentSoft: "#ffffff",
  },
  silverstone: {
    deck: "High-speed commitment and sustained balance usually decide whether the weekend stays clean or collapses late.",
    shell: "#10151b",
    accent: "#59a7ff",
    accentSoft: "#f7fbff",
  },
  spa: {
    deck: "Spa-Francorchamps. Elevation, weather, and strategy risk.",
    shell: "#10151b",
    accent: "#74d66f",
    accentSoft: "#ffffff",
  },
};

const fallbackTheme: RaceTheme = {
  deck: "A focused read on pace, readiness, strategy, and the signals most likely to matter before lights out.",
  shell: "#10151b",
  accent: "#e10600",
  accentSoft: "#ffffff",
};

const raceTimezoneByCircuit: Record<string, string> = {
  catalunya: "Europe/Madrid",
  miami: "America/New_York",
  monaco: "Europe/Monaco",
  red_bull_ring: "Europe/Vienna",
  silverstone: "Europe/London",
  spa: "Europe/Brussels",
};

const predictionModeIds: RaceWeekPredictionModeId[] = ["baseline", "fp1", "fp2", "fp3"];

type PredictionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function normalizePredictionMode(value: string | string[] | undefined): RaceWeekPredictionModeId {
  const mode = getFirstSearchParam(value);
  return predictionModeIds.includes(mode as RaceWeekPredictionModeId) ? (mode as RaceWeekPredictionModeId) : "baseline";
}

function predictionModeHref(mode: RaceWeekPredictionModeId) {
  return mode === "baseline" ? "/predictions" : `/predictions?mode=${mode}`;
}

function formatRaceDate(iso: string | null | undefined) {
  if (!iso) {
    return "Date pending";
  }
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDelta(value: number | null, digits = 2) {
  if (value === null || Number.isNaN(value)) {
    return "Not enough data";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}s`;
}

function formatTime(value: number | null, digits = 3) {
  if (value === null || Number.isNaN(value)) {
    return "Practice pending";
  }
  return `${value.toFixed(digits)}s`;
}

function formatQualifyingTime(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Pending";
  }
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(3).padStart(6, "0");
  return `${minutes}:${seconds}`;
}

function formatMethodLabel(value: string | null) {
  if (!value) {
    return "Season delta model";
  }
  return value.replace(/_/g, " ");
}

function getWeatherTone(value: number | null) {
  if (value === null) {
    return "Forecast pending";
  }
  if (value >= 70) {
    return "Weather is a major variable";
  }
  if (value >= 40) {
    return "Weather may shape the read";
  }
  return "Conditions are relatively stable";
}

function formatTemperature(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Forecast pending";
  }
  return `${Math.round(value)}C`;
}

function formatWind(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Forecast pending";
  }
  return `${value.toFixed(1)} m/s`;
}

function formatForecastUpdated(value: string | null | undefined) {
  if (!value) {
    return "Daily refresh pending";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Daily refresh pending";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getDataStatus(value: number | null) {
  return value !== null && value < 0.45 ? "Practice pending" : "Data ready";
}

function formatPoleGap(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Not enough data";
  }
  if (Math.abs(value) < 0.0005) {
    return "Pole";
  }
  return formatDelta(value, 3);
}

function getConfidenceBand(value: number | null, qComplete: boolean) {
  if (!qComplete) {
    return "Prediction";
  }
  if (value === null || Number.isNaN(value)) {
    return "Low";
  }
  if (value >= 0.72) {
    return "High";
  }
  if (value >= 0.45) {
    return "Medium";
  }
  return "Low";
}

function explainPredictionFlags(flags: string[]) {
  const labels: Record<string, string> = {
    race_week_delta_neutral: "Live FP/Q pending",
    same_circuit_driver_gap_missing: "No prior same-circuit driver history",
    constructor_delta_missing: "Constructor delta fallback",
    driver_delta_missing: "Driver delta fallback",
    season_delta_estimated: "Season delta estimated",
  };
  const explained = flags.map((flag) => labels[flag] ?? flag.replace(/_/g, " ")).filter(Boolean);
  return explained.length > 0 ? explained.join(" / ") : "Full model inputs";
}

function concise(value: string | null | undefined, maxLength = 116) {
  if (!value) {
    return "";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function sanitizeRaceWeekText(value: string | null | undefined, maxLength = 116) {
  return concise(value?.replace(/\s*Confidence is (?:low|medium|high)\.?/gi, "") ?? "", maxLength);
}

function buildIsoAtTrackTime(raceIso: string | null | undefined, offsetDays: number, utcHour: number, utcMinute: number) {
  if (!raceIso) {
    return new Date().toISOString();
  }
  const date = new Date(raceIso);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(utcHour, utcMinute, 0, 0);
  return date.toISOString();
}

function buildWeekendSessions(raceIso: string | null | undefined) {
  return [
    { label: "FP1", iso: buildIsoAtTrackTime(raceIso, -2, 11, 30), status: "Provisional" },
    { label: "FP2", iso: buildIsoAtTrackTime(raceIso, -2, 15, 0), status: "Provisional" },
    { label: "FP3", iso: buildIsoAtTrackTime(raceIso, -1, 10, 30), status: "Provisional" },
    { label: "Qualifying", iso: buildIsoAtTrackTime(raceIso, -1, 14, 0), status: "Provisional" },
    { label: "Race", iso: raceIso ?? buildIsoAtTrackTime(raceIso, 0, 13, 0), status: "Scheduled" },
  ];
}

function getSessionCode(label: string): "FP1" | "FP2" | "FP3" | "Q" | null {
  if (label === "FP1" || label === "FP2" || label === "FP3") {
    return label;
  }
  if (label === "Qualifying") {
    return "Q";
  }
  return null;
}

function getSessionStatusLabel(
  sessionCode: "FP1" | "FP2" | "FP3" | "Q",
  sessionIso: string,
  sessionStatus: RaceWeekProduct["sessionStatus"],
) {
  const status = sessionStatus.find((entry) => entry.sessionCode === sessionCode);
  if (status?.status === "complete") {
    return "Complete";
  }

  const sessionStart = new Date(sessionIso).getTime();
  const unavailableAfter = sessionStart + (60 + 30 + 6 * 60) * 60 * 1000;
  if (Number.isFinite(sessionStart) && Date.now() > unavailableAfter) {
    return "Unavailable";
  }

  return "Pending";
}

function getSessionStatusDetail(sessionCode: "FP1" | "FP2" | "FP3" | "Q", productStatus: string, rows: number) {
  if (sessionCode === "Q") {
    if (productStatus === "Complete") {
      return "Ready";
    }
    if (productStatus === "Unavailable") {
      return "No data";
    }
    return "Pending";
  }

  if (rows > 0) {
    return "Ready";
  }
  return productStatus === "Unavailable" ? "No data" : "Pending";
}

export default async function PredictionsPage({ searchParams }: PredictionsPageProps) {
  const params = await searchParams;
  const selectedPredictionMode = normalizePredictionMode(params?.mode);
  const [raceWeekResult, seasonState] = await Promise.all([getRaceWeekProductResult(), getSeasonState()]);
  const raceWeek = raceWeekResult.mode === "unavailable" ? null : raceWeekResult.data;

  if (seasonState && !seasonState.current_race_week.available) {
    return (
      <main className="subpage-shell race-week-page">
        <StatePanel
          eyebrow="Race Week"
          title={`${formatSeasonRaceLabel(seasonState.next_race)} build pending.`}
          message={`Current product view targets ${formatSeasonRaceLabel(seasonState.current_race_week.product_view_race)}. Latest completed race is ${formatSeasonRaceLabel(seasonState.latest_completed_race)}.`}
          tone="notice"
          actionHref="/race-analysis"
          actionLabel="Open Race Analysis"
        />
        <SiteFooter />
      </main>
    );
  }

  if (!raceWeek?.overview.nextRace) {
    return (
      <main className="subpage-shell race-week-page">
        <section className="race-week-empty">
          <p className="race-week-empty__eyebrow">Race Week</p>
          <h1 className="race-week-empty__title">No weekend read is ready yet.</h1>
          <p className="race-week-empty__copy">Data will appear when the next event is ready.</p>
        </section>
        <SiteFooter />
      </main>
    );
  }

  const { overview, driverBoard, strategy, predictionModes } = raceWeek;
  const nextRace = overview.nextRace;
  if (!nextRace) {
    return null;
  }
  const circuit = getCircuitAsset(nextRace.circuitId);
  const raceTheme = raceThemeByCircuit[nextRace.circuitId] ?? fallbackTheme;
  const trackTimeZone = raceTimezoneByCircuit[nextRace.circuitId] ?? "UTC";
  const weekendSessions = buildWeekendSessions(nextRace.scheduledAt);
  const raceWeekConditions = [
    {
      label: "Rain risk",
      value: overview.weatherRiskIndex === null ? "Forecast pending" : `${Math.round(overview.weatherRiskIndex)} / 100`,
      meter: overview.weatherRiskIndex ?? 0,
    },
    {
      label: "Track temp",
      value: formatTemperature(overview.trackTempMeanC),
      meter: overview.trackTempMeanC === null ? 0 : Math.min(100, overview.trackTempMeanC * 2),
    },
    {
      label: "Wind",
      value: formatWind(overview.windSpeedMeanMps),
      meter: overview.windSpeedMeanMps === null ? 0 : Math.min(100, overview.windSpeedMeanMps * 8),
    },
    {
      label: "Forecast updated",
      value: formatForecastUpdated(raceWeekResult.meta.generatedAt),
      meter: raceWeekResult.meta.generatedAt ? 100 : 0,
    },
  ];
  const sessionStatusCards = weekendSessions
    .map((session) => {
      const sessionCode = getSessionCode(session.label);
      if (!sessionCode) {
        return null;
      }
      const status = raceWeek.sessionStatus.find((entry) => entry.sessionCode === sessionCode);
      const productStatus = getSessionStatusLabel(sessionCode, session.iso, raceWeek.sessionStatus);
      return {
        ...session,
        sessionCode,
        productStatus,
        rows: status?.rowCount ?? 0,
      };
    })
    .filter((session): session is NonNullable<typeof session> => Boolean(session));

  const fieldDrivers = driverBoard.slice(0, 10);
  const selectedPredictionModeMeta = predictionModes.find((entry) => entry.id === selectedPredictionMode) ?? predictionModes[0];
  const selectedQualifyingPrediction = raceWeek.qualifyingPrediction.filter((entry) => entry.predictionMode === selectedPredictionMode);
  const qualifyingOrder = [...selectedQualifyingPrediction].sort((left, right) => {
    const leftRank = left.predictedQRank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.predictedQRank ?? Number.POSITIVE_INFINITY;
    return leftRank - rightRank || (left.predictedQGapS ?? Number.POSITIVE_INFINITY) - (right.predictedQGapS ?? Number.POSITIVE_INFINITY);
  });
  const qualifyingTopThree = qualifyingOrder.slice(0, 3);
  const qualifyingBaseline = qualifyingOrder[0] ?? null;
  const qualifyingPoleTime = qualifyingOrder.find((entry) => entry.predictedQTimeS !== null)?.predictedQTimeS ?? null;
  const qualifyingSessionComplete = raceWeek.sessionStatus.some((entry) => entry.sessionCode === "Q" && entry.status === "complete");
  const driverNameById = new Map(driverBoard.map((entry) => [entry.driverId, entry.driverName]));
  const constructorNameById = new Map(driverBoard.map((entry) => [entry.constructorId, entry.constructorName]));
  const keyedStrategy = strategy.slice(0, 6).map((entry) => {
    const matchingDriver = driverBoard.find((driver) => driver.driverId === entry.driverId);
    return {
      ...entry,
      driverName: matchingDriver?.driverName ?? entry.driverId,
      constructorName: matchingDriver?.constructorName ?? entry.constructorId,
    };
  });
  return (
    <main
      className="subpage-shell race-week-page"
      style={
        {
          "--race-shell": raceTheme.shell,
          "--race-accent": raceTheme.accent,
          "--race-accent-soft": raceTheme.accentSoft,
        } as CSSProperties
      }
    >
      <section className="race-week-hero">
        <div className="race-week-hero__grid">
          <div className="race-week-hero__copy">
            <p className="race-week-hero__eyebrow">{nextRace.raceName} Race Week</p>
            <h1 className="race-week-hero__headline">
              {nextRace.raceName}
              <span>{formatRaceDate(nextRace.scheduledAt)}</span>
            </h1>
            <p className="race-week-hero__deck">{raceTheme.deck}</p>

            <div className="race-week-hero__signals">
              <div className="race-week-hero__signal">
                <span>Round</span>
                <strong>{nextRace.round}</strong>
              </div>
              <div className="race-week-hero__signal">
                <span>Profile</span>
                <strong>{overview.archetypeLabel ?? "Street circuit"}</strong>
              </div>
              <div className="race-week-hero__signal">
                <span>Weather</span>
                <strong>{getWeatherTone(overview.weatherRiskIndex)}</strong>
              </div>
            </div>

            <div className="race-week-hero__actions">
              <Link href="/picks" className="race-week-hero__cta race-week-hero__cta--primary">
                Picks
              </Link>
              <Link href="/race-analysis" className="race-week-hero__cta race-week-hero__cta--secondary">
                Race Analysis
              </Link>
            </div>
          </div>

          <div className="race-week-hero__visual">
            <div className="race-week-hero__track">
              <RaceWeekSectorTrack
                circuitId={nextRace.circuitId}
                title={nextRace.raceName}
                presentation="hero"
                showLegend={false}
                showMetadata
                showSpecs
              />
            </div>
            <div className="race-week-hero__meta">
              <div>
                <span>Venue</span>
                <strong>
                  {circuit.region}
                  {nextRace.circuitCountry ? `, ${nextRace.circuitCountry}` : ""}
                </strong>
              </div>
              <div>
                <span>Strategy</span>
                <strong>{overview.strategyDifficulty ?? "Building"}</strong>
              </div>
              <div>
                <span>Data</span>
                <strong>{raceWeekResult.meta.mode === "primary" ? "Live" : "Backup"}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="race-week-command-deck" aria-label="Race weekend command center">
        <div className="race-week-timetable">
          <div className="race-week-section-heading race-week-section-heading--tight">
            <p className="race-week-section-kicker">Weekend</p>
            <h2>Sessions</h2>
          </div>
          <RaceWeekTimeToggle sessions={weekendSessions} trackTimeZone={trackTimeZone} />
          <div className="race-week-session-status" aria-label="Weekend data status">
            {sessionStatusCards.map((session) => (
              <div
                className={`race-week-session-status__item race-week-session-status__item--${session.productStatus.toLowerCase()}`}
                key={session.label}
              >
                <span>{session.label}</span>
                <strong>{session.productStatus}</strong>
                <em>{getSessionStatusDetail(session.sessionCode, session.productStatus, session.rows)}</em>
              </div>
            ))}
          </div>
        </div>

        <aside className="race-week-environment" aria-label="Weather and environment radar">
          <div className="race-week-section-heading race-week-section-heading--tight">
            <p className="race-week-section-kicker">Conditions</p>
            <h2>{getWeatherTone(overview.weatherRiskIndex)}</h2>
          </div>
          <div className="race-week-environment__grid">
            {raceWeekConditions.map((signal) => (
              <div className="race-week-environment__metric" key={signal.label}>
                <span>{signal.label}</span>
                <strong>{signal.value}</strong>
                <i style={{ "--env-meter": `${Math.max(0, Math.min(100, signal.meter))}%` } as CSSProperties} />
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="race-week-q-prediction" aria-label="Qualifying prediction">
        <div className="race-week-section-heading">
          <p className="race-week-section-kicker">Qualifying</p>
          <h2>Projected front rows.</h2>
          <span className={`race-week-prediction-status race-week-prediction-status--${selectedPredictionModeMeta?.status ?? "pending"}`}>
            {selectedPredictionModeMeta?.statusLabel ?? "Prediction data pending"}
          </span>
        </div>

        <nav className="race-week-prediction-modes" aria-label="Prediction mode">
          {predictionModes.map((mode) => (
            <Link
              key={mode.id}
              href={predictionModeHref(mode.id)}
              className={`race-week-prediction-modes__link${mode.id === selectedPredictionMode ? " is-active" : ""}${mode.status === "pending" ? " is-pending" : ""}`}
              aria-current={mode.id === selectedPredictionMode ? "page" : undefined}
            >
              <span>{mode.label}</span>
              <em>{mode.status === "pending" ? "Pending" : mode.rowCount > 0 ? `${mode.rowCount} rows` : "Ready"}</em>
            </Link>
          ))}
        </nav>

        {qualifyingBaseline ? (
          <>
            <div className="race-week-q-prediction__baseline" aria-label="Qualifying baseline">
              <div>
                <span>Pole baseline</span>
                <strong>{formatQualifyingTime(qualifyingBaseline.basePoleS)}</strong>
              </div>
              <div>
                <span>2026 season delta</span>
                <strong>{formatDelta(qualifyingBaseline.seasonDelta26Vs25S, 3)}</strong>
              </div>
              <div>
                <span>Baseline method</span>
                <strong>{formatMethodLabel(qualifyingBaseline.baselineMethod)}</strong>
              </div>
            </div>

            <div className="race-week-q-prediction__podium">
              {qualifyingTopThree.map((entry, index) => {
                const displayGapToPole = qualifyingPoleTime === null || entry.predictedQTimeS === null ? null : entry.predictedQTimeS - qualifyingPoleTime;
                return (
                  <article key={entry.driverId} className="race-week-q-card">
                    <div className="race-week-q-card__rank">P{entry.predictedQRank ?? index + 1}</div>
                    <div className="race-week-q-card__identity">
                      <h3>{driverNameById.get(entry.driverId) ?? entry.driverId.replace(/_/g, " ")}</h3>
                      <TeamBadge teamId={entry.constructorId} compact />
                    </div>
                    <div className="race-week-q-card__metrics">
                      <div>
                        <span>Predicted time</span>
                        <strong>{formatQualifyingTime(entry.predictedQTimeS)}</strong>
                      </div>
                      <div>
                        <span>Gap to pole</span>
                        <strong>{formatPoleGap(displayGapToPole)}</strong>
                      </div>
                      <div>
                        <span>Confidence</span>
                        <strong>{getConfidenceBand(entry.confidenceScore, qualifyingSessionComplete)}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <details className="race-week-q-details">
              <summary>Full order</summary>
              <div className="race-week-q-table" role="table" aria-label="Full qualifying order">
                <div className="race-week-q-table__row race-week-q-table__row--head" role="row">
                  <span>Order</span>
                  <span>Driver</span>
                  <span>Time</span>
                  <span>Gap</span>
                  <span>Flags</span>
                </div>
                {qualifyingOrder.map((entry, index) => {
                  const displayGapToPole = qualifyingPoleTime === null || entry.predictedQTimeS === null ? null : entry.predictedQTimeS - qualifyingPoleTime;
                  return (
                    <article key={entry.driverId} className="race-week-q-table__row" role="row">
                      <span className="race-week-q-table__rank">P{entry.predictedQRank ?? index + 1}</span>
                      <span className="race-week-q-table__driver">
                        <strong>{driverNameById.get(entry.driverId) ?? entry.driverId.replace(/_/g, " ")}</strong>
                        <em>{constructorNameById.get(entry.constructorId) ?? entry.constructorId.replace(/_/g, " ")}</em>
                      </span>
                      <span>{formatQualifyingTime(entry.predictedQTimeS)}</span>
                      <span>{formatPoleGap(displayGapToPole)}</span>
                      <span>{explainPredictionFlags(entry.missingFlags)}</span>
                    </article>
                  );
                })}
              </div>
            </details>
          </>
        ) : (
          <div className="race-week-q-prediction__empty">
            <strong>{selectedPredictionModeMeta?.statusLabel ?? "Qualifying model pending"}</strong>
            <span>
              {selectedPredictionModeMeta?.status === "pending"
                ? "This mode will populate when the required practice sessions are available in the active data source."
                : "Qualifying prediction rows are not available in the active data source."}
            </span>
          </div>
        )}
      </section>

      <section className="race-week-signal-grid">
        <div className="race-week-signal-grid__main">
          <div className="race-week-section-heading race-week-section-heading--tight">
            <p className="race-week-section-kicker">Race order</p>
            <h2>Projected top ten.</h2>
          </div>

          <div className="race-week-driver-table">
            {fieldDrivers.map((entry, index) => (
              <article key={entry.driverId} className="race-week-driver-row">
                <div className="race-week-driver-row__position">P{entry.projectedFinish ?? index + 1}</div>
                <div className="race-week-driver-row__identity">
                  <strong>{entry.driverName}</strong>
                  <span>{entry.constructorName}</span>
                </div>
                <div className="race-week-driver-row__metric">
                  <span>One lap</span>
                  <strong>{formatTime(entry.oneLapPaceS)}</strong>
                </div>
                <div className="race-week-driver-row__metric">
                  <span>Tyre fade</span>
                  <strong>{formatDelta(entry.degradationSPerLap, 3)}</strong>
                </div>
                <div className="race-week-driver-row__metric race-week-driver-row__metric--status">
                  <span>Status</span>
                  <strong>{getDataStatus(entry.signalConfidence)}</strong>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="race-week-signal-grid__side">
          <div className="race-week-strategy">
            <div className="race-week-section-heading race-week-section-heading--tight">
              <p className="race-week-section-kicker">Strategy</p>
              <h2>Pit-window focus.</h2>
            </div>
            <div className="race-week-strategy__list">
              {keyedStrategy.map((entry) => (
                <article key={entry.driverId} className="race-week-strategy__item">
                  <div className="race-week-strategy__item-head">
                    <strong>{entry.driverName}</strong>
                    <span>{entry.recommendedStopCount ? `${entry.recommendedStopCount}-stop` : "Flexible"}</span>
                  </div>
                  <p>{sanitizeRaceWeekText(entry.rationale, 96)}</p>
                  <div className="race-week-strategy__item-meta">
                    <span>
                      Window {entry.pitWindowStartLap ?? "?"}-{entry.pitWindowEndLap ?? "?"}
                    </span>
                    <span>{entry.constructorName}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}
