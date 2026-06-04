import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { SiteHeader } from "@/components/ui/site-header";
import { SiteFooter } from "@/components/ui/site-footer";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { StatePanel } from "@/components/ui/state-panel";
import { TeamBadge } from "@/components/ui/team-badge";
import { RaceWeekSectorTrack } from "@/components/race-week/race-week-sector-track";
import { RaceWeekTimeToggle } from "@/components/race-week/race-week-time-toggle";
import { getRaceWeekProductResult } from "@/lib/server/race-week-product";
import { formatSeasonRaceLabel, getSeasonState } from "@/lib/server/season-state";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";
import { getCircuitAsset, getTeamAsset } from "@/lib/ui/asset-manifest";

type RaceTheme = {
  eyebrow: string;
  deck: string;
  shell: string;
  accent: string;
  accentSoft: string;
};

const raceThemeByCircuit: Record<string, RaceTheme> = {
  miami: {
    eyebrow: "Miami Race Week",
    deck: "Warm night energy, long straights, and enough volatility to punish overconfident reads.",
    shell: "#46d9ff",
    accent: "#ff5ea8",
    accentSoft: "#ffe58f",
  },
  monaco: {
    eyebrow: "Monaco Race Week",
    deck: "Track position dominates here. One-lap shape and execution quality matter more than brute pace alone.",
    shell: "#d7cfbf",
    accent: "#fb4f4f",
    accentSoft: "#ffffff",
  },
  silverstone: {
    eyebrow: "Silverstone Race Week",
    deck: "High-speed commitment and sustained balance usually decide whether the weekend stays clean or collapses late.",
    shell: "#d7ecff",
    accent: "#59a7ff",
    accentSoft: "#f7fbff",
  },
  spa: {
    eyebrow: "Spa Race Week",
    deck: "Low-drag pace, weather variance, and strategic timing can reshape the order in a single phase change.",
    shell: "#a8e6ff",
    accent: "#74d66f",
    accentSoft: "#ffffff",
  },
};

const fallbackTheme: RaceTheme = {
  eyebrow: "Race Week",
  deck: "A focused read on pace, readiness, strategy, and the signals most likely to matter before lights out.",
  shell: "#d5dce7",
  accent: "#ff5d57",
  accentSoft: "#ffffff",
};

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

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Building";
  }
  return `${Math.round(value * 100)}%`;
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

function getStrategicTone(value: string | null) {
  if (!value) {
    return "Strategy picture is still settling.";
  }
  if (value === "High") {
    return "The weekend is tactically sharp. Small calls could move the order quickly.";
  }
  if (value === "Medium") {
    return "Strategy will matter, but outright pace should still do most of the work.";
  }
  return "This looks like a cleaner weekend where pace should carry through more directly.";
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

export default async function PredictionsPage() {
  const [raceWeekResult, seasonState] = await Promise.all([getRaceWeekProductResult(), getSeasonState()]);
  const raceWeek = raceWeekResult.mode === "unavailable" ? null : raceWeekResult.data;

  if (seasonState && !seasonState.current_race_week.available) {
    return (
      <main className="subpage-shell race-week-page">
        <SiteHeader title="Race Week" actionHref="/lab" actionLabel="Strategy Lab" />
        <StatePanel
          eyebrow="Race Week"
          title={`${formatSeasonRaceLabel(seasonState.next_race)} build pending.`}
          message={`Current product view targets ${formatSeasonRaceLabel(seasonState.current_race_week.product_view_race)}. Latest completed race is ${formatSeasonRaceLabel(seasonState.latest_completed_race)}.`}
          tone="notice"
          actionHref="/analytics"
          actionLabel="Open Analytics"
        />
        <SiteFooter />
      </main>
    );
  }

  if (!raceWeek?.overview.nextRace) {
    return (
      <main className="subpage-shell race-week-page">
        <SiteHeader title="Race Week" />
        <section className="race-week-empty">
          <p className="race-week-empty__eyebrow">Race Week</p>
          <h1 className="race-week-empty__title">No weekend read is ready yet.</h1>
          <p className="race-week-empty__copy">Data will appear when the next event is ready.</p>
        </section>
        <SiteFooter />
      </main>
    );
  }

  const { overview, driverBoard, constructorBoard, strategy, storylines } = raceWeek;
  const nextRace = overview.nextRace;
  if (!nextRace) {
    return null;
  }
  const circuit = getCircuitAsset(nextRace.circuitId);
  const raceTheme = raceThemeByCircuit[nextRace.circuitId] ?? fallbackTheme;
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

  const leadDrivers = driverBoard.slice(0, 3);
  const fieldDrivers = driverBoard.slice(0, 10);
  const leadConstructors = constructorBoard.slice(0, 5);
  const mclarenWatch = driverBoard.filter((entry) => entry.constructorId === "mclaren").sort((a, b) => (b.readinessScore ?? 0) - (a.readinessScore ?? 0));
  const ferrariWatch = driverBoard.filter((entry) => entry.constructorId === "ferrari").sort((a, b) => (b.readinessScore ?? 0) - (a.readinessScore ?? 0));
  const norris = driverBoard.find((entry) => entry.driverId === "norris");
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
      <SiteHeader
        title="Race Week"
        actionHref="/lab"
        actionLabel="Strategy Lab"
      />

      <section className="race-week-hero">
        <div className="race-week-hero__grid">
          <div className="race-week-hero__copy">
            <p className="race-week-hero__eyebrow">{raceTheme.eyebrow}</p>
            <h1 className="race-week-hero__headline">
              {nextRace.raceName}
              <span>{formatRaceDate(nextRace.scheduledAt)}</span>
            </h1>
            <p className="race-week-hero__deck">{raceTheme.deck}</p>

            <div className="race-week-hero__signals">
              <div className="race-week-hero__signal">
                <span>Season context</span>
                <strong>
                  Round {nextRace.round}
                  {overview.latestCompletedRace ? ` / after ${overview.latestCompletedRace.raceName}` : ""}
                </strong>
              </div>
              <div className="race-week-hero__signal">
                <span>Circuit profile</span>
                <strong>{overview.archetypeLabel ?? "Street circuit"}</strong>
              </div>
            </div>

            <ProductRuntimeNote runtime={raceWeekResult.meta} className="race-week-hero__runtime" primaryLabel="Race Week data" degradedLabel="Backup data source" />

            <div className="race-week-hero__actions">
              <Link href="/lab" className="race-week-hero__cta race-week-hero__cta--primary">
                Open Strategy Lab
              </Link>
              <Link href="/analytics" className="race-week-hero__cta race-week-hero__cta--secondary">
                Open Analytics
              </Link>
            </div>
          </div>

          <div className="race-week-hero__visual">
            <div className="race-week-hero__track">
              <RaceWeekSectorTrack circuitId={nextRace.circuitId} title={nextRace.raceName} />
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
                <span>Strategic difficulty</span>
                <strong>{overview.strategyDifficulty ?? "Building"}</strong>
              </div>
              <div>
                <span>Weather read</span>
                <strong>{getWeatherTone(overview.weatherRiskIndex)}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="race-week-command-deck" aria-label="Race weekend command center">
        <div className="race-week-timetable">
          <div className="race-week-section-heading race-week-section-heading--tight">
            <p className="race-week-section-kicker">Weekend timeline</p>
            <h2>Track time or your local time.</h2>
          </div>
          <RaceWeekTimeToggle sessions={weekendSessions} trackTimeZone="Europe/Monaco" />
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

      <section className="race-week-form-watch" aria-label="Upgrade and form watch">
        <div className="race-week-section-heading race-week-section-heading--tight">
          <p className="race-week-section-kicker">McLaren upgrade watch</p>
          <h2>Norris and McLaren are the form watch.</h2>
        </div>
        <div className="race-week-form-watch__grid">
          <article>
            <span>McLaren read</span>
            <strong>{norris ? `${norris.driverName} leads the McLaren baseline` : "Norris watch"}</strong>
            <p>Norris and McLaren are the form watch once practice timing arrives.</p>
          </article>
          <article>
            <span>Generated baseline</span>
            <strong>
              McLaren {mclarenWatch[0]?.projectedFinish ? `P${mclarenWatch[0].projectedFinish}` : "pending"} / Ferrari {ferrariWatch[0]?.projectedFinish ? `P${ferrariWatch[0].projectedFinish}` : "pending"}
            </strong>
            <p>Generated order remains separate from upgrade narrative.</p>
          </article>
        </div>
      </section>

      <section className="race-week-story-band">
        <div className="race-week-story-band__intro">
          <p className="race-week-section-kicker">Weekend brief</p>
          <h2>What matters before the grid forms.</h2>
          <p>Pace shape, tyre fade, strategy friction, and session readiness.</p>
        </div>

        <div className="race-week-story-band__cards">
          {storylines.slice(0, 3).map((storyline) => (
            <article key={`${storyline.storylineType}-${storyline.priorityRank}`} className="race-week-story-card">
              <div className="race-week-story-card__eyebrow">
                <span>{storyline.priorityRank.toString().padStart(2, "0")}</span>
                <span>Watch item</span>
              </div>
              <h3>{storyline.headline}</h3>
              <p>{sanitizeRaceWeekText(storyline.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="race-week-leaders">
        <div className="race-week-section-heading">
          <p className="race-week-section-kicker">Front row watch</p>
          <h2>Early race-week read.</h2>
        </div>

        <div className="race-week-leaders__grid">
          {leadDrivers.map((entry, index) => {
            const driver = getCurrentDriverMeta(entry.driverId);
            const team = getTeamAsset(entry.constructorId);
            return (
              <article
                key={entry.driverId}
                className={`race-week-leader-card ${index === 0 ? "race-week-leader-card--primary" : ""}`}
                style={
                  {
                    "--leader-primary": team.primary,
                    "--leader-secondary": team.secondary,
                    "--leader-accent": team.accent,
                  } as CSSProperties
                }
              >
                <div className="race-week-leader-card__portrait">
                  <Image
                    src={driver.photoPath ?? driver.fallbackPhotoPath}
                    alt={driver.altText}
                    fill
                    sizes="(max-width: 959px) 100vw, 28rem"
                    className="race-week-leader-card__portrait-image"
                    style={{ objectFit: driver.photoFit ?? "contain", objectPosition: driver.photoPosition ?? "center bottom" }}
                    unoptimized
                  />
                </div>
                <div className="race-week-leader-card__content">
                  <div className="race-week-leader-card__rank">P{index + 1}</div>
                  <h3>{entry.driverName}</h3>
                  <div className="race-week-leader-card__team">
                    <TeamBadge teamId={entry.constructorId} compact />
                  </div>
                  <div className="race-week-leader-card__metrics">
                    <div>
                      <span>Status</span>
                      <strong>{getDataStatus(entry.signalConfidence)}</strong>
                    </div>
                    <div>
                      <span>One lap</span>
                      <strong>{formatTime(entry.oneLapPaceS)}</strong>
                    </div>
                    <div>
                      <span>Tyre fade</span>
                      <strong>{formatDelta(entry.degradationSPerLap, 3)}</strong>
                    </div>
                  </div>
                  <p>{sanitizeRaceWeekText(entry.summary)}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="race-week-signal-grid">
        <div className="race-week-signal-grid__main">
          <div className="race-week-section-heading race-week-section-heading--tight">
            <p className="race-week-section-kicker">Race-week order</p>
            <h2>Projected weekend order.</h2>
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
          <div className="race-week-constructors">
            <div className="race-week-section-heading race-week-section-heading--tight">
              <p className="race-week-section-kicker">Constructor outlook</p>
              <h2>Who has the cleanest team shape.</h2>
            </div>

            <div className="race-week-constructors__list">
              {leadConstructors.map((entry) => {
                const team = getTeamAsset(entry.constructorId);
                return (
                  <article
                    key={entry.constructorId}
                    className="race-week-constructor-card"
                    style={
                      {
                        "--constructor-primary": team.primary,
                        "--constructor-secondary": team.secondary,
                      } as CSSProperties
                    }
                  >
                    <div className="race-week-constructor-card__head">
                      <strong>{entry.constructorName}</strong>
                      <span>{formatPercent(entry.readinessScore)}</span>
                    </div>
                    <div className="race-week-constructor-card__subhead">
                      <span>Long run {formatTime(entry.longRunPaceS)}</span>
                      <span>One lap {formatTime(entry.oneLapPaceS)}</span>
                    </div>
                    <p>{sanitizeRaceWeekText(entry.summary, 92)}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="race-week-strategy">
            <div className="race-week-section-heading race-week-section-heading--tight">
              <p className="race-week-section-kicker">Strategic complexion</p>
              <h2>Where the race can move.</h2>
            </div>
            <p className="race-week-strategy__lede">{getStrategicTone(overview.strategyDifficulty)}</p>
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

      <section className="race-week-close">
        <div className="race-week-close__copy">
          <p className="race-week-section-kicker">Carry the weekend forward</p>
          <h2>Move from the read into action.</h2>
          <p>Pressure-test strategy or compare the telemetry picture.</p>
        </div>
        <div className="race-week-close__links">
          <Link href="/lab" className="race-week-close__link">
            <span>01</span>
            <strong>Open Strategy Lab</strong>
            <p>Stress alternative calls.</p>
          </Link>
          <Link href="/analytics" className="race-week-close__link">
            <span>02</span>
            <strong>Open Analytics</strong>
            <p>Compare driver signals.</p>
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
