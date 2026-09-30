import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import {
  Activity as Gauge,
  ArrowRight,
  Crown,
  DashFlag as Flag,
  Flash as Zap,
  NavArrowDown as ChevronDown,
  Trophy,
} from "iconoir-react/regular";
import { SiteShell } from "@/components/site-shell";
import { team } from "@/data/teams";
import { getChampionship } from "@/lib/f1.functions";
import "./championship.css";

const champQuery = queryOptions({
  queryKey: ["championship"],
  queryFn: () => getChampionship({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/championship")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(champQuery);
  },
  head: () => ({
    meta: [
      { title: "Championship 2026 | F1 InsightX" },
      { name: "description", content: "2026 driver and constructor standings, with the season's defining numbers." },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell fullWidth>
      <div className="cp-error" role="alert">Standings unavailable: {error.message}</div>
    </SiteShell>
  ),
  component: Championship,
});

type ChampionshipData = NonNullable<Awaited<ReturnType<typeof getChampionship>>>;
type Driver = ChampionshipData["drivers"][number];
type Constructor = ChampionshipData["constructors"][number];
type StandingMode = "drivers" | "teams";
type MetricKey = "wins" | "podiums" | "sprintPoints" | "positionsGained" | "starts" | "dnf";

const number = new Intl.NumberFormat("en-US");
const fmt = (value: number | null | undefined) => value == null ? "—" : number.format(Math.round(value));
const portrait = (code: string) => `/assets/drivers/2026/headshots/${code.toLowerCase()}.png`;
const fullPortrait = (code: string) => `/assets/drivers/2026/full-body/front/${code.toLowerCase()}.png`;

const metrics: { key: MetricKey; label: string; icon: typeof Trophy }[] = [
  { key: "wins", label: "Wins", icon: Trophy },
  { key: "podiums", label: "Podiums", icon: Crown },
  { key: "sprintPoints", label: "Sprint points", icon: Zap },
  { key: "positionsGained", label: "Places gained", icon: ArrowRight },
  { key: "starts", label: "Race starts", icon: Flag },
  { key: "dnf", label: "DNFs", icon: Gauge },
];

function Championship() {
  const { data } = useSuspenseQuery(champQuery);
  const [mode, setMode] = useState<StandingMode>("drivers");
  const [metric, setMetric] = useState<MetricKey>("wins");
  const [showAll, setShowAll] = useState(false);
  const leader = data.drivers[0];
  const leadingTeam = data.constructors[0];
  const runnerUp = data.drivers[1];
  const gap = leader && runnerUp ? leader.points - runnerUp.points : null;
  const selectedMetric = metrics.find((item) => item.key === metric)!;
  const metricDrivers = useMemo(() => data.drivers
    .filter((driver) => typeof driver[metric] === "number" && Number.isFinite(driver[metric]))
    .sort((a, b) => Number(b[metric]) - Number(a[metric])), [data.drivers, metric]);
  const standings = mode === "drivers" ? data.drivers : data.constructors;
  const visible = showAll ? standings : standings.slice(0, 10);

  return (
    <SiteShell fullWidth>
      <div className="cp-page">
        <div className="cp-container">
          <header className="cp-heading">
            <div>
              <p className="cp-overline">Season {data.season} <span /> Round {data.round}</p>
              <h1>Championship<span className="cp-heading-dot">.</span></h1>
            </div>
            <div className="cp-heading-aside"><span className="cp-live-dot" /> Standings through round {data.round}</div>
          </header>

          <section className="cp-leaders" aria-label="Championship leaders">
            <div className="cp-driver-feature" style={{ "--cp-team": team(leader?.team).color } as CSSProperties}>
              <div className="cp-feature-copy">
                <div className="cp-feature-top"><span>01 / Driver leader</span><Crown width={19} height={19} strokeWidth={1.6} /></div>
                {leader ? <>
                  <div className="cp-feature-main">
                    <span className="cp-feature-index">P1</span>
                    <h2>{leader.name}</h2>
                    <p>{team(leader.team).name}</p>
                  </div>
                  <div className="cp-feature-bottom">
                    <div><strong>{fmt(leader.points)}</strong><span>Points</span></div>
                    <div><strong>{fmt(leader.wins)}</strong><span>Wins</span></div>
                    {gap != null && <div><strong>+{fmt(gap)}</strong><span>To P2</span></div>}
                  </div>
                </> : <p className="cp-feature-empty">Awaiting results</p>}
              </div>
              {leader && <img className="cp-hero-driver" src={fullPortrait(leader.code)} alt={leader.name} />}
              <span className="cp-feature-ghost" aria-hidden="true">01</span>
            </div>

            <div className="cp-team-feature" style={{ "--cp-team": team(leadingTeam?.name).color } as CSSProperties}>
              <div className="cp-feature-top"><span>01 / Constructor leader</span><ArrowRight width={19} height={19} strokeWidth={1.6} /></div>
              {leadingTeam && <>
                <img className="cp-team-logo" src={team(leadingTeam.name).logoSvg} alt="" />
                <div className="cp-team-feature-bottom">
                  <div><h2>{team(leadingTeam.name).name}</h2><p>Constructors</p></div>
                  <strong>{fmt(leadingTeam.points)} <span>PTS</span></strong>
                </div>
              </>}
            </div>
          </section>

          <section className="cp-standings" aria-labelledby="cp-standings-title">
            <div className="cp-section-head">
              <div><span className="cp-section-number">01 / THE ORDER</span><h2 id="cp-standings-title">Standings</h2></div>
              <div className="cp-tabs" role="tablist" aria-label="Standings">
                <button type="button" role="tab" aria-selected={mode === "drivers"} className={mode === "drivers" ? "active" : ""} onClick={() => { setMode("drivers"); setShowAll(false); }}>Drivers</button>
                <button type="button" role="tab" aria-selected={mode === "teams"} className={mode === "teams" ? "active" : ""} onClick={() => { setMode("teams"); setShowAll(false); }}>Constructors</button>
              </div>
            </div>
            <div className="cp-table" role="tabpanel">
              <div className="cp-table-head"><span>Pos</span><span>{mode === "drivers" ? "Driver" : "Constructor"}</span><span>Wins</span><span>Points</span></div>
              {mode === "drivers" ? (visible as Driver[]).map((driver) => <DriverRow key={driver.driverId} driver={driver} leaderPoints={leader?.points ?? 0} />) :
                (visible as Constructor[]).map((constructor) => <TeamRow key={constructor.id} constructor={constructor} leaderPoints={leadingTeam?.points ?? 0} />)}
              {standings.length > 10 && <button className="cp-show-all" type="button" onClick={() => setShowAll(!showAll)}>{showAll ? "Show top 10" : `Show all ${standings.length}`}<ChevronDown width={16} height={16} className={showAll ? "rotate" : ""} /></button>}
            </div>
          </section>

          <section className="cp-numbers" aria-labelledby="cp-numbers-title">
            <div className="cp-section-head"><div><span className="cp-section-number">02 / THE NUMBERS</span><h2 id="cp-numbers-title">Beyond points</h2></div></div>
            <div className="cp-metric-layout">
              <div className="cp-metric-nav" role="tablist" aria-label="Season metrics">
                {metrics.map(({ key, label, icon: Icon }) => {
                  const top = data.drivers.filter((d) => typeof d[key] === "number").sort((a, b) => Number(b[key]) - Number(a[key]))[0];
                  return <button key={key} type="button" role="tab" aria-selected={metric === key} className={metric === key ? "active" : ""} onClick={() => setMetric(key)}><Icon width={19} height={19} strokeWidth={1.7} /><span>{label}</span><strong>{fmt(top?.[key])}</strong><ArrowRight width={16} height={16} className="cp-metric-arrow" /></button>;
                })}
              </div>
              <div className="cp-metric-detail" role="tabpanel">
                <div className="cp-metric-detail-head"><div><selectedMetric.icon width={20} height={20} strokeWidth={1.7} /><span>{selectedMetric.label}</span></div><span>Top 5</span></div>
                {metricDrivers.length ? metricDrivers.slice(0, 5).map((driver, index) => <div className="cp-metric-row" key={driver.driverId} style={{ "--cp-team": team(driver.team).color } as CSSProperties}>
                  <span className="cp-metric-position">0{index + 1}</span>
                  <img src={portrait(driver.code)} alt="" />
                  <div className="cp-metric-name"><strong>{driver.name}</strong><span>{team(driver.team).short}</span></div>
                  <div className="cp-metric-bar"><span style={{ width: `${Math.max(3, Number(driver[metric]) / Math.max(1, Number(metricDrivers[0]?.[metric])) * 100)}%` }} /></div>
                  <strong className="cp-metric-value">{fmt(driver[metric])}</strong>
                </div>) : <p className="cp-no-data">No data available</p>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </SiteShell>
  );
}

function DriverRow({ driver, leaderPoints }: { driver: Driver; leaderPoints: number }) {
  const t = team(driver.team);
  return <div className="cp-row" style={{ "--cp-team": t.color } as CSSProperties}>
    <span className="cp-rank">{String(driver.position).padStart(2, "0")}</span>
    <div className="cp-identity"><div className="cp-portrait"><img src={portrait(driver.code)} alt="" /></div><div className="cp-identity-text"><strong>{driver.name}</strong><span>{t.name}</span></div></div>
    <span className="cp-wins">{fmt(driver.wins)}</span>
    <span className="cp-points"><strong>{fmt(driver.points)}</strong>{driver.position !== 1 && <small>−{fmt(leaderPoints - driver.points)}</small>}</span>
  </div>;
}

function TeamRow({ constructor, leaderPoints }: { constructor: Constructor; leaderPoints: number }) {
  const t = team(constructor.name);
  return <div className="cp-row" style={{ "--cp-team": t.color } as CSSProperties}>
    <span className="cp-rank">{String(constructor.position).padStart(2, "0")}</span>
    <div className="cp-identity"><div className="cp-row-logo"><img src={t.logoSvg} alt="" /></div><div className="cp-identity-text"><strong>{t.name}</strong><span>{t.short}</span></div></div>
    <span className="cp-wins">{fmt(constructor.wins)}</span>
    <span className="cp-points"><strong>{fmt(constructor.points)}</strong>{constructor.position !== 1 && <small>−{fmt(leaderPoints - constructor.points)}</small>}</span>
  </div>;
}
