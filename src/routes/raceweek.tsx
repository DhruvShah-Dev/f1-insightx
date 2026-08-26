import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  CloudRain,
  Flag,
  Gauge,
  MapPinned,
  Thermometer,
  Timer,
  Trophy,
  Wind,
} from "lucide-react";
import { Countdown } from "@/components/countdown";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { CircuitMap } from "@/components/circuit-map";
import { countryTheme } from "@/data/country-theme";
import { team } from "@/data/teams";
import {
  cornerProfileForCircuit,
  cornerSummaryForCircuit,
  cornersForCircuit,
} from "@/data/circuit-corners";
import { fmtDate, fmtDateTime, fmtDelta, fmtLapS, fmtNum, pct } from "@/lib/format";
import {
  getRaceWeek,
  type RaceWeekDriver,
  type RaceWeekQualifyingPrediction,
} from "@/lib/f1.functions";

const raceWeekQuery = queryOptions({
  queryKey: ["race-week"],
  queryFn: () => getRaceWeek(),
  // Weather is a daily stored snapshot; avoid re-querying it throughout the day.
  staleTime: 24 * 60 * 60_000,
  refetchOnWindowFocus: false,
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
  const [showQualiAll, setShowQualiAll] = useState(false);
  const [showRaceAll, setShowRaceAll] = useState(false);
  const [showCorners, setShowCorners] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);

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
      ? data.qualifyingPredictions.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      : heuristicQualifyingPredictions(data.drivers);
  const racePredictions: RacePrediction[] = data.projections
    .slice()
    .sort((a, b) => (a.projected ?? 99) - (b.projected ?? 99));
  const qualiRows = showQualiAll ? qualiPredictions : qualiPredictions.slice(0, 5);
  const raceRows = showRaceAll ? racePredictions : racePredictions.slice(0, 5);
  const weatherAvailable = Boolean(
    w && [w.rainProb, w.trackTempC, w.windMps, w.riskIndex].some((value) => value != null),
  );
  const visibleCorners = showCorners ? corners : corners.slice(0, 6);
  const sortedConstructors = data.constructors
    .slice()
    .sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0));
  const visibleConstructors = showTeams ? sortedConstructors : sortedConstructors.slice(0, 5);
  const leadQuali = qualiPredictions[0];
  const leadRace = racePredictions[0];

  const setRaceReminder = () => {
    if (!data.scheduledAt) return;
    window.localStorage.setItem(`f1-insightx-race-reminder-${data.raceId}`, data.scheduledAt);
    setReminderSet(true);
  };

  return (
    <SiteShell>
      <div className="raceweek-page" style={{ "--race-accent": theme.accent } as CSSProperties}>
      <section className="relative overflow-hidden border border-border bg-[#111111] shadow-[0_24px_56px_rgba(0,0,0,0.28)]" style={{ borderTopColor: theme.accent, borderTopWidth: 5 }}>
        <div className="flex h-3 w-full">
          {theme.flag.map((c, i) => (
            <span key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="relative grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="p-6 sm:p-8" style={{ backgroundColor: theme.flag[0] }}>
            <div className="inline-flex items-center gap-2 border border-white/30 bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
              <Flag className="size-3.5" /> Round {data.round} · {data.season}
            </div>
            <p className="mt-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
              <MapPinned className="size-3.5" /> {theme.label}
            </p>
            <h1 className="mt-2 text-4xl font-black uppercase italic leading-[0.9] tracking-tighter text-white sm:text-5xl">
              {data.raceName}
            </h1>
            <p className="num mt-4 text-xs text-white/75">
              {data.circuit.name}
              {data.circuit.location ? ` - ${data.circuit.location}` : ""}
              {data.circuit.country ? `, ${data.circuit.country}` : ""}
            </p>
            {data.officialName ? (
              <p className="mt-2 max-w-xl text-sm text-white/70">{data.officialName}</p>
            ) : null}

            {data.scheduledAt ? (
              <div className="mt-7 flex flex-wrap items-end gap-8 border-t border-white/25 pt-5">
                <Countdown targetISO={data.scheduledAt} label="Race start in" compact />
                <div>
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65"><Timer className="size-3" /> Lights out</p>
                  <p className="num mt-1 text-sm font-bold text-white">{fmtDateTime(data.scheduledAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={setRaceReminder}
                  className="inline-flex min-h-11 items-center gap-2 border border-white/45 bg-black/20 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-white transition-colors hover:bg-white hover:text-black"
                >
                  {reminderSet ? <Check className="size-4" /> : <Bell className="size-4" />}
                  {reminderSet ? "Race saved" : "Save race"}
                </button>
              </div>
            ) : null}

            <div className="mt-7 grid grid-cols-2 gap-px bg-white/20 sm:grid-cols-4">
              <Stat
                label="Corners"
                value={cornerSummaryForCircuit(data.circuit.id)}
                note={mediumCornerCount ? `${mediumCornerCount} medium complexes` : undefined}
                icon={<MapPinned className="size-3.5" />}
              />
              <Stat
                label="Rain risk"
                value={w?.rainProb == null ? "TBC" : `${Math.round(w.rainProb * 100)}`}
                unit={w?.rainProb == null ? undefined : "%"}
                icon={<CloudRain className="size-3.5" />}
              />
              <Stat
                label="Sessions"
                value="Standard"
                note="Practice + Q + race"
                icon={<Flag className="size-3.5" />}
              />
              {data.circuit.lengthKm != null ? (
                <Stat label="Lap" value={fmtNum(data.circuit.lengthKm, 3)} unit="km" icon={<Gauge className="size-3.5" />} />
              ) : null}
            </div>
          </div>

          <div className="bg-[#0b0b0b] p-3 sm:p-5">
            <CircuitMap
              path={data.trackPath}
              circuitId={data.circuit.id}
              circuitName={data.circuit.name}
              className="min-h-[420px] border-white/15"
            />
          </div>
        </div>
      </section>

      <section className="mt-16 border-y border-border py-8" style={{ borderTopColor: theme.accent }}>
        <SectionHeading kicker="Forecast" title="Weather snapshot" />
        {weatherAvailable ? (
          <>
            <p className="-mt-1 mb-5 text-sm text-muted-foreground">
              Stored race-week conditions. This snapshot refreshes once daily when source data is available.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ForecastTile label="Rain" value={w?.rainProb == null ? "—" : `${Math.round(w.rainProb * 100)}%`} note="Race window" icon={<CloudRain className="size-4" />} />
              <ForecastTile label="Track temp" value={w?.trackTempC == null ? "—" : `${fmtNum(w.trackTempC, 1)} C`} note={w?.trackTempVolatility == null ? "Mean estimate" : `+/-${fmtNum(w.trackTempVolatility, 1)} swing`} icon={<Thermometer className="size-4" />} />
              <ForecastTile label="Wind" value={w?.windMps == null ? "—" : `${fmtNum(w.windMps, 1)} m/s`} note="Average speed" icon={<Wind className="size-4" />} />
              <ForecastTile label="Weather risk" value={w?.riskIndex == null ? "—" : fmtNum(w.riskIndex, 2)} note="Model index" icon={<Trophy className="size-4" />} />
            </div>
          </>
        ) : (
          <div className="border border-dashed border-border bg-[#101010] p-6 sm:p-8">
            <p className="flex items-center gap-2 text-sm font-black uppercase italic"><CloudRain className="size-4 text-[var(--race-accent)]" /> Daily weather update pending</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">We do not yet have a verified weather snapshot for this race window. This section will populate after the next daily source update.</p>
          </div>
        )}
      </section>

      <section className="mt-16 grid gap-0 border border-border bg-[#0c0c0c] lg:grid-cols-[0.8fr_1.2fr]">
        <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
        <SectionHeading kicker="Circuit" title="Corner profile" />
          <div className="grid gap-px bg-border sm:grid-cols-3 lg:grid-cols-1">
            {cornerGroups.map((group) => (
              <div key={group.label} className="bg-[#141414] p-4" style={{ borderLeft: `3px solid ${theme.accent}` }}>
                <p className="label-xs">{group.label} corners</p>
                <p className="num mt-2 text-4xl font-black">{group.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{group.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="label-xs">Named turns</p>
            <p className="num text-[10px] text-[var(--race-accent)]">SECTOR INDEX</p>
          </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {corners.length ? (
                visibleCorners.map((corner) => (
                  <div
                    key={corner.number}
                    className="flex items-center gap-2 border-b border-border/60 py-2 text-xs transition-colors hover:bg-white/5"
                  >
                    <span className="num grid size-6 place-items-center bg-primary text-[10px] font-black text-primary-foreground">
                      {corner.number}
                    </span>
                    <span className="font-bold uppercase">{corner.name}</span>
                    <span className="label-xs ml-auto">S{corner.sector}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Corner labels are not available for this circuit yet.
                </p>
              )}
            </div>
            {corners.length > 6 ? (
              <button type="button" onClick={() => setShowCorners((value) => !value)} className="mt-4 inline-flex min-h-10 items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--race-accent)]">
                {showCorners ? "Show key turns" : `Show all ${corners.length} turns`} <ChevronDown className={showCorners ? "size-4 rotate-180" : "size-4"} />
              </button>
            ) : null}
          </div>
      </section>

      <section className="mt-16 border border-border bg-[#101010] p-5 sm:p-7" style={{ borderTopColor: theme.accent, borderTopWidth: 3 }}>
        <SectionHeading kicker="Predictions" title="Qualifying" />
        <div className="mb-5 grid gap-px border border-border bg-border sm:grid-cols-2">
          <PredictionLead label="Qualifying favourite" driver={leadQuali?.name ?? "Awaiting model"} detail={leadQuali?.timeS == null ? "Current model board" : `Projected pole: ${fmtLapS(leadQuali.timeS)}`} />
          <PredictionLead label="Race favourite" driver={leadRace?.name ?? "Awaiting model"} detail={leadRace?.winProb == null ? "Current model board" : `${pct(leadRace.winProb)} win probability`} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <QualiPredictionPanel
            title="Qualifying"
            rows={qualiRows}
            expanded={showQualiAll}
            onToggle={() => setShowQualiAll((value) => !value)}
            total={qualiPredictions.length}
            circuitCode={circuitCode}
          />
          <div className="flex flex-col justify-between border border-border bg-[#080808] p-5">
            <div>
              <p className="label-xs">Projection protocol</p>
              <p className="mt-3 text-2xl font-black uppercase italic leading-none">One lap first.</p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Grid order uses qualifying pace, recent form and circuit fit. The live source detail remains visible in each result row.</p>
            </div>
            <div className="mt-8 border-t border-border pt-4">
              <p className="label-xs">Race format</p>
              <p className="num mt-1 text-sm font-bold">STANDARD WEEKEND</p>
            </div>
          </div>
        </div>
      </section>

      {racePredictions.length ? (
        <section className="mt-0 border-x border-b border-border bg-[#0a0a0a] p-5 sm:p-7">
          <SectionHeading kicker="Race pred" title="Race prediction" />
          <RacePredictionPanel
            rows={raceRows}
            expanded={showRaceAll}
            onToggle={() => setShowRaceAll((value) => !value)}
            total={racePredictions.length}
          />
        </section>
      ) : null}

      <div className="mt-16 grid gap-0 border border-border bg-[#0e0e0e] lg:grid-cols-[1fr_1fr]">
        {data.constructors.length ? (
          <section className="border-b border-border p-6 lg:border-b-0 lg:border-r">
            <SectionHeading kicker="Constructors" title="Team readiness" />
            <div className="divide-y divide-border border border-border bg-[#080808]">
              {visibleConstructors.map((c) => {
                  const t = team(c.name);
                  return (
                    <div key={c.id} className="p-4 transition-colors hover:bg-white/[0.03]">
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
            {sortedConstructors.length > 5 ? (
              <button type="button" onClick={() => setShowTeams((value) => !value)} className="mt-4 inline-flex min-h-10 items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--race-accent)]">
                {showTeams ? "Show top five teams" : `Show all ${sortedConstructors.length} teams`} <ChevronDown className={showTeams ? "size-4 rotate-180" : "size-4"} />
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="p-6">
          <SectionHeading kicker="Context" title="Form and history" />
          <div className="overflow-hidden border border-border bg-card/50">
            <div className="relative h-40 overflow-hidden border-b border-border">
              <img src="/images/raceweek-pitlane-italy.png" alt="Race-week pit lane" className="h-full w-full object-cover object-center opacity-75" />
              <p className="absolute bottom-3 left-3 bg-black px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">Circuit archive</p>
            </div>
            <div className="p-4">
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
          </div>

          <div className="mt-4 border border-border bg-[#080808] p-4">
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

          <div className="mt-4 border border-border bg-[#151515] p-4" style={{ borderLeftColor: theme.accent, borderLeftWidth: 3 }}>
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
      </div>
    </SiteShell>
  );
}

function ForecastTile({ label, value, note, icon }: { label: string; value: string; note: string; icon: ReactNode }) {
  return (
    <div className="pw-ticker border border-border bg-[#121212] p-5 transition-transform hover:-translate-y-1" style={{ borderTopColor: "var(--race-accent)", borderTopWidth: 3 }}>
      <p className="flex items-center gap-2 label-xs"><span className="text-[var(--race-accent)]">{icon}</span>{label}</p>
      <p className="num mt-2 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function PredictionLead({ label, driver, detail }: { label: string; driver: string; detail: string }) {
  return (
    <div className="bg-[#0a0a0a] px-5 py-4 sm:px-6">
      <p className="label-xs">{label}</p>
      <p className="mt-1 text-xl font-black uppercase italic tracking-tight sm:text-2xl">{driver}</p>
      <p className="num mt-1 text-xs text-muted-foreground">{detail}</p>
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
    <div className="border border-border bg-[#080808] p-5 sm:p-6" style={{ borderTopColor: "var(--race-accent)", borderTopWidth: 3 }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-xs">{title}</p>
          <h3 className="text-lg font-black uppercase italic">Top order</h3>
        </div>
        {disabled ? <span className="label-xs">Not scheduled</span> : null}
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
          metric: row.modeLabel ?? row.sourceLabel ?? "Composite model",
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
          className="mt-4 border border-[var(--race-accent)] bg-transparent px-3 py-2 text-[11px] font-black uppercase italic text-foreground transition-colors hover:bg-[var(--race-accent)] hover:text-black"
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
    <div className="border border-border bg-[#080808] p-5 sm:p-6" style={{ borderTopColor: "var(--race-accent)", borderTopWidth: 3 }}>
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
          className="mt-4 border border-[var(--race-accent)] bg-transparent px-3 py-2 text-[11px] font-black uppercase italic text-foreground transition-colors hover:bg-[var(--race-accent)] hover:text-black"
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
    <div className="mt-4">
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => {
          const t = team(row.teamName);
          return (
            <article key={row.key} className="border-l-2 border-border bg-[#101010] p-4" style={{ borderLeftColor: t.color }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="num text-xs font-black text-[var(--race-accent)]">P{row.position ?? index + 1}</p>
                  <p className="mt-1 text-base font-black uppercase">{row.name} <span className="num text-[10px] text-muted-foreground">{row.code}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.name}</p>
                </div>
                <p className="max-w-28 text-right text-xs font-bold leading-snug">{row.metric}</p>
              </div>
              <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="num text-foreground">{row.detail}</span> · {row.secondary}
                {row.note ? <span className="mt-1 block text-[11px] leading-relaxed">{row.note}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[620px] text-left">
        <thead>
          <tr className="border-b-2 border-[var(--race-accent)]">
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
              <tr key={row.key} className="pw-ticker border-b border-border/60 transition-colors hover:bg-white/[0.04]">
                <td className="num px-2 py-3 text-xs font-black text-[var(--race-accent)]">P{row.position ?? index + 1}</td>
                <td className="px-2 py-3 text-sm font-bold uppercase">
                  <span
                    className="mr-2 inline-block h-3 w-0.5 align-middle"
                    style={{ backgroundColor: t.color }}
                  />
                  {row.name}
                  <span className="num ml-2 text-[10px] text-muted-foreground">{row.code}</span>
                </td>
                <td className="num px-2 py-3 text-xs text-muted-foreground">{t.name}</td>
                <td className="num px-2 py-3 text-right text-xs leading-relaxed text-muted-foreground">
                  {row.detail}
                  <span className="block">{row.secondary}</span>
                  {row.note ? <span className="block text-[10px]">{row.note}</span> : null}
                </td>
                <td className="num px-2 py-3 text-right text-xs font-bold">{row.metric}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
