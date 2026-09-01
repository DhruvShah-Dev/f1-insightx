import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Check,
  ChevronDown,
  CloudRain,
  Flag,
  Gauge,
  MapPinned,
  Medal,
  Route as RouteIcon,
  ShieldCheck,
  Thermometer,
  Timer,
  Trophy,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { CircuitMap } from "@/components/circuit-map";
import { SiteShell } from "@/components/site-shell";
import { countryForRace, countryTheme } from "@/data/country-theme";
import {
  cornerProfileForCircuit,
  cornerSummaryForCircuit,
  cornersForCircuit,
} from "@/data/circuit-corners";
import { team } from "@/data/teams";
import { fmtDate, fmtDateTime, fmtDelta, fmtLapS, fmtNum, pct } from "@/lib/format";
import {
  getRaceWeek,
  type RaceWeekDriver,
  type RaceWeekQualifyingPrediction,
} from "@/lib/f1.functions";

const raceWeekQuery = queryOptions({
  queryKey: ["race-week"],
  queryFn: () => getRaceWeek(),
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

type RaceWeekData = NonNullable<Awaited<ReturnType<typeof getRaceWeek>>>;

export const Route = createFileRoute("/raceweek")({
  loader: ({ context }) => context.queryClient.ensureQueryData(raceWeekQuery),
  head: () => ({
    meta: [
      { title: "Race Week - F1 InsightX" },
      {
        name: "description",
        content:
          "Race start, circuit map, weather, qualifying picks and race predictions for the next Formula 1 round.",
      },
      { property: "og:title", content: "Race Week - F1 InsightX" },
      {
        property: "og:description",
        content: "A focused race-week board for the selected Grand Prix.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <SiteShellError message={`Race week unavailable: ${error.message}`} />
  ),
  component: RaceWeek,
});

function RaceWeek() {
  const { data } = useSuspenseQuery(raceWeekQuery);
  const [activeView, setActiveView] = useState<"schedule" | "circuit" | "pace">("schedule");
  const [showAllQuali, setShowAllQuali] = useState(false);
  const [showAllRace, setShowAllRace] = useState(false);
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [showAllTurns, setShowAllTurns] = useState(false);

  if (!data) {
    return <SiteShellError message="No race week is available for the current season." />;
  }

  const country = countryForRace({
    circuitId: data.circuit.id,
    circuit: data.circuit.name,
    raceName: data.raceName,
  });
  const theme = countryTheme(country ?? data.circuit.country);
  const flagA = theme.flag[0] ?? theme.accent;
  const flagB = theme.flag[1] ?? "#ffffff";
  const flagC = theme.flag.at(-1) ?? theme.accent;
  const weather = data.weather;
  const weatherReady = Boolean(
    weather &&
    [weather.rainProb, weather.trackTempC, weather.windMps, weather.riskIndex].some(
      (value) => value != null,
    ),
  );
  const corners = cornersForCircuit(data.circuit.id);
  const visibleCorners = showAllTurns ? corners : corners.slice(0, 8);
  const cornerGroups = cornerProfileForCircuit(data.circuit.id);
  const qualiPredictions =
    data.qualifyingPredictions.length > 0
      ? data.qualifyingPredictions.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      : heuristicQualifyingPredictions(data.drivers);
  const racePredictions = data.projections
    .slice()
    .sort((a, b) => (a.projected ?? 99) - (b.projected ?? 99));
  const qualiRows = showAllQuali ? qualiPredictions : qualiPredictions.slice(0, 6);
  const raceRows = showAllRace ? racePredictions : racePredictions.slice(0, 6);
  const teams = data.constructors.slice().sort((a, b) => (b.readiness ?? 0) - (a.readiness ?? 0));
  const visibleTeams = showAllTeams ? teams : teams.slice(0, 6);
  const leadQuali = qualiPredictions[0];
  const leadRace = racePredictions[0];
  const circuitShort = data.circuit.name.split(" ").slice(0, 2).join(" ");

  const tabs = [
    { id: "schedule" as const, label: "Start", icon: CalendarClock },
    { id: "circuit" as const, label: "Circuit", icon: RouteIcon },
    { id: "pace" as const, label: "Pace", icon: Gauge },
  ];

  return (
    <SiteShell fullWidth>
      <div
        className="race-page-enter"
        style={
          {
            "--primary": theme.accent,
            "--ring": theme.accent,
            "--race-accent": theme.accent,
            "--flag-a": flagA,
            "--flag-b": flagB,
            "--flag-c": flagC,
            "--ink": "#07110c",
          } as CSSProperties
        }
      >
        <section className="relative overflow-hidden rounded-lg border border-border bg-card">
          <div aria-hidden className="absolute inset-0 grid grid-cols-1 md:grid-cols-3">
            <span style={{ backgroundColor: flagA }} />
            <span style={{ backgroundColor: flagB }} />
            <span style={{ backgroundColor: flagC }} />
          </div>
          <div className="relative grid min-h-[560px] gap-5 p-5 sm:p-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(34rem,1.1fr)]">
            <div className="flex min-h-[500px] flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#07110c]">
                  <Flag className="size-3.5" />
                  Round {data.round}
                </div>
                <h1 className="mt-6 max-w-4xl text-5xl font-black uppercase italic leading-none text-[#07110c] sm:text-7xl">
                  {data.raceName}
                </h1>
                <p className="mt-4 max-w-xl text-base font-bold text-[#07110c] sm:text-lg">
                  {data.circuit.name}
                  {data.circuit.location ? `, ${data.circuit.location}` : ""}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeroMetric
                  label="Lights out"
                  value={data.scheduledAt ? fmtDateTime(data.scheduledAt) : "TBC"}
                  icon={<Timer className="size-4" />}
                />
                <HeroMetric
                  label="Weekend"
                  value={data.sprintWeekend ? "Sprint" : "Standard"}
                  icon={<Zap className="size-4" />}
                />
                <HeroMetric
                  label="Turns"
                  value={cornerSummaryForCircuit(data.circuit.id)}
                  icon={<MapPinned className="size-4" />}
                />
              </div>
            </div>

            <div className="home-section-enter self-end rounded-lg border border-white bg-[#07110c] p-3">
              <CircuitMap
                path={data.trackPath}
                circuitId={data.circuit.id}
                circuitName={data.circuit.name}
                className="min-h-[460px] rounded-md border-white bg-white text-[#07110c]"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id)}
                className={`pw-card rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card"
                }`}
              >
                <Icon className="size-5" />
                <span className="mt-3 block text-lg font-black uppercase italic">{tab.label}</span>
              </button>
            );
          })}
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <main className="space-y-5">
            {activeView === "schedule" ? (
              <ScheduleBoard data={data} weatherReady={weatherReady} />
            ) : null}
            {activeView === "circuit" ? (
              <CircuitBoard
                data={data}
                cornerGroups={cornerGroups}
                corners={visibleCorners}
                totalCorners={corners.length}
                expanded={showAllTurns}
                onToggle={() => setShowAllTurns((value) => !value)}
              />
            ) : null}
            {activeView === "pace" ? (
              <PaceBoard
                leadQuali={leadQuali}
                leadRace={leadRace}
                racePredictions={racePredictions}
              />
            ) : null}

            <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <PanelHeading
                kicker="Qualifying"
                title="Predicted top order"
                icon={<Gauge className="size-4" />}
              />
              <PredictionList
                rows={qualiRows.map((row) => ({
                  key: row.driverId,
                  position: row.rank,
                  code: row.code,
                  name: row.name,
                  teamName: row.team,
                  main: row.timeS == null ? "Time TBC" : fmtLapS(row.timeS),
                  sub: row.gapS == null ? "Gap TBC" : fmtDelta(row.gapS),
                  metric: row.modeLabel ?? "Model",
                }))}
              />
              {qualiPredictions.length > 6 ? (
                <ShowMoreButton
                  expanded={showAllQuali}
                  total={qualiPredictions.length}
                  noun="drivers"
                  onClick={() => setShowAllQuali((value) => !value)}
                />
              ) : null}
            </section>

            {racePredictions.length ? (
              <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
                <PanelHeading
                  kicker="Race"
                  title="Projected finish"
                  icon={<Trophy className="size-4" />}
                />
                <PredictionList
                  rows={raceRows.map((row) => ({
                    key: row.code,
                    position: row.projected,
                    code: row.code,
                    name: row.name,
                    teamName: row.team,
                    main: `P${row.low ?? "-"}-P${row.high ?? "-"}`,
                    sub: row.winProb == null ? "Win TBC" : `Win ${pct(row.winProb)}`,
                    metric: row.podiumProb == null ? "Podium TBC" : `Podium ${pct(row.podiumProb)}`,
                  }))}
                />
                {racePredictions.length > 6 ? (
                  <ShowMoreButton
                    expanded={showAllRace}
                    total={racePredictions.length}
                    noun="drivers"
                    onClick={() => setShowAllRace((value) => !value)}
                  />
                ) : null}
              </section>
            ) : null}
          </main>

          <aside className="space-y-5">
            <WeatherPanel weather={weather} ready={weatherReady} />
            <TeamsPanel
              teams={visibleTeams}
              total={teams.length}
              expanded={showAllTeams}
              onToggle={() => setShowAllTeams((value) => !value)}
            />
            <StoryPanel data={data} circuitShort={circuitShort} />
          </aside>
        </section>

        <p className="num mt-8 text-[10px] uppercase text-muted-foreground">
          Updated for {data.scheduledAt ? fmtDate(data.scheduledAt) : "race week"}.
        </p>
      </div>
    </SiteShell>
  );
}

function SiteShellError({ message }: { message: string }) {
  return (
    <SiteShell fullWidth>
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
    </SiteShell>
  );
}

function HeroMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-4 text-[#07110c]">
      <div className="flex items-center gap-2">
        {icon}
        <p className="label-xs text-[#07110c]">{label}</p>
      </div>
      <p className="num mt-3 text-lg font-black uppercase leading-tight">{value}</p>
    </div>
  );
}

function PanelHeading({ kicker, title, icon }: { kicker: string; title: string; icon: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-border pb-3">
      <div>
        <p className="label-xs">{kicker}</p>
        <h2 className="text-2xl font-black uppercase italic">{title}</h2>
      </div>
      <span className="grid size-9 place-items-center rounded-sm bg-primary text-primary-foreground">
        {icon}
      </span>
    </div>
  );
}

function ScheduleBoard({ data, weatherReady }: { data: RaceWeekData; weatherReady: boolean }) {
  const sessions = [
    {
      label: "Practice",
      value: data.sprintWeekend ? "Sprint format" : "Standard format",
      icon: Gauge,
    },
    {
      label: "Qualifying",
      value: data.sprintWeekend ? "Sprint + race grid" : "Race grid",
      icon: Flag,
    },
    {
      label: "Race",
      value: data.scheduledAt ? fmtDateTime(data.scheduledAt) : "Time TBC",
      icon: Timer,
    },
    {
      label: "Weather",
      value: weatherReady ? "Available" : "Pending",
      icon: CloudRain,
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <PanelHeading
        kicker="Start"
        title="Weekend board"
        icon={<CalendarClock className="size-4" />}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {sessions.map((session, index) => {
          const Icon = session.icon;
          return (
            <div
              key={session.label}
              className="pw-ticker rounded-lg border border-border bg-background p-4"
              style={{
                animationDelay: `${index * 28}ms`,
                borderTop: "4px solid var(--race-accent)",
              }}
            >
              <Icon className="size-5 text-primary" />
              <p className="mt-4 text-xl font-black uppercase italic">{session.label}</p>
              <p className="num mt-1 text-sm text-muted-foreground">{session.value}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CircuitBoard({
  data,
  cornerGroups,
  corners,
  totalCorners,
  expanded,
  onToggle,
}: {
  data: RaceWeekData;
  cornerGroups: { label: string; value: string; detail: string }[];
  corners: { number: number; name: string; sector: number }[];
  totalCorners: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <PanelHeading
        kicker="Circuit"
        title={data.circuit.name}
        icon={<RouteIcon className="size-4" />}
      />
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="grid gap-2">
          {cornerGroups.map((group, index) => (
            <div
              key={group.label}
              className="pw-ticker rounded-lg border border-border bg-background p-4"
              style={{
                animationDelay: `${index * 32}ms`,
                borderLeft: "5px solid var(--race-accent)",
              }}
            >
              <p className="label-xs">{group.label}</p>
              <p className="num mt-2 text-4xl font-black">{group.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{group.detail}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="label-xs">Turns</p>
            <p className="num text-[10px] uppercase text-primary">{totalCorners || "TBC"}</p>
          </div>
          {corners.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {corners.map((corner, index) => (
                <div
                  key={corner.number}
                  className="pw-ticker flex items-center gap-3 border-b border-border py-2"
                  style={{ animationDelay: `${index * 18}ms` }}
                >
                  <span className="num grid size-7 place-items-center rounded-sm bg-primary text-xs font-black text-primary-foreground">
                    {corner.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-black uppercase">
                    {corner.name}
                  </span>
                  <span className="label-xs">S{corner.sector}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Turn names are not available.</p>
          )}
          {totalCorners > 8 ? (
            <button
              type="button"
              onClick={onToggle}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-sm border border-primary px-3 text-[11px] font-black uppercase italic text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {expanded ? "Show key turns" : `Show all ${totalCorners}`}
              <ChevronDown className={expanded ? "size-4 rotate-180" : "size-4"} />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PaceBoard({
  leadQuali,
  leadRace,
  racePredictions,
}: {
  leadQuali: RaceWeekQualifyingPrediction | undefined;
  leadRace: RacePrediction | undefined;
  racePredictions: RacePrediction[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <PanelHeading kicker="Pace" title="Top calls" icon={<Zap className="size-4" />} />
      <div className="grid gap-3 md:grid-cols-3">
        <Callout
          label="Pole pick"
          value={leadQuali?.name ?? "TBC"}
          note={leadQuali?.gapS == null ? "Model board" : fmtDelta(leadQuali.gapS)}
          icon={Gauge}
        />
        <Callout
          label="Race pick"
          value={leadRace?.name ?? "TBC"}
          note={leadRace?.winProb == null ? "Model board" : `Win ${pct(leadRace.winProb)}`}
          icon={Trophy}
        />
        <Callout
          label="Podium fight"
          value={String(racePredictions.filter((row) => (row.podiumProb ?? 0) >= 0.2).length)}
          note="Drivers above 20%"
          icon={Medal}
        />
      </div>
    </section>
  );
}

function Callout({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
}) {
  return (
    <div className="pw-ticker rounded-lg border border-border bg-background p-5">
      <Icon className="size-5 text-primary" />
      <p className="label-xs mt-4">{label}</p>
      <p className="mt-2 truncate text-2xl font-black uppercase italic">{value}</p>
      <p className="num mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function WeatherPanel({ weather, ready }: { weather: RaceWeekData["weather"]; ready: boolean }) {
  const rows = [
    {
      label: "Rain",
      value: weather?.rainProb == null ? "TBC" : `${Math.round(weather.rainProb * 100)}%`,
      icon: CloudRain,
    },
    {
      label: "Track",
      value: weather?.trackTempC == null ? "TBC" : `${fmtNum(weather.trackTempC, 1)} C`,
      icon: Thermometer,
    },
    {
      label: "Wind",
      value: weather?.windMps == null ? "TBC" : `${fmtNum(weather.windMps, 1)} m/s`,
      icon: Wind,
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <PanelHeading kicker="Weather" title="Race window" icon={<CloudRain className="size-4" />} />
      <div className="grid gap-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex items-center gap-3 rounded-lg bg-background p-3">
              <span className="grid size-9 place-items-center rounded-sm bg-primary text-primary-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="label-xs block">{row.label}</span>
                <span className="num mt-1 block text-lg font-black">{row.value}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {ready ? "Weather update is available." : "Weather update is pending."}
      </p>
    </section>
  );
}

function TeamsPanel({
  teams,
  total,
  expanded,
  onToggle,
}: {
  teams: RaceWeekData["constructors"];
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <PanelHeading kicker="Teams" title="Readiness" icon={<ShieldCheck className="size-4" />} />
      <div className="space-y-3">
        {teams.map((constructor, index) => {
          const t = team(constructor.name);
          const readiness =
            constructor.readiness == null ? 0 : Math.max(0, Math.min(1, constructor.readiness));
          return (
            <div
              key={constructor.id}
              className="pw-ticker rounded-lg border border-border bg-background p-3"
              style={{ animationDelay: `${index * 24}ms`, borderLeft: `5px solid ${t.color}` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-xs font-black uppercase">{t.name}</p>
                <p className="num text-xs font-black" style={{ color: t.color }}>
                  {constructor.readiness == null ? "TBC" : pct(readiness)}
                </p>
              </div>
              <div className="mt-2 h-2 rounded-sm bg-secondary">
                <div
                  className="h-2 rounded-sm"
                  style={{ width: `${Math.round(readiness * 100)}%`, backgroundColor: t.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {total > 6 ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-sm border border-primary px-3 text-[11px] font-black uppercase italic text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {expanded ? "Show top 6" : `Show all ${total}`}
          <ChevronDown className={expanded ? "size-4 rotate-180" : "size-4"} />
        </button>
      ) : null}
    </section>
  );
}

function StoryPanel({ data, circuitShort }: { data: RaceWeekData; circuitShort: string }) {
  const story = data.storylines.find((entry) => entry.headline) ?? null;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <PanelHeading kicker="Watch" title="What matters" icon={<Flag className="size-4" />} />
      {story ? (
        <div className="rounded-lg bg-background p-4">
          <p className="text-base font-black uppercase italic">{story.headline}</p>
          {story.body ? <p className="mt-2 text-sm text-muted-foreground">{story.body}</p> : null}
        </div>
      ) : (
        <div className="rounded-lg bg-background p-4">
          <p className="text-base font-black uppercase italic">{circuitShort}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Watch qualifying order, tyre wear, and weather.
          </p>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-background p-4">
        <p className="label-xs">Previous visits</p>
        {data.previous.length ? (
          <ul className="mt-2 space-y-2">
            {data.previous.map((race) => (
              <li key={race.slug} className="flex items-baseline gap-2 text-xs">
                <span className="num text-muted-foreground">{race.season}</span>
                <span className="font-black uppercase">{race.winnerCode}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {team(race.winnerTeam).name}
                </span>
                <Link
                  to="/analysis/$slug"
                  params={{ slug: race.slug }}
                  className="num font-black uppercase text-primary"
                >
                  Report
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No previous report stored.</p>
        )}
      </div>
    </section>
  );
}

function PredictionList({
  rows,
}: {
  rows: {
    key: string;
    position: number | null;
    code: string;
    name: string;
    teamName: string;
    main: string;
    sub: string;
    metric: string;
  }[];
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const t = team(row.teamName);
        const position = row.position ?? index + 1;
        return (
          <article
            key={row.key}
            className="pw-ticker grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[3.5rem_minmax(0,1fr)_10rem_8rem]"
            style={{ animationDelay: `${index * 24}ms`, borderLeft: `5px solid ${t.color}` }}
          >
            <div>
              <p className="num text-2xl font-black text-primary">P{position}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase italic">{row.name}</p>
              <p className="num mt-1 text-[10px] uppercase text-muted-foreground">
                {row.code} / {t.name}
              </p>
            </div>
            <div>
              <p className="num text-sm font-black">{row.main}</p>
              <p className="num mt-1 text-[10px] uppercase text-muted-foreground">{row.sub}</p>
            </div>
            <div className="md:text-right">
              <p className="num text-xs font-black uppercase">{row.metric}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ShowMoreButton({
  expanded,
  total,
  noun,
  onClick,
}: {
  expanded: boolean;
  total: number;
  noun: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-sm border border-primary px-3 text-[11px] font-black uppercase italic text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      {expanded ? "Show less" : `Show all ${total} ${noun}`}
      <ChevronDown className={expanded ? "size-4 rotate-180" : "size-4"} />
    </button>
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
    modeLabel: "One-lap form",
    sourceLabel: "race_week_driver_board",
  }));
}
