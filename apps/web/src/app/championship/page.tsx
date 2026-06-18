import type { CSSProperties } from "react";
import Link from "next/link";
import { ChampionshipLeaderboards } from "@/components/achievements/championship-leaderboards";
import { AppFooter } from "@/components/ui/app-footer";
import { AssetImage } from "@/components/ui/asset-image";
import {
  getAchievementsSeason,
  type AchievementMetricId,
} from "@/lib/server/achievements-product";
import {
  getChampionshipStandingsSeason,
  listChampionshipSeasons,
  type ConstructorStanding,
  type DriverStanding,
} from "@/lib/server/standings";
import { getTeamAsset } from "@/lib/ui/asset-manifest";
import { getCurrentDriverMeta } from "@/lib/ui/driver-asset-manifest";

type ChampionshipPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const metricOrder: AchievementMetricId[] = [
  "lapsCompleted",
  "lapsLed",
  "overtakes",
  "pitStops",
  "positionsGained",
  "positionsLost",
  "dnfs",
];

export const metadata = {
  title: "Championship | F1 InsightX",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatGeneratedAt(value: string | null) {
  if (!value) {
    return "Generated timestamp unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatRaceDate(value: string | null | undefined) {
  if (!value) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatPoints(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} pts`;
}

function YearSelector({ seasons, selectedSeason }: { seasons: number[]; selectedSeason: number }) {
  return (
    <nav className="championship-year-selector" aria-label="Championship year">
      {seasons.map((season) => (
        <Link
          key={season}
          href={`/championship?season=${season}`}
          className={season === selectedSeason ? "is-active" : ""}
          aria-current={season === selectedSeason ? "page" : undefined}
        >
          {season}
        </Link>
      ))}
    </nav>
  );
}

function DriverPodium({ drivers }: { drivers: DriverStanding[] }) {
  const podium = [drivers[1], drivers[0], drivers[2]].filter(Boolean);

  return (
    <section className="championship-driver-podium" aria-label="Top three drivers">
      {podium.map((driver) => {
        const meta = getCurrentDriverMeta(driver.driverId);
        const team = getTeamAsset(driver.teamId);
        return (
          <article
            className={`championship-driver-podium__item championship-driver-podium__item--p${driver.standingPosition}`}
            key={driver.driverId}
            style={
              {
                "--team-primary": team.primary,
                "--team-secondary": team.secondary,
                "--team-accent": team.accent,
              } as CSSProperties
            }
          >
            <div className="championship-driver-podium__copy">
              <span>P{driver.standingPosition}</span>
              <h2>{driver.displayName}</h2>
              <p>{driver.teamName}</p>
              <strong>{formatPoints(driver.points)}</strong>
            </div>
            <div className="championship-driver-podium__portrait">
              <AssetImage
                src={meta.photoPath ?? meta.fallbackPhotoPath}
                fallbackSrc={meta.fallbackPhotoPath}
                alt={meta.altText}
                className="championship-driver-podium__photo"
                fill
                sizes="(max-width: 800px) 80vw, 22rem"
                priority={driver.standingPosition === 1}
                style={{
                  objectPosition: meta.photoPosition ?? "center top",
                  objectFit: meta.photoFit ?? "cover",
                  transform: `translateY(2.1rem) scale(${(meta.photoScale ?? 1) * 1.08})`,
                }}
              />
            </div>
          </article>
        );
      })}
    </section>
  );
}

function DriverOrder({ drivers }: { drivers: DriverStanding[] }) {
  return (
    <section className="championship-order-band" aria-label="Drivers championship order">
      <div className="championship-section-heading">
        <span>Drivers Championship</span>
        <h2>Full points order</h2>
      </div>
      <ol className="championship-open-list">
        {drivers.map((driver) => (
          <li key={driver.driverId}>
            <span>P{driver.standingPosition}</span>
            <strong>{driver.displayName}</strong>
            <small>{driver.teamName}</small>
            <em>{formatPoints(driver.points)}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ConstructorOrder({ constructors }: { constructors: ConstructorStanding[] }) {
  return (
    <section className="championship-order-band championship-order-band--constructors" aria-label="Constructors championship order">
      <div className="championship-section-heading">
        <span>Constructors Championship</span>
        <h2>Team standings</h2>
      </div>
      <ol className="championship-constructor-list">
        {constructors.map((constructor) => {
          const team = getTeamAsset(constructor.constructorId);
          return (
            <li
              key={constructor.constructorId}
              style={
                {
                  "--team-primary": team.primary,
                  "--team-secondary": team.secondary,
                  "--team-accent": team.accent,
                } as CSSProperties
              }
            >
              <span>P{constructor.standingPosition}</span>
              <strong>{team.label}</strong>
              <small>{constructor.wins} wins</small>
              <em>{formatPoints(constructor.points)}</em>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default async function ChampionshipPage({ searchParams }: ChampionshipPageProps) {
  const params = await searchParams;
  const requestedSeason = Number(firstParam(params?.season));
  const seasons = await listChampionshipSeasons();
  const selectedSeason = Number.isFinite(requestedSeason) && seasons.includes(requestedSeason) ? requestedSeason : seasons[0];
  const [achievements, championship] = await Promise.all([
    getAchievementsSeason(selectedSeason),
    getChampionshipStandingsSeason(selectedSeason),
  ]);

  return (
    <main className="championship-page">
      {achievements && championship ? (
        <>
          <section className="championship-hero">
            <div className="championship-hero__copy">
              <span>Championship</span>
              <h1>{championship.season} championship</h1>
              <p>
                Drivers and Constructors Championship order with season performance leaderboards from the latest
                completed race data.
              </p>
            </div>
            <div className="championship-hero__meta">
              <YearSelector seasons={seasons} selectedSeason={championship.season} />
              <div>
                <span>After {championship.latestRaceName}</span>
                <strong>{formatRaceDate(championship.latestRaceDate)}</strong>
              </div>
              <div>
                <span>Race reports counted</span>
                <strong>{achievements.raceCount}</strong>
              </div>
              <div>
                <span>Generated</span>
                <strong>{formatGeneratedAt(achievements.generatedAt)}</strong>
              </div>
            </div>
          </section>

          <DriverPodium drivers={championship.drivers.slice(0, 3)} />

          <section className="championship-standings-layout">
            <DriverOrder drivers={championship.drivers} />
            <ConstructorOrder constructors={championship.constructors} />
          </section>

          <section className="championship-performance-band" aria-label="Performance leaderboards">
            <div className="championship-section-heading">
              <span>Performance leaderboards</span>
              <h2>Season records</h2>
            </div>
            <ChampionshipLeaderboards metrics={metricOrder.map((metricId) => achievements.metrics[metricId])} />
          </section>
        </>
      ) : (
        <section className="championship-hero championship-hero--empty">
          <div className="championship-hero__copy">
            <span>Championship</span>
            <h1>Championship data is unavailable.</h1>
            <p>Championship tables appear when race-analysis and standings data are generated.</p>
          </div>
        </section>
      )}

      <AppFooter />
    </main>
  );
}
