import Link from "next/link";
import type { CSSProperties } from "react";
import { RaceCountdown } from "@/components/home/race-countdown";
import { TrackMap } from "@/components/ui/track-map";
import type { SeasonRaceRef } from "@/lib/server/season-state";
import { getCircuitAsset, getTeamAsset } from "@/lib/ui/asset-manifest";
import { formatCountdown, formatRaceDateUtc } from "@/lib/ui/home-hero";

type HomeHeroProps = {
  nextRace: SeasonRaceRef | null;
  circuitName: string;
  visualTeamId: string;
};

type FlagTheme = {
  orientation: "horizontal" | "vertical";
  stripes: [string, string, string];
  glow: string;
};

const flagThemeByCountry: Record<string, FlagTheme> = {
  HU: {
    orientation: "horizontal",
    stripes: ["#ce2939", "#ffffff", "#477050"],
    glow: "rgba(206, 41, 57, 0.24)",
  },
  BE: {
    orientation: "horizontal",
    stripes: ["#ce2939", "#ffffff", "#477050"],
    glow: "rgba(206, 41, 57, 0.24)",
  },
};

const fallbackFlagTheme: FlagTheme = {
  orientation: "vertical",
  stripes: ["#050608", "#f4f6f8", "#e10600"],
  glow: "rgba(225, 6, 0, 0.2)",
};

export function HomeHero({ nextRace, circuitName, visualTeamId }: HomeHeroProps) {
  const visualTeam = getTeamAsset(visualTeamId);
  const circuit = getCircuitAsset(nextRace?.circuit_id);
  const flagTheme = flagThemeByCountry[circuit.countryCode] ?? fallbackFlagTheme;
  const flagGradientDirection = flagTheme.orientation === "horizontal" ? "180deg" : "90deg";
  const flagGradient = `linear-gradient(${flagGradientDirection}, ${flagTheme.stripes[0]} 0 33.33%, ${flagTheme.stripes[1]} 33.33% 66.66%, ${flagTheme.stripes[2]} 66.66% 100%)`;

  return (
    <section
      className="home-hero"
      style={
        {
          "--hero-team-primary": visualTeam.primary,
          "--hero-team-secondary": visualTeam.secondary,
          "--hero-flag-one": flagTheme.stripes[0],
          "--hero-flag-two": flagTheme.stripes[1],
          "--hero-flag-three": flagTheme.stripes[2],
          "--hero-flag-glow": flagTheme.glow,
          "--hero-flag-gradient": flagGradient,
        } as CSSProperties
      }
    >
      <div className="home-hero__atmosphere" aria-hidden="true">
        <div className="home-hero__grid" />
        <div className="home-hero__car-fade" />
      </div>

      <div className="home-hero__inner">
        <header className="home-hero__brand-block">
          <h1 className="home-hero__brand">F1 InsightX</h1>
          <p className="home-hero__tagline" aria-label="Analyze, Strategize, Execute">
            <span>Analyze</span><i aria-hidden="true" />
            <span>Strategize</span><i aria-hidden="true" />
            <span>Execute</span>
          </p>
        </header>

        <div className="home-hero__stage">
          {nextRace ? (
            <article className="home-hero__race" aria-labelledby="home-next-race-title">
              <div className={`home-hero__flag home-hero__flag--${flagTheme.orientation}`} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className="home-hero__race-kicker">Next race</span>
              <h2 id="home-next-race-title">{nextRace.race_name ?? "Race pending"}</h2>
              <div className="home-hero__race-meta">
                <span>
                  <small>Round</small>
                  <strong>{nextRace.round ?? "--"}</strong>
                </span>
                <time dateTime={nextRace.scheduled_at ?? undefined}>
                  <small>Race start</small>
                  <strong>{formatRaceDateUtc(nextRace.scheduled_at)}</strong>
                </time>
                <span className="home-hero__race-circuit">
                  <small>Circuit</small>
                  <strong>{circuitName}</strong>
                </span>
              </div>
              <div className="home-hero__countdown">
                <RaceCountdown
                  scheduledAt={nextRace.scheduled_at}
                  initialLabel={formatCountdown(nextRace.scheduled_at)}
                />
              </div>
            </article>
          ) : null}

          <div className="home-hero__visual">
            {nextRace?.circuit_id ? (
              <div className="home-hero__track">
                <TrackMap circuitId={nextRace.circuit_id} title={circuitName} variant="hero" presentation="hero" />
              </div>
            ) : null}

            <div className="home-hero__actions">
              <Link href="/race-analysis" className="hero__cta hero__cta--primary">
                <span>Explore race analysis</span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link href="/predictions" className="hero__cta hero__cta--secondary">
                <span>Open race week</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
