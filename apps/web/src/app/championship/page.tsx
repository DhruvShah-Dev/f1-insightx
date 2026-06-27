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

const navSections = [
  { href: "#overview", label: "Overview" },
  { href: "#drivers", label: "Drivers" },
  { href: "#constructors", label: "Constructors" },
  { href: "#performance", label: "Performance" },
  { href: "#data-notes", label: "Data notes" },
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

function formatGap(value: number) {
  if (value <= 0) {
    return "Leader";
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)} back`;
}

function percentOf(value: number, maxValue: number) {
  if (maxValue <= 0) {
    return 0;
  }

  return Math.max(4, Math.min(100, (value / maxValue) * 100));
}

function teamStyle(teamId: string | null | undefined, extra: Record<string, string | number> = {}) {
  const team = getTeamAsset(teamId);
  return {
    "--team-primary": team.primary,
    "--team-secondary": team.secondary,
    "--team-accent": team.accent,
    ...extra,
  } as CSSProperties;
}

function YearSelector({ seasons, selectedSeason }: { seasons: number[]; selectedSeason: number }) {
  return (
    <nav className="champ-cinema-season-switcher" aria-label="Championship year">
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

function SectionRail() {
  return (
    <nav className="champ-cinema-section-rail" aria-label="Championship sections">
      {navSections.map((item) => (
        <a href={item.href} key={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function TeamLogo({ teamId, className }: { teamId: string; className: string }) {
  const team = getTeamAsset(teamId);

  if (!team.badgeAssetPath) {
    return <span className={`${className} champ-cinema-logo-fallback`}>{team.shortLabel}</span>;
  }

  return (
    <AssetImage
      src={team.badgeAssetPath}
      fallbackSrc={team.fallbackImagePath}
      alt={`${team.label} logo`}
      className={className}
      width={64}
      height={64}
    />
  );
}

function ChampionshipHero({
  championship,
  seasons,
  raceCount,
  generatedAt,
}: {
  championship: NonNullable<Awaited<ReturnType<typeof getChampionshipStandingsSeason>>>;
  seasons: number[];
  raceCount: number;
  generatedAt: string | null;
}) {
  const leader = championship.drivers[0];
  const leaderMeta = getCurrentDriverMeta(leader?.driverId);
  const leaderTeam = getTeamAsset(leader?.teamId);

  return (
    <section className="champ-cinema-hero" style={teamStyle(leader?.teamId)}>
      <div className="champ-cinema-hero__atmosphere" aria-hidden="true">
        {leaderTeam.carImagePath ? (
          <AssetImage
            src={leaderTeam.carImagePath}
            fallbackSrc={leaderTeam.fallbackImagePath}
            alt=""
            className="champ-cinema-hero__car"
            fill
            loading="eager"
            sizes="100vw"
            style={{
              objectFit: leaderTeam.imageFit ?? "cover",
              objectPosition: leaderTeam.imagePosition,
            }}
          />
        ) : null}
        <div className="champ-cinema-hero__grid" />
        <div className="champ-cinema-hero__speed" />
      </div>

      <div className="champ-cinema-hero__copy">
        <span>Championship control</span>
        <h1>{championship.season} Championship</h1>
        <p>
          Drivers, constructors, and race-derived season records after {championship.latestRaceName}.
        </p>
        <div className="champ-cinema-hero__meta">
          <strong>{formatRaceDate(championship.latestRaceDate)}</strong>
          <strong>{raceCount} reports counted</strong>
          <strong>{formatGeneratedAt(generatedAt)}</strong>
        </div>
      </div>

      {leader ? (
        <aside className="champ-cinema-leader-panel" aria-label="Drivers championship leader">
          <div className="champ-cinema-leader-panel__portrait">
            <AssetImage
              src={leaderMeta.photoPath ?? leaderMeta.fallbackPhotoPath}
              fallbackSrc={leaderMeta.fallbackPhotoPath}
              alt={leaderMeta.altText}
              className="champ-cinema-leader-panel__photo"
              fill
              priority
              sizes="(max-width: 900px) 60vw, 24rem"
              style={{
                objectFit: leaderMeta.photoFit ?? "contain",
                objectPosition: leaderMeta.photoPosition ?? "center bottom",
                transform: `translateX(${leaderMeta.photoTranslateX ?? 0}px) translateY(1rem) scale(${(leaderMeta.photoScale ?? 1) * 1.05})`,
              }}
            />
          </div>
          <div className="champ-cinema-leader-panel__copy">
            <span>Driver leader</span>
            <h2>{leader.displayName}</h2>
            <p>{leader.teamName}</p>
            <strong>{formatPoints(leader.points)}</strong>
          </div>
          <TeamLogo teamId={leader.teamId} className="champ-cinema-leader-panel__logo" />
        </aside>
      ) : null}

      <div className="champ-cinema-hero__season">
        <YearSelector seasons={seasons} selectedSeason={championship.season} />
      </div>
    </section>
  );
}

function OverviewSection({
  championship,
  raceCount,
  generatedAt,
}: {
  championship: NonNullable<Awaited<ReturnType<typeof getChampionshipStandingsSeason>>>;
  raceCount: number;
  generatedAt: string | null;
}) {
  const driverLeader = championship.drivers[0];
  const driverSecond = championship.drivers[1];
  const constructorLeader = championship.constructors[0];
  const constructorSecond = championship.constructors[1];
  const driverMargin = driverLeader && driverSecond ? driverLeader.points - driverSecond.points : 0;
  const constructorMargin = constructorLeader && constructorSecond ? constructorLeader.points - constructorSecond.points : 0;

  return (
    <section className="champ-cinema-panel champ-cinema-overview" id="overview" aria-labelledby="overview-title">
      <div className="champ-cinema-section-heading">
        <span>Overview</span>
        <h2 id="overview-title">Championship state</h2>
        <p>Current order, race coverage, and source confidence in one read.</p>
      </div>

      <div className="champ-cinema-kpi-strip">
        <article>
          <span>Driver margin</span>
          <strong>{formatGap(driverMargin)}</strong>
          <small>{driverLeader?.displayName ?? "Leader unavailable"} over P2</small>
        </article>
        <article>
          <span>Constructor margin</span>
          <strong>{formatGap(constructorMargin)}</strong>
          <small>{constructorLeader?.constructorName ?? "Team unavailable"} over P2</small>
        </article>
        <article>
          <span>Latest race</span>
          <strong>{championship.latestRaceName}</strong>
          <small>{formatRaceDate(championship.latestRaceDate)}</small>
        </article>
        <article>
          <span>Race reports</span>
          <strong>{raceCount}</strong>
          <small>Performance metrics counted</small>
        </article>
      </div>

      <div className="champ-cinema-source-note">
        <strong>Data posture</strong>
        <p>
          Standings use curated championship tables. Performance records use race-analysis outputs, with overtakes and
          position movement kept as proxy-derived signals.
        </p>
        <span>Last generated: {formatGeneratedAt(generatedAt)}</span>
      </div>
    </section>
  );
}

function DriverPodium({ drivers }: { drivers: DriverStanding[] }) {
  const podium = [drivers[1], drivers[0], drivers[2]].filter(Boolean);
  const maxPoints = drivers[0]?.points ?? 0;

  return (
    <div className="champ-cinema-driver-podium" aria-label="Top three drivers">
      {podium.map((driver) => {
        const meta = getCurrentDriverMeta(driver.driverId);
        const team = getTeamAsset(driver.teamId);
        return (
          <article
            className={`champ-cinema-podium champ-cinema-podium--p${driver.standingPosition}`}
            key={driver.driverId}
            style={teamStyle(driver.teamId, {
              "--bar-size": `${percentOf(driver.points, maxPoints)}%`,
            })}
          >
            <div className="champ-cinema-podium__copy">
              <span>P{driver.standingPosition}</span>
              <h3>{driver.displayName}</h3>
              <p>{team.label}</p>
              <strong>{formatPoints(driver.points)}</strong>
            </div>
            <div className="champ-cinema-podium__portrait">
              <AssetImage
                src={meta.photoPath ?? meta.fallbackPhotoPath}
                fallbackSrc={meta.fallbackPhotoPath}
                alt={meta.altText}
                className="champ-cinema-podium__photo"
                fill
                sizes="(max-width: 900px) 58vw, 19rem"
                priority={driver.standingPosition === 1}
                style={{
                  objectFit: meta.photoFit ?? "contain",
                  objectPosition: meta.photoPosition ?? "center bottom",
                  transform: `translateX(${meta.photoTranslateX ?? 0}px) translateY(1.2rem) scale(${(meta.photoScale ?? 1) * 1.04})`,
                }}
              />
            </div>
            <i aria-hidden="true" />
          </article>
        );
      })}
    </div>
  );
}

function DriversSection({ drivers }: { drivers: DriverStanding[] }) {
  const maxPoints = drivers[0]?.points ?? 0;

  return (
    <section className="champ-cinema-panel" id="drivers" aria-labelledby="drivers-title">
      <div className="champ-cinema-section-heading">
        <span>Drivers</span>
        <h2 id="drivers-title">Drivers championship</h2>
        <p>Team identity, points share, and gap to the leader for the full field.</p>
      </div>

      <DriverPodium drivers={drivers.slice(0, 3)} />

      <ol className="champ-cinema-driver-table">
        {drivers.map((driver) => {
          const meta = getCurrentDriverMeta(driver.driverId);
          const team = getTeamAsset(driver.teamId);
          const gap = maxPoints - driver.points;
          return (
            <li
              key={driver.driverId}
              style={teamStyle(driver.teamId, {
                "--bar-size": `${percentOf(driver.points, maxPoints)}%`,
              })}
            >
              <span className="champ-cinema-rank">P{driver.standingPosition}</span>
              <div className="champ-cinema-driver-table__portrait">
                <AssetImage
                  src={meta.photoPath ?? meta.fallbackPhotoPath}
                  fallbackSrc={meta.fallbackPhotoPath}
                  alt=""
                  className="champ-cinema-driver-table__photo"
                  fill
                  sizes="4rem"
                  style={{
                    objectFit: meta.photoFit ?? "contain",
                    objectPosition: meta.photoPosition ?? "center bottom",
                    transform: `translateX(${meta.photoTranslateX ?? 0}px) scale(${meta.photoScale ?? 1})`,
                  }}
                />
              </div>
              <div className="champ-cinema-driver-table__identity">
                <strong>{driver.displayName}</strong>
                <small>{team.label}</small>
              </div>
              <div className="champ-cinema-points-bar" aria-hidden="true">
                <i />
              </div>
              <TeamLogo teamId={driver.teamId} className="champ-cinema-driver-table__logo" />
              <em>{formatPoints(driver.points)}</em>
              <b>{formatGap(gap)}</b>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ConstructorsSection({ constructors }: { constructors: ConstructorStanding[] }) {
  const maxPoints = constructors[0]?.points ?? 0;

  return (
    <section className="champ-cinema-panel" id="constructors" aria-labelledby="constructors-title">
      <div className="champ-cinema-section-heading">
        <span>Constructors</span>
        <h2 id="constructors-title">Team standings</h2>
        <p>Constructor points density with wins, gap, team color, logo, and car identity.</p>
      </div>

      <ol className="champ-cinema-constructor-grid">
        {constructors.map((constructor) => {
          const team = getTeamAsset(constructor.constructorId);
          const gap = maxPoints - constructor.points;
          return (
            <li
              key={constructor.constructorId}
              style={teamStyle(constructor.constructorId, {
                "--bar-size": `${percentOf(constructor.points, maxPoints)}%`,
              })}
            >
              <div className="champ-cinema-constructor-grid__media">
                {team.carImagePath ? (
                  <AssetImage
                    src={team.carImagePath}
                    fallbackSrc={team.fallbackImagePath}
                    alt={team.carImageAlt}
                    className="champ-cinema-constructor-grid__car"
                    fill
                    sizes="(max-width: 900px) 90vw, 26rem"
                    style={{
                      objectFit: team.imageFit ?? "cover",
                      objectPosition: team.imagePosition,
                    }}
                  />
                ) : null}
                <TeamLogo teamId={constructor.constructorId} className="champ-cinema-constructor-grid__logo" />
              </div>
              <div className="champ-cinema-constructor-grid__body">
                <span>P{constructor.standingPosition}</span>
                <h3>{team.label}</h3>
                <div className="champ-cinema-constructor-grid__stats">
                  <strong>{formatPoints(constructor.points)}</strong>
                  <small>{constructor.wins} wins</small>
                  <small>{formatGap(gap)}</small>
                </div>
                <div className="champ-cinema-points-bar" aria-hidden="true">
                  <i />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DataNotesSection() {
  return (
    <section className="champ-cinema-panel champ-cinema-notes" id="data-notes" aria-labelledby="data-notes-title">
      <div className="champ-cinema-section-heading">
        <span>Data notes</span>
        <h2 id="data-notes-title">Source confidence</h2>
        <p>Keep official standings separate from inferred race-analysis signals.</p>
      </div>
      <div className="champ-cinema-notes__grid">
        <article>
          <span>Official order</span>
          <strong>Drivers and constructors</strong>
          <p>Championship tables come from curated standings snapshots for the selected season.</p>
        </article>
        <article>
          <span>Race-analysis records</span>
          <strong>Leaderboards</strong>
          <p>Laps, pit stops, DNFs, and position records are compiled from generated race-analysis artifacts.</p>
        </article>
        <article>
          <span>Proxy signals</span>
          <strong>Movement and overtakes</strong>
          <p>Overtakes and position gains are proxy-derived and should be read as analytical estimates.</p>
        </article>
      </div>
    </section>
  );
}

export default async function ChampionshipPage({ searchParams }: ChampionshipPageProps) {
  const params = await searchParams;
  const requestedSeason = Number(firstParam(params?.season));
  const seasons = await listChampionshipSeasons();
  const selectedSeason = Number.isFinite(requestedSeason) && seasons.includes(requestedSeason)
    ? requestedSeason
    : seasons[0];
  const [achievements, championship] = await Promise.all([
    getAchievementsSeason(selectedSeason),
    getChampionshipStandingsSeason(selectedSeason),
  ]);

  return (
    <main className="champ-cinema-page">
      {achievements && championship ? (
        <>
          <ChampionshipHero
            championship={championship}
            seasons={seasons}
            raceCount={achievements.raceCount}
            generatedAt={achievements.generatedAt}
          />

          <div className="champ-cinema-workspace">
            <SectionRail />
            <div className="champ-cinema-workspace__main">
              <OverviewSection
                championship={championship}
                raceCount={achievements.raceCount}
                generatedAt={achievements.generatedAt}
              />
              <DriversSection drivers={championship.drivers} />
              <ConstructorsSection constructors={championship.constructors} />
              <section className="champ-cinema-panel" id="performance" aria-labelledby="performance-title">
                <div className="champ-cinema-section-heading">
                  <span>Performance</span>
                  <h2 id="performance-title">Season records</h2>
                  <p>Top drivers by race-distance, lap-leading, strategy, movement, and classification records.</p>
                </div>
                <ChampionshipLeaderboards metrics={metricOrder.map((metricId) => achievements.metrics[metricId])} />
              </section>
              <DataNotesSection />
            </div>
          </div>
        </>
      ) : (
        <section className="champ-cinema-hero champ-cinema-hero--empty">
          <div className="champ-cinema-hero__copy">
            <span>Championship control</span>
            <h1>Championship data is unavailable.</h1>
            <p>Championship tables appear when race-analysis and standings data are generated.</p>
          </div>
        </section>
      )}

      <AppFooter />
    </main>
  );
}
