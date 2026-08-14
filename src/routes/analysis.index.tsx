import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SectionHeading, SiteShell, Stat } from "@/components/site-shell";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { team } from "@/data/teams";
import { fmtDate } from "@/lib/format";
import { getWeekendIndex } from "@/lib/f1.functions";

const indexQuery = queryOptions({
  queryKey: ["weekend-index"],
  queryFn: () => getWeekendIndex({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/analysis/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(indexQuery),
  head: () => ({
    meta: [
      { title: "Race weekend analysis — 2026 F1 qualifying, sprint and race breakdowns" },
      {
        name: "description",
        content:
          "Every analysed 2026 F1 weekend: qualifying segments, sprint results, race classification, tyre strategy, pit windows and lap-level pace, all from stored session data.",
      },
      { property: "og:title", content: "2026 F1 weekend analysis" },
      {
        property: "og:description",
        content: "Qualifying, sprint and race breakdowns for every analysed round of 2026.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell>
      <p role="alert" className="text-sm text-destructive">
        Analysis index unavailable: {error.message}
      </p>
    </SiteShell>
  ),
  component: AnalysisIndex,
});

type Filter = "all" | "sprint" | "pending";

function AnalysisIndex() {
  const { data } = useSuspenseQuery(indexQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [teamKey, setTeamKey] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const all = useMemo(() => [...data.weekends].sort((a, b) => a.round - b.round), [data.weekends]);
  const analysed = useMemo(() => all.filter((w) => w.hasRace), [all]);

  const wins = useMemo(() => {
    const m = new Map<string, { key: string; name: string; color: string; n: number }>();
    for (const w of analysed) {
      const t = team(w.winnerTeam);
      const cur = m.get(t.key) ?? { key: t.key, name: t.name, color: t.color, n: 0 };
      cur.n += 1;
      m.set(t.key, cur);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [analysed]);

  const rail = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((w) => {
      if (filter === "sprint" && !w.hasSprint) return false;
      if (filter === "pending" && w.hasRace) return false;
      if (teamKey && team(w.winnerTeam).key !== teamKey) return false;
      if (!needle) return true;
      return `${w.name} ${w.circuit}`.toLowerCase().includes(needle);
    });
  }, [all, filter, teamKey, q]);

  const [activeRound, setActiveRound] = useState<number | null>(
    analysed.length ? analysed[analysed.length - 1]!.round : null,
  );
  const active = rail.find((w) => w.round === activeRound) ?? rail.find((w) => w.hasRace) ?? rail[0];
  const activeTeam = team(active?.winnerTeam);

  const maxWins = Math.max(1, ...wins.map((w) => w.n));

  return (
    <SiteShell>
      <section className="relative overflow-hidden rounded-xl border border-border bg-card/40 p-5">
        <span className="pw-drift pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
        <span
          className="pw-glow pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/25 blur-3xl"
          aria-hidden
        />
        <span className="pw-sweep pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative">
          <p className="label-xs">{data.season} season · session data</p>
          <h1 className="mt-1 text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
            Weekend analysis
          </h1>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Reports" value={String(analysed.length)} note="race weekends analysed" />
            <Stat
              label="Sprints"
              value={String(all.filter((w) => w.hasSprint).length)}
              note="sprint formats stored"
            />
            <Stat label="Winners" value={String(new Set(analysed.map((w) => w.winnerCode)).size)} />
            <Stat
              label="Remaining"
              value={String(all.length - analysed.length)}
              note="rounds not yet analysed"
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading
          kicker="Pick a round"
          title="Season rail"
          action={
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search GP / circuit"
              aria-label="Search weekends"
              className="num w-40 rounded border border-border bg-background/60 px-2 py-1 text-[11px] outline-none focus:border-primary sm:w-52"
            />
          }
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { k: "all", l: "All rounds" },
              { k: "sprint", l: "Sprint" },
              { k: "pending", l: "Not analysed" },
            ] as { k: Filter; l: string }[]
          ).map((f) => (
            <button
              key={f.k}
              type="button"
              onClick={() => setFilter(f.k)}
              aria-pressed={filter === f.k}
              className={`num rounded-sm border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${
                filter === f.k
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.l}
            </button>
          ))}
          {teamKey ? (
            <button
              type="button"
              onClick={() => setTeamKey(null)}
              className="num rounded-sm border border-primary/60 px-2.5 py-1 text-[10px] font-black uppercase text-primary"
            >
              Clear team ×
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-2">
          {rail.map((w) => {
            const t = team(w.winnerTeam);
            const on = active?.round === w.round;
            return (
              <button
                key={w.raceId}
                type="button"
                onClick={() => setActiveRound(w.round)}
                aria-pressed={on}
                title={w.name}
                className={`num shrink-0 rounded-md border px-3 py-2 text-left transition-all ${
                  on ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                } ${w.hasRace ? "" : "opacity-50"}`}
                style={{ borderBottom: `3px solid ${w.hasRace ? t.color : "transparent"}` }}
              >
                <span className="block text-[9px] uppercase text-muted-foreground">R{w.round}</span>
                <span className="block text-[11px] font-black uppercase">
                  {w.circuit.split(" ")[0]}
                </span>
              </button>
            );
          })}
          {rail.length === 0 ? (
            <p className="num py-4 text-xs text-muted-foreground">No round matches those filters.</p>
          ) : null}
        </div>
      </section>

      {active ? (
        <section
          key={active.raceId}
          className="pw-flip-in mt-4 overflow-hidden rounded-xl border border-border bg-card/50"
          style={{ borderTop: `3px solid ${activeTeam.color}` }}
        >
          <div className="grid gap-5 p-5 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <p className="label-xs">
                Round {active.round} · {active.scheduledAt ? fmtDate(active.scheduledAt) : "TBC"}
              </p>
              <h2 className="mt-1 text-2xl font-black uppercase italic tracking-tighter sm:text-3xl">
                {active.name}
              </h2>
              <p className="num mt-1 text-[11px] text-muted-foreground">{active.circuit}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  { k: "Quali", on: active.hasQuali },
                  { k: "Sprint", on: active.hasSprint },
                  { k: "Race", on: active.hasRace },
                ].map((x) => (
                  <span
                    key={x.k}
                    className={`num rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                      x.on
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground line-through"
                    }`}
                  >
                    {x.k}
                  </span>
                ))}
                {active.resultsOnly ? (
                  <span className="num rounded border border-border bg-card/60 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    Results only · no telemetry
                  </span>
                ) : null}
              </div>


              {active.story ? (
                <p className="mt-4 line-clamp-3 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  {active.story}
                </p>
              ) : null}

              {active.hasRace && active.slug ? (
                <Link
                  to="/analysis/$slug"
                  params={{ slug: active.slug }}
                  className="num mt-4 inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.03]"
                >
                  Open full report →
                </Link>
              ) : (
                <p className="num mt-4 text-[11px] text-muted-foreground">
                  Not analysed yet — no stored session data.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-background/40 p-4">
              {active.hasRace ? (
                <>
                  <p className="label-xs">Winner</p>
                  <div className="mt-2 flex items-center gap-3">
                    <DriverAvatar
                      code={active.winnerCode ?? "—"}
                      teamName={active.winnerTeam}
                      size="lg"
                    />
                    <div>
                      <p className="text-sm font-black uppercase italic">
                        {active.winnerName ?? active.winnerCode ?? "—"}
                      </p>
                      <TeamBadge teamName={active.winnerTeam} />
                    </div>
                  </div>
                  {active.podium.length ? (
                    <div className="mt-4 space-y-1">
                      <p className="label-xs">Podium</p>
                      {active.podium.map((p, i) => (
                        <div key={p} className="flex items-center gap-2">
                          <span className="num w-4 text-[10px] text-muted-foreground">P{i + 1}</span>
                          <span
                            className="h-2.5 rounded-sm bg-primary"
                            style={{ width: `${[64, 44, 28][i] ?? 20}%`, opacity: 1 - i * 0.25 }}
                          />
                          <span className="num text-[11px] font-black uppercase">{p}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="num text-[11px] text-muted-foreground">
                  Awaiting session data for this round.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {wins.length ? (
        <section className="mt-10">
          <SectionHeading kicker="Tap to filter the rail" title="Wins by team" />
          <div className="space-y-1.5">
            {wins.map((t, i) => {
              const on = teamKey === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTeamKey(on ? null : t.key)}
                  aria-pressed={on}
                  className={`pw-ticker flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors ${
                    on ? "bg-accent/50" : "hover:bg-accent/30"
                  }`}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                >
                  <span className="num w-24 shrink-0 text-[11px] font-black uppercase">
                    {t.name}
                  </span>
                  <span className="relative h-4 flex-1 overflow-hidden rounded-sm bg-secondary/50">
                    <span
                      className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500"
                      style={{ width: `${(t.n / maxWins) * 100}%`, backgroundColor: t.color }}
                    />
                  </span>
                  <span className="num w-6 text-right text-[11px] font-bold">{t.n}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </SiteShell>
  );
}
