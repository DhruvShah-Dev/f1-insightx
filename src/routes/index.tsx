import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CloudRain, Flag, Gauge, Thermometer, Timer, Trophy, Wind } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { StartLightRails } from "@/components/race-atmosphere";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { countryTheme } from "@/data/country-theme";
import { team as teamOf } from "@/data/teams";
import { getRaceReports, getRaceWeek, getSeasonTelemetry } from "@/lib/f1.functions";
import { fmtDate, fmtDelta, fmtLapS, fmtNum, pct, titleCase } from "@/lib/format";
import crowdImg from "@/assets/zandvoort-crowd.jpg";

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
      { title: "F1 InsightX — Race Control: predictions, pace and championship reads" },
      {
        name: "description",
        content:
          "Race Control: next-session countdown, qualifying projection with confidence, live championship standings and post-race telemetry reports for the 2026 Formula 1 season.",
      },
      { property: "og:title", content: "F1 InsightX — Race Control" },
      {
        property: "og:description",
        content:
          "Next-session countdown, qualifying projection with confidence, championship pulse and race reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell>
      <p role="alert" className="text-sm text-destructive">
        Race Control data unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  notFoundComponent: () => (
    <SiteShell>
      <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
    </SiteShell>
  ),
  component: RaceControl,
});

function RaceControl() {
  const { data } = useSuspenseQuery(seasonQuery);
  const rw = useSuspenseQuery(raceWeekQuery).data;
  const leader = data.drivers[0]!;
  const runnerUp = data.drivers[1]!;
  const teamLeader = data.constructors[0]!;
  const teamSecond = data.constructors[1]!;
  const reports = useSuspenseQuery(reportsQuery).data.reports;
  const latest = reports[0];

  const theme = countryTheme(rw?.circuit.country);
  const accent = theme.accent;
  const board = (rw?.drivers ?? [])
    .slice()
    .sort((a, b) => (a.oneLapS ?? 9e9) - (b.oneLapS ?? 9e9));
  const podium = board.slice(0, 3);
  const gpTitle = (rw?.raceName ?? "Grand Prix").replace(/grand prix/i, "").trim();

  return (
    <SiteShell>
      <StartLightRails />

      <div className="relative z-10">
        {/* Masthead */}
        <section className="relative overflow-hidden rounded-xl border border-border">
          <img
            src={crowdImg}
            alt="Floodlit grandstand and banked asphalt at a Formula 1 circuit"
            width={1920}
            height={912}
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(105deg, color-mix(in oklab, var(--background) 94%, transparent) 0%, color-mix(in oklab, var(--background) 78%, transparent) 55%, color-mix(in oklab, ${accent} 14%, transparent) 100%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5"
            style={{
              background: `linear-gradient(180deg, ${theme.flag
                .map((c, i) => `${c} ${(i * 100) / theme.flag.length}%, ${c} ${((i + 1) * 100) / theme.flag.length}%`)
                .join(", ")})`,
            }}
          />

          <div className="rule-grid relative p-5 pl-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
                <Flag className="size-3" /> Next GP
              </span>
              <span
                className="num rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                style={{
                  color: accent,
                  backgroundColor: `color-mix(in oklab, ${accent} 15%, transparent)`,
                }}
              >
                {theme.label}
              </span>
              <span className="num text-[11px] text-muted-foreground">
                R{rw?.round ?? "—"} · {rw?.season ?? ""}
              </span>
              <span className="num text-[11px] text-muted-foreground">
                {rw?.circuit.name}
                {rw?.circuit.country ? ` · ${rw.circuit.country}` : ""}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black uppercase italic leading-[0.95] tracking-tighter sm:text-6xl">
                  {gpTitle}{" "}
                  <span style={{ color: accent }}>Grand Prix</span>
                </h1>
                <div
                  aria-hidden
                  className="mt-3 flex h-1.5 max-w-40 overflow-hidden rounded-sm"
                >
                  {theme.flag.map((col) => (
                    <span key={col} className="flex-1" style={{ backgroundColor: col }} />
                  ))}
                </div>
                <p className="num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3.5 text-primary" />
                    Lights out {rw?.scheduledAt ? fmtDate(rw.scheduledAt) : "TBC"}
                  </span>
                  {rw?.circuit.lengthKm != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="size-3.5 text-primary" />
                      {rw.circuit.lengthKm.toFixed(3)} km lap
                    </span>
                  ) : null}
                  {rw?.archetype ? (
                    <span className="inline-flex items-center gap-1">
                      <Flag className="size-3.5 text-primary" />
                      {titleCase(rw.archetype)}
                    </span>
                  ) : null}
                </p>
              </div>
              {rw?.scheduledAt ? (
                <Countdown targetISO={rw.scheduledAt} label="Lights out in" />
              ) : null}
            </div>

            {/* Instrument bar — only what the dataset actually holds for this round */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                rw?.weather?.rainProb != null
                  ? {
                      label: "Rain probability",
                      value: String(
                        Math.round(rw.weather.rainProb * (rw.weather.rainProb <= 1 ? 100 : 1)),
                      ),
                      unit: "%",
                      note: "Race window",
                      icon: <CloudRain className="size-3.5" />,
                    }
                  : null,
                rw?.weather?.trackTempC != null
                  ? {
                      label: "Track temp",
                      value: fmtNum(rw.weather.trackTempC, 1),
                      unit: "°C",
                      icon: <Thermometer className="size-3.5" />,
                    }
                  : null,
                rw?.weather?.windMps != null
                  ? {
                      label: "Wind",
                      value: fmtNum(rw.weather.windMps, 1),
                      unit: "m/s",
                      icon: <Wind className="size-3.5" />,
                    }
                  : null,
                rw?.circuit.highSpeedBias != null
                  ? {
                      label: "High-speed bias",
                      value: fmtNum(rw.circuit.highSpeedBias, 2),
                      note: "Circuit character",
                      icon: <Gauge className="size-3.5" />,
                    }
                  : null,
                rw?.circuit.overtakeDifficulty != null
                  ? {
                      label: "Overtake difficulty",
                      value: fmtNum(rw.circuit.overtakeDifficulty, 2),
                      icon: <Flag className="size-3.5" />,
                    }
                  : null,
                rw?.circuit.degBias != null
                  ? {
                      label: "Tyre deg bias",
                      value: fmtNum(rw.circuit.degBias, 2),
                      icon: <Thermometer className="size-3.5" />,
                    }
                  : null,
                rw?.strategyDifficulty
                  ? {
                      label: "Strategy",
                      value: titleCase(rw.strategyDifficulty),
                      note: "Difficulty read",
                      icon: <Timer className="size-3.5" />,
                    }
                  : null,
                board.length
                  ? {
                      label: "Reference lap",
                      value: fmtLapS(board[0]!.oneLapS),
                      note: `${board[0]!.code} quickest`,
                      icon: <Gauge className="size-3.5" />,
                    }
                  : null,
                board.length > 1 && board[board.length - 1]!.oneLapGapS != null
                  ? {
                      label: "Field spread",
                      value: fmtNum(board[board.length - 1]!.oneLapGapS, 3),
                      unit: "s",
                      note: `${board.length} cars`,
                      icon: <Flag className="size-3.5" />,
                    }
                  : null,
                rw?.circuit.lengthKm != null
                  ? {
                      label: "Lap length",
                      value: fmtNum(rw.circuit.lengthKm, 3),
                      unit: "km",
                      icon: <Flag className="size-3.5" />,
                    }
                  : null,

              ]
                .filter((s): s is NonNullable<typeof s> => s != null)
                .slice(0, 5)
                .map((s) => (
                  <Stat
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    {...(s.unit ? { unit: s.unit } : {})}
                    {...(s.note ? { note: s.note } : {})}
                    icon={s.icon}
                  />
                ))}
            </div>


            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/raceweek"
                className="bg-primary px-4 py-2 text-xs font-black uppercase italic tracking-wide text-primary-foreground"
              >
                Open race week
              </Link>
              <Link
                to="/analysis"
                className="border border-border bg-background/60 px-4 py-2 text-xs font-black uppercase italic tracking-wide backdrop-blur hover:bg-accent"
              >
                Latest report
              </Link>
            </div>
          </div>
        </section>

        {/* Prediction read + championship pulse */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <SectionHeading
              kicker="One-lap pace board"
              title="The read"
              action={
                <Link to="/raceweek" className="text-[11px] font-bold uppercase text-primary">
                  Full tower →
                </Link>
              }
            />
            {board.length ? (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  {podium.map((d, i) => (
                    <div
                      key={d.driverId}
                      className="relative overflow-hidden rounded-lg border border-border bg-card/60 p-3 backdrop-blur"
                      style={{ borderLeft: `4px solid ${teamOf(d.team).color}` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="num flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                            P{i + 1}
                            {i === 0 ? <Trophy className="size-3.5 text-caution" /> : null}
                          </div>
                          <p className="mt-1 text-sm font-bold uppercase leading-tight">{d.name}</p>
                          <div className="mt-2">
                            <TeamBadge teamName={d.team} />
                          </div>
                        </div>
                        <DriverAvatar code={d.code} teamName={d.team} name={d.name} size="lg" />
                      </div>
                      <p className="num mt-2 text-lg font-bold">{fmtLapS(d.oneLapS)}</p>
                      <p className="num text-[11px] text-muted-foreground">
                        {i === 0 ? "reference" : fmtDelta(d.oneLapGapS)}
                      </p>
                      {d.confidence != null ? (
                        <div className="mt-3">
                          <div className="h-1 w-full bg-secondary">
                            <div
                              className="h-1"
                              style={{ width: pct(d.confidence), backgroundColor: accent }}
                            />
                          </div>
                          <p className="label-xs mt-1">Signal {pct(d.confidence)}</p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <table className="mt-4 w-full text-left">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="label-xs py-2">Pos</th>
                      <th className="label-xs py-2">Driver</th>
                      <th className="label-xs py-2 text-right">One lap</th>
                      <th className="label-xs py-2 text-right">Gap</th>
                      <th className="label-xs py-2 text-right">Long run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.slice(3, 12).map((d, i) => (
                      <tr key={d.driverId} className="border-b border-border/60 hover:bg-accent/40">
                        <td className="num py-2 text-xs text-muted-foreground">{i + 4}</td>
                        <td className="py-2 text-xs font-bold uppercase">
                          <span
                            className="mr-2 inline-block h-3 w-0.5 align-middle"
                            style={{ backgroundColor: teamOf(d.team).color }}
                          />
                          {d.name}
                        </td>
                        <td className="num py-2 text-right text-xs">{fmtLapS(d.oneLapS)}</td>
                        <td className="num py-2 text-right text-xs text-muted-foreground">
                          {fmtDelta(d.oneLapGapS)}
                        </td>
                        <td className="num py-2 text-right text-xs">{fmtLapS(d.longRunS)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="num text-xs text-muted-foreground">
                No practice pace board stored for this round yet.
              </p>
            )}
          </section>


        <section>
          <SectionHeading
            kicker="Championship pulse"
            title="Standings"
            action={
              <Link to="/championship" className="text-[11px] font-bold uppercase text-primary">
                Full tables →
              </Link>
            }
          />
          <div className="rounded-lg border border-border bg-card/50 p-4">
            <p className="label-xs">Drivers' lead · after R{data.standingsRound}</p>
            <p className="mt-1 text-sm font-bold uppercase">{leader.driverName}</p>
            <p className="num text-2xl font-bold">{leader.points}</p>
            <p className="num text-[11px] text-muted-foreground">
              +{leader.points - runnerUp.points} over {runnerUp.driverName}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {data.constructors.slice(0, 5).map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 bg-card/40 p-2"
                style={{ borderLeft: `4px solid ${teamOf(row.name).color}` }}
              >
                <span className="num w-4 text-xs text-muted-foreground">{row.position}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase">{teamOf(row.name).name}</p>
                  <p className="num text-[10px] text-muted-foreground">{row.wins} wins</p>
                </div>
                <span className="num text-xs font-bold">{row.points}</span>
              </div>
            ))}
          </div>

          <p className="num mt-3 text-[11px] text-muted-foreground">
            Constructors' gap: {teamLeader.points - teamSecond.points} pts
          </p>
        </section>
      </div>

      {/* Report rail */}
      <section className="mt-12">
        <SectionHeading
          kicker="Post-race telemetry"
          title="Recent reports"
          action={
            <Link to="/analysis" className="text-[11px] font-bold uppercase text-primary">
              All rounds →
            </Link>
          }
        />
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {reports.map((r) => (
            <Link
              key={r.slug}
              to="/analysis/$slug"
              params={{ slug: r.slug }}
              className="w-[280px] shrink-0 snap-start rounded-lg border border-border bg-card/50 p-4 transition-colors hover:border-primary"
              style={{ borderTop: `3px solid ${teamOf(r.winnerTeam).color}` }}
            >
              <p className="num text-[10px] text-muted-foreground">
                R{r.round} · {fmtDate(r.dateISO)}
              </p>
              <p className="mt-1 text-sm font-black uppercase italic">{r.name}</p>
              <p className="mt-2 text-xs font-bold uppercase">{r.winnerName}</p>
              <p className="num text-[11px] text-muted-foreground">
                {teamOf(r.winnerTeam).name}
                {r.strategy ? ` · ${r.strategy}` : ""}
              </p>
              {r.podium.length === 3 ? (
                <p className="num mt-2 text-[11px] text-muted-foreground">
                  Podium {r.podium.join(" · ")}
                </p>
              ) : null}
              <p className="mt-3 line-clamp-3 text-[11px] text-muted-foreground">
                {r.paceFactor ?? r.story ?? ""}
              </p>
              <p className="mt-3 text-[11px] font-bold uppercase text-primary">Read report →</p>
            </Link>
          ))}
        </div>
        {latest ? (
          <p className="num mt-2 text-[11px] text-muted-foreground">
            Latest: R{latest.round} {latest.name} — {latest.weather ?? latest.raceShape ?? ""}
          </p>
        ) : null}
        </section>
      </div>
    </SiteShell>

  );
}
