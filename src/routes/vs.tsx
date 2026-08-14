import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { SiteShell } from "@/components/site-shell";
import { CompoundLegend, DeltaChart, LapTraceChart, StintStrip } from "@/components/telemetry";
import { buildCornerModel, CornerMap, CornerMapLegend } from "@/components/corner-profile";
import { CornerProfileChart, DirtyAirChart, PositionBattleChart } from "@/components/duel-charts";
import {
  buildDominance,
  DominanceStrip,
  DominanceSummary,
  PaceDropTable,
  TrackDominanceRing,
} from "@/components/dominance";
import { SkeletonPanel } from "@/components/skeleton-block";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { duelColors, team } from "@/data/teams";
import { fmtDelta, fmtLapMs, fmtLapS, fmtNum, titleCase } from "@/lib/format";
import { getHeadToHead, getWeekendIndex } from "@/lib/f1.functions";

const searchSchema = z.object({
  slug: z.string().optional(),
  a: z.string().optional(),
  b: z.string().optional(),
});

const indexQuery = queryOptions({
  queryKey: ["weekend-index"],
  queryFn: () => getWeekendIndex({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/vs")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(indexQuery),
  head: () => ({
    meta: [
      { title: "Driver vs driver — session-by-session F1 head to head" },
      {
        name: "description",
        content:
          "Pick a 2026 F1 weekend and two drivers to compare qualifying segments, sprint results, race classification, tyre strategy, pit cycles and lap-by-lap pace side by side.",
      },
      { property: "og:title", content: "F1 driver vs driver, session by session" },
      {
        property: "og:description",
        content: "Qualifying, sprint and race head-to-head with lap traces and cumulative gap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell>
      <p role="alert" className="text-sm text-destructive">
        Head to head unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  component: Vs,
});

type Session = "quali" | "sprint" | "race";
type RaceView =
  | "duel"
  | "dominance"
  | "trace"
  | "battle"
  | "tyres"
  | "pits"
  | "traffic"
  | "circuit";
type H2H = NonNullable<Awaited<ReturnType<typeof getHeadToHead>>>;

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`pw-flip-in rounded-xl border border-border bg-card/40 p-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { k: T; l: string }[];
  value: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          aria-pressed={value === o.k}
          className={`num rounded-sm border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
            value === o.k
              ? "border-primary bg-primary/15 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

type Metric = {
  k: string;
  hint?: string;
  a: number | null;
  b: number | null;
  fmt: (v: number | null) => string;
  lowerIsBetter?: boolean;
  /** metric is descriptive only, no winner */
  neutral?: boolean;
};

function winnerOf(m: Metric): "a" | "b" | null {
  if (m.neutral || m.a == null || m.b == null || m.a === m.b) return null;
  const aBetter = m.lowerIsBetter ? m.a < m.b : m.a > m.b;
  return aBetter ? "a" : "b";
}

/** Diverging duel bar: each side's share of the pair total, winner highlighted. */
function DuelRow({
  m,
  colorA,
  colorB,
  index,
}: {
  m: Metric;
  colorA: string;
  colorB: string;
  index: number;
}) {
  const w = winnerOf(m);
  const av = m.a;
  const bv = m.b;
  const mag = Math.max(Math.abs(av ?? 0), Math.abs(bv ?? 0)) || 1;
  const pctA = av == null ? 0 : Math.max(3, (Math.abs(av) / mag) * 100);
  const pctB = bv == null ? 0 : Math.max(3, (Math.abs(bv) / mag) * 100);

  return (
    <div
      className="pw-ticker grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded px-1 py-1.5 transition-colors hover:bg-accent/30 sm:gap-3"
      style={{ animationDelay: `${Math.min(index, 14) * 26}ms` }}
    >
      {/* A side */}
      <div className="flex items-center justify-end gap-2">
        <span
          className={`num shrink-0 text-[11px] font-black tabular-nums sm:text-xs ${
            w === "a" ? "" : "text-muted-foreground"
          }`}
          style={w === "a" ? { color: colorA } : undefined}
        >
          {m.fmt(av)}
        </span>
        <span className="relative hidden h-2.5 w-full max-w-[160px] overflow-hidden rounded-sm bg-secondary/50 sm:block">
          <span
            className="absolute inset-y-0 right-0 rounded-sm transition-[width] duration-500"
            style={{ width: `${pctA}%`, backgroundColor: colorA, opacity: w === "a" ? 1 : 0.4 }}
          />
        </span>
      </div>

      {/* label */}
      <div className="w-28 shrink-0 text-center sm:w-44">
        <p className="text-[10px] font-black uppercase leading-tight tracking-wide">{m.k}</p>
        {m.hint ? (
          <p className="num text-[9px] leading-tight text-muted-foreground">{m.hint}</p>
        ) : null}
      </div>

      {/* B side */}
      <div className="flex items-center gap-2">
        <span className="relative hidden h-2.5 w-full max-w-[160px] overflow-hidden rounded-sm bg-secondary/50 sm:block">
          <span
            className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500"
            style={{ width: `${pctB}%`, backgroundColor: colorB, opacity: w === "b" ? 1 : 0.4 }}
          />
        </span>
        <span
          className={`num shrink-0 text-[11px] font-black tabular-nums sm:text-xs ${
            w === "b" ? "" : "text-muted-foreground"
          }`}
          style={w === "b" ? { color: colorB } : undefined}
        >
          {m.fmt(bv)}
        </span>
      </div>
    </div>
  );
}

function DuelBoard({
  metrics,
  colorA,
  colorB,
}: {
  metrics: Metric[];
  colorA: string;
  colorB: string;
}) {
  return (
    <div className="space-y-0.5">
      {metrics.map((m, i) => (
        <DuelRow key={m.k} m={m} colorA={colorA} colorB={colorB} index={i} />
      ))}
    </div>
  );
}

/** Text-only comparison row for non-numeric values (segments, statuses). */
function TextRow({ k, a, b }: { k: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded px-1 py-1.5 sm:gap-3">
      <span className="num text-right text-[11px] font-bold uppercase">{a}</span>
      <span className="w-28 shrink-0 text-center text-[10px] font-black uppercase tracking-wide sm:w-44">
        {k}
      </span>
      <span className="num text-[11px] font-bold uppercase">{b}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Vs() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/vs" });
  const { data: index } = useSuspenseQuery(indexQuery);

  // Rounds without stored lap telemetry still carry full classifications, so keep
  // them selectable — the deep race views simply hide themselves.
  const weekends = index.weekends
    .filter((w) => w.hasRace)
    .sort((a, b) => b.round - a.round);

  const slug = search.slug ?? weekends[0]?.slug ?? "";
  const [session, setSession] = useState<Session>("race");
  const [view, setView] = useState<RaceView>("duel");

  const h2h = useQuery({
    queryKey: ["h2h", slug, search.a ?? "", search.b ?? ""],
    queryFn: () =>
      getHeadToHead({ data: { slug, a: search.a ?? "AUTO", b: search.b ?? "AUTO" } }),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });

  const entrants = h2h.data?.entrants ?? [];
  const codeA = search.a ?? entrants[0]?.code ?? "";
  const codeB = search.b ?? entrants[1]?.code ?? "";

  const resolved = useQuery({
    queryKey: ["h2h-pair", slug, codeA, codeB],
    queryFn: () => getHeadToHead({ data: { slug, a: codeA, b: codeB } }),
    enabled: Boolean(slug && codeA && codeB),
    staleTime: 5 * 60_000,
  });

  const d = resolved.data;
  const entrantA = entrants.find((e) => e.code === codeA);
  const entrantB = entrants.find((e) => e.code === codeB);
  const teamA = team(d?.race[0]?.team ?? entrantA?.team);
  const teamB = team(d?.race[1]?.team ?? entrantB?.team);
  // Teammates share one livery colour, so split it into two readable variants.
  const duel = duelColors(
    d?.race[0]?.team ?? entrantA?.team,
    d?.race[1]?.team ?? entrantB?.team,
  );
  const colorA = duel.colorA;
  const colorB = duel.colorB;

  const setSearch = (patch: {
    slug?: string | undefined;
    a?: string | undefined;
    b?: string | undefined;
  }) => navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const swap = () => setSearch({ a: codeB, b: codeA });

  const mapLaps = (rows: H2H["laps"][number] | undefined) =>
    (rows ?? []).map((l) => ({
      driverCode: l.code,
      lap: l.lap,
      lapTimeS: l.lapTimeS,
      paceDeltaS: l.paceDeltaS,
      fuelCorrectedDeltaS: l.fuelCorrectedDeltaS,
      compound: l.compound,
      stint: l.stint,
      tyreAge: l.tyreAge,
    }));

  const seriesA = { code: codeA, color: colorA, laps: mapLaps(d?.laps[0]) };
  const seriesB = { code: codeB, color: colorB, laps: mapLaps(d?.laps[1]) };

  const available: Session[] = [];
  if (d?.quali.some(Boolean)) available.push("quali");
  if (d?.sprint.some(Boolean)) available.push("sprint");
  if (d?.race.some(Boolean)) available.push("race");
  const active = available.includes(session) ? session : (available[0] ?? "race");
  const label: Record<Session, string> = { quali: "Qualifying", sprint: "Sprint", race: "Race" };

  /* ---- metrics per session ---- */
  const { metrics, extras } = useMemo(() => {
    const asNum = (v: number | null | undefined) => (v == null ? null : v);
    if (active === "quali") {
      const [qa, qb] = d?.quali ?? [];
      return {
        metrics: [
          {
            k: "Position",
            a: asNum(qa?.position),
            b: asNum(qb?.position),
            fmt: (v: number | null) => (v == null ? "—" : `P${v}`),
            lowerIsBetter: true,
          },
          {
            k: "Best lap",
            a: asNum(qa?.bestMs),
            b: asNum(qb?.bestMs),
            fmt: (v: number | null) => fmtLapMs(v),
            lowerIsBetter: true,
          },
          {
            k: "Q1",
            a: asNum(qa?.q1Ms),
            b: asNum(qb?.q1Ms),
            fmt: (v: number | null) => fmtLapMs(v),
            lowerIsBetter: true,
          },
          {
            k: "Q2",
            a: asNum(qa?.q2Ms),
            b: asNum(qb?.q2Ms),
            fmt: (v: number | null) => fmtLapMs(v),
            lowerIsBetter: true,
          },
          {
            k: "Q3",
            a: asNum(qa?.q3Ms),
            b: asNum(qb?.q3Ms),
            fmt: (v: number | null) => fmtLapMs(v),
            lowerIsBetter: true,
          },
          {
            k: "Gap to pole",
            hint: "seconds",
            a: qa?.gapMs == null ? null : qa.gapMs / 1000,
            b: qb?.gapMs == null ? null : qb.gapMs / 1000,
            fmt: (v: number | null) => (v == null ? "—" : v === 0 ? "pole" : fmtDelta(v)),
            lowerIsBetter: true,
          },
        ] as Metric[],
        extras: [{ k: "Segment reached", a: qa?.segment ?? "—", b: qb?.segment ?? "—" }],
      };
    }
    if (active === "sprint") {
      const [sa, sb] = d?.sprint ?? [];
      return {
        metrics: [
          {
            k: "Grid",
            a: asNum(sa?.grid),
            b: asNum(sb?.grid),
            fmt: (v: number | null) => (v == null ? "—" : `P${v}`),
            lowerIsBetter: true,
          },
          {
            k: "Finish",
            a: asNum(sa?.finish),
            b: asNum(sb?.finish),
            fmt: (v: number | null) => (v == null ? "—" : `P${v}`),
            lowerIsBetter: true,
          },
          {
            k: "Places gained",
            a: sa?.grid != null && sa?.finish != null ? sa.grid - sa.finish : null,
            b: sb?.grid != null && sb?.finish != null ? sb.grid - sb.finish : null,
            fmt: (v: number | null) => (v == null ? "—" : fmtDelta(v, 0)),
          },
          {
            k: "Points",
            a: asNum(sa?.points) ?? 0,
            b: asNum(sb?.points) ?? 0,
            fmt: (v: number | null) => String(v ?? 0),
          },
          {
            k: "Laps",
            a: asNum(sa?.laps),
            b: asNum(sb?.laps),
            fmt: (v: number | null) => (v == null ? "—" : String(v)),
            neutral: true,
          },
        ] as Metric[],
        extras: [
          { k: "Status", a: titleCase(sa?.status) || "—", b: titleCase(sb?.status) || "—" },
        ],
      };
    }
    const [ra, rb] = d?.race ?? [];
    const [pa, pb] = d?.pace ?? [];
    const [xa, xb] = d?.positions ?? [];
    return {
      metrics: [
        {
          k: "Grid",
          a: asNum(ra?.grid),
          b: asNum(rb?.grid),
          fmt: (v: number | null) => (v == null ? "—" : `P${v}`),
          lowerIsBetter: true,
        },
        {
          k: "Finish",
          a: asNum(ra?.finish),
          b: asNum(rb?.finish),
          fmt: (v: number | null) => (v == null ? "—" : `P${v}`),
          lowerIsBetter: true,
        },
        {
          k: "Points",
          a: asNum(ra?.points) ?? 0,
          b: asNum(rb?.points) ?? 0,
          fmt: (v: number | null) => String(v ?? 0),
        },
        {
          k: "Race pace",
          hint: "median fuel-corrected Δ",
          a: asNum(pa?.medianFuelDeltaS),
          b: asNum(pb?.medianFuelDeltaS),
          fmt: (v: number | null) => fmtDelta(v),
          lowerIsBetter: true,
        },
        {
          k: "Best lap",
          a: asNum(pa?.bestLapS),
          b: asNum(pb?.bestLapS),
          fmt: (v: number | null) => fmtLapS(v),
          lowerIsBetter: true,
        },
        {
          k: "Net positions",
          a: asNum(xa?.net),
          b: asNum(xb?.net),
          fmt: (v: number | null) => (v == null ? "—" : fmtDelta(v, 0)),
        },
        {
          k: "Gained on track",
          a: asNum(xa?.onTrack),
          b: asNum(xb?.onTrack),
          fmt: (v: number | null) => (v == null ? "—" : fmtDelta(v, 0)),
        },
        {
          k: "Pit stops",
          a: d?.pits[0]?.length ?? 0,
          b: d?.pits[1]?.length ?? 0,
          fmt: (v: number | null) => String(v ?? 0),
          neutral: true,
        },
        {
          k: "Tyre deg",
          hint: "avg s/lap",
          a: avg((d?.stints[0] ?? []).map((s) => s.degS)),
          b: avg((d?.stints[1] ?? []).map((s) => s.degS)),
          fmt: (v: number | null) => fmtNum(v, 3),
          lowerIsBetter: true,
        },
      ] as Metric[],
      extras: [{ k: "Status", a: titleCase(ra?.status) || "—", b: titleCase(rb?.status) || "—" }],
    };
  }, [active, d]);

  const score = metrics.reduce(
    (acc, m) => {
      const w = winnerOf(m);
      if (w === "a") acc.a += 1;
      else if (w === "b") acc.b += 1;
      return acc;
    },
    { a: 0, b: 0 },
  );

  const raceViews: { k: RaceView; l: string }[] = [
    { k: "duel", l: "Duel" },
    ...(seriesA.laps.length && seriesB.laps.length ? [{ k: "dominance" as const, l: "Dominance" }] : []),
    ...(seriesA.laps.length || seriesB.laps.length
      ? [
          { k: "trace" as const, l: "Lap trace" },
          { k: "tyres" as const, l: "Tyres" },
        ]
      : []),
    ...(d?.positionLaps?.[0]?.length || d?.positionLaps?.[1]?.length
      ? [{ k: "battle" as const, l: "Battle" }]
      : []),
    ...(d?.pits[0]?.length || d?.pits[1]?.length ? [{ k: "pits" as const, l: "Pit stops" }] : []),
    ...(d?.traffic?.[0] ? [{ k: "traffic" as const, l: "Traffic" }] : []),
    ...(d?.trackPath ? [{ k: "circuit" as const, l: "Corners" }] : []),
  ];
  const activeView = raceViews.some((v) => v.k === view) ? view : "duel";

  const pending = h2h.isPending || resolved.isPending;

  return (
    <SiteShell>
      {/* ---------------- hero ---------------- */}
      <section
        className="relative overflow-hidden rounded-xl border border-border bg-card/50"
        style={{ borderTop: `3px solid ${colorA}`, borderBottom: `3px solid ${colorB}` }}
      >
        <span className="pw-drift pointer-events-none absolute inset-0 opacity-30" aria-hidden />
        <span className="pw-sweep pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative p-5">
          <p className="label-xs">Head to head</p>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
            Driver vs driver
          </h1>
          <p className="num mt-1 text-[11px] text-muted-foreground">
            {d ? `R${d.round} ${d.name} · ${d.circuit}` : "Pick a weekend below"}
          </p>

          <div className="mt-5 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <DriverCard
              code={codeA}
              name={entrantA?.name ?? codeA}
              teamName={entrantA?.team ?? d?.race[0]?.team ?? null}
              color={colorA}
              score={score.a}
              align="left"
            />
            <div className="flex flex-col items-center gap-2">
              <span className="pw-glow num rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                vs
              </span>
              <button
                type="button"
                onClick={swap}
                className="num rounded-sm border border-border px-2 py-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                swap
              </button>
              <span className="num text-[10px] text-muted-foreground">
                {label[active]} · {score.a}–{score.b}
              </span>
              {duel.sameTeam ? (
                <span className="num rounded-sm border border-border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                  teammates · shaded
                </span>
              ) : null}
            </div>
            <DriverCard
              code={codeB}
              name={entrantB?.name ?? codeB}
              teamName={entrantB?.team ?? d?.race[1]?.team ?? null}
              color={colorB}
              score={score.b}
              align="right"
            />
          </div>
        </div>
      </section>

      {/* ---------------- weekend rail ---------------- */}
      <div className="mt-5">
        <p className="label-xs">Weekend</p>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {weekends.map((w) => {
            const on = w.slug === slug;
            return (
              <button
                key={w.slug!}
                type="button"
                onClick={() => setSearch({ slug: w.slug!, a: undefined, b: undefined })}
                aria-pressed={on}
                className={`num shrink-0 rounded-sm border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  on
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                R{w.round} · {w.name}
                {w.resultsOnly ? (
                  <span className="ml-1.5 text-[9px] font-bold text-primary/80">results</span>
                ) : null}
              </button>

            );
          })}
        </div>
      </div>

      {/* ---------------- driver pickers ---------------- */}
      {entrants.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { side: "Driver A", value: codeA, other: codeB, key: "a" as const, color: colorA },
            { side: "Driver B", value: codeB, other: codeA, key: "b" as const, color: colorB },
          ].map((sel) => (
            <div
              key={sel.key}
              className="rounded-xl border border-border bg-card/40 p-3"
              style={{ borderLeft: `4px solid ${sel.color}` }}
            >
              <p className="label-xs">{sel.side}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entrants.map((e) => {
                  const t = team(e.team);
                  const on = e.code === sel.value;
                  const disabled = e.code === sel.other;
                  return (
                    <button
                      key={e.code}
                      type="button"
                      disabled={disabled}
                      onClick={() => setSearch({ [sel.key]: e.code })}
                      aria-pressed={on}
                      title={`${e.name} · ${t.name}`}
                      className={`num rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-25 ${
                        on
                          ? "border-transparent text-background"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                      style={on ? { backgroundColor: sel.color } : undefined}
                    >
                      {e.code}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {pending ? (
        <SkeletonPanel rows={7} label="Loading session data" />
      ) : !d ? (
        <p className="mt-10 text-sm text-muted-foreground">No stored data for this weekend.</p>
      ) : (
        <>
          {/* ---------------- sticky switcher ---------------- */}
          <div className="sticky top-0 z-20 mt-6 -mx-4 border-y border-border bg-background/90 px-4 py-2 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                options={available.map((s) => ({ k: s, l: label[s] }))}
                value={active}
                onChange={setSession}
              />
              {active === "race" && raceViews.length > 1 ? (
                <>
                  <span className="hidden h-4 w-px bg-border sm:block" />
                  <Segmented options={raceViews} value={activeView} onChange={setView} />
                </>
              ) : null}
            </div>
          </div>

          {d.resultsOnly ? (
            <p className="num mt-4 rounded-sm border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] text-muted-foreground">
              Classification only for this round — qualifying and race results are stored, lap
              telemetry has not been ingested yet, so trace, tyre and dominance views are hidden.
            </p>
          ) : null}



          {/* ---------------- duel board ---------------- */}
          {active !== "race" || activeView === "duel" ? (
            <Panel className="mt-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="label-xs">{label[active]}</p>
                  <h2 className="text-lg font-black uppercase italic">Metric duel</h2>
                </div>
                <span className="num text-[10px] text-muted-foreground">
                  bars scale to the larger value · winner highlighted
                </span>
              </div>
              <DuelBoard metrics={metrics} colorA={colorA} colorB={colorB} />
              {extras.length ? (
                <div className="mt-3 border-t border-border/60 pt-2">
                  {extras.map((e) => (
                    <TextRow key={e.k} k={e.k} a={e.a} b={e.b} />
                  ))}
                </div>
              ) : null}
            </Panel>
          ) : null}

          {/* ---------------- race views ---------------- */}
          {active === "race" && activeView === "dominance" ? (
            <DominanceBlock
              codeA={codeA}
              codeB={codeB}
              colorA={colorA}
              colorB={colorB}
              lapsA={d.laps[0] ?? []}
              lapsB={d.laps[1] ?? []}
              pitsA={d.pits[0] ?? []}
              pitsB={d.pits[1] ?? []}
              trafficLapsA={d.trafficLaps?.[0] ?? []}
              trafficLapsB={d.trafficLaps?.[1] ?? []}
              statusPhases={d.statusPhases ?? []}
              trackPath={d.trackPath}
              circuit={d.circuit}
            />
          ) : null}

          {active === "race" && activeView === "trace" ? (
            <Panel className="mt-5">
              <div className="mb-3">
                <p className="label-xs">Race trace</p>
                <h2 className="text-lg font-black uppercase italic">Lap by lap</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <p className="label-xs">Lap time (s, slow laps clipped)</p>
                  <LapTraceChart series={[seriesA, seriesB]} />
                </div>
                <div>
                  <p className="label-xs">Cumulative gap</p>
                  <DeltaChart series={[seriesA, seriesB]} />
                </div>
              </div>
            </Panel>
          ) : null}

          {active === "race" && activeView === "tyres" ? (
            <Panel className="mt-5">
              <div className="mb-3">
                <p className="label-xs">Tyres</p>
                <h2 className="text-lg font-black uppercase italic">Stints & degradation</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <StintStrip {...seriesA} />
                <StintStrip {...seriesB} />
              </div>
              <div className="mt-3">
                <CompoundLegend />
              </div>
              <StintTable
                sides={[
                  { code: codeA, color: colorA, stints: d.stints[0] ?? [] },
                  { code: codeB, color: colorB, stints: d.stints[1] ?? [] },
                ]}
              />
            </Panel>
          ) : null}

          {active === "race" && activeView === "pits" ? (
            <PitLossBlock
              codeA={codeA}
              codeB={codeB}
              colorA={colorA}
              colorB={colorB}
              pitsA={d.pits[0] ?? []}
              pitsB={d.pits[1] ?? []}
            />
          ) : null}

          {active === "race" && activeView === "traffic" ? (
            <TrafficBlock
              codeA={codeA}
              codeB={codeB}
              colorA={colorA}
              colorB={colorB}
              traffic={d.traffic}
              trafficLapsA={d.trafficLaps?.[0] ?? []}
              trafficLapsB={d.trafficLaps?.[1] ?? []}
            />

          ) : null}

          {active === "race" && activeView === "battle" ? (
            <BattleBlock
              codeA={codeA}
              codeB={codeB}
              colorA={colorA}
              colorB={colorB}
              lapsA={d.positionLaps?.[0] ?? []}
              lapsB={d.positionLaps?.[1] ?? []}
              statusPhases={d.statusPhases ?? []}
              swings={d.swings ?? []}
            />
          ) : null}


          {active === "race" && activeView === "circuit" ? (
            <CornerBlock path={d.trackPath} circuit={d.circuit} />
          ) : null}
        </>
      )}
    </SiteShell>
  );
}

function DriverCard({
  code,
  name,
  teamName,
  color,
  score,
  align,
}: {
  code: string;
  name: string;
  teamName: string | null;
  color: string;
  score: number;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
      style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 35%, transparent)` }}
    >
      <DriverAvatar code={code} teamName={teamName} name={name} size="lg" />
      <div className={align === "right" ? "items-end" : ""}>
        <p className="truncate text-sm font-black uppercase italic leading-tight">{name}</p>
        <div className={`mt-1 flex ${align === "right" ? "justify-end" : ""}`}>
          <TeamBadge teamName={teamName} />
        </div>
      </div>
      <span
        className="num pw-chip-pop ml-auto text-2xl font-black tabular-nums"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

function StintTable({
  sides,
}: {
  sides: { code: string; color: string; stints: H2H["stints"][number] }[];
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {sides.map((s) => (
        <div key={s.code} className="rounded-lg border border-border bg-background/40 p-3">
          <p className="num text-[11px] font-black uppercase" style={{ color: s.color }}>
            {s.code}
          </p>
          <ul className="mt-2 space-y-1">
            {s.stints.length ? (
              s.stints.map((st) => (
                <li key={st.stint} className="num flex justify-between text-[11px]">
                  <span>
                    S{st.stint} · {titleCase(st.compound) || "—"} · L{st.startLap}–L{st.endLap}
                  </span>
                  <span className="text-muted-foreground">
                    {fmtNum(st.degS, 3)} s/lap · med {fmtLapS(st.medianS)}
                  </span>
                </li>
              ))
            ) : (
              <li className="num text-[11px] text-muted-foreground">No stored stints</li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function avg(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/* ------------------------------------------------------------------ */
/* Battle: running order + position swings                             */
/* ------------------------------------------------------------------ */

function BattleBlock({
  codeA,
  codeB,
  colorA,
  colorB,
  lapsA,
  lapsB,
  statusPhases,
  swings,
}: {
  codeA: string;
  codeB: string;
  colorA: string;
  colorB: string;
  lapsA: H2H["positionLaps"][number];
  lapsB: H2H["positionLaps"][number];
  statusPhases: H2H["statusPhases"];
  swings: H2H["swings"];
}) {
  const net = (rows: typeof lapsA) => {
    const first = rows.find((r) => r.position != null)?.position ?? null;
    const last = [...rows].reverse().find((r) => r.position != null)?.position ?? null;
    return first != null && last != null ? first - last : null;
  };
  const best = (rows: typeof lapsA) => {
    const ps = rows.map((r) => r.position).filter((p): p is number => p != null);
    return ps.length ? Math.min(...ps) : null;
  };
  const lapsAhead = lapsA.filter((r) => {
    const other = lapsB.find((x) => x.lap === r.lap);
    return r.position != null && other?.position != null && r.position < other.position;
  }).length;
  const shared = lapsA.filter((r) =>
    lapsB.some((x) => x.lap === r.lap && x.position != null && r.position != null),
  ).length;

  const metrics: Metric[] = [
    {
      k: "Net positions",
      hint: "first classified lap vs last",
      a: net(lapsA),
      b: net(lapsB),
      fmt: (v) => (v == null ? "—" : v > 0 ? `+${v}` : String(v)),
    },
    {
      k: "Best position",
      a: best(lapsA),
      b: best(lapsB),
      fmt: (v) => (v == null ? "—" : `P${v}`),
      lowerIsBetter: true,
    },
    {
      k: "Laps ahead",
      hint: `${shared} laps compared`,
      a: lapsAhead,
      b: shared - lapsAhead,
      fmt: (v) => (v == null ? "—" : String(v)),
    },
  ];

  return (
    <Panel className="mt-5">
      <div className="mb-3">
        <p className="label-xs">Battle</p>
        <h2 className="text-lg font-black uppercase italic">Lap-by-lap running order</h2>
      </div>

      {lapsA.length || lapsB.length ? (
        <>
          <PositionBattleChart
            a={{ code: codeA, color: colorA }}
            b={{ code: codeB, color: colorB }}
            lapsA={lapsA}
            lapsB={lapsB}
            statusPhases={statusPhases}
          />
          <div className="mt-4">
            <DuelBoard metrics={metrics} colorA={colorA} colorB={colorB} />
          </div>
        </>
      ) : (
        <p className="num py-6 text-center text-xs text-muted-foreground">
          No position timeline stored for this weekend.
        </p>
      )}

      {swings.length ? (
        <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-card">
              <tr className="label-xs">
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Laps</th>
                <th className="px-3 py-2">Swing</th>
                <th className="px-3 py-2">Event</th>
              </tr>
            </thead>
            <tbody>
              {swings.map((s, i) => (
                <tr key={`${s.code}-${s.startLap}-${i}`} className="border-t border-border/60">
                  <td
                    className="num px-3 py-2 text-[11px] font-bold"
                    style={{ color: s.code === codeA ? colorA : colorB }}
                  >
                    {s.code}
                  </td>
                  <td className="num px-3 py-2 text-[11px]">
                    L{s.startLap ?? "—"}–L{s.endLap ?? "—"}
                  </td>
                  <td className="num px-3 py-2 text-[11px]">
                    {s.delta == null ? "—" : s.delta > 0 ? `+${s.delta}` : s.delta}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {titleCase(s.type) || "—"}
                    {s.phase ? ` · ${titleCase(s.phase)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Panel>
  );
}


/* ------------------------------------------------------------------ */
/* Circuit                                                             */
/* ------------------------------------------------------------------ */

function DominanceBlock({
  codeA,
  codeB,
  colorA,
  colorB,
  lapsA,
  lapsB,
  pitsA,
  pitsB,
  trafficLapsA,
  trafficLapsB,
  statusPhases,
  trackPath,
  circuit,
}: {
  codeA: string;
  codeB: string;
  colorA: string;
  colorB: string;
  lapsA: H2H["laps"][number];
  lapsB: H2H["laps"][number];
  pitsA: H2H["pits"][number];
  pitsB: H2H["pits"][number];
  trafficLapsA: H2H["trafficLaps"][number];
  trafficLapsB: H2H["trafficLaps"][number];
  statusPhases: H2H["statusPhases"];
  trackPath: H2H["trackPath"];
  circuit: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const laps = useMemo(
    () =>
      buildDominance({
        lapsA,
        lapsB,
        pitsA,
        pitsB,
        trafficA: trafficLapsA,
        trafficB: trafficLapsB,
        statusPhases,
      }),
    [lapsA, lapsB, pitsA, pitsB, trafficLapsA, trafficLapsB, statusPhases],
  );

  if (!laps.length) {
    return (
      <Panel className="mt-5">
        <p className="num text-xs text-muted-foreground">
          No lap-time rows stored for this pairing, so dominance cannot be built.
        </p>
      </Panel>
    );
  }

  return (
    <>
      <Panel className="mt-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="label-xs">Race dominance</p>
            <h2 className="text-lg font-black uppercase italic">Who owned the lap</h2>
          </div>
          <span className="num text-[10px] text-muted-foreground">
            faster lap time wins the lap
          </span>
        </div>
        <DominanceSummary
          laps={laps}
          codeA={codeA}
          codeB={codeB}
          colorA={colorA}
          colorB={colorB}
        />
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="label-xs">Lap delta strip</p>
            <div className="mt-2">
              <DominanceStrip
                laps={laps}
                codeA={codeA}
                codeB={codeB}
                colorA={colorA}
                colorB={colorB}
                selected={selected}
                onSelect={setSelected}
              />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/40 p-3">
            <p className="label-xs">{circuit} · dominance ring</p>
            <TrackDominanceRing
              path={trackPath}
              laps={laps}
              codeA={codeA}
              codeB={codeB}
              colorA={colorA}
              colorB={colorB}
              selected={selected}
              onSelect={setSelected}
            />
            <p className="num mt-1 text-[10px] leading-relaxed text-muted-foreground">
              Each arc around the circuit is one race lap in order. Thicker, brighter arcs are
              bigger lap-time advantages. Dots mark pit laps, yellow wash marks neutralised laps.
            </p>
          </div>
        </div>
      </Panel>

      <Panel className="mt-5">
        <div className="mb-3">
          <p className="label-xs">Pace drops explained</p>
          <h2 className="text-lg font-black uppercase italic">Why the lap went slow</h2>
        </div>
        <PaceDropTable
          laps={laps}
          codeA={codeA}
          codeB={codeB}
          colorA={colorA}
          colorB={colorB}
          onSelect={setSelected}
        />
        <p className="num mt-2 text-[10px] text-muted-foreground">
          Each row is a lap more than 1.2s off that driver&apos;s own reference pace, matched
          against stored pit laps, track-status phases, traffic labels and tyre age.
        </p>
      </Panel>
    </>
  );
}

function CornerBlock({ path, circuit }: { path: H2H["trackPath"]; circuit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const model = buildCornerModel(path);
  if (!model) return null;

  const byType = (t: "Slow" | "Medium" | "Fast") =>
    model.corners.filter((c) => c.type === t).length;
  const longest = model.straights.find((s) => s.isLongest) ?? null;

  return (
    <Panel className="mt-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Circuit</p>
          <h2 className="text-lg font-black uppercase italic">Corner &amp; straight profile</h2>
        </div>
        <span className="num text-[10px] text-muted-foreground">
          derived from stored circuit geometry
        </span>
      </div>
      <div className="mb-4 rounded-lg border border-border bg-background/40 p-3">
        <CornerProfileChart model={model} selected={hover} onSelect={setHover} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <CornerMap path={path} className="w-full" highlightCorner={hover} />
          <div className="mt-3">
            <CornerMapLegend />
          </div>
        </div>


        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: "Corners", v: String(model.corners.length) },
              { l: "Slow", v: String(byType("Slow")) },
              { l: "Medium", v: String(byType("Medium")) },
              { l: "Fast", v: String(byType("Fast")) },
            ].map((x) => (
              <div key={x.l} className="rounded-lg border border-border bg-card/50 p-3">
                <p className="label-xs">{x.l}</p>
                <p className="num mt-1 text-xl font-bold">{x.v}</p>
              </div>
            ))}
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-card">
                <tr>
                  <th className="label-xs px-3 py-2">Corner</th>
                  <th className="label-xs px-3 py-2">Type</th>
                  <th className="label-xs px-3 py-2">Dir</th>
                  <th className="label-xs px-3 py-2 text-right">Arc</th>
                  <th className="label-xs px-3 py-2 text-right">Sector</th>
                  <th className="label-xs px-3 py-2 text-right">Lap pos</th>
                </tr>
              </thead>
              <tbody>
                {model.corners.map((c) => (
                  <tr
                    key={c.number}
                    onMouseEnter={() => setHover(c.number)}
                    onMouseLeave={() => setHover(null)}
                    className="border-t border-border/60 transition-colors hover:bg-accent/40"
                  >
                    <td className="num px-3 py-1.5 text-xs font-bold">C{c.number}</td>
                    <td className="px-3 py-1.5 text-xs font-bold uppercase">{c.type}</td>
                    <td className="num px-3 py-1.5 text-xs">{c.direction === "left" ? "L" : "R"}</td>
                    <td className="num px-3 py-1.5 text-right text-xs">{c.turnDeg}°</td>
                    <td className="num px-3 py-1.5 text-right text-xs">S{c.sector}</td>
                    <td className="num px-3 py-1.5 text-right text-xs text-muted-foreground">
                      {c.lapPct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-border bg-background/40 p-3">
            <p className="label-xs">Straights (share of lap distance)</p>
            <ul className="mt-2 space-y-1.5">
              {model.straights
                .slice()
                .sort((a, b) => b.lapPct - a.lapPct)
                .slice(0, 6)
                .map((s) => (
                  <li key={s.index} className="flex items-center gap-2">
                    <span className="num w-20 shrink-0 text-[11px] text-muted-foreground">
                      C{s.from}–C{s.to}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-sm bg-border/40">
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.min(100, (s.lapPct / (longest?.lapPct ?? 1)) * 100)}%`,
                          backgroundColor: s.isLongest ? "#ff2ea6" : "var(--primary)",
                        }}
                      />
                    </span>
                    <span className="num w-12 shrink-0 text-right text-[11px]">
                      {s.lapPct.toFixed(1)}%
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {circuit} geometry only. Corners are derived from the stored track path in lap
              direction, so the sequence groups linked corners and does not match official FIA turn
              numbers. The pink marker is the longest straight — the natural speed-trap point.
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Traffic                                                             */
/* ------------------------------------------------------------------ */

function TrafficBlock({
  codeA,
  codeB,
  colorA,
  colorB,
  traffic,
  trafficLapsA,
  trafficLapsB,
}: {
  codeA: string;
  codeB: string;
  colorA: string;
  colorB: string;
  traffic: H2H["traffic"];
  trafficLapsA: H2H["trafficLaps"][number];
  trafficLapsB: H2H["trafficLaps"][number];
}) {
  const [ta, tb] = traffic;
  if (!ta || !tb) return null;
  const anySignal =
    ta.cleanAirLaps +
    ta.trafficLaps +
    ta.uncertainLaps +
    tb.cleanAirLaps +
    tb.trafficLaps +
    tb.uncertainLaps;
  if (!anySignal)
    return (
      <Panel className="mt-5">
        <p className="num text-xs text-muted-foreground">
          No traffic proxy stored for this weekend.
        </p>
      </Panel>
    );

  const metrics: Metric[] = [
    {
      k: "Clean-air pace",
      hint: "median normalised Δ",
      a: ta.cleanAirPaceS,
      b: tb.cleanAirPaceS,
      fmt: (v) => fmtDelta(v),
      lowerIsBetter: true,
    },
    {
      k: "In-traffic pace",
      hint: "median normalised Δ",
      a: ta.trafficPaceS,
      b: tb.trafficPaceS,
      fmt: (v) => fmtDelta(v),
      lowerIsBetter: true,
    },
    {
      k: "Dirty-air cost",
      hint: "traffic − clean air",
      a: ta.dirtyAirCostS,
      b: tb.dirtyAirCostS,
      fmt: (v) => fmtDelta(v),
      lowerIsBetter: true,
    },
    {
      k: "Worst dirty-air lap",
      hint: "peak proxy penalty",
      a: ta.worstDirtyAirS,
      b: tb.worstDirtyAirS,
      fmt: (v) => fmtNum(v, 2),
      lowerIsBetter: true,
    },
  ];

  const split = (t: typeof ta) => {
    const total = Math.max(1, t.cleanAirLaps + t.trafficLaps + t.uncertainLaps);
    return [
      { l: "Clean", v: t.cleanAirLaps, c: "#35c759" },
      { l: "Traffic", v: t.trafficLaps, c: "#ff8a00" },
      { l: "Unclassified", v: t.uncertainLaps, c: "#5a616b" },
    ].map((x) => ({ ...x, pct: (x.v / total) * 100 }));
  };

  return (
    <Panel className="mt-5">
      <div className="mb-3">
        <p className="label-xs">Traffic</p>
        <h2 className="text-lg font-black uppercase italic">Clean air vs following</h2>
      </div>
      <DuelBoard metrics={metrics} colorA={colorA} colorB={colorB} />
      <div className="mt-4 rounded-lg border border-border bg-background/40 p-3">
        <p className="label-xs mb-2">Dirty air, lap by lap</p>
        <DirtyAirChart
          a={{ code: codeA, color: colorA }}
          b={{ code: codeB, color: colorB }}
          lapsA={trafficLapsA}
          lapsB={trafficLapsB}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { code: codeA, color: colorA, t: ta },
          { code: codeB, color: colorB, t: tb },
        ].map((s) => (
          <div key={s.code} className="rounded-lg border border-border bg-background/40 p-3">
            <p className="num text-[11px] font-black uppercase" style={{ color: s.color }}>
              {s.code} lap mix
            </p>
            <div className="mt-2 flex h-3 overflow-hidden rounded-sm bg-border/30">
              {split(s.t).map((x) => (
                <span
                  key={x.l}
                  title={`${x.l}: ${x.v} laps`}
                  style={{ width: `${x.pct}%`, backgroundColor: x.c }}
                />
              ))}
            </div>
            <p className="num mt-1 text-[10px] text-muted-foreground">
              {split(s.t)
                .map((x) => `${x.l} ${x.v}`)
                .join(" · ")}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Pit stops                                                           */
/* ------------------------------------------------------------------ */

function PitLossBlock({
  codeA,
  codeB,
  colorA,
  colorB,
  pitsA,
  pitsB,
}: {
  codeA: string;
  codeB: string;
  colorA: string;
  colorB: string;
  pitsA: H2H["pits"][number];
  pitsB: H2H["pits"][number];
}) {
  const [active, setActive] = useState<string | null>(null);
  const sides = [
    { code: codeA, color: colorA, pits: pitsA },
    { code: codeB, color: colorB, pits: pitsB },
  ];
  const sum = (xs: (number | null)[]) => {
    const n = xs.filter((v): v is number => v != null);
    return n.length ? n.reduce((a, b) => a + b, 0) : null;
  };
  const best = (xs: (number | null)[]) => {
    const n = xs.filter((v): v is number => v != null);
    return n.length ? Math.min(...n) : null;
  };
  const totals = sides.map((s) => sum(s.pits.map((p) => p.lossS)));
  const maxTotal = Math.max(1, ...totals.map((t) => t ?? 0));
  // Some weekends were ingested without the pit-loss model, so the stack would
  // render as empty bars. Fall back to a stop-by-stop card list instead.
  const hasLoss = [...pitsA, ...pitsB].some((p) => (p.lossS ?? 0) > 0);

  const hasTrafficPenalty = [...pitsA, ...pitsB].some((p) => (p.trafficPenaltyS ?? 0) > 0);

  const metrics: Metric[] = [
    {
      k: "Stops",
      a: pitsA.length,
      b: pitsB.length,
      fmt: (v) => String(v ?? 0),
      neutral: true,
    },
    ...(hasLoss
      ? ([
          {
            k: "Total pit-loss",
            hint: "estimated, s",
            a: totals[0] ?? null,
            b: totals[1] ?? null,
            fmt: (v: number | null) => fmtNum(v, 2),
            lowerIsBetter: true,
          },
          {
            k: "Best single stop",
            hint: "s",
            a: best(pitsA.map((p) => p.lossS)),
            b: best(pitsB.map((p) => p.lossS)),
            fmt: (v: number | null) => fmtNum(v, 2),
            lowerIsBetter: true,
          },
        ] as Metric[])
      : []),
    ...(hasTrafficPenalty
      ? ([
          {
            k: "Rejoin traffic penalty",
            hint: "proxy, s",
            a: sum(pitsA.map((p) => p.trafficPenaltyS)),
            b: sum(pitsB.map((p) => p.trafficPenaltyS)),
            fmt: (v: number | null) => fmtNum(v, 2),
            lowerIsBetter: true,
          },
        ] as Metric[])
      : []),
    {
      k: "First stop lap",
      a: pitsA[0]?.lap ?? null,
      b: pitsB[0]?.lap ?? null,
      fmt: (v) => (v == null ? "—" : `L${v}`),
      neutral: true,
    },
    {
      k: "Net through cycles",
      a: sum(pitsA.map((p) => p.net)),
      b: sum(pitsB.map((p) => p.net)),
      fmt: (v) => (v == null ? "—" : fmtDelta(v, 0)),
    },
  ];


  return (
    <Panel className="mt-5">
      <div className="mb-3">
        <p className="label-xs">Pit stops</p>
        <h2 className="text-lg font-black uppercase italic">
          {hasLoss ? "Time lost in the lane" : "Stop-for-stop"}
        </h2>
      </div>
      <DuelBoard metrics={metrics} colorA={colorA} colorB={colorB} />

      {hasLoss ? (
        <div className="mt-5 space-y-3">
          <p className="label-xs">Per-stop loss stack — hover a block</p>
          {sides.map((s, i) => (
            <div key={s.code}>
              <div className="flex items-baseline justify-between">
                <span className="num text-[11px] font-black uppercase" style={{ color: s.color }}>
                  {s.code}
                </span>
                <span className="num text-[11px] text-muted-foreground">
                  {fmtNum(totals[i] ?? null, 2)}s total
                </span>
              </div>
              <div className="mt-1 flex h-5 w-full gap-px overflow-hidden rounded-sm bg-border/30">
                {s.pits.length ? (
                  s.pits.map((p) => (
                    <button
                      key={`${p.stop}-${p.lap}`}
                      type="button"
                      onMouseEnter={() =>
                        setActive(
                          `${s.code} · stop ${p.stop} · L${p.lap ?? "—"} · ${
                            [p.from, p.to].filter(Boolean).join(" → ") || "compound n/a"
                          } · ${fmtNum(p.lossS, 2)}s · P${p.posBefore ?? "?"}→P${p.posAfter ?? "?"} · ${
                            titleCase(p.label ?? p.effect) || "no label"
                          }`,
                        )
                      }
                      onFocus={() => setActive(`${s.code} · stop ${p.stop}`)}
                      aria-label={`${s.code} stop ${p.stop}`}
                      className="h-full transition-opacity hover:opacity-80"
                      style={{
                        width: `${((p.lossS ?? 0) / maxTotal) * 100}%`,
                        backgroundColor: s.color,
                        opacity: 0.35 + 0.2 * p.stop,
                      }}
                    />
                  ))
                ) : (
                  <span className="num px-2 text-[10px] text-muted-foreground">
                    No stored stops
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="min-h-9 rounded border border-border bg-background/50 p-2">
            <p className="num text-[11px] text-muted-foreground">
              {active ?? "Hover a stop block for compound, lap, loss and position swing."}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Bars scale to the larger of the two totals, so the shorter bar is the cheaper set of pit
            cycles.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {sides.map((s) => (
            <div key={s.code} className="rounded-lg border border-border bg-background/40 p-3">
              <p className="num text-[11px] font-black uppercase" style={{ color: s.color }}>
                {s.code}
              </p>
              <ul className="mt-2 space-y-1.5">
                {s.pits.length ? (
                  s.pits.map((p) => (
                    <li
                      key={`${p.stop}-${p.lap}`}
                      className="rounded border border-border/60 px-2 py-1.5"
                      style={{ borderLeft: `3px solid ${s.color}` }}
                    >
                      <p className="num text-[11px] font-bold">
                        Stop {p.stop} · L{p.lap ?? "—"} ·{" "}
                        {[p.from, p.to].filter(Boolean).join(" → ") || "compound n/a"}
                      </p>
                      <p className="num text-[10px] text-muted-foreground">
                        P{p.posBefore ?? "?"} → P{p.posAfter ?? "?"} ·{" "}
                        {p.net == null ? "net —" : `net ${fmtDelta(p.net, 0)}`} ·{" "}
                        {titleCase(p.label ?? p.effect) || "no label"}
                        {p.rejoinRisk ? ` · rejoin ${titleCase(p.rejoinRisk)}` : ""}
                      </p>
                    </li>
                  ))
                ) : (
                  <li className="num text-[11px] text-muted-foreground">No stored stops</li>
                )}
              </ul>
            </div>
          ))}
          <p className="num text-[10px] text-muted-foreground sm:col-span-2">
            Pit-loss seconds aren't modelled for this weekend, so stops are shown by lap, compound
            and position swing only.
          </p>
        </div>
      )}

    </Panel>
  );
}
