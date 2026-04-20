import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { HomeLink } from "@/components/ui/home-link";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { TrackMap } from "@/components/ui/track-map";
import { TeamBadge } from "@/components/ui/team-badge";
import { getRaceWeekProductResult } from "@/lib/server/race-week-product";
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
    deck: "Low-drag confidence, weather variance, and strategic timing can reshape the order in a single phase change.",
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
    return "Signal building";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}s`;
}

function formatTime(value: number | null, digits = 3) {
  if (value === null || Number.isNaN(value)) {
    return "Signal building";
  }
  return `${value.toFixed(digits)}s`;
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "Building";
  }
  return `${Math.round(value * 100)}%`;
}

function getConfidenceTone(value: number | null) {
  if (value === null) {
    return "Signal building";
  }
  if (value >= 0.7) {
    return "High confidence";
  }
  if (value >= 0.45) {
    return "Developing confidence";
  }
  return "Low confidence";
}

function getWeatherTone(value: number | null) {
  if (value === null) {
    return "Stable conditions";
  }
  if (value >= 70) {
    return "Weather is a major variable";
  }
  if (value >= 40) {
    return "Weather may shape the read";
  }
  return "Conditions are relatively stable";
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

export default async function PredictionsPage() {
  const raceWeekResult = await getRaceWeekProductResult();
  const raceWeek = raceWeekResult.mode === "unavailable" ? null : raceWeekResult.data;

  if (!raceWeek?.overview.nextRace) {
    return (
      <main className="subpage-shell race-week-page">
        <section className="race-week-empty">
          <div className="race-week-empty__topbar">
            <HomeLink />
          </div>
          <p className="race-week-empty__eyebrow">Race Week</p>
          <h1 className="race-week-empty__title">No weekend read is ready yet.</h1>
          <p className="race-week-empty__copy">
            The Race Week surface activates once the current event and its product views are available in the data pipeline.
          </p>
        </section>
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

  const leadDrivers = driverBoard.slice(0, 3);
  const fieldDrivers = driverBoard.slice(0, 8);
  const leadConstructors = constructorBoard.slice(0, 5);
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
        <div className="race-week-hero__topbar">
          <Link href="/" className="race-week-hero__nav-link">
            Return home
          </Link>
          <div className="race-week-hero__title">Race Week</div>
          <Link href="/lab" className="race-week-hero__nav-link race-week-hero__nav-link--accent">
            Strategy Lab
          </Link>
        </div>

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
                  {overview.latestCompletedRace ? ` · after ${overview.latestCompletedRace.raceName}` : ""}
                </strong>
              </div>
              <div className="race-week-hero__signal">
                <span>Weekend complexion</span>
                <strong>{overview.archetypeLabel ?? "Balanced circuit"}</strong>
              </div>
              <div className="race-week-hero__signal">
                <span>Read strength</span>
                <strong>{getConfidenceTone(overview.signalConfidence)}</strong>
              </div>
            </div>

            <ProductRuntimeNote runtime={raceWeekResult.meta} className="race-week-hero__runtime" primaryLabel="Race Week live product view" degradedLabel="Race Week fallback snapshot" />

            <div className="race-week-hero__actions">
              <Link href="/lab" className="race-week-hero__cta race-week-hero__cta--primary">
                Open Strategy Lab
              </Link>
              <Link href="/fantasy" className="race-week-hero__cta race-week-hero__cta--secondary">
                Open Fantasy Builder
              </Link>
            </div>
          </div>

          <div className="race-week-hero__visual">
            <div className="race-week-hero__track">
              <TrackMap circuitId={nextRace.circuitId} title={nextRace.raceName} variant="hero" />
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

      <section className="race-week-story-band">
        <div className="race-week-story-band__intro">
          <p className="race-week-section-kicker">Weekend brief</p>
          <h2>What matters before the grid forms.</h2>
          <p>
            The page is organized around the signals most likely to decide the weekend: pace shape, tyre fade, strategic friction, and where the strongest confidence is actually coming from.
          </p>
        </div>

        <div className="race-week-story-band__cards">
          {storylines.slice(0, 3).map((storyline) => (
            <article key={`${storyline.storylineType}-${storyline.priorityRank}`} className="race-week-story-card">
              <div className="race-week-story-card__eyebrow">
                <span>{storyline.priorityRank.toString().padStart(2, "0")}</span>
                <span>{storyline.confidenceBand}</span>
              </div>
              <h3>{storyline.headline}</h3>
              <p>{storyline.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="race-week-leaders">
        <div className="race-week-section-heading">
          <p className="race-week-section-kicker">Front of the read</p>
          <h2>The drivers carrying the strongest weekend case.</h2>
          <p>The podium outlook is less useful than the shape underneath it. These are the names with the clearest current signal.</p>
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
                      <span>Readiness</span>
                      <strong>{formatPercent(entry.readinessScore)}</strong>
                    </div>
                    <div>
                      <span>One lap</span>
                      <strong>{formatTime(entry.oneLapPaceS)}</strong>
                    </div>
                    <div>
                      <span>Long run</span>
                      <strong>{formatTime(entry.longRunPaceS)}</strong>
                    </div>
                  </div>
                  <p>{entry.summary}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="race-week-signal-grid">
        <div className="race-week-signal-grid__main">
          <div className="race-week-section-heading race-week-section-heading--tight">
            <p className="race-week-section-kicker">Field board</p>
            <h2>The weekend order at a glance.</h2>
          </div>

          <div className="race-week-driver-table">
            {fieldDrivers.map((entry, index) => (
              <article key={entry.driverId} className="race-week-driver-row">
                <div className="race-week-driver-row__position">P{index + 1}</div>
                <div className="race-week-driver-row__identity">
                  <strong>{entry.driverName}</strong>
                  <span>{entry.constructorName}</span>
                </div>
                <div className="race-week-driver-row__metric">
                  <span>Long run</span>
                  <strong>{formatTime(entry.longRunPaceS)}</strong>
                </div>
                <div className="race-week-driver-row__metric">
                  <span>One lap</span>
                  <strong>{formatTime(entry.oneLapPaceS)}</strong>
                </div>
                <div className="race-week-driver-row__metric">
                  <span>Fade</span>
                  <strong>{formatDelta(entry.degradationSPerLap, 3)}</strong>
                </div>
                <div className="race-week-driver-row__metric race-week-driver-row__metric--confidence">
                  <span>Confidence</span>
                  <strong>{getConfidenceTone(entry.signalConfidence)}</strong>
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
                    <p>{entry.summary}</p>
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
                  <p>{entry.rationale}</p>
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
          <p>
            Use Strategy Lab when you want to pressure-test scenarios. Use Fantasy Builder when you want to turn the same weekend signal into lineup value.
          </p>
        </div>
        <div className="race-week-close__links">
          <Link href="/lab" className="race-week-close__link">
            <span>01</span>
            <strong>Open Strategy Lab</strong>
            <p>Stress the race shape against alternative calls and confidence assumptions.</p>
          </Link>
          <Link href="/fantasy" className="race-week-close__link">
            <span>02</span>
            <strong>Open Fantasy Builder</strong>
            <p>Carry the same weekend board into value, volatility, and lineup tradeoffs.</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
