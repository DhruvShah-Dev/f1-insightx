import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { RaceFlagHero } from "@/components/race-flag-hero";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { team } from "@/data/teams";
import { fmtDelta, fmtNum } from "@/lib/format";
import { getChampionship, getSeasonTelemetry } from "@/lib/f1.functions";

const seasonQuery = queryOptions({
  queryKey: ["season-telemetry"],
  queryFn: () => getSeasonTelemetry(),
  staleTime: 5 * 60_000,
});

const champQuery = queryOptions({
  queryKey: ["championship"],
  queryFn: () => getChampionship({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/championship")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(seasonQuery),
      context.queryClient.ensureQueryData(champQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Championship 2026 — driver and constructor standings with pace" },
      {
        name: "description",
        content:
          "2026 Formula 1 driver and constructor standings with points gaps, wins, podiums, average grid and finish, sprint points, round-by-round progression and measured race pace.",
      },
      { property: "og:title", content: "Championship 2026 — standings, form and pace" },
      {
        property: "og:description",
        content:
          "Standings, points progression, per-driver race records and measured race pace for 2026.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell fullWidth>
      <p role="alert" className="text-sm text-destructive">
        Standings unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  component: Championship,
});

/* ------------------------------------------------------------------ */
/* Interactive progression chart                                       */
/* ------------------------------------------------------------------ */

type Line = { key: string; label: string; color: string; points: (number | null)[] };

function Progression({ rounds, lines }: { rounds: number[]; lines: Line[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const W = 760;
  const H = 260;
  const padL = 40;
  const padB = 24;
  const maxPts = Math.max(1, ...lines.flatMap((l) => l.points.map((p) => p ?? 0)));
  const x = (i: number) => padL + (i / Math.max(1, rounds.length - 1)) * (W - padL - 14);
  const y = (p: number) => H - padB - (p / maxPts) * (H - padB - 16);

  if (!rounds.length)
    return <p className="num py-8 text-center text-xs text-muted-foreground">No rounds stored.</p>;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Points progression"
        onMouseLeave={() => setCursor(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - box.left) / box.width) * W;
          const i = Math.round(
            ((rel - padL) / (W - padL - 14)) * Math.max(1, rounds.length - 1),
          );
          setCursor(Math.min(rounds.length - 1, Math.max(0, i)));
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={padL}
              x2={W - 14}
              y1={y(maxPts * f)}
              y2={y(maxPts * f)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={6} y={y(maxPts * f) + 3} fill="currentColor" opacity={0.45} fontSize={9}>
              {Math.round(maxPts * f)}
            </text>
          </g>
        ))}

        {cursor != null ? (
          <line
            x1={x(cursor)}
            x2={x(cursor)}
            y1={10}
            y2={H - padB}
            stroke="var(--primary)"
            strokeWidth={1}
            opacity={0.6}
          />
        ) : null}

        {lines.map((l) => {
          const on = hover === l.key;
          const dim = hover != null && !on;
          return (
            <g key={l.key} opacity={dim ? 0.16 : 1}>
              <polyline
                fill="none"
                stroke={l.color}
                strokeWidth={on ? 3.5 : 2}
                points={l.points
                  .map((p, i) => (p == null ? null : `${x(i)},${y(p)}`))
                  .filter(Boolean)
                  .join(" ")}
              />
              {cursor != null && l.points[cursor] != null ? (
                <circle cx={x(cursor)} cy={y(l.points[cursor]!)} r={on ? 5 : 3.5} fill={l.color} />
              ) : null}
            </g>
          );
        })}

        {rounds.map((r, i) =>
          i % 2 === 0 || rounds.length < 8 ? (
            <text
              key={r}
              x={x(i)}
              y={H - 6}
              fill="currentColor"
              opacity={cursor === i ? 0.9 : 0.45}
              fontSize={9}
              textAnchor="middle"
            >
              R{r}
            </text>
          ) : null,
        )}
      </svg>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {lines.map((l) => {
          const val = cursor != null ? l.points[cursor] : l.points[l.points.length - 1];
          const on = hover === l.key;
          return (
            <button
              key={l.key}
              type="button"
              onMouseEnter={() => setHover(l.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(l.key)}
              onBlur={() => setHover(null)}
              className={`num flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all ${
                on ? "border-transparent text-background" : "border-border text-muted-foreground"
              }`}
              style={on ? { backgroundColor: l.color } : undefined}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: on ? "rgba(0,0,0,.55)" : l.color }}
              />
              {l.label}
              <span className="opacity-70">{val ?? "—"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type View = "drivers" | "constructors" | "progression" | "winners";

function Championship() {
  const { data: tele } = useSuspenseQuery(seasonQuery);
  const { data } = useSuspenseQuery(champQuery);
  const [view, setView] = useState<View>("drivers");
  const [teamKey, setTeamKey] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const paceByCode = useMemo(
    () => new Map(tele.drivers.map((d) => [d.driverCode, d])),
    [tele.drivers],
  );
  const leader = data.drivers[0];
  const teamLeader = data.constructors[0];

  const drivers = useMemo(
    () => data.drivers.filter((d) => !teamKey || team(d.team).key === teamKey),
    [data.drivers, teamKey],
  );

  const driverLines: Line[] = useMemo(
    () =>
      data.drivers.slice(0, 6).map((d) => ({
        key: d.code,
        label: d.code,
        color: team(d.team).color,
        points: data.progression.map(
          (p) => p.entries.find((e) => e.code === d.code)?.points ?? null,
        ),
      })),
    [data.drivers, data.progression],
  );

  const consLines: Line[] = useMemo(
    () =>
      data.constructors.slice(0, 6).map((c) => ({
        key: c.id,
        label: team(c.name).short,
        color: team(c.name).color,
        points: data.constructorProgression.map(
          (p) => p.entries.find((e) => e.id === c.id)?.points ?? null,
        ),
      })),
    [data.constructors, data.constructorProgression],
  );

  const maxConsPts = Math.max(1, ...data.constructors.map((c) => c.points));
  const paceValues = data.drivers
    .map((d) => paceByCode.get(d.code)?.racePaceDeltaS)
    .filter((v): v is number => v != null);
  const paceMax = Math.max(0.001, ...paceValues.map((v) => Math.abs(v)));

  const views: { k: View; l: string }[] = [
    { k: "drivers", l: "Drivers" },
    { k: "constructors", l: "Constructors" },
    { k: "progression", l: "Progression" },
    { k: "winners", l: "Winners" },
  ];

  return (
    <SiteShell fullWidth>
      <RaceFlagHero
        kicker={`${data.season} season`}
        title="Championship"
        meta={`Complete through round ${data.round}`}
        stats={[
          { label: "Leader", value: leader?.code ?? "-", note: leader ? `${leader.points} pts` : undefined },
          {
            label: "Margin",
            value: data.drivers[1] ? String(Math.abs(data.drivers[1].gapToLeader)) : "-",
            note: "points to P2",
          },
          { label: "Top team", value: team(teamLeader?.name).short, note: `${teamLeader?.points ?? 0} pts` },
          {
            label: "Winners",
            value: String(new Set(data.winnersByRound.map((r) => r.winnerCode).filter(Boolean)).size),
            note: "different race winners",
          },
        ]}
      />

      <div className="sticky top-0 z-20 -mx-4 mt-6 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          {views.map((v) => (
            <button
              key={v.k}
              type="button"
              onClick={() => setView(v.k)}
              aria-pressed={view === v.k}
              className={`num rounded-sm border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                view === v.k
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.l}
            </button>
          ))}
          {teamKey ? (
            <button
              type="button"
              onClick={() => setTeamKey(null)}
              className="num rounded-sm border border-primary/60 px-2.5 py-1 text-[10px] font-black uppercase text-primary"
            >
              {team(teamKey).short} only ×
            </button>
          ) : null}
        </div>
      </div>

      {view === "drivers" ? (
        <section className="mt-5">
          <SectionHeading kicker="Tap a row" title="Standings and record" />
          <div className="space-y-1.5">
            {drivers.map((d, i) => {
              const t = team(d.team);
              const pace = paceByCode.get(d.code);
              const delta = pace?.racePaceDeltaS ?? null;
              const isOpen = open === d.code;
              return (
                <div
                  key={d.code}
                  className="pw-ticker overflow-hidden rounded-lg border border-border bg-card/40"
                  style={{
                    animationDelay: `${Math.min(i, 14) * 25}ms`,
                    borderLeft: `4px solid ${t.color}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : d.code)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/30"
                  >
                    <span className="num w-6 text-xs font-black text-muted-foreground">
                      {d.position}
                    </span>
                    <DriverAvatar code={d.code} teamName={d.team} name={d.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-black uppercase">{d.name}</span>
                      <TeamBadge teamName={d.team} />
                    </span>
                    <span className="hidden w-28 shrink-0 sm:block">
                      <span className="relative flex h-3 items-center">
                        <span className="absolute inset-x-0 h-[2px] bg-secondary/60" />
                        <span
                          className="absolute h-3 w-[2px] bg-muted-foreground/50"
                          style={{ left: "50%" }}
                        />
                        {delta != null ? (
                          <span
                            className="absolute h-2.5 rounded-sm"
                            style={{
                              backgroundColor: t.color,
                              width: `${(Math.abs(delta) / paceMax) * 48}%`,
                              left: delta < 0 ? `${50 - (Math.abs(delta) / paceMax) * 48}%` : "50%",
                            }}
                          />
                        ) : null}
                      </span>
                      <span className="num mt-0.5 block text-right text-[9px] text-muted-foreground">
                        {delta == null ? "no pace" : `${fmtDelta(delta, 2)}s`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block text-sm font-black">{d.points}</span>
                      <span className="num block text-[10px] text-muted-foreground">
                        {d.position === 1 ? "leader" : d.gapToLeader}
                      </span>
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="grid grid-cols-2 gap-2 border-t border-border/60 bg-background/40 px-3 py-3 sm:grid-cols-4 lg:grid-cols-8">
                      {[
                        { l: "Wins", v: d.wins },
                        { l: "Podiums", v: d.podiums },
                        { l: "Top 10", v: d.top10 },
                        { l: "Sprint", v: d.sprintPoints },
                        { l: "Starts", v: d.starts },
                        { l: "Avg grid", v: fmtNum(d.avgGrid, 1) },
                        { l: "Avg fin", v: fmtNum(d.avgFinish, 1) },
                        {
                          l: "Quali gap",
                          v: pace?.qualiGapS == null ? "—" : `${fmtNum(pace.qualiGapS, 3)}s`,
                        },
                      ].map((c) => (
                        <div key={c.l}>
                          <p className="label-xs">{c.l}</p>
                          <p className="num text-sm font-bold">{c.v}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="num mt-2 text-[10px] text-muted-foreground">
            Pace bar = median fuel-corrected lap delta to the field reference. Left of centre is
            faster. Averages count classified finishes only.
          </p>
        </section>
      ) : null}

      {view === "constructors" ? (
        <section className="mt-5">
          <SectionHeading kicker="Tap to filter drivers" title="Constructor standings" />
          <div className="space-y-1.5">
            {data.constructors.map((row, i) => {
              const t = team(row.name);
              const on = teamKey === t.key;
              const line = data.drivers
                .filter((d) => team(d.team).key === t.key)
                .map((d) => d.code)
                .join(" / ");
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setTeamKey(on ? null : t.key);
                    if (!on) setView("drivers");
                  }}
                  aria-pressed={on}
                  className={`pw-ticker flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors ${
                    on ? "bg-accent/50" : "bg-card/40 hover:bg-accent/30"
                  }`}
                  style={{
                    animationDelay: `${Math.min(i, 12) * 30}ms`,
                    borderLeft: `4px solid ${t.color}`,
                  }}
                >
                  <span className="num w-5 text-xs text-muted-foreground">{row.position}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black uppercase">{t.name}</span>
                    <span className="num text-[10px] text-muted-foreground">
                      {row.wins} wins · {line || "—"}
                    </span>
                    <span className="relative mt-1.5 block h-2.5 overflow-hidden rounded-sm bg-secondary/50">
                      <span
                        className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500"
                        style={{
                          width: `${(row.points / maxConsPts) * 100}%`,
                          backgroundColor: t.color,
                        }}
                      />
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-sm font-black">{row.points}</span>
                    <span className="num block text-[10px] text-muted-foreground">
                      {row.position === 1
                        ? "leader"
                        : `-${(teamLeader?.points ?? 0) - row.points}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "progression" ? (
        <div className="mt-5 grid gap-8 xl:grid-cols-2">
          <section>
            <SectionHeading kicker="Hover a chip or the chart" title="Drivers · points progression" />
            <div className="rounded-lg border border-border bg-card/40 p-3 text-foreground">
              <Progression rounds={data.progression.map((p) => p.round)} lines={driverLines} />
            </div>
          </section>
          <section>
            <SectionHeading kicker="Top six" title="Constructors · points progression" />
            <div className="rounded-lg border border-border bg-card/40 p-3 text-foreground">
              <Progression
                rounds={data.constructorProgression.map((p) => p.round)}
                lines={consLines}
              />
            </div>
          </section>
        </div>
      ) : null}

      {view === "winners" ? (
        <section className="mt-5">
          <SectionHeading kicker="Round by round" title="Race winners" />
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {data.winnersByRound.map((r, i) => {
              const t = team(r.winnerTeam);
              return (
                <div
                  key={r.round}
                  className={`pw-ticker flex items-center gap-3 rounded-lg border border-border p-3 ${
                    r.winnerCode ? "bg-card/40" : "bg-card/20 opacity-60"
                  }`}
                  style={{
                    animationDelay: `${Math.min(i, 14) * 25}ms`,
                    borderLeft: `4px solid ${r.winnerCode ? t.color : "transparent"}`,
                  }}
                >
                  <span className="num w-8 text-[10px] uppercase text-muted-foreground">
                    R{r.round}
                  </span>
                  {r.winnerCode ? (
                    <DriverAvatar code={r.winnerCode} teamName={r.winnerTeam} size="sm" />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-black uppercase">{r.name}</span>
                    <span className="num text-[10px] text-muted-foreground">
                      {r.winnerCode ? t.name : "not yet run"}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <Link
        to="/method"
        className="num mt-8 inline-block text-[11px] font-bold uppercase text-primary"
      >
        How these numbers are derived →
      </Link>
    </SiteShell>
  );
}
