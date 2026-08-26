import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CloudRain, Database, ExternalLink, Flag, Gauge, Newspaper, Thermometer, Timer, Wind, Wrench } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { SectionHeading, SiteShell } from "@/components/site-shell";
import { CircuitMap } from "@/components/circuit-map";
import { countryTheme } from "@/data/country-theme";
import { team as teamOf } from "@/data/teams";
import { getRaceReports, getRaceWeek, getSeasonTelemetry } from "@/lib/f1.functions";
import { fmtDate, fmtNum, titleCase } from "@/lib/format";

const upgradeSources = [
  {
    name: "FIA Documents",
    role: "Official declarations",
    detail: "Race-week car presentation submissions and scrutineering files.",
    href: "https://www.fia.com/documents/championships/fia-formula-one-world-championship-14",
    icon: Database,
  },
  {
    name: "Formula1.com",
    role: "Official tech explainers",
    detail: "Readable summaries of team packages, goals and reported part changes.",
    href: "https://www.formula1.com/en/latest",
    icon: Newspaper,
  },
  {
    name: "The Race / Autosport",
    role: "Technical analysis",
    detail: "Part-by-part context, photos, practice impact and driver feedback.",
    href: "https://www.the-race.com/formula-1/",
    icon: Wrench,
  },
] as const;

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
          "Race Control: next-session countdown, qualifying projection, live championship standings and post-race telemetry reports for the 2026 Formula 1 season.",
      },
      { property: "og:title", content: "F1 InsightX — Race Control" },
      {
        property: "og:description",
        content:
          "Next-session countdown, qualifying projection, championship pulse and race reports.",
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
  const leader = data.drivers[0] ?? null;
  const runnerUp = data.drivers[1] ?? null;
  const teamLeader = data.constructors[0] ?? null;
  const teamSecond = data.constructors[1] ?? null;
  const reports = useSuspenseQuery(reportsQuery).data.reports;
  const latest = reports[0];

  const theme = countryTheme(rw?.circuit.country);
  const gpTitle = (rw?.raceName ?? "Grand Prix").replace(/grand prix/i, "").trim();

  return (
    <SiteShell>
      <div className="relative z-10">
        {/* Masthead */}
        <section className="relative overflow-hidden rounded-xl border border-white/15 bg-[#07110c] text-white shadow-[0_18px_80px_rgba(0,0,0,0.28)]">
          <img src="/images/race-control-hero.png" alt="Floodlit circuit at night" className="absolute inset-0 h-full w-full object-cover object-right opacity-70" />
          <div aria-hidden className="absolute inset-0 grid grid-cols-3 opacity-35">
            <span style={{ backgroundColor: "#008c45" }} />
            <span style={{ backgroundColor: "#f4f4f4" }} />
            <span style={{ backgroundColor: "#cd212a" }} />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(105deg,rgba(7,17,12,0.98)_0%,rgba(7,17,12,0.88)_45%,rgba(7,17,12,0.42)_100%)]"
          />
          <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-2">
            {theme.flag.map((col) => (
              <span key={col} className="flex-1" style={{ backgroundColor: col }} />
            ))}
          </div>
          <div
            aria-hidden
            className="absolute bottom-0 right-0 h-32 w-full bg-[linear-gradient(90deg,rgba(0,140,69,0.32),rgba(255,255,255,0.16),rgba(205,33,42,0.34))]"
          />

          <div className="rule-grid relative p-5 pt-7 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#07110c]">
                <Flag className="size-3" /> Next GP
              </span>
              <span
                className="num rounded-sm border border-white/25 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest"
                style={{
                  color: "#ffffff",
                  backgroundColor: "#008c45",
                }}
              >
                {theme.label}
              </span>
              <span className="num text-[11px] text-white/75">
                R{rw?.round ?? "—"} · {rw?.season ?? ""}
              </span>
              <span className="num text-[11px] text-white/75">
                {rw?.circuit.name}
                {rw?.circuit.country ? ` · ${rw.circuit.country}` : ""}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black uppercase italic leading-[0.95] tracking-tighter sm:text-6xl">
                  {gpTitle}{" "}
                  <span style={{ color: "#ff4d58" }}>Grand Prix</span>
                </h1>
                <div
                  aria-hidden
                  className="mt-3 flex h-1.5 max-w-40 overflow-hidden rounded-sm"
                >
                  {theme.flag.map((col) => (
                    <span key={col} className="flex-1" style={{ backgroundColor: col }} />
                  ))}
                </div>
                <p className="num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/78">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3.5 text-white" />
                    Lights out {rw?.scheduledAt ? fmtDate(rw.scheduledAt) : "TBC"}
                  </span>
                  {rw?.circuit.lengthKm != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="size-3.5 text-white" />
                      {rw.circuit.lengthKm.toFixed(3)} km lap
                    </span>
                  ) : null}
                  {rw?.archetype ? (
                    <span className="inline-flex items-center gap-1">
                      <Flag className="size-3.5 text-white" />
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
                      unit: "C",
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
                  <div
                    key={s.label}
                    className="flex min-h-[92px] flex-col justify-between rounded-lg border border-white/18 bg-black/24 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur transition-colors hover:bg-black/34"
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/76">
                      <span className="text-white">{s.icon}</span>
                      {s.label}
                    </span>
                    <span className="mt-2 flex items-baseline gap-1">
                      <span className="num text-xl font-bold text-white">{s.value}</span>
                      {s.unit ? <span className="text-xs font-bold text-white/70">{s.unit}</span> : null}
                    </span>
                    {s.note ? <span className="mt-1 text-[11px] text-white/68">{s.note}</span> : null}
                  </div>
                ))}
            </div>


            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to="/raceweek"
                className="bg-white px-4 py-2 text-xs font-black uppercase italic tracking-wide text-[#07110c] transition-colors hover:bg-[#e8f5ee]"
              >
                Open race week
              </Link>
              <Link
                to="/analysis"
                className="border border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase italic tracking-wide text-white backdrop-blur transition-colors hover:bg-white/18"
              >
                Latest report
              </Link>
            </div>
          </div>
        </section>

        {/* Circuit read + championship pulse */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <SectionHeading
              kicker="Circuit map"
              title={`${rw?.circuit.name ?? "Circuit"} sectors`}
              action={
                <Link to="/raceweek" className="text-[11px] font-bold uppercase text-primary">
                  Race week →
                </Link>
              }
            />
            <CircuitMap
              path={rw?.trackPath ?? null}
              circuitId={rw?.circuit.id}
              circuitName={rw?.circuit.name}
            />
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
            {leader ? (
              <>
                <p className="mt-1 text-sm font-bold uppercase">{leader.driverName}</p>
                <p className="num text-2xl font-bold">{leader.points}</p>
                {runnerUp ? (
                  <p className="num text-[11px] text-muted-foreground">
                    +{leader.points - runnerUp.points} over {runnerUp.driverName}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Standings are not available from the current data source.
              </p>
            )}
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

          {teamLeader && teamSecond ? (
            <p className="num mt-3 text-[11px] text-muted-foreground">
              Constructors' gap: {teamLeader.points - teamSecond.points} pts
            </p>
          ) : null}
        </section>
      </div>

      {/* Upgrade watch */}
      <section className="mt-12 overflow-hidden rounded-xl border border-border bg-card/45">
        <div className="rule-grid relative p-5 sm:p-6">
          <span className="pw-sweep pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
                  <Wrench className="size-3" />
                  Upgrade watch
                </span>
                <span className="label-xs">FIA first · editorial context after</span>
              </div>
              <h2 className="mt-3 text-2xl font-black uppercase italic tracking-tight sm:text-3xl">
                Track new F1 parts from official declarations
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Use FIA car presentation files as the raw feed, then enrich with F1.com,
                The Race, Autosport and Motorsport reporting for purpose, photos and impact.
              </p>
            </div>
            <div className="num border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-primary">
              Derivable: team · part · round · impact
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 lg:grid-cols-3">
            {upgradeSources.map((source, index) => {
              const Icon = source.icon;
              return (
                <a
                  key={source.name}
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="pw-ticker group border border-border bg-background/70 p-4 transition-colors hover:border-primary hover:bg-accent/40"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-9 place-items-center border border-border bg-card text-primary">
                      <Icon className="size-4" />
                    </span>
                    <ExternalLink className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <p className="mt-4 text-sm font-black uppercase italic">{source.name}</p>
                  <p className="label-xs mt-1">{source.role}</p>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{source.detail}</p>
                </a>
              );
            })}
          </div>

          <div className="relative mt-5 grid gap-2 sm:grid-cols-4">
            {["Upgrade count", "Affected area", "First race used", "Practice delta"].map((item) => (
              <span
                key={item}
                className="border border-border bg-card/50 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

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
