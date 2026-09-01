import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type CSSProperties } from "react";
import { SiteShell, Stat } from "@/components/site-shell";
import { RaceFlagHero } from "@/components/race-flag-hero";
import { CompoundLegend, LapTraceChart } from "@/components/telemetry";
import { buildCornerModel, CornerMap, CornerMapLegend } from "@/components/corner-profile";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import {
  DriverChips,
  PaceDots,
  PitTimeline,
  PositionRibbon,
  QualiGapBars,
} from "@/components/analysis-viz";
import { countryForRace, countryTheme } from "@/data/country-theme";
import { team } from "@/data/teams";
import { fmtDate, fmtDelta, fmtNum, titleCase } from "@/lib/format";
import { getWeekend } from "@/lib/f1.functions";

const weekendQuery = (slug: string) =>
  queryOptions({
    queryKey: ["weekend", slug],
    queryFn: () => getWeekend({ data: { slug } }),
    staleTime: 5 * 60_000,
  });

export const Route = createFileRoute("/analysis/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(weekendQuery(params.slug));
    if (!data) throw notFound();
  },
  head: ({ params }) => {
    const title = params.slug
      .split("-")
      .slice(2)
      .join(" ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${title} weekend analysis — qualifying, strategy and race pace` },
        {
          name: "description",
          content: `Session-by-session breakdown of the ${title} F1 weekend: qualifying segments, sprint result, race classification, tyre stints, pit cycles and lap-level pace.`,
        },
        { property: "og:title", content: `${title} weekend analysis` },
        {
          property: "og:description",
          content: "Qualifying, sprint, race classification, stints, pit cycles and lap pace.",
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <SiteShell fullWidth>
      <p role="alert" className="text-sm text-destructive">
        Weekend unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  notFoundComponent: () => (
    <SiteShell fullWidth>
      <h1 className="text-2xl font-black uppercase italic">Weekend not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No stored analysis matches this weekend.{" "}
        <Link to="/analysis" className="text-primary underline underline-offset-2">
          Back to all reports
        </Link>
      </p>
    </SiteShell>
  ),
  component: WeekendPage,
});

type Session = "quali" | "sprint" | "race";
type RaceView = "result" | "pace" | "tyres" | "pits" | "story" | "circuit";

const COMPOUND: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd400",
  HARD: "#e8e8e8",
  INTERMEDIATE: "#43b02a",
  WET: "#0067ad",
};

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

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`pw-flip-in rounded-xl border border-border bg-card/40 p-4 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function StintBars({
  rows,
}: {
  rows: {
    code: string;
    team: string;
    compound: string | null;
    startLap: number | null;
    endLap: number | null;
  }[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const maxLap = Math.max(1, ...rows.map((r) => r.endLap ?? 0));
  const byDriver = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byDriver.get(r.code) ?? [];
    list.push(r);
    byDriver.set(r.code, list);
  }
  return (
    <div>
      <div className="space-y-1.5">
        {[...byDriver.entries()].map(([code, list], i) => (
          <div
            key={code}
            className="pw-ticker flex items-center gap-2"
            style={{ animationDelay: `${Math.min(i, 14) * 26}ms` }}
          >
            <span className="num w-10 text-[11px] font-black uppercase">{code}</span>
            <span
              className="inline-block h-3 w-0.5"
              style={{ backgroundColor: team(list[0]!.team).color }}
            />
            <div className="flex h-4 flex-1 overflow-hidden rounded-sm bg-secondary">
              {list
                .slice()
                .sort((a, b) => (a.startLap ?? 0) - (b.startLap ?? 0))
                .map((s) => {
                  const len = (s.endLap ?? 0) - (s.startLap ?? 0) + 1;
                  const key = `${code}-${s.startLap}-${s.compound}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      onMouseEnter={() =>
                        setActive(
                          `${code} · ${titleCase(s.compound ?? "unknown")} · L${s.startLap}–L${s.endLap} · ${Math.max(len, 0)} laps`,
                        )
                      }
                      onMouseLeave={() => setActive(null)}
                      aria-label={`${code} ${s.compound ?? "unknown"} stint`}
                      className="h-full transition-opacity hover:opacity-80"
                      style={{
                        width: `${(Math.max(len, 0) / maxLap) * 100}%`,
                        backgroundColor: COMPOUND[(s.compound ?? "").toUpperCase()] ?? "#5a616b",
                      }}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 min-h-8 rounded border border-border bg-card/60 p-2">
        <p className="num text-[11px] text-muted-foreground">
          {active ?? "Hover a stint block for compound and lap window."}
        </p>
      </div>
    </div>
  );
}

function WeekendPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(weekendQuery(slug));
  const w = data!;

  const available = useMemo(() => {
    const list: Session[] = [];
    if (w.qualifying.length) list.push("quali");
    if (w.sprint.length) list.push("sprint");
    if (w.classification.length || w.laps.length) list.push("race");
    return list;
  }, [w]);
  const [session, setSession] = useState<Session>(
    available.includes("race") ? "race" : (available[0] ?? "race"),
  );
  const [view, setView] = useState<RaceView>("result");
  const [resultMode, setResultMode] = useState<"table" | "ribbon">("ribbon");
  const [hoverCorner, setHoverCorner] = useState<number | null>(null);

  const lapDrivers = useMemo(() => {
    const codes = [...new Set(w.laps.map((l) => l.code))];
    return codes
      .map((code) => ({
        code,
        team: w.classification.find((c) => c.code === code)?.team ?? null,
        pos: w.classification.find((c) => c.code === code)?.finish ?? 99,
      }))
      .sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
  }, [w]);

  const [picked, setPicked] = useState<string[]>(() =>
    [...new Set(w.classification.slice(0, 3).map((r) => r.code))].filter(Boolean),
  );
  const toggle = (code: string) =>
    setPicked((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code].slice(-6)));

  const traceSeries = picked.map((code) => ({
    code,
    color: team(w.classification.find((c) => c.code === code)?.team).color,
    laps: w.laps
      .filter((l) => l.code === code)
      .map((l) => ({
        driverCode: l.code,
        lap: l.lap,
        lapTimeS: l.lapTimeS,
        paceDeltaS: l.paceDeltaS,
        fuelCorrectedDeltaS: l.fuelCorrectedDeltaS,
        compound: l.compound,
        stint: null,
        tyreAge: l.tyreAge,
      })),
  }));

  const winnerTeam = team(w.winner.team);
  const raceTheme = countryTheme(
    countryForRace({
      circuitId: w.circuitId,
      circuit: w.circuit,
      raceName: w.name,
    }),
  );
  const raceThemeStyle = {
    "--primary": raceTheme.accent,
    "--ring": raceTheme.accent,
    "--race-country-accent": raceTheme.accent,
  } as CSSProperties;
  const raceLaps = Math.max(1, ...w.laps.map((l) => l.lap), ...w.pits.map((p) => p.lap ?? 0));
  const label: Record<Session, string> = { quali: "Qualifying", sprint: "Sprint", race: "Race" };
  const cornerModel = useMemo(() => buildCornerModel(w.trackPath), [w.trackPath]);
  const cornerCounts = useMemo(() => {
    const counts = { Slow: 0, Medium: 0, Fast: 0 };
    for (const c of cornerModel?.corners ?? []) counts[c.type] += 1;
    return counts;
  }, [cornerModel]);
  const weatherSummary = useMemo(() => {
    if (!w.weather.length) return null;
    const avg = (values: (number | null)[]) => {
      const xs = values.filter((x): x is number => x != null);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    return {
      airC: avg(w.weather.map((x) => x.airC)),
      trackC: avg(w.weather.map((x) => x.trackC)),
      humidity: avg(w.weather.map((x) => x.humidity)),
      rainLaps: w.weather.filter((x) => x.rain).length,
      state: w.summary?.weather ?? w.weather.find((x) => x.state)?.state ?? null,
    };
  }, [w.weather, w.summary?.weather]);

  const raceViews: { k: RaceView; l: string }[] = [
    { k: "result", l: "Result" },
    ...(w.laps.length || w.pace.length ? [{ k: "pace" as const, l: "Pace" }] : []),
    ...(w.stints.length ? [{ k: "tyres" as const, l: "Tyres" }] : []),
    ...(w.pits.length ? [{ k: "pits" as const, l: "Pit stops" }] : []),
    ...(w.stories.length || w.statusPhases.length || w.weather.length
      ? [{ k: "story" as const, l: "Timeline" }]
      : []),
    { k: "circuit", l: "Circuit" },
  ];

  return (
    <SiteShell fullWidth>
      <div style={raceThemeStyle}>
        <nav className="text-[11px] text-muted-foreground">
          <Link to="/analysis" className="text-primary underline underline-offset-2">
            Analysis
          </Link>
          <span className="mx-1">/</span>
          <span className="num">R{w.round}</span>
        </nav>
        <RaceFlagHero
          kicker={`Round ${w.round} / ${w.season}`}
          title={w.name}
          meta={`${w.circuit}${w.resultsOnly ? " / results only - lap telemetry not ingested" : ` / ${w.lapsAnalysed} analysed laps`}`}
          flag={raceTheme.flag}
          stats={[
            { label: "Race shape", value: titleCase(w.summary?.raceShape) },
            {
              label: "Strategy",
              value: titleCase(w.summary?.strategy),
              note: w.summary?.compoundPath ?? undefined,
            },
            {
              label: "Corners",
              value: `${cornerCounts.Slow}/${cornerCounts.Medium}/${cornerCounts.Fast}`,
              note: "slow / medium / fast",
            },
            { label: "Winner", value: w.winner.code || "-", note: w.winner.team },
          ]}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="flex items-center gap-3 rounded-lg border border-white/18 bg-[#07110c]/88 p-3">
              <DriverAvatar code={w.winner.code || "-"} teamName={w.winner.team} size="lg" />
              <div className="min-w-0">
                <p className="label-xs text-white/65">Winner</p>
                <p className="truncate text-sm font-black uppercase italic text-white">
                  {w.winner.name || w.winner.code || "-"}
                </p>
                <TeamBadge teamName={w.winner.team} showName />
              </div>
            </div>
            <div className="rounded-lg border border-white/18 bg-white p-3 text-[#07110c]">
              <p className="label-xs">Circuit</p>
              <CornerMap
                path={w.trackPath}
                className="mx-auto mt-2 h-44 w-full"
                highlightCorner={hoverCorner}
              />
              <div className="mt-2">
                <CornerMapLegend />
              </div>
            </div>
          </div>
        </RaceFlagHero>

        <div className="sticky top-0 z-10 mt-8 -mx-1 flex flex-wrap items-center gap-2 border-b border-border bg-background/90 px-1 py-2 backdrop-blur">
          <Segmented
            options={available.map((s) => ({ k: s, l: label[s] }))}
            value={session}
            onChange={setSession}
          />
          {session === "race" ? (
            <>
              <span className="hidden h-4 w-px bg-border sm:block" />
              <Segmented options={raceViews} value={view} onChange={setView} />
            </>
          ) : null}
        </div>

        {session === "quali" ? (
          <Panel className="mt-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="label-xs">Qualifying</p>
                <h2 className="text-lg font-black uppercase italic">Gap to pole</h2>
              </div>
              <p className="num text-[10px] text-muted-foreground">hover a row for segments</p>
            </div>
            <QualiGapBars rows={w.qualifying} />
          </Panel>
        ) : null}

        {session === "sprint" ? (
          <Panel className="mt-5">
            <div className="mb-3">
              <p className="label-xs">Sprint</p>
              <h2 className="text-lg font-black uppercase italic">Grid to flag</h2>
            </div>
            <PositionRibbon
              rows={w.sprint.map((s) => ({
                code: s.code,
                name: s.name,
                team: s.team,
                start: s.grid,
                finish: s.finish,
                net: s.grid != null && s.finish != null ? s.grid - s.finish : null,
              }))}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {w.sprint
                .filter((s) => (s.points ?? 0) > 0)
                .map((s) => (
                  <div
                    key={s.code}
                    className="flex items-center justify-between rounded border border-border bg-background/40 px-2 py-1.5"
                    style={{ borderLeft: `3px solid ${team(s.team).color}` }}
                  >
                    <span className="num text-[11px] font-black uppercase">{s.code}</span>
                    <span className="num text-[11px] font-bold">{s.points} pts</span>
                  </div>
                ))}
            </div>
          </Panel>
        ) : null}

        {session === "race" ? (
          <div className="mt-5">
            {view === "result" ? (
              <Panel>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="label-xs">Race</p>
                    <h2 className="text-lg font-black uppercase italic">Classification</h2>
                  </div>
                  <Segmented
                    options={[
                      { k: "ribbon" as const, l: "Ribbon" },
                      { k: "table" as const, l: "Table" },
                    ]}
                    value={resultMode}
                    onChange={setResultMode}
                  />
                </div>

                {resultMode === "ribbon" ? (
                  <PositionRibbon
                    rows={(w.positions.length
                      ? w.positions.map((p) => ({
                          code: p.code,
                          name: p.name,
                          team: p.team,
                          start: p.start,
                          finish: p.finish,
                          net: p.net,
                        }))
                      : w.classification.map((r) => ({
                          code: r.code,
                          name: r.name,
                          team: r.team,
                          start: r.grid,
                          finish: r.finish,
                          net: r.grid != null && r.finish != null ? r.grid - r.finish : null,
                        }))
                    ).filter((r) => r.start != null && r.finish != null)}
                  />
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="bg-card/60">
                        <tr>
                          <th className="label-xs px-3 py-2">Fin</th>
                          <th className="label-xs px-3 py-2">Driver</th>
                          <th className="label-xs px-3 py-2 text-right">Grid</th>
                          <th className="label-xs px-3 py-2 text-right">Δ</th>
                          <th className="label-xs px-3 py-2 text-right">Laps</th>
                          <th className="label-xs px-3 py-2 text-right">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {w.classification.map((r, i) => (
                          <tr
                            key={r.code}
                            className="pw-ticker border-t border-border/60 hover:bg-accent/40"
                            style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
                          >
                            <td className="num px-3 py-2 text-xs text-muted-foreground">
                              {r.finish ?? titleCase(r.status)}
                            </td>
                            <td className="px-3 py-2 text-xs font-bold uppercase">
                              <span
                                className="mr-2 inline-block h-3 w-0.5 align-middle"
                                style={{ backgroundColor: team(r.team).color }}
                              />
                              {r.name}
                            </td>
                            <td className="num px-3 py-2 text-right text-xs">{r.grid ?? "—"}</td>
                            <td className="num px-3 py-2 text-right text-xs">
                              {r.grid != null && r.finish != null
                                ? fmtDelta(r.grid - r.finish, 0)
                                : "—"}
                            </td>
                            <td className="num px-3 py-2 text-right text-xs">{r.laps ?? "—"}</td>
                            <td className="num px-3 py-2 text-right text-xs font-bold">
                              {r.points ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            ) : null}

            {view === "pace" ? (
              <div className="space-y-4">
                <Panel>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="label-xs">Lap pace · pick up to six</p>
                      <h2 className="text-lg font-black uppercase italic">Trace</h2>
                    </div>
                    <CompoundLegend />
                  </div>
                  <DriverChips drivers={lapDrivers} selected={picked} onToggle={toggle} />
                  <div className="mt-3">
                    {traceSeries.some((s) => s.laps.length) ? (
                      <LapTraceChart series={traceSeries} />
                    ) : (
                      <p className="num py-8 text-center text-xs text-muted-foreground">
                        Select a driver to draw their laps.
                      </p>
                    )}
                  </div>
                </Panel>
                {w.pace.length ? (
                  <Panel>
                    <div className="mb-3">
                      <p className="label-xs">Fuel-corrected median</p>
                      <h2 className="text-lg font-black uppercase italic">True pace order</h2>
                    </div>
                    <PaceDots
                      rows={w.pace.map((p) => ({
                        ...p,
                        team: w.classification.find((c) => c.code === p.code)?.team ?? null,
                      }))}
                    />
                  </Panel>
                ) : null}
              </div>
            ) : null}

            {view === "tyres" ? (
              <Panel>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="label-xs">Tyres</p>
                    <h2 className="text-lg font-black uppercase italic">Stint map</h2>
                  </div>
                  <CompoundLegend />
                </div>
                <StintBars rows={w.stints} />
              </Panel>
            ) : null}

            {view === "pits" ? (
              <Panel>
                <div className="mb-3">
                  <p className="label-xs">Pit cycles</p>
                  <h2 className="text-lg font-black uppercase italic">When they stopped</h2>
                </div>
                <PitTimeline pits={w.pits} maxLap={raceLaps} />
              </Panel>
            ) : null}

            {view === "story" ? (
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                {w.stories.length ? (
                  <Panel>
                    <div className="mb-3">
                      <p className="label-xs">Narrative</p>
                      <h2 className="text-lg font-black uppercase italic">Race timeline</h2>
                    </div>
                    <ol className="space-y-3 border-l border-border pl-4">
                      {w.stories.map((s, i) => (
                        <li
                          key={`${s.lap}-${s.title}`}
                          className="pw-ticker relative"
                          style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                        >
                          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                          <p className="num text-[10px] uppercase text-muted-foreground">
                            {s.lap == null ? titleCase(s.phase) : `Lap ${s.lap}`}
                          </p>
                          <p className="text-xs font-bold uppercase">{s.title}</p>
                          {s.summary ? (
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              {s.summary}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </Panel>
                ) : null}
                <div className="space-y-4">
                  {w.statusPhases.length ? (
                    <Panel>
                      <p className="label-xs">Neutralisations</p>
                      <ul className="mt-2 space-y-1">
                        {w.statusPhases.map((p) => (
                          <li key={`${p.label}-${p.fromLap}`} className="flex items-baseline gap-2">
                            <span className="num w-16 text-[11px] text-muted-foreground">
                              L{p.fromLap}
                              {p.toLap !== p.fromLap ? `–${p.toLap}` : ""}
                            </span>
                            <span className="text-[11px] font-bold uppercase">
                              {titleCase(p.label)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  ) : null}
                  {w.weather.length ? (
                    <Panel>
                      <p className="label-xs">Conditions</p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          {
                            k: "Air °C",
                            v: fmtNum(
                              w.weather.reduce((a, x) => a + (x.airC ?? 0), 0) / w.weather.length,
                              1,
                            ),
                          },
                          {
                            k: "Track °C",
                            v: fmtNum(
                              w.weather.reduce((a, x) => a + (x.trackC ?? 0), 0) / w.weather.length,
                              1,
                            ),
                          },
                          { k: "Rain laps", v: String(w.weather.filter((x) => x.rain).length) },
                        ].map((x) => (
                          <div
                            key={x.k}
                            className="rounded border border-border bg-background/40 p-2"
                          >
                            <p className="label-xs">{x.k}</p>
                            <p className="num text-sm font-bold">{x.v}</p>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ) : null}
                  {w.summary?.paceFactor ||
                  w.summary?.strategyFactor ||
                  w.summary?.positionFactor ? (
                    <Panel>
                      <p className="label-xs">Key factors</p>
                      <ul className="mt-2 space-y-2">
                        {[
                          { k: "Pace", v: w.summary?.paceFactor },
                          { k: "Strategy", v: w.summary?.strategyFactor },
                          { k: "Position", v: w.summary?.positionFactor },
                        ]
                          .filter((x) => x.v)
                          .map((x) => (
                            <li key={x.k} className="text-[11px] leading-relaxed">
                              <span className="num font-black uppercase text-primary">{x.k}</span>{" "}
                              <span className="text-muted-foreground">{x.v}</span>
                            </li>
                          ))}
                      </ul>
                    </Panel>
                  ) : null}
                </div>
              </div>
            ) : null}

            {view === "circuit" ? (
              <Panel>
                <div className="mb-3">
                  <p className="label-xs">Geometry · sectors, corners, speed trap</p>
                  <h2 className="text-lg font-black uppercase italic">{w.circuit}</h2>
                </div>
                <CornerMap
                  path={w.trackPath}
                  className="mx-auto h-[380px] w-full max-w-2xl"
                  highlightCorner={hoverCorner}
                />
                <div className="mt-3">
                  <CornerMapLegend />
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <div>
                    <p className="label-xs">Corner mix</p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { label: "Slow", value: cornerCounts.Slow },
                        { label: "Medium", value: cornerCounts.Medium },
                        { label: "Fast", value: cornerCounts.Fast },
                      ].map((x) => (
                        <div
                          key={x.label}
                          className="rounded border border-border bg-background/40 p-2"
                        >
                          <p className="label-xs">{x.label}</p>
                          <p className="num text-xl font-black">{x.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 max-h-56 space-y-1 overflow-auto pr-1">
                      {cornerModel?.corners.map((c) => (
                        <button
                          key={c.number}
                          type="button"
                          onMouseEnter={() => setHoverCorner(c.number)}
                          onFocus={() => setHoverCorner(c.number)}
                          onMouseLeave={() => setHoverCorner(null)}
                          onBlur={() => setHoverCorner(null)}
                          className="flex w-full items-center justify-between rounded border border-border bg-background/30 px-2 py-1.5 text-left transition-colors hover:border-primary hover:bg-accent/40"
                        >
                          <span className="flex items-center gap-2">
                            <span className="num flex size-6 items-center justify-center rounded-full border border-border text-[10px] font-black">
                              {c.number}
                            </span>
                            <span className="text-xs font-bold uppercase">Sector {c.sector}</span>
                          </span>
                          <span className="num text-[10px] uppercase text-muted-foreground">
                            {c.type} · {c.direction}
                          </span>
                        </button>
                      )) ?? (
                        <p className="num text-[11px] text-muted-foreground">
                          No corner model available for this circuit.
                        </p>
                      )}
                    </div>
                  </div>

                  {weatherSummary ? (
                    <div>
                      <p className="label-xs">Race conditions</p>
                      {weatherSummary.state ? (
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                          {weatherSummary.state}
                        </p>
                      ) : null}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {[
                          {
                            k: "Air",
                            v:
                              weatherSummary.airC != null
                                ? `${fmtNum(weatherSummary.airC, 1)} C`
                                : "N/A",
                          },
                          {
                            k: "Track",
                            v:
                              weatherSummary.trackC != null
                                ? `${fmtNum(weatherSummary.trackC, 1)} C`
                                : "N/A",
                          },
                          {
                            k: "Humidity",
                            v:
                              weatherSummary.humidity != null
                                ? `${fmtNum(weatherSummary.humidity, 0)}%`
                                : "N/A",
                          },
                          { k: "Rain laps", v: String(weatherSummary.rainLaps) },
                        ].map((x) => (
                          <div
                            key={x.k}
                            className="rounded border border-border bg-background/40 p-2"
                          >
                            <p className="label-xs">{x.k}</p>
                            <p className="num text-sm font-bold">{x.v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Panel>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-4 text-[11px] font-bold uppercase text-primary">
          <Link to="/vs" search={{ slug: w.slug }}>
            Compare two drivers →
          </Link>
          <Link to="/analysis">All weekends →</Link>
        </div>
      </div>
    </SiteShell>
  );
}
