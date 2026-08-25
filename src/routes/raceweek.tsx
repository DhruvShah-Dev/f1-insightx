import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Countdown } from "@/components/countdown";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { CircuitMap } from "@/components/circuit-map";
import { countryTheme } from "@/data/country-theme";
import { team } from "@/data/teams";
import { cornerProfileForCircuit, cornerSummaryForCircuit, cornersForCircuit } from "@/data/circuit-corners";
import { fmtDate, fmtDateTime, fmtDelta, fmtLapS, fmtNum, pct } from "@/lib/format";
import { getRaceWeek, type RaceWeekDriver, type RaceWeekQualifyingPrediction } from "@/lib/f1.functions";

const raceWeekQuery = queryOptions({
  queryKey: ["race-week"],
  queryFn: () => getRaceWeek(),
  staleTime: 5 * 60_000,
});

type RacePrediction = {
  code: string;
  name: string;
  team: string;
  projected: number | null;
  low: number | null;
  high: number | null;
  winProb: number | null;
  podiumProb: number | null;
};

export const Route = createFileRoute("/raceweek")({
  loader: ({ context }) => context.queryClient.ensureQueryData(raceWeekQuery),
  head: () => ({
    meta: [
      { title: "Race Week - next F1 round pace, weather and predictions" },
      {
        name: "description",
        content:
          "Interactive circuit map, corner profile, weather forecast, qualifying predictions and race projections for the current Formula 1 race week.",
      },
      { property: "og:title", content: "F1 InsightX - Race Week" },
      {
        property: "og:description",
        content:
          "Interactive circuit map, weather forecast, qualifying predictions and race projections for the next round.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell>
      <p role="alert" className="text-sm text-destructive">
        Race week data unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  component: RaceWeek,
});

function RaceWeek() {
  const { data } = useSuspenseQuery(raceWeekQuery);
  const [showSprintQAll, setShowSprintQAll] = useState(false);
  const [showQualiAll, setShowQualiAll] = useState(false);
  const [showRaceAll, setShowRaceAll] = useState(false);

  if (!data) {
    return (
      <SiteShell>
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">Race week</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No scheduled round is stored for the current season.
        </p>
      </SiteShell>
    );
  }

  const theme = countryTheme(data.circuit.country);
  const w = data.weather;
  const cornerGroups = cornerProfileForCircuit(data.circuit.id);
  const corners = cornersForCircuit(data.circuit.id);
  const mediumCornerCount = cornerGroups.find((group) => group.label === "Medium")?.value;
  const circuitCode = data.circuit.id.toUpperCase().slice(0, 3);
  const qualiPredictions: RaceWeekQualifyingPrediction[] =
    data.qualifyingPredictions.length > 0
      ? data.qualifyingPredictions
          .slice()
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      : heuristicQualifyingPredictions(data.drivers);
  const racePredictions: RacePrediction[] = data.projections
    .slice()
    .sort((a, b) => (a.projected ?? 99) - (b.projected ?? 99));
  const sprintRows = showSprintQAll ? qualiPredictions : qualiPredictions.slice(0, 5);
  const qualiRows = showQualiAll ? qualiPredictions : qualiPredictions.slice(0, 5);
  const raceRows = showRaceAll ? racePredictions : racePredictions.slice(0, 5);

  return (
    <SiteShell>
      <section className="relative overflow-hidden rounded-xl border border-border bg-card/50">
        <div className="flex h-1.5 w-full">
          {theme.flag.map((c, i) => (
            <span key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{ background: `radial-gradient(80% 60% at 85% 0%, ${theme.accent}, transparent)` }}
        />
        <div className="relative grid gap-6 p-5 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <p className="label-xs">
              Round {data.round} - {data.season} - {theme.label}
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
              {data.raceName}
            </h1>
            <p className="num mt-1 text-xs text-muted-foreground">
              {data.circuit.name}
              {data.circuit.location ? ` - ${data.circuit.location}` : ""}
              {data.circuit.country ? `, ${data.circuit.country}` : ""}
              {data.sprintWeekend ? " - Sprint weekend" : ""}
            </p>
            {data.officialName ? (
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">{data.officialName}</p>
            ) : null}

            {data.scheduledAt ? (
              <div className="mt-5 flex flex-wrap items-end gap-8">
                <Countdown targetISO={data.scheduledAt} label="Race start in" compact />
                <div>
                  <p className="label-xs">Lights out</p>
                  <p className="num text-sm font-bold">{fmtDateTime(data.scheduledAt)}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                label="Corners"
                value={cornerSummaryForCircuit(data.circuit.id)}
                note={mediumCornerCount ? `${mediumCornerCount} medium complexes` : undefined}
              />
              <Stat
                label="Rain risk"
                value={w?.rainProb == null ? "TBC" : `${Math.round(w.rainProb * 100)}`}
                unit={w?.rainProb == null ? undefined : "%"}
              />
              <Stat
                label="Sessions"
                value={data.sprintWeekend ? "Sprint" : "Standard"}
                note={data.sprintWeekend ? "Sprint Q + sprint + Q" : "Practice + Q + race"}
              />
              {data.circuit.lengthKm != null ? (
                <Stat label="Lap" value={fmtNum(data.circuit.lengthKm, 3)} unit="km" />
              ) : null}
            </div>
          </div>

          <CircuitMap
            path={data.trackPath}
            circuitId={data.circuit.id}
            circuitName={data.circuit.name}
            className="min-h-[420px]"
          />
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading kicker="Forecast" title="Weather forecast" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ForecastTile label="Rain" value={w?.rainProb == null ? "TBC" : `${Math.round(w.rainProb * 100)}%`} note="Race window" />
          <ForecastTile label="Track temp" value={w?.trackTempC == null ? "TBC" : `${fmtNum(w.trackTempC, 1)} C`} note={w?.trackTempVolatility == null ? "Mean estimate" : `+/-${fmtNum(w.trackTempVolatility, 1)} swing`} />
          <ForecastTile label="Wind" value={w?.windMps == null ? "TBC" : `${fmtNum(w.windMps, 1)} m/s`} note="Average speed" />
          <ForecastTile label="Weather risk" value={w?.riskIndex == null ? "TBC" : fmtNum(w.riskIndex, 2)} note="Model index" />
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading kicker="Circuit" title="Corner profile" />
        <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {cornerGroups.map((group) => (
              <div key={group.label} className="border border-border bg-card/50 p-4">
                <p className="label-xs">{group.label} corners</p>
                <p className="num mt-1 text-3xl font-black">{group.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{group.detail}</p>
              </div>
            ))}
          </div>
          <div className="border border-border bg-card/40 p-4">
            <p className="label-xs">Named turns</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {corners.length ? corners.map((corner) => (
                <div key={corner.number} className="flex items-center gap-2 border-b border-border/60 pb-2 text-xs">
                  <span className="num grid size-6 place-items-center bg-primary text-[10px] font-black text-primary-foreground">
                    {corner.number}
                  </span>
                  <span className="font-bold uppercase">{corner.name}</span>
                  <span className="label-xs ml-auto">S{corner.sector}</span>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground">Corner labels are not available for this circuit yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading kicker="Predictions" title="Sprint Q and Q" />
        <div className="grid gap-4 lg:grid-cols-2">
          <QualiPredictionPanel
            title="Sprint Q"
            rows={sprintRows}
            expanded={showSprintQAll}
            disabled={!data.sprintWeekend}
            onToggle={() => setShowSprintQAll((value) => !value)}
            total={qualiPredictions.length}
            circuitCode={circuitCode}
          />
          <QualiPredictionPanel
            title="Qualifying"
            rows={qualiRows}
            expanded={showQualiAll}
            onToggle={() => setShowQualiAll((value) => !value)}
            total={qualiPredictions.length}
            circuitCode={circuitCode}
          />
        </div>
      </section>

      {racePredictions.length ? (
        <section className="mt-12">
          <SectionHeading kicker="Race pred" title="Race prediction" />
          <RacePredictionPanel
            rows={raceRows}
            expanded={showRaceAll}
            onToggle={() => setShowRaceAll((value) => !value)}
            total={racePredictions.length}
          />
        </section>
      ) : null}

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1fr]">
        {data.constructors.length ? (
          <section>
            <SectionHeading kicker="Constructors" title="Team readiness" />
            <div className="space-y-2">
              {data.constructors
                .slice()
                .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0))
                .map((c) => {
                  const t = team(c.name);
                  return (
                    <div key={c.id} className="rounded-lg border border-border bg-card/50 p-3">
                      <div className="flex items-baseline justify-between">
                        <p className="text-xs font-bold uppercase">{t.name}</p>
                        <span className="num text-xs font-bold" style={{ color: t.color }}>
                          {c.readiness == null ? "-" : pct(c.readiness)}
                        </span>
                      </div>
                      <div className="mt-2 h-1 w-full bg-secondary">
                        <div
                          className="h-1"
                          style={{
                            width: c.readiness == null ? "0%" : pct(c.readiness),
                            backgroundColor: t.color,
                          }}
                        />
                      </div>
                      {c.summary ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">{c.summary}</p>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeading kicker="Context" title="Form and history" />
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <p className="label-xs">Championship after R{data.round - 1}</p>
            <ol className="mt-2 space-y-1">
              {data.championship.map((c) => (
                <li key={c.code} className="flex items-baseline gap-2 text-xs">
                  <span className="num w-5 text-muted-foreground">{c.position}</span>
                  <span
                    className="inline-block h-3 w-0.5"
                    style={{ backgroundColor: team(c.team).color }}
                  />
                  <span className="font-bold uppercase">{c.name}</span>
                  <span className="num ml-auto font-bold">{c.points}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card/50 p-4">
            <p className="label-xs">Previous editions at this circuit</p>
            {data.previous.length ? (
              <ul className="mt-2 space-y-2">
                {data.previous.map((p) => (
                  <li key={p.slug} className="flex items-baseline gap-2 text-xs">
                    <span className="num text-muted-foreground">{p.season}</span>
                    <span className="font-bold uppercase">{p.winnerCode}</span>
                    <span className="num text-[11px] text-muted-foreground">
                      {team(p.winnerTeam).name}
                    </span>
                    <Link
                      to="/analysis/$slug"
                      params={{ slug: p.slug }}
                      className="num ml-auto text-[11px] text-primary underline underline-offset-2"
                    >
                      Report
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                No stored analysis for an earlier visit here.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card/40 p-4">
            <p className="label-xs">Data honesty</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Session-by-session practice timing is not ingested for this weekend, so these boards
              use season form signals rather than live FP1-FP3 laps. Race start time is the
              scheduled value stored with the round
              {data.lastCompleted?.name
                ? `; results are complete through ${data.lastCompleted.name}`
                : ""}
              .
            </p>
            <Link
              to="/method"
              className="mt-3 inline-block text-[11px] font-bold uppercase text-primary"
            >
              Model limits -&gt;
            </Link>
          </div>
        </section>
      </div>

      <p className="num mt-8 text-[10px] text-muted-foreground">
        Scheduled {data.scheduledAt ? fmtDate(data.scheduledAt) : "TBC"} - circuit id{" "}
        {data.circuit.id}
      </p>
    </SiteShell>
  );
}

function ForecastTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="pw-ticker border border-border bg-card/50 p-4">
      <p className="label-xs">{label}</p>
      <p className="num mt-2 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function QualiPredictionPanel({
  title,
  rows,
  expanded,
  disabled,
  onToggle,
  total,
  circuitCode,
}: {
  title: string;
  rows: RaceWeekQualifyingPrediction[];
  expanded: boolean;
  disabled?: boolean;
  onToggle: () => void;
  total: number;
  circuitCode: string;
}) {
  return (
    <div className="border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-xs">{title}</p>
          <h3 className="text-lg font-black uppercase italic">Top order</h3>
        </div>
        {disabled ? (
          <span className="label-xs">Not scheduled</span>
        ) : null}
      </div>
      <PredictionTable
        rows={rows.map((row) => ({
          key: row.code,
          code: row.code,
          name: row.name,
          teamName: row.team,
          position: row.rank,
          detail: row.timeS == null ? "Time TBC" : fmtLapS(row.timeS),
          secondary: row.gapS == null ? "Gap TBC" : fmtDelta(row.gapS),
          metric: row.sourceUsefulnessRank == null ? "Raw blend" : `Source #${row.sourceUsefulnessRank}`,
          note: [
            row.recentGapS == null ? null : `Recent ${fmtDelta(row.recentGapS)}`,
            row.sameCircuitGapS == null ? null : `${circuitCode} ${fmtDelta(row.sameCircuitGapS)}`,
            row.trackFitGapS == null ? null : `Fit ${fmtDelta(row.trackFitGapS)}`,
          ]
            .filter(Boolean)
            .join(" / "),
        }))}
      />
      {total > 5 ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-3 border border-border bg-background px-3 py-2 text-[11px] font-black uppercase italic text-foreground transition-colors hover:bg-accent"
        >
          {expanded ? "Show top 5" : `Show more (${total})`}
        </button>
      ) : null}
    </div>
  );
}

function heuristicQualifyingPredictions(drivers: RaceWeekDriver[]): RaceWeekQualifyingPrediction[] {
  const sorted = drivers
    .map((driver) => {
      const gap =
        driver.oneLapGapS ??
        (driver.projectedFinish == null ? null : Math.max(0, (driver.projectedFinish - 1) * 0.18));
      const readinessPush = driver.readiness == null ? 0 : (1 - driver.readiness) * 0.12;
      return {
        driver,
        score: (gap ?? 9) + readinessPush,
      };
    })
    .sort((a, b) => a.score - b.score);

  return sorted.map(({ driver, score }, index) => ({
    driverId: driver.driverId,
    code: driver.code,
    name: driver.name,
    team: driver.team,
    rank: index + 1,
    timeS: driver.oneLapS,
    gapS: driver.oneLapGapS ?? (Number.isFinite(score) ? score : null),
    recentGapS: driver.oneLapGapS,
    sameCircuitGapS: null,
    constructorGapS: null,
    raceWeekDeltaGapS: null,
    driverDeltaS: null,
    constructorDeltaS: null,
    formBiasScore: driver.readiness,
    trackFitGapS: null,
    sourceUsefulnessScore: null,
    sourceUsefulnessRank: null,
    qualityNote: "derived from one-lap board when qualifying table is unavailable",
    missingFlags: "qualifying_prediction_table_unavailable",
    mode: "heuristic",
    modeLabel: "One-lap heuristic",
    sourceLabel: "race_week_driver_board",
  }));
}

function RacePredictionPanel({
  rows,
  expanded,
  onToggle,
  total,
}: {
  rows: RacePrediction[];
  expanded: boolean;
  onToggle: () => void;
  total: number;
}) {
  return (
    <div className="border border-border bg-card/50 p-4">
      <PredictionTable
        rows={rows.map((row) => ({
          key: row.code,
          code: row.code,
          name: row.name,
          teamName: row.team,
          position: row.projected,
          detail: `Band P${row.low ?? "-"}-P${row.high ?? "-"}`,
          secondary: row.winProb == null ? "Win TBC" : `Win ${pct(row.winProb)}`,
          metric: row.podiumProb == null ? "-" : pct(row.podiumProb),
        }))}
      />
      {total > 5 ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-3 border border-border bg-background px-3 py-2 text-[11px] font-black uppercase italic text-foreground transition-colors hover:bg-accent"
        >
          {expanded ? "Show top 5" : `Show more (${total})`}
        </button>
      ) : null}
    </div>
  );
}

function PredictionTable({
  rows,
}: {
  rows: {
    key: string;
    code: string;
    name: string;
    teamName: string;
    position: number | null;
    detail: string;
    secondary: string;
    metric: string;
    note?: string;
  }[];
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="label-xs px-2 py-2">Pos</th>
            <th className="label-xs px-2 py-2">Driver</th>
            <th className="label-xs px-2 py-2">Team</th>
            <th className="label-xs px-2 py-2 text-right">Read</th>
            <th className="label-xs px-2 py-2 text-right">Metric</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const t = team(row.teamName);
            return (
              <tr key={row.key} className="pw-ticker border-b border-border/60 hover:bg-accent/30">
                <td className="num px-2 py-2 text-xs font-black">
                  P{row.position ?? index + 1}
                </td>
                <td className="px-2 py-2 text-xs font-bold uppercase">
                  <span
                    className="mr-2 inline-block h-3 w-0.5 align-middle"
                    style={{ backgroundColor: t.color }}
                  />
                  {row.name}
                  <span className="num ml-2 text-[10px] text-muted-foreground">{row.code}</span>
                </td>
                <td className="num px-2 py-2 text-[11px] text-muted-foreground">{t.name}</td>
                <td className="num px-2 py-2 text-right text-[11px] text-muted-foreground">
                  {row.detail}
                  <span className="block">{row.secondary}</span>
                  {row.note ? <span className="block text-[10px]">{row.note}</span> : null}
                </td>
                <td className="num px-2 py-2 text-right text-xs font-bold">{row.metric}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
