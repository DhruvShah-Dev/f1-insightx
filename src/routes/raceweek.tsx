import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Cloud, Timer } from "iconoir-react/regular";
import { Flag, Navigation } from "lucide-react";
import { useState } from "react";
import { SiteShell } from "@/components/site-shell";
import { RaceCircuitProfile } from "@/components/race-circuit-profile";
import { cornerSummaryForCircuit } from "@/data/circuit-corners";
import { fmtDateTime, fmtLapS, pct } from "@/lib/format";
import { getRaceWeek } from "@/lib/f1.functions";
import { pageSeo } from "@/lib/seo";
import "./raceweek.css";

const raceWeekQuery = queryOptions({
  queryKey: ["race-week"],
  queryFn: () => getRaceWeek(),
  staleTime: 24 * 60 * 60_000,
  refetchOnWindowFocus: false,
});

export const Route = createFileRoute("/raceweek")({
  loader: ({ context }) => context.queryClient.ensureQueryData(raceWeekQuery),
  head: () => pageSeo({
    title: "F1 Race Week Guide: Schedule, Circuit and Projections | F1 InsightX",
    description: "See the next Formula 1 weekend's session schedule, circuit profile, weather and qualifying and race projections.",
    path: "/raceweek",
  }),
  component: RaceWeek,
});

function RaceWeek() {
  const { data } = useSuspenseQuery(raceWeekQuery);
  const [expanded, setExpanded] = useState<"qualifying" | "race" | null>(null);
  if (!data)
    return (
      <SiteShell fullWidth>
        <p role="alert">Race week data is unavailable.</p>
      </SiteShell>
    );

  const qualifying = [...data.qualifyingPredictions].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99),
  );
  const race = [...data.projections].sort((a, b) => (a.projected ?? 99) - (b.projected ?? 99));
  const raceRows = race.length
    ? race.map((d) => ({
        id: d.code,
        rank: d.projected,
        name: d.name,
        team: d.team,
        value: d.winProb == null ? "—" : `${pct(d.winProb)} win`,
      }))
    : data.drivers
        .filter((d) => d.projectedFinish != null)
        .sort((a, b) => (a.projectedFinish ?? 99) - (b.projectedFinish ?? 99))
        .map((d) => ({
          id: d.driverId,
          rank: d.projectedFinish,
          name: d.name,
          team: d.team,
          value: d.readiness == null ? "—" : `${pct(d.readiness)} ready`,
        }));
  const rain = data.weather?.rainProb == null ? null : pct(data.weather.rainProb);
  const trackTemp =
    data.weather?.trackTempC == null ? null : `${Math.round(data.weather.trackTempC)}°C`;
  const wind =
    data.weather?.windMps == null ? null : `${Math.round(data.weather.windMps * 3.6)} km/h`;
  const hasWeather = rain != null || trackTemp != null || wind != null;
  const start = data.scheduledAt ? fmtDateTime(data.scheduledAt) : "TBC";
  const turns = cornerSummaryForCircuit(data.circuit.id);
  const isSepang = /sepang/i.test(data.circuit.name);
  const circuitLength =
    data.circuit.lengthKm != null && data.circuit.lengthKm > 0
      ? data.circuit.lengthKm
      : isSepang
        ? 5.543
        : null;
  const turnCount = turns === "TBC" && isSepang ? "15" : turns;

  return (
    <SiteShell fullWidth>
      <div className="rw-page">
        <header className="rw-heading">
          <div>
            <p className="rw-eyebrow">
              Race week <span>·</span> Round {data.round} / {data.season}
            </p>
            <h1>{data.raceName}</h1>
            <p className="rw-subtitle">
              {data.circuit.name}
              {data.circuit.location ? ` · ${data.circuit.location}` : ""}
            </p>
          </div>
          <div className="rw-start">
            <span>Scheduled start</span>
            <strong>{start}</strong>
          </div>
        </header>
        <section className="rw-feature" aria-label="Circuit and race details">
          <div className="rw-map-column">
            <div className="rw-section-label">
              <Navigation aria-hidden="true" /> Circuit profile
            </div>
            <RaceCircuitProfile path={data.trackPath} circuitName={data.circuit.name} />
            <div className="rw-map-caption">
              <span>{data.circuit.name}</span>
              <span>{turnCount} turns</span>
            </div>
          </div>
          <div className="rw-facts-column">
            <div className="rw-section-label">
              <Flag aria-hidden="true" /> Race details
            </div>
            <div className="rw-big-stat">
              <span>Circuit length</span>
              <strong>{circuitLength == null ? "—" : `${circuitLength.toFixed(3)} km`}</strong>
            </div>
            <div className="rw-fact-pair">
              <div>
                <span>Format</span>
                <strong>{data.sprintWeekend ? "Sprint" : "Grand Prix"}</strong>
              </div>
              <div>
                <span>Turns</span>
                <strong>{turnCount}</strong>
              </div>
            </div>
            {hasWeather ? (
              <div className="rw-fact-pair">
                <div>
                  <span>Rain chance</span>
                  <strong>{rain ?? "—"}</strong>
                </div>
                <div>
                  <span>Track temp</span>
                  <strong>{trackTemp ?? "—"}</strong>
                </div>
              </div>
            ) : null}
            {wind ? (
              <div className="rw-weather-line">
                <Cloud aria-hidden="true" />
                <span>Wind</span>
                <strong>{wind}</strong>
              </div>
            ) : null}
          </div>
        </section>
        <section className="rw-projections" aria-label="Race week projections">
          <ProjectionTable
            title="Qualifying"
            subtitle="Predicted order"
            rows={qualifying.map((d) => ({
              id: d.driverId,
              rank: d.rank,
              name: d.name,
              team: d.team,
              value: d.timeS == null ? "—" : fmtLapS(d.timeS),
            }))}
            expanded={expanded === "qualifying"}
            onToggle={() => setExpanded(expanded === "qualifying" ? null : "qualifying")}
          />
          <ProjectionTable
            title="Race"
            subtitle="Projected finish"
            rows={raceRows}
            expanded={expanded === "race"}
            onToggle={() => setExpanded(expanded === "race" ? null : "race")}
          />
          {isSepang ? (
            <div className="rw-brief">
              <div className="rw-block-title">
                <Timer aria-hidden="true" />
                <div>
                  <h2>Circuit record</h2>
                  <p>Sepang International Circuit</p>
                </div>
              </div>
              <div className="rw-brief-row">
                <span>First Grand Prix</span>
                <strong>1999</strong>
              </div>
              <div className="rw-brief-row">
                <span>Fastest lap</span>
                <strong>1:34.080</strong>
              </div>
              <div className="rw-brief-row">
                <span>Record holder</span>
                <strong>Sebastian Vettel · 2017</strong>
              </div>
              <div className="rw-brief-row">
                <span>Reference distance</span>
                <strong>310.398 km</strong>
              </div>
            </div>
          ) : (
            <div className="rw-brief">
              <div className="rw-block-title">
                <Timer aria-hidden="true" />
                <div>
                  <h2>Weekend</h2>
                  <p>Conditions</p>
                </div>
              </div>
              <div className="rw-brief-row">
                <span>Race start</span>
                <strong>{start}</strong>
              </div>
              <div className="rw-brief-row">
                <span>Rain chance</span>
                <strong>{rain ?? "—"}</strong>
              </div>
              <div className="rw-brief-row">
                <span>Track temperature</span>
                <strong>{trackTemp ?? "—"}</strong>
              </div>
              <div className="rw-brief-row">
                <span>Wind</span>
                <strong>{wind ?? "—"}</strong>
              </div>
            </div>
          )}
        </section>
      </div>
    </SiteShell>
  );
}

function ProjectionTable({
  title,
  subtitle,
  rows,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle: string;
  rows: { id: string; rank: number | null; name: string; team: string; value: string }[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rw-projection-block">
      <div className="rw-block-title">
        <Flag aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="rw-table">
        {rows.length ? (
          (expanded ? rows : rows.slice(0, 5)).map((row, index) => (
            <div className="rw-table-row" key={row.id}>
              <span className="rw-rank">{row.rank ?? index + 1}</span>
              <div className="rw-driver">
                <strong>{row.name}</strong>
                <span>{row.team}</span>
              </div>
              <strong className="rw-value">{row.value}</strong>
            </div>
          ))
        ) : (
          <p className="rw-empty">Projection pending</p>
        )}
      </div>
      {rows.length > 5 ? (
        <button className="rw-more" type="button" onClick={onToggle}>
          {expanded ? "Show top 5" : `View all ${rows.length}`} <ArrowUpRight aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
