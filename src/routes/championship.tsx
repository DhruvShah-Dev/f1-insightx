import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Car,
  CircleOff,
  Crown,
  Eye,
  Flag,
  Gauge,
  Medal,
  Route as RouteIcon,
  Timer,
  Trophy,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { DriverAvatar, TeamBadge } from "@/components/driver-avatar";
import { SiteShell } from "@/components/site-shell";
import { team } from "@/data/teams";
import { getChampionship } from "@/lib/f1.functions";

const champQuery = queryOptions({
  queryKey: ["championship"],
  queryFn: () => getChampionship({ data: {} }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/championship")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(champQuery);
  },
  head: () => ({
    meta: [
      { title: "Championship 2026 - standings and season battles" },
      {
        name: "description",
        content:
          "Formula 1 driver and constructor standings with top-five championship battles for points, wins, podiums, laps, positions gained and DNFs.",
      },
      { property: "og:title", content: "Championship 2026 - F1 InsightX" },
      {
        property: "og:description",
        content: "Driver and constructor standings plus the key season battle boards.",
      },
      { property: "og:type", content: "article" },
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
          Standings unavailable: {error.message}
        </p>
      </div>
    </SiteShell>
  ),
  component: Championship,
});

type ChampionshipData = NonNullable<Awaited<ReturnType<typeof getChampionship>>>;
type Driver = ChampionshipData["drivers"][number];
type Constructor = ChampionshipData["constructors"][number];

type BattleRow = {
  id: string;
  label: string;
  code?: string;
  teamName: string;
  value: number;
  display: string;
  color: string;
  note?: string;
};

type Battle = {
  id: string;
  title: string;
  label: string;
  icon: LucideIcon;
  rows: BattleRow[];
  unavailable?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function whole(value: number | null | undefined) {
  return value == null ? "Not tracked" : numberFormatter.format(Math.round(value));
}

function valueOf(driver: Driver, key: keyof Driver) {
  const value = driver[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function driverRows(
  drivers: Driver[],
  key: keyof Driver,
  display: (value: number) => string = whole,
  note?: (driver: Driver) => string,
) {
  return drivers
    .map((driver) => {
      const value = valueOf(driver, key);
      if (value == null) return null;
      const t = team(driver.team);
      return {
        id: driver.driverId,
        label: driver.name,
        code: driver.code,
        teamName: driver.team,
        value,
        display: display(value),
        color: t.color,
        note: note?.(driver),
      } satisfies BattleRow;
    })
    .filter((row): row is BattleRow => row != null)
    .sort((a, b) => b.value - a.value);
}

function constructorRows(
  constructors: Constructor[],
  key: keyof Constructor,
  display: (value: number) => string = whole,
) {
  return constructors
    .map((constructor) => {
      const value = constructor[key];
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      const t = team(constructor.name);
      return {
        id: constructor.id,
        label: t.name,
        teamName: constructor.name,
        value,
        display: display(value),
        color: t.color,
      } satisfies BattleRow;
    })
    .filter((row): row is BattleRow => row != null)
    .sort((a, b) => b.value - a.value);
}

function buildBattles(data: ChampionshipData): Battle[] {
  return [
    {
      id: "driver-points",
      title: "Drivers",
      label: "Points",
      icon: Trophy,
      rows: driverRows(data.drivers, "points"),
    },
    {
      id: "constructor-points",
      title: "Constructors",
      label: "Points",
      icon: Users,
      rows: constructorRows(data.constructors, "points"),
    },
    {
      id: "wins",
      title: "Race Wins",
      label: "Wins",
      icon: Crown,
      rows: driverRows(data.drivers, "wins"),
    },
    {
      id: "constructor-wins",
      title: "Team Wins",
      label: "Wins",
      icon: Car,
      rows: constructorRows(data.constructors, "wins"),
    },
    {
      id: "podiums",
      title: "Podiums",
      label: "Podiums",
      icon: Medal,
      rows: driverRows(data.drivers, "podiums"),
    },
    {
      id: "top10",
      title: "Points Finishes",
      label: "Top 10s",
      icon: Flag,
      rows: driverRows(data.drivers, "top10"),
    },
    {
      id: "sprint-points",
      title: "Sprint Score",
      label: "Points",
      icon: Zap,
      rows: driverRows(data.drivers, "sprintPoints"),
    },
    {
      id: "most-laps",
      title: "Most Laps",
      label: "Completed",
      icon: RouteIcon,
      rows: driverRows(data.drivers, "lapsCompleted"),
    },
    {
      id: "positions-gained",
      title: "Positions Gained",
      label: "Places",
      icon: ArrowUp,
      rows: driverRows(data.drivers, "positionsGained", whole, (driver) =>
        driver.netPositions > 0
          ? `Net +${whole(driver.netPositions)}`
          : `Net ${whole(driver.netPositions)}`,
      ),
    },
    {
      id: "starts",
      title: "Race Starts",
      label: "Starts",
      icon: Timer,
      rows: driverRows(data.drivers, "starts"),
    },
    {
      id: "dnfs",
      title: "DNFs",
      label: "DNFs",
      icon: CircleOff,
      rows: driverRows(data.drivers, "dnf"),
    },
    {
      id: "positions-lost",
      title: "Positions Lost",
      label: "Places",
      icon: ArrowDown,
      rows: driverRows(data.drivers, "positionsLost"),
    },
    {
      id: "laps-led",
      title: "Laps Led",
      label: "Not tracked",
      icon: Gauge,
      rows: [],
      unavailable: "Not tracked in the current race dataset.",
    },
    {
      id: "overtakes",
      title: "Overtakes",
      label: "Not tracked",
      icon: BarChart3,
      rows: [],
      unavailable: "Exact overtake counts are not in the current race dataset.",
    },
  ];
}

function Championship() {
  const { data } = useSuspenseQuery(champQuery);
  const [activeBattle, setActiveBattle] = useState<Battle | null>(null);

  const battles = useMemo(() => buildBattles(data), [data]);
  const driverLeader = data.drivers[0];
  const constructorLeader = data.constructors[0];
  const trackedBattles = battles.filter((battle) => battle.rows.length > 0).length;

  return (
    <SiteShell fullWidth>
      <div className="-mx-5 -my-8 min-h-screen bg-[#090b0f] text-[#f6f3ea]">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-5 py-8 lg:px-8">
          <section className="grid min-h-[430px] overflow-hidden border border-[#2a303a] bg-[#11151c] lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col justify-between gap-8 p-5 sm:p-8 lg:p-10">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 border border-[#f6f3ea] bg-[#f6f3ea] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#090b0f]">
                  <Trophy className="size-3.5 text-[#e8002d]" />
                  {data.season} Season
                </div>
                <div className="max-w-4xl">
                  <p className="text-xs font-black uppercase tracking-widest text-[#e8002d]">
                    Complete through round {data.round}
                  </p>
                  <h1 className="mt-3 text-4xl font-black uppercase italic leading-none min-[430px]:text-5xl sm:text-7xl lg:text-8xl">
                    Championship Battles
                  </h1>
                  <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-[#c6cbd3] sm:text-lg">
                    The season table rebuilt as live leaderboards: points, wins, podiums, laps,
                    places gained and reliability.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroStat
                  icon={Crown}
                  label="Driver leader"
                  value={driverLeader?.code ?? "TBD"}
                  note={`${whole(driverLeader?.points)} pts`}
                />
                <HeroStat
                  icon={Users}
                  label="Team leader"
                  value={constructorLeader ? team(constructorLeader.name).short : "TBD"}
                  note={`${whole(constructorLeader?.points)} pts`}
                />
                <HeroStat icon={Eye} label="Battle boards" value={whole(trackedBattles)} note="Top 5 shown" />
              </div>
            </div>

            <div className="relative min-h-[320px] border-t border-[#2a303a] bg-[#090b0f] lg:border-l lg:border-t-0">
              <img
                src="/images/race-control-hero.png"
                alt="Race control desk"
                className="h-full min-h-[320px] w-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 grid grid-cols-3 border-t border-[#2a303a] bg-[#11151c] text-[#f6f3ea]">
                <TrackSignal label="Mode" value="Top 5" />
                <TrackSignal label="Lists" value="Tap cards" />
                <TrackSignal label="Surface" value="Solid" />
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <StandingsStrip
              title="Driver Standings"
              icon={Trophy}
              rows={data.drivers.slice(0, 5).map((driver) => ({
                key: driver.driverId,
                rank: driver.position,
                label: driver.name,
                code: driver.code,
                teamName: driver.team,
                value: `${whole(driver.points)} pts`,
                color: team(driver.team).color,
              }))}
            />
            <StandingsStrip
              title="Constructor Standings"
              icon={Users}
              rows={data.constructors.slice(0, 5).map((constructor) => {
                const t = team(constructor.name);
                return {
                  key: constructor.id,
                  rank: constructor.position,
                  label: t.name,
                  teamName: constructor.name,
                  value: `${whole(constructor.points)} pts`,
                  color: t.color,
                };
              })}
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 border-b border-[#2a303a] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#e8002d]">
                  Season boards
                </p>
                <h2 className="text-3xl font-black uppercase italic leading-none sm:text-4xl">
                  Every Fight That Matters
                </h2>
              </div>
              <p className="max-w-md text-sm font-semibold text-[#a9b0bb]">
                Each board shows the top five. Open a board for the complete ranked list.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {battles.map((battle, index) => (
                <BattleCard
                  key={battle.id}
                  battle={battle}
                  delay={index * 35}
                  onOpen={() => (battle.rows.length ? setActiveBattle(battle) : undefined)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {activeBattle
        ? createPortal(
            <BattleDialog battle={activeBattle} onClose={() => setActiveBattle(null)} />,
            document.body,
          )
        : null}
    </SiteShell>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border border-[#2a303a] bg-[#0c1016] p-4">
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#9aa3ad]">
        <Icon className="size-4 text-[#e8002d]" />
        {label}
      </span>
      <span className="num mt-3 block text-2xl font-black uppercase text-[#f6f3ea]">{value}</span>
      <span className="num mt-1 block text-xs font-bold uppercase text-[#ff6b7a]">{note}</span>
    </div>
  );
}

function TrackSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-[#2a303a] p-3 last:border-r-0">
      <span className="block text-[9px] font-black uppercase tracking-widest text-[#9aa3ad]">{label}</span>
      <span className="num mt-1 block text-sm font-black uppercase">{value}</span>
    </div>
  );
}

function StandingsStrip({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: LucideIcon;
  rows: Array<{
    key: string;
    rank: number;
    label: string;
    code?: string;
    teamName: string;
    value: string;
    color: string;
  }>;
}) {
  return (
    <div className="home-section-enter border border-[#2a303a] bg-[#11151c] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-black uppercase italic">
          <Icon className="size-5 text-[#e8002d]" />
          {title}
        </h2>
        <span className="border border-[#2a303a] bg-[#0c1016] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#dfe5ec]">
          Top 5
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 border border-[#2a303a] bg-[#0c1016] p-2"
          >
            <span className="num grid size-8 place-items-center bg-[#f6f3ea] text-xs font-black text-[#090b0f]">
              {row.rank}
            </span>
            <div className="flex min-w-0 items-center gap-3">
              {row.code ? (
                <DriverAvatar code={row.code} teamName={row.teamName} name={row.label} size="sm" showCode={false} />
              ) : (
                <TeamBadge teamName={row.teamName} />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase">{row.label}</p>
                <p className="num text-[10px] font-bold uppercase" style={{ color: row.color }}>
                  {team(row.teamName).short}
                </p>
              </div>
            </div>
            <span className="num text-sm font-black uppercase">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BattleCard({ battle, delay, onOpen }: { battle: Battle; delay: number; onOpen: () => void }) {
  const Icon = battle.icon;
  const topRows = battle.rows.slice(0, 5);
  const max = Math.max(1, ...topRows.map((row) => row.value));
  const canOpen = battle.rows.length > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!canOpen}
      className="home-section-enter group min-h-[340px] w-full border border-[#2a303a] bg-[#11151c] p-4 text-left transition-transform duration-200 enabled:hover:-translate-y-1 disabled:cursor-not-allowed"
      style={{ animationDelay: `${delay}ms` } as CSSProperties}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-3 grid size-10 place-items-center bg-[#f6f3ea] text-[#090b0f]">
            <Icon className="size-5 text-[#e8002d]" />
          </div>
          <h3 className="text-xl font-black uppercase italic leading-none">{battle.title}</h3>
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#9aa3ad]">
            {battle.label}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 border border-[#2a303a] bg-[#0c1016] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#dfe5ec]">
          <Eye className="size-3" />
          Full list
        </span>
      </div>

      {battle.unavailable ? (
        <div className="grid min-h-[210px] place-items-center border border-[#2a303a] bg-[#0c1016] p-5 text-center">
          <div>
            <p className="text-sm font-black uppercase text-[#ff6b7a]">Not tracked yet</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#a9b0bb]">{battle.unavailable}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {topRows.map((row, index) => (
            <RankRow key={row.id} row={row} rank={index + 1} max={max} compact />
          ))}
        </div>
      )}
    </button>
  );
}

function RankRow({
  row,
  rank,
  max,
  compact = false,
}: {
  row: BattleRow;
  rank: number;
  max: number;
  compact?: boolean;
}) {
  const width = Math.max(4, Math.round((row.value / max) * 100));

  return (
    <div className="space-y-2" data-rank-row>
      <div className="grid grid-cols-[2rem_1fr_auto] items-center gap-2">
        <span className="num grid size-7 place-items-center bg-[#f6f3ea] text-[11px] font-black text-[#090b0f]">
          {rank}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {row.code ? (
            <DriverAvatar code={row.code} teamName={row.teamName} name={row.label} size="sm" showCode={false} />
          ) : (
            <TeamBadge teamName={row.teamName} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-black uppercase">{row.code ?? row.label}</p>
            {!compact ? <p className="truncate text-xs font-semibold text-[#a9b0bb]">{row.label}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <span className="num block text-sm font-black">{row.display}</span>
          {row.note ? <span className="num block text-[10px] font-bold text-[#9aa3ad]">{row.note}</span> : null}
        </div>
      </div>
      <div className="h-2 border border-[#2a303a] bg-[#0c1016]">
        <div className="h-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: row.color }} />
      </div>
    </div>
  );
}

function BattleDialog({ battle, onClose }: { battle: Battle; onClose: () => void }) {
  const Icon = battle.icon;
  const max = Math.max(1, ...battle.rows.map((row) => row.value));

  return (
    <div className="fixed inset-0 z-[100] bg-[#090b0f] p-4 text-[#f6f3ea] sm:p-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${battle.title} full list`}
        className="mx-auto flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col border border-[#2a303a] bg-[#11151c] sm:max-h-[calc(100vh-4rem)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#2a303a] p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center bg-[#f6f3ea] text-[#090b0f]">
              <Icon className="size-5 text-[#e8002d]" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ff6b7a]">
                Complete list / {battle.rows.length} entries
              </p>
              <h2 className="text-2xl font-black uppercase italic leading-none">{battle.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center border border-[#2a303a] bg-[#0c1016] text-[#f6f3ea] transition-colors hover:bg-[#e8002d] hover:text-[#ffffff]"
            aria-label="Close full list"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          {battle.rows.length ? (
            <div className="space-y-4">
              {battle.rows.map((row, index) => (
                <RankRow key={row.id} row={row} rank={index + 1} max={max} />
              ))}
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center border border-[#2a303a] bg-[#0c1016] p-6 text-center">
              <p className="text-sm font-black uppercase text-[#a9b0bb]">No ranked entries for this board.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
