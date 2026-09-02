import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  CalendarClock,
  ChevronRight,
  Circle,
  ClipboardList,
  Crosshair,
  Eye,
  Flag,
  Gauge,
  Search,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { SiteShell } from "@/components/site-shell";
import { countryForRace, countryTheme } from "@/data/country-theme";
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
      { title: "Analysis 2026 - race reviews and weekend reports" },
      {
        name: "description",
        content:
          "Browse 2026 Formula 1 race reviews by weekend with winners, podiums, strategy notes and stored session reports.",
      },
      { property: "og:title", content: "Analysis 2026 - F1 InsightX" },
      {
        property: "og:description",
        content: "Pick a weekend and open the race review that matters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShell fullWidth>
      <div className="-mx-5 -my-8 min-h-screen bg-[#090b0f] p-5 text-[#f6f3ea]">
        <p
          role="alert"
          className="border border-[#e8002d] bg-[#151922] p-4 text-sm font-bold text-[#ff6b7a]"
        >
          Analysis index unavailable: {error.message}
        </p>
      </div>
    </SiteShell>
  ),
  component: AnalysisIndex,
});

type WeekendIndex = NonNullable<Awaited<ReturnType<typeof getWeekendIndex>>>;
type Weekend = WeekendIndex["weekends"][number];
type Filter = "all" | "reports" | "sprint" | "pending";

const filterOptions: Array<{ key: Filter; label: string; icon: LucideIcon }> = [
  { key: "all", label: "All", icon: Circle },
  { key: "reports", label: "Reports", icon: ClipboardList },
  { key: "sprint", label: "Sprint", icon: Gauge },
  { key: "pending", label: "Pending", icon: CalendarClock },
];

function AnalysisIndex() {
  const { data } = useSuspenseQuery(indexQuery);
  const [filter, setFilter] = useState<Filter>("reports");
  const [query, setQuery] = useState("");

  const weekends = useMemo(
    () => [...data.weekends].sort((a, b) => a.round - b.round),
    [data.weekends],
  );
  const analysed = useMemo(() => weekends.filter((weekend) => weekend.hasRace), [weekends]);
  const latestAnalysed = analysed[analysed.length - 1] ?? weekends[0];
  const [activeRaceId, setActiveRaceId] = useState<string | null>(latestAnalysed?.raceId ?? null);

  const visibleWeekends = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return weekends.filter((weekend) => {
      if (filter === "reports" && !weekend.hasRace) return false;
      if (filter === "sprint" && !weekend.hasSprint) return false;
      if (filter === "pending" && weekend.hasRace) return false;
      if (!needle) return true;
      return `${weekend.name} ${weekend.circuit} ${weekend.winnerCode ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, query, weekends]);

  const active =
    visibleWeekends.find((weekend) => weekend.raceId === activeRaceId) ??
    visibleWeekends.find((weekend) => weekend.hasRace) ??
    visibleWeekends[0] ??
    latestAnalysed;

  const teamWins = useMemo(() => {
    const wins = new Map<string, { key: string; name: string; color: string; wins: number }>();
    for (const weekend of analysed) {
      const t = team(weekend.winnerTeam);
      const current = wins.get(t.key) ?? { key: t.key, name: t.name, color: t.color, wins: 0 };
      current.wins += 1;
      wins.set(t.key, current);
    }
    return [...wins.values()].sort((a, b) => b.wins - a.wins);
  }, [analysed]);

  const winnerCount = new Set(analysed.map((weekend) => weekend.winnerCode).filter(Boolean)).size;
  const sprintCount = weekends.filter((weekend) => weekend.hasSprint).length;
  const pendingCount = weekends.filter((weekend) => !weekend.hasRace).length;
  const activeTheme = active
    ? countryTheme(
        countryForRace({
          circuitId: active.circuitId,
          circuit: active.circuit,
          raceName: active.name,
        }),
      )
    : null;
  const activeColor = activeTheme?.accent ?? "#e8002d";

  return (
    <SiteShell fullWidth>
      <div className="-mx-5 -my-8 min-h-screen bg-[#090b0f] text-[#f6f3ea]">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-8 px-5 py-8 lg:px-8">
          <section className="grid min-h-[460px] overflow-hidden border border-[#2a303a] bg-[#11151c] lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative min-h-[320px] bg-[#090b0f]">
              <img
                src="/images/raceweek-pitlane-italy.png"
                alt="Formula 1 pit lane"
                className="h-full min-h-[320px] w-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 grid grid-cols-3 border-t border-[#2a303a] bg-[#11151c]">
                <HeroMetric icon={ClipboardList} label="Reports" value={String(analysed.length)} />
                <HeroMetric icon={Gauge} label="Sprints" value={String(sprintCount)} />
                <HeroMetric icon={Trophy} label="Winners" value={String(winnerCount)} />
              </div>
            </div>

            <div className="flex flex-col justify-between gap-8 p-5 sm:p-8 lg:p-10">
              <div className="space-y-5">
                <div className="inline-flex w-fit items-center gap-2 bg-[#f6f3ea] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#090b0f]">
                  <Activity className="size-3.5" style={{ color: activeColor }} />
                  {data.season} Race Review
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest" style={{ color: activeColor }}>
                    Latest stored weekend
                  </p>
                  <h1 className="mt-3 text-5xl font-black uppercase italic leading-none sm:text-7xl lg:text-8xl">
                    Analysis
                  </h1>
                  <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-[#c6cbd3] sm:text-lg">
                    Pick a Grand Prix. See the winner, podium, strategy read and full race report.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Signal label="Pending" value={String(pendingCount)} />
                <Signal label="Selected" value={active ? `R${active.round}` : "None"} />
                <Signal label="Open" value={active?.hasRace ? "Ready" : "Waiting"} />
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
            <div className="min-w-0 space-y-5">
              <ControlBar filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />
              <Timeline
                weekends={visibleWeekends}
                active={active}
                onSelect={(weekend) => setActiveRaceId(weekend.raceId)}
              />
              <ReportBoard weekend={active} accent={activeColor} />
            </div>

            <aside className="min-w-0 space-y-5">
              <CoverageMatrix weekends={weekends} active={active} onSelect={(weekend) => setActiveRaceId(weekend.raceId)} />
              <TeamWins rows={teamWins} />
            </aside>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 border-b border-[#2a303a] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: activeColor }}>
                  Report shelf
                </p>
                <h2 className="text-3xl font-black uppercase italic leading-none sm:text-4xl">
                  Race Weekends
                </h2>
              </div>
              <p className="max-w-md text-sm font-semibold text-[#a9b0bb]">
                Top-level context stays here. Open a report for lap pace, tyres, pits and track status.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleWeekends.map((weekend, index) => (
                <ReportTile
                  key={weekend.raceId}
                  weekend={weekend}
                  active={active?.raceId === weekend.raceId}
                  delay={index * 25}
                  onSelect={() => setActiveRaceId(weekend.raceId)}
                />
              ))}
            </div>

            {visibleWeekends.length === 0 ? (
              <div className="border border-[#2a303a] bg-[#11151c] p-6 text-sm font-bold text-[#a9b0bb]">
                No weekend matches that filter.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </SiteShell>
  );
}

function HeroMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="border-r border-[#2a303a] p-3 last:border-r-0">
      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#9aa3ad]">
        <Icon className="size-3" />
        {label}
      </span>
      <span className="num mt-1 block text-xl font-black">{value}</span>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#2a303a] bg-[#0c1016] p-4">
      <span className="block text-[10px] font-black uppercase tracking-widest text-[#9aa3ad]">{label}</span>
      <span className="num mt-2 block text-xl font-black uppercase text-[#f6f3ea]">{value}</span>
    </div>
  );
}

function ControlBar({
  filter,
  onFilter,
  query,
  onQuery,
}: {
  filter: Filter;
  onFilter: (filter: Filter) => void;
  query: string;
  onQuery: (query: string) => void;
}) {
  return (
    <div className="home-section-enter flex flex-col gap-3 border border-[#2a303a] bg-[#11151c] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {filterOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onFilter(option.key)}
              aria-pressed={filter === option.key}
              className={`inline-flex items-center gap-1.5 border px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                filter === option.key
                  ? "border-[#f6f3ea] bg-[#f6f3ea] text-[#090b0f]"
                  : "border-[#2a303a] bg-[#0c1016] text-[#dfe5ec] hover:border-[#f6f3ea]"
              }`}
            >
              <Icon className="size-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>
      <label className="flex min-h-10 items-center gap-2 border border-[#2a303a] bg-[#0c1016] px-3">
        <Search className="size-4 text-[#9aa3ad]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search race, circuit, winner"
          aria-label="Search race, circuit, winner"
          className="min-w-0 bg-[#0c1016] text-sm font-bold text-[#f6f3ea] outline-none placeholder:text-[#9aa3ad] sm:w-64"
        />
      </label>
    </div>
  );
}

function Timeline({
  weekends,
  active,
  onSelect,
}: {
  weekends: Weekend[];
  active: Weekend | undefined;
  onSelect: (weekend: Weekend) => void;
}) {
  return (
    <div className="home-section-enter overflow-x-auto border border-[#2a303a] bg-[#11151c] p-3">
      <div className="flex min-w-max gap-2">
        {weekends.map((weekend) => {
          const selected = active?.raceId === weekend.raceId;
          const t = team(weekend.winnerTeam);
          const country = countryTheme(
            countryForRace({
              circuitId: weekend.circuitId,
              circuit: weekend.circuit,
              raceName: weekend.name,
            }),
          );
          return (
            <button
              key={weekend.raceId}
              type="button"
              onClick={() => onSelect(weekend)}
              aria-pressed={selected}
              className={`w-28 border p-3 text-left transition-transform duration-200 hover:-translate-y-0.5 ${
                selected
                  ? "border-[#f6f3ea] bg-[#f6f3ea] text-[#090b0f]"
                  : "border-[#2a303a] bg-[#0c1016] text-[#dfe5ec]"
              }`}
            >
              <span className="num block text-[10px] font-black uppercase" style={{ color: selected ? "#090b0f" : "#9aa3ad" }}>
                R{weekend.round}
              </span>
              <span className="mt-2 block truncate text-xs font-black uppercase">{weekend.circuit.split(" ")[0]}</span>
              <span className="mt-3 block h-1.5" style={{ backgroundColor: weekend.hasRace ? t.color : "#3a424d" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReportBoard({ weekend, accent }: { weekend: Weekend | undefined; accent: string }) {
  if (!weekend) {
    return (
      <div className="border border-[#2a303a] bg-[#11151c] p-6 text-sm font-bold text-[#a9b0bb]">
        Select a weekend to preview the report.
      </div>
    );
  }

  const winnerTeam = team(weekend.winnerTeam);

  return (
    <section className="home-section-enter grid overflow-hidden border border-[#2a303a] bg-[#11151c] lg:grid-cols-[1fr_0.82fr]">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num bg-[#f6f3ea] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#090b0f]">
            Round {weekend.round}
          </span>
          <span className="num border border-[#2a303a] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#dfe5ec]">
            {weekend.scheduledAt ? fmtDate(weekend.scheduledAt) : "TBC"}
          </span>
        </div>
        <h2 className="mt-4 text-4xl font-black uppercase italic leading-none sm:text-5xl">
          {weekend.name}
        </h2>
        <p className="num mt-2 text-xs font-bold uppercase tracking-widest text-[#a9b0bb]">{weekend.circuit}</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <SessionPill label="Quali" active={weekend.hasQuali} />
          <SessionPill label="Sprint" active={weekend.hasSprint} />
          <SessionPill label="Race" active={weekend.hasRace} />
        </div>

        {weekend.story ? (
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-[#c6cbd3]">{weekend.story}</p>
        ) : (
          <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-[#c6cbd3]">
            Report details will appear when the stored race analysis is available.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {weekend.hasRace && weekend.slug ? (
            <Link
              to="/analysis/$slug"
              params={{ slug: weekend.slug }}
              className="inline-flex min-h-11 items-center gap-2 bg-[#f6f3ea] px-4 text-[11px] font-black uppercase tracking-widest text-[#090b0f] transition-transform hover:-translate-y-0.5"
            >
              Open report
              <ChevronRight className="size-4" />
            </Link>
          ) : null}
          {weekend.resultsOnly ? (
            <span className="inline-flex min-h-11 items-center border border-[#2a303a] px-4 text-[11px] font-black uppercase tracking-widest text-[#dfe5ec]">
              Results only
            </span>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[#2a303a] bg-[#0c1016] p-5 sm:p-6 lg:border-l lg:border-t-0">
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: accent }}>
          Race result
        </p>
        {weekend.hasRace ? (
          <div className="mt-4 space-y-5">
            <div className="flex items-center gap-4">
              <DriverAvatar code={weekend.winnerCode ?? "TBD"} teamName={weekend.winnerTeam} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-2xl font-black uppercase italic">
                  {weekend.winnerName ?? weekend.winnerCode ?? "Winner TBD"}
                </p>
                <TeamBadge teamName={weekend.winnerTeam} showName />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#9aa3ad]">Podium</p>
              {weekend.podium.length ? (
                weekend.podium.slice(0, 3).map((driver, index) => (
                  <div key={`${driver}-${index}`} className="flex items-center gap-3">
                    <span className="num grid size-7 place-items-center bg-[#f6f3ea] text-[10px] font-black text-[#090b0f]">
                      P{index + 1}
                    </span>
                    <span className="h-2 flex-1 border border-[#2a303a] bg-[#151922]">
                      <span
                        className="block h-full"
                        style={{ width: `${100 - index * 24}%`, backgroundColor: index === 0 ? winnerTeam.color : accent }}
                      />
                    </span>
                    <span className="num w-12 text-right text-xs font-black uppercase">{driver}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm font-bold text-[#a9b0bb]">Podium not stored yet.</p>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <MiniFact label="Strategy" value={weekend.strategy ?? "Not stored"} icon={Crosshair} />
              <MiniFact label="Race shape" value={weekend.raceShape ?? "Not stored"} icon={Sparkles} />
            </div>
          </div>
        ) : (
          <div className="mt-4 grid min-h-56 place-items-center border border-[#2a303a] bg-[#11151c] p-6 text-center">
            <div>
              <CalendarClock className="mx-auto size-8 text-[#e8002d]" />
              <p className="mt-3 text-sm font-black uppercase">Awaiting report</p>
              <p className="mt-2 text-sm font-semibold text-[#a9b0bb]">No stored race analysis for this round yet.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SessionPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex min-h-10 items-center justify-center border px-3 text-[10px] font-black uppercase tracking-widest ${
        active
          ? "border-[#f6f3ea] bg-[#f6f3ea] text-[#090b0f]"
          : "border-[#2a303a] bg-[#0c1016] text-[#9aa3ad]"
      }`}
    >
      {label}
    </span>
  );
}

function MiniFact({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="border border-[#2a303a] bg-[#11151c] p-3">
      <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#9aa3ad]">
        <Icon className="size-3.5 text-[#e8002d]" />
        {label}
      </span>
      <span className="mt-2 block text-sm font-black uppercase leading-5">{value}</span>
    </div>
  );
}

function CoverageMatrix({
  weekends,
  active,
  onSelect,
}: {
  weekends: Weekend[];
  active: Weekend | undefined;
  onSelect: (weekend: Weekend) => void;
}) {
  return (
    <section className="home-section-enter border border-[#2a303a] bg-[#11151c] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-black uppercase italic">
          <Eye className="size-5 text-[#e8002d]" />
          Coverage
        </h2>
        <span className="num text-[10px] font-black uppercase tracking-widest text-[#9aa3ad]">
          Q / S / R
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
        {weekends.map((weekend) => (
          <button
            key={weekend.raceId}
            type="button"
            onClick={() => onSelect(weekend)}
            aria-pressed={active?.raceId === weekend.raceId}
            className={`border p-2 text-left transition-colors ${
              active?.raceId === weekend.raceId
                ? "border-[#f6f3ea] bg-[#f6f3ea] text-[#090b0f]"
                : "border-[#2a303a] bg-[#0c1016] text-[#dfe5ec] hover:border-[#f6f3ea]"
            }`}
          >
            <span className="num block text-[10px] font-black uppercase">R{weekend.round}</span>
            <span className="mt-1 flex gap-1">
              {[weekend.hasQuali, weekend.hasSprint, weekend.hasRace].map((isStored, index) => (
                <span
                  key={`${weekend.raceId}-${index}`}
                  className="h-2 flex-1"
                  style={{ backgroundColor: isStored ? team(weekend.winnerTeam).color : "#3a424d" }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TeamWins({ rows }: { rows: Array<{ key: string; name: string; color: string; wins: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.wins));

  return (
    <section className="home-section-enter border border-[#2a303a] bg-[#11151c] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-black uppercase italic">
          <Trophy className="size-5 text-[#e8002d]" />
          Wins By Team
        </h2>
        <span className="num text-[10px] font-black uppercase tracking-widest text-[#9aa3ad]">
          Race wins
        </span>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const width = Math.max(8, Math.round((row.wins / max) * 100));
          return (
            <div
              key={row.key}
              className="home-section-enter"
              style={{ animationDelay: `${index * 40}ms` } as CSSProperties}
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-black uppercase">{row.name}</span>
                <span className="num text-sm font-black">{row.wins}</span>
              </div>
              <div className="h-3 border border-[#2a303a] bg-[#0c1016]">
                <div className="h-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: row.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReportTile({
  weekend,
  active,
  delay,
  onSelect,
}: {
  weekend: Weekend;
  active: boolean;
  delay: number;
  onSelect: () => void;
}) {
  const t = team(weekend.winnerTeam);

  return (
    <div
      className={`home-section-enter group min-h-44 border p-4 text-left transition-transform duration-200 hover:-translate-y-1 ${
        active ? "border-[#f6f3ea] bg-[#f6f3ea] text-[#090b0f]" : "border-[#2a303a] bg-[#11151c] text-[#f6f3ea]"
      }`}
      style={{ animationDelay: `${delay}ms` } as CSSProperties}
    >
      <button type="button" onClick={onSelect} aria-pressed={active} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className="num text-[10px] font-black uppercase tracking-widest"
              style={{ color: active ? "#090b0f" : "#9aa3ad" }}
            >
              Round {weekend.round}
            </span>
            <h3 className="mt-2 line-clamp-2 text-xl font-black uppercase italic leading-none">
              {weekend.name}
            </h3>
          </div>
          <Flag className="size-5 shrink-0" style={{ color: weekend.hasRace ? t.color : "#3a424d" }} />
        </div>
        <p
          className={`num mt-3 truncate text-[11px] font-bold uppercase ${
            active ? "text-[#3a424d]" : "text-[#a9b0bb]"
          }`}
        >
          {weekend.circuit}
        </p>
      </button>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {weekend.hasRace && weekend.winnerCode ? (
            <DriverAvatar code={weekend.winnerCode} teamName={weekend.winnerTeam} size="sm" showCode={false} />
          ) : null}
          <span className="num text-xs font-black uppercase">
            {weekend.hasRace ? (weekend.winnerCode ?? "Result") : "Pending"}
          </span>
        </span>
        {weekend.hasRace && weekend.slug ? (
          <Link
            to="/analysis/$slug"
            params={{ slug: weekend.slug }}
            className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${
              active ? "text-[#090b0f]" : "text-[#f6f3ea]"
            }`}
          >
            Report
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
