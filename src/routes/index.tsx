import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Calendar, DashFlag, FastArrowRight, MapPin, Timer } from "iconoir-react/regular";
import type { CSSProperties } from "react";
import { SiteShell } from "@/components/site-shell";
import { team as teamOf } from "@/data/teams";
import { getRaceReports, getRaceWeek, getSeasonTelemetry } from "@/lib/f1.functions";
import { fmtDate } from "@/lib/format";
import "./home.css";

const seasonQuery = queryOptions({
  queryKey: ["season-telemetry"],
  queryFn: () => getSeasonTelemetry(),
  staleTime: 5 * 60_000,
});

const reportsQuery = queryOptions({
  queryKey: ["race-reports"],
  queryFn: () => getRaceReports(),
  staleTime: 5 * 60_000,
});

const raceWeekQuery = queryOptions({
  queryKey: ["race-week"],
  queryFn: () => getRaceWeek(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(seasonQuery),
      context.queryClient.ensureQueryData(reportsQuery),
      context.queryClient.ensureQueryData(raceWeekQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "F1 InsightX — Race Control" },
      {
        name: "description",
        content: "The next race, championship standings and race analysis in one place.",
      },
      { property: "og:title", content: "F1 InsightX — Race Control" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell>
      <p role="alert">Race Control data unavailable: {error.message}</p>
    </SiteShell>
  ),
  component: Home,
});

type Driver = {
  driverCode: string;
  driverName: string;
  team: string;
  constructorName: string | null;
  position: number;
  points: number;
  wins: number;
};

function portrait(code: string, full = false) {
  const assetCode = code.toUpperCase() === "MAX" ? "ver" : code.toLowerCase();
  return `/assets/drivers/2026/${full ? "full-body/front" : "headshots"}/${assetCode}.png`;
}

function Home() {
  const { data } = useSuspenseQuery(seasonQuery);
  const race = useSuspenseQuery(raceWeekQuery).data;
  const reports = useSuspenseQuery(reportsQuery).data.reports;
  const drivers = [...data.drivers].sort((a, b) => a.position - b.position);
  const constructors = [...data.constructors].sort((a, b) => a.position - b.position);
  const leader = drivers[0];
  const leaderTeam = teamOf(leader?.constructorName ?? leader?.team);
  const latest = reports[0];
  const raceName = race?.raceName ?? "Next Grand Prix";
  const raceLocation = race?.circuit.country ?? race?.circuit.name ?? "2026 season";
  const raceUpcoming = !!race?.scheduledAt && new Date(race.scheduledAt).getTime() > Date.now();

  return (
    <SiteShell fullWidth home>
      <div className="hx-home">
        <section
          className="hx-hero"
          aria-labelledby="hx-title"
          style={{ "--team-accent": leaderTeam.color } as CSSProperties}
        >
          <div className="hx-hero-grain" aria-hidden="true" />
          <div className="hx-hero-copy">
            <h1 id="hx-title" className="hx-wordmark">
              <span>F1</span>
              <span>
                INSIGHT<span className="hx-wordmark-x">X</span>
              </span>
            </h1>
            <p className="hx-hero-line">A sharper view of race day.</p>

            <div className="hx-next-race">
              <div className="hx-next-meta">
                <span className="hx-eyebrow">
                  <span className="hx-signal" /> {raceUpcoming ? "Next race" : "Race focus"}{" "}
                  <span className="hx-round">/ Round {race?.round ?? "—"}</span>
                </span>
                <h2>{raceName}</h2>
                <p>
                  <MapPin aria-hidden="true" /> {raceLocation}
                  {race?.scheduledAt ? (
                    <>
                      <span className="hx-meta-dot">·</span>
                      {fmtDate(race.scheduledAt)}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="hx-hero-actions">
                <Link to="/raceweek" className="hx-primary-link">
                  Race week <FastArrowRight aria-hidden="true" />
                </Link>
                <Link to="/championship" className="hx-text-link">
                  Championship <FastArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>

          {leader ? (
            <div className="hx-hero-driver">
              <div className="hx-driver-halo" aria-hidden="true" />
              <span className="hx-driver-number" aria-hidden="true">
                01
              </span>
              <img
                className="hx-driver-photo"
                src={portrait(leader.driverCode, true)}
                alt={`${leader.driverName}, championship leader`}
                fetchPriority="high"
              />
              <div className="hx-driver-caption">
                <div className="hx-driver-caption-main">
                  <span className="hx-eyebrow">Championship leader</span>
                  <strong>{leader.driverName}</strong>
                </div>
                <div className="hx-driver-team">
                  {leaderTeam.logoSvg ? <img src={leaderTeam.logoSvg} alt="" /> : null}
                  <span>{leaderTeam.name}</span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="hx-standings hx-section" aria-labelledby="hx-standings-title">
          <div className="hx-section-head">
            <div>
              <span className="hx-eyebrow">After round {data.standingsRound}</span>
              <h2 id="hx-standings-title">The order.</h2>
            </div>
            <Link to="/championship" className="hx-section-link">
              Full standings <FastArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div className="hx-standings-grid">
            <div className="hx-drivers-list">
              {drivers.slice(0, 4).map((driver) => (
                <DriverRow key={driver.driverCode} driver={driver} />
              ))}
            </div>
            <div className="hx-teams-list">
              <div className="hx-list-label">
                <span>Constructors</span>
                <span>Pts</span>
              </div>
              {constructors.slice(0, 4).map((constructor) => {
                const team = teamOf(constructor.name);
                return (
                  <Link to="/championship" className="hx-team-row" key={constructor.id}>
                    <span className="hx-rank">{String(constructor.position).padStart(2, "0")}</span>
                    {team.logoSvg ? (
                      <img src={team.logoSvg} alt="" />
                    ) : (
                      <span className="hx-team-fallback">{team.short}</span>
                    )}
                    <strong>{team.name}</strong>
                    <span className="hx-points">{constructor.points}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="hx-discover hx-section" aria-label="Explore Race Control">
          <Link to="/raceweek" className="hx-discover-link">
            <Calendar aria-hidden="true" />
            <span>Race week</span>
            <FastArrowRight aria-hidden="true" />
          </Link>
          <Link to="/analysis" className="hx-discover-link">
            <Timer aria-hidden="true" />
            <span>Analysis</span>
            <FastArrowRight aria-hidden="true" />
          </Link>
          <Link to="/picks" className="hx-discover-link">
            <DashFlag aria-hidden="true" />
            <span>Picks</span>
            <FastArrowRight aria-hidden="true" />
          </Link>
        </section>

        {latest ? (
          <section className="hx-latest hx-section" aria-labelledby="hx-latest-title">
            <div className="hx-section-head">
              <div>
                <span className="hx-eyebrow">Latest report / Round {latest.round}</span>
                <h2 id="hx-latest-title">Last time out.</h2>
              </div>
              <Link to="/analysis" className="hx-section-link">
                All analysis <FastArrowRight aria-hidden="true" />
              </Link>
            </div>
            <Link to="/analysis/$slug" params={{ slug: latest.slug }} className="hx-latest-link">
              <span className="hx-latest-race">
                <small>{fmtDate(latest.dateISO)}</small>
                <strong>{latest.name}</strong>
                <span>{latest.circuit}</span>
              </span>
              <span className="hx-latest-winner">
                <small>Winner</small>
                <strong>{latest.winnerName}</strong>
                <span className="hx-latest-team">
                  {teamOf(latest.winnerTeam).logoSvg ? (
                    <img src={teamOf(latest.winnerTeam).logoSvg} alt="" />
                  ) : null}
                  {teamOf(latest.winnerTeam).name}
                </span>
              </span>
              <FastArrowRight aria-hidden="true" />
            </Link>
          </section>
        ) : null}
      </div>
    </SiteShell>
  );
}

function DriverRow({ driver }: { driver: Driver }) {
  const team = teamOf(driver.constructorName ?? driver.team);
  return (
    <Link
      to="/championship"
      className="hx-driver-row"
      style={{ "--row-accent": team.color } as CSSProperties}
    >
      <span className="hx-rank">{String(driver.position).padStart(2, "0")}</span>
      <span className="hx-row-portrait">
        <img src={portrait(driver.driverCode)} alt="" loading="lazy" />
      </span>
      <span className="hx-row-name">
        <strong>{driver.driverName}</strong>
        <small>{team.name}</small>
      </span>
      <span className="hx-points">
        {driver.points}
        <small> pts</small>
      </span>
    </Link>
  );
}
