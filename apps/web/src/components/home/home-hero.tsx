import Link from "next/link";
import type { CSSProperties } from "react";
import { RaceCountdown } from "@/components/home/race-countdown";
import { TrackMap } from "@/components/ui/track-map";
import type { SeasonRaceRef } from "@/lib/server/season-state";
import { getTeamAsset } from "@/lib/ui/asset-manifest";
import { formatCountdown, formatRaceDateUtc } from "@/lib/ui/home-hero";

type HomeHeroProps = {
  nextRace: SeasonRaceRef | null;
  circuitName: string;
  visualTeamId: string;
};

export function HomeHero({ nextRace, circuitName, visualTeamId }: HomeHeroProps) {
  const visualTeam = getTeamAsset(visualTeamId);

  return (
    <section
      className="home-hero"
      style={
        {
          "--hero-team-primary": visualTeam.primary,
          "--hero-team-secondary": visualTeam.secondary,
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
              <span className="home-hero__race-kicker">Next race</span>
              <h2 id="home-next-race-title">{nextRace.race_name ?? "Race pending"}</h2>
              <div className="home-hero__race-meta">
                <span>{nextRace.round ? `Round ${nextRace.round}` : "Round pending"}</span>
                <time dateTime={nextRace.scheduled_at ?? undefined}>{formatRaceDateUtc(nextRace.scheduled_at)}</time>
                <span className="home-hero__race-circuit">{circuitName}</span>
              </div>
              <p className="home-hero__countdown">
                <RaceCountdown
                  scheduledAt={nextRace.scheduled_at}
                  initialLabel={formatCountdown(nextRace.scheduled_at)}
                />
              </p>
              <span className="home-hero__team-context">{visualTeam.label} visual feed</span>
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
