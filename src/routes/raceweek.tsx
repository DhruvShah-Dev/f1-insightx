import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Countdown } from "@/components/countdown";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { SectorLegend, TrackMap } from "@/components/track-map";
import { countryTheme } from "@/data/country-theme";
import { team } from "@/data/teams";
import { fmtDate, fmtDateTime, fmtDelta, fmtLapS, fmtNum, pct, titleCase } from "@/lib/format";
import { getRaceWeek } from "@/lib/f1.functions";

const raceWeekQuery = queryOptions({
  queryKey: ["race-week"],
  queryFn: () => getRaceWeek(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/raceweek")({
  loader: ({ context }) => context.queryClient.ensureQueryData(raceWeekQuery),
  head: () => ({
    meta: [
      { title: "Race Week — next F1 round pace, strategy and projections" },
      {
        name: "description",
        content:
          "Everything about the current F1 race week: circuit geometry with sector split, weather risk, driver readiness board, strategy windows, race projections and storylines for the current round.",
      },
      { property: "og:title", content: "F1 InsightX — Race Week" },
      {
        property: "og:description",
        content:
          "Circuit map, weather risk, readiness board, strategy windows and race projections for the next round.",
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
  const hasLongRun = data.drivers.some((d) => d.longRunS != null);
  const w = data.weather;

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
        <div className="relative grid gap-6 p-5 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <p className="label-xs">
              Round {data.round} · {data.season} · {theme.label}
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
              {data.raceName}
            </h1>
            <p className="num mt-1 text-xs text-muted-foreground">
              {data.circuit.name}
              {data.circuit.location ? ` · ${data.circuit.location}` : ""}
              {data.circuit.country ? `, ${data.circuit.country}` : ""}
              {data.sprintWeekend ? " · Sprint weekend" : ""}
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
              {w ? (
                <>
                  <Stat
                    label="Rain risk"
                    value={w.rainProb == null ? "—" : `${Math.round(w.rainProb * 100)}`}
                    unit={w.rainProb == null ? undefined : "%"}
                  />
                  <Stat
                    label="Track temp"
                    value={fmtNum(w.trackTempC, 1)}
                    unit="°C"
                    note={
                      w.trackTempVolatility == null
                        ? undefined
                        : `±${fmtNum(w.trackTempVolatility, 1)} volatility`
                    }
                  />
                  <Stat label="Wind" value={fmtNum(w.windMps, 1)} unit="m/s" />
                </>
              ) : null}
              <Stat
                label="Circuit type"
                value={titleCase(data.archetype)}
                note={data.strategyDifficulty ? `${data.strategyDifficulty} strategy load` : undefined}
              />
              <Stat
                label="Sessions"
                value={data.sprintWeekend ? "Sprint" : "Standard"}
                note={data.sprintWeekend ? "Sprint quali + sprint + quali" : "Three practices + quali"}
              />
              {data.circuit.lengthKm != null ? (
                <Stat label="Lap" value={fmtNum(data.circuit.lengthKm, 3)} unit="km" />
              ) : null}
            </div>
            {!w ? (
              <p className="num mt-3 text-[10px] text-muted-foreground">
                Weather model arrives closer to the weekend.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-baseline justify-between">
              <p className="label-xs">Circuit geometry</p>
              <p className="num text-[10px] text-muted-foreground">
                {data.trackPath ? "3 sectors · start/finish" : "layout unavailable"}
              </p>
            </div>
            <TrackMap path={data.trackPath} className="mx-auto mt-2 h-56 w-full" />
            <div className="mt-2">
              <SectorLegend />
            </div>
            {[data.circuit.overtakeDifficulty, data.circuit.highSpeedBias, data.circuit.degBias].some(
              (v) => v != null,
            ) ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
                {[
                  { k: "Overtake difficulty", v: fmtNum(data.circuit.overtakeDifficulty, 2) },
                  { k: "High-speed bias", v: fmtNum(data.circuit.highSpeedBias, 2) },
                  { k: "Deg bias", v: fmtNum(data.circuit.degBias, 2) },
                ].map((x) => (
                  <div key={x.k}>
                    <dt className="label-xs">{x.k}</dt>
                    <dd className="num text-sm font-bold">{x.v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="num mt-3 border-t border-border pt-3 text-[10px] text-muted-foreground">
                Sectors split by equal distance along the recorded racing line.
              </p>
            )}
          </div>
        </div>
      </section>

      {data.storylines.length ? (
        <section className="mt-10">
          <SectionHeading kicker="Race week" title="Storylines" />
          <div className="grid gap-3 md:grid-cols-2">
            {data.storylines.map((s) => (
              <article key={s.headline} className="rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="num rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase"
                    style={{
                      color: theme.accent,
                      backgroundColor: `color-mix(in oklab, ${theme.accent} 18%, transparent)`,
                    }}
                  >
                    {titleCase(s.type)}
                  </span>
                  {s.confidence ? <span className="label-xs">{s.confidence} confidence</span> : null}
                </div>
                <h3 className="mt-2 text-sm font-bold uppercase">{s.headline}</h3>
                {s.body ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                ) : null}
                {s.sourceUrl ? (
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="num mt-2 inline-block text-[10px] uppercase text-primary underline underline-offset-2"
                  >
                    {s.sourceTitle ?? "Source"}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12">
        <SectionHeading
          kicker="Readiness board"
          title="Driver form going in"
          action={
            data.strategyDifficulty ? (
              <span className="label-xs">Strategy difficulty · {data.strategyDifficulty}</span>
            ) : null
          }
        />
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-card/60">
              <tr>
                <th className="label-xs px-3 py-2">Proj</th>
                <th className="label-xs px-3 py-2">Driver</th>
                <th className="label-xs px-3 py-2">Team</th>
                <th className="label-xs px-3 py-2 text-right">One lap</th>
                <th className="label-xs px-3 py-2 text-right">Gap</th>
                {hasLongRun ? (
                  <th className="label-xs px-3 py-2 text-right">Long run</th>
                ) : null}
                <th className="label-xs px-3 py-2 text-right">Deg</th>
                <th className="label-xs px-3 py-2 text-right">Readiness</th>
                <th className="label-xs px-3 py-2 text-right">Conf</th>
              </tr>
            </thead>
            <tbody>
              {data.drivers.map((d) => {
                const t = team(d.team);
                return (
                  <tr key={d.driverId} className="border-t border-border/60 hover:bg-accent/40">
                    <td className="num px-3 py-2 text-xs text-muted-foreground">
                      {d.projectedFinish ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs font-bold uppercase">
                      <span
                        className="mr-2 inline-block h-3 w-0.5 align-middle"
                        style={{ backgroundColor: t.color }}
                      />
                      {d.name}
                    </td>
                    <td className="num px-3 py-2 text-[11px] text-muted-foreground">{t.name}</td>
                    <td className="num px-3 py-2 text-right text-xs">{fmtLapS(d.oneLapS)}</td>
                    <td className="num px-3 py-2 text-right text-xs text-muted-foreground">
                      {d.oneLapGapS == null ? "—" : fmtDelta(d.oneLapGapS)}
                    </td>
                    {hasLongRun ? (
                      <td className="num px-3 py-2 text-right text-xs">{fmtLapS(d.longRunS)}</td>
                    ) : null}
                    <td className="num px-3 py-2 text-right text-xs">{fmtNum(d.degS, 3)}</td>
                    <td className="num px-3 py-2 text-right text-xs">
                      {d.readiness == null ? "—" : pct(d.readiness)}
                    </td>
                    <td className="num px-3 py-2 text-right text-[11px] text-muted-foreground">
                      {d.confidence == null ? "—" : pct(d.confidence)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.drivers[0]?.summary ? (
          <p className="mt-2 text-xs text-muted-foreground">{data.drivers[0].summary}</p>
        ) : null}
      </section>

      {data.projections.length ? (
        <section className="mt-12">
          <SectionHeading kicker="Race projection" title="Finish bands" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.projections.slice(0, 6).map((p) => {
              const t = team(p.team);
              return (
                <div
                  key={p.code}
                  className="rounded-lg border border-border bg-card/50 p-3"
                  style={{ borderLeft: `4px solid ${t.color}` }}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-bold uppercase">{p.name}</p>
                    <span className="num text-lg font-black">P{p.projected ?? "—"}</span>
                  </div>
                  <p className="num mt-1 text-[11px] text-muted-foreground">
                    Band P{p.low ?? "—"}–P{p.high ?? "—"} · {t.name}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { k: "Win", v: p.winProb },
                      { k: "Podium", v: p.podiumProb },
                      { k: "Conf", v: p.confidence },
                    ].map((x) => (
                      <div key={x.k}>
                        <p className="label-xs">{x.k}</p>
                        <p className="num text-sm font-bold">{x.v == null ? "—" : pct(x.v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {data.strategy.length ? (
        <section className="mt-12">
          <SectionHeading kicker="Strategy" title="Recommended windows" />
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-card/60">
                <tr>
                  <th className="label-xs px-3 py-2">Driver</th>
                  <th className="label-xs px-3 py-2 text-right">Stops</th>
                  <th className="label-xs px-3 py-2">Compounds</th>
                  <th className="label-xs px-3 py-2">Pit window</th>
                  <th className="label-xs px-3 py-2">Deg risk</th>
                  <th className="label-xs px-3 py-2 text-right">Conf</th>
                </tr>
              </thead>
              <tbody>
                {data.strategy.map((s) => (
                  <tr key={s.driverId} className="border-t border-border/60 hover:bg-accent/40">
                    <td className="px-3 py-2 text-xs font-bold uppercase">
                      <span
                        className="mr-2 inline-block h-3 w-0.5 align-middle"
                        style={{ backgroundColor: team(s.team).color }}
                      />
                      {s.name}
                    </td>
                    <td className="num px-3 py-2 text-right text-xs">{s.stops ?? "—"}</td>
                    <td className="num px-3 py-2 text-[11px] uppercase text-muted-foreground">
                      {[s.primary, s.secondary].filter(Boolean).join(" → ") || "—"}
                    </td>
                    <td className="num px-3 py-2 text-xs">
                      {s.windowStart == null ? "—" : `L${s.windowStart}–L${s.windowEnd ?? "?"}`}
                    </td>
                    <td className="num px-3 py-2 text-[11px] uppercase text-muted-foreground">
                      {s.degRisk ?? "—"}
                    </td>
                    <td className="num px-3 py-2 text-right text-xs">
                      {s.confidence == null ? "—" : pct(s.confidence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                          {c.readiness == null ? "—" : pct(c.readiness)}
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
              Session-by-session practice timing is not ingested for this weekend, so the board above
              is built from season form signals rather than live FP1–FP3 laps. Race start time is
              the scheduled value stored with the round
              {data.lastCompleted?.name
                ? `; results are complete through ${data.lastCompleted.name}`
                : ""}
              .
            </p>
            <Link
              to="/method"
              className="mt-3 inline-block text-[11px] font-bold uppercase text-primary"
            >
              Model limits →
            </Link>
          </div>
        </section>
      </div>

      <p className="num mt-8 text-[10px] text-muted-foreground">
        Scheduled {data.scheduledAt ? fmtDate(data.scheduledAt) : "TBC"} · circuit id{" "}
        {data.circuit.id}
      </p>
    </SiteShell>
  );
}
