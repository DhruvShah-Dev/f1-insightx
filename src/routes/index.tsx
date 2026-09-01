import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Database, ExternalLink, Flag, Medal, Newspaper, Trophy, Wrench } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { SectionHeading, SiteShell } from "@/components/site-shell";
import { CircuitMap } from "@/components/circuit-map";
import { countryTheme } from "@/data/country-theme";
import { team as teamOf } from "@/data/teams";
import { getRaceReports, getRaceWeek, getSeasonTelemetry } from "@/lib/f1.functions";
import { fmtDate } from "@/lib/format";

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
      { title: "F1 InsightX - Race Control: predictions, pace and championship reads" },
      {
        name: "description",
        content:
          "Race Control: next-session countdown, qualifying projection, live championship standings and post-race telemetry reports for the 2026 Formula 1 season.",
      },
      { property: "og:title", content: "F1 InsightX - Race Control" },
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
  const reports = useSuspenseQuery(reportsQuery).data.reports;
  const latest = reports[0];

  const theme = countryTheme(rw?.circuit.country);
  const gpTitle = (rw?.raceName ?? "Grand Prix").replace(/grand prix/i, "").trim();
  const flagStart = theme.flag[0] ?? theme.accent;
  const flagMiddle = theme.flag[1] ?? "#ffffff";
  const flagEnd = theme.flag.at(-1) ?? theme.accent;
  const raceThemeStyle = {
    "--primary": theme.accent,
    "--ring": theme.accent,
    "--race-country-primary": flagStart,
    "--race-country-secondary": flagMiddle,
    "--race-country-tertiary": flagEnd,
    "--race-country-accent": theme.accent,
  } as CSSProperties;

  return (
    <SiteShell fullWidth>
      <div className="home-page-solid relative z-10" style={raceThemeStyle}>
        {/* Masthead */}
        <section
          className="home-section-enter relative overflow-hidden rounded-lg border border-white/18 text-white shadow-[0_18px_80px_rgba(0,0,0,0.22)]"
          style={{ backgroundColor: flagStart }}
        >
          <div aria-hidden className="absolute inset-0 hidden md:grid md:grid-cols-3">
            <span style={{ backgroundColor: flagStart }} />
            <span style={{ backgroundColor: flagMiddle }} />
            <span style={{ backgroundColor: flagEnd }} />
          </div>
          <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-2">
            {theme.flag.map((col) => (
              <span key={col} className="flex-1" style={{ backgroundColor: col }} />
            ))}
          </div>

          <div className="relative p-5 pt-7 sm:p-7 lg:p-9">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-white px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#07110c]">
                <Flag className="size-3" /> Next GP
              </span>
              <span
                className="num rounded-sm border border-white/25 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-white"
                style={{
                  backgroundColor: theme.accent,
                }}
              >
                {theme.label}
              </span>
              <span className="num text-[11px] text-white/75">
                R{rw?.round ?? "-"} - {rw?.season ?? ""}
              </span>
              <span className="num text-[11px] text-white/75">
                {rw?.circuit.name}
                {rw?.circuit.country ? ` - ${rw.circuit.country}` : ""}
              </span>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.64fr)] xl:items-stretch">
              <div className="flex min-w-0 flex-col justify-between">
                <div>
                  <h1 className="text-4xl font-black uppercase italic leading-[0.95] tracking-tighter sm:text-6xl">
                    {gpTitle}{" "}
                    <span style={{ color: flagEnd }}>Grand Prix</span>
                  </h1>
                  {rw?.scheduledAt ? (
                    <div className="mt-6">
                      <Countdown targetISO={rw.scheduledAt} label="Lights out" />
                    </div>
                  ) : null}
                  <div
                    aria-hidden
                    className="mt-5 flex h-3 max-w-72 overflow-hidden rounded-sm border border-white/20"
                  >
                    {theme.flag.map((col) => (
                      <span key={col} className="flex-1" style={{ backgroundColor: col }} />
                    ))}
                  </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    to="/raceweek"
                    className="px-4 py-2 text-xs font-black uppercase italic tracking-wide text-[#07110c] transition-[filter] hover:brightness-95"
                    style={{ backgroundColor: flagMiddle }}
                  >
                    Open race week
                  </Link>
                  <Link
                    to="/analysis"
                    className="border border-white/25 bg-black/35 px-4 py-2 text-xs font-black uppercase italic tracking-wide text-white transition-colors hover:bg-black/50"
                  >
                    Latest report
                  </Link>
                </div>
              </div>
              </div>

              <CircuitMap
                path={rw?.trackPath ?? null}
                circuitId={rw?.circuit.id}
                circuitName={rw?.circuit.name}
                compact
                className="rounded-lg border-white/20 bg-white text-[#07110c] shadow-[0_12px_50px_rgba(0,0,0,0.28)]"
              />
            </div>
          </div>
        </section>

        <div className="home-section-enter mt-8">
          <ChampionshipSection
            drivers={data.drivers}
            constructors={data.constructors}
            standingsRound={data.standingsRound}
          />
        </div>

      {/* Upgrade watch */}
      <section className="home-section-enter race-country-panel mt-12 overflow-hidden rounded-lg border">
        <div className="relative p-5 sm:p-6">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-primary px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary-foreground">
                  <Wrench className="size-3" />
                  Upgrade watch
                </span>
                <span className="label-xs">FIA first - editorial context after</span>
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
              Derivable: team - part - round - impact
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
                className="pw-ticker group border border-border bg-background/80 p-4 transition-colors hover:border-primary hover:bg-accent/60"
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
                className="border border-border bg-card/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Report rail */}
      <section className="home-section-enter mt-12">
        <SectionHeading
          kicker="Post-race telemetry"
          title="Recent reports"
          action={
            <Link to="/analysis" className="whitespace-nowrap text-[11px] font-bold uppercase text-primary">
              All rounds {"->"}
            </Link>
          }
        />
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
          {reports.map((r) => (
            <Link
              key={r.slug}
              to="/analysis/$slug"
              params={{ slug: r.slug }}
              className="w-[280px] shrink-0 snap-start rounded-lg border border-border bg-card/60 p-4 transition-colors hover:border-primary"
              style={{ borderTop: `3px solid ${teamOf(r.winnerTeam).color}` }}
            >
              <p className="num text-[10px] text-muted-foreground">
                R{r.round} - {fmtDate(r.dateISO)}
              </p>
              <p className="mt-1 text-sm font-black uppercase italic">{r.name}</p>
              <p className="mt-2 text-xs font-bold uppercase">{r.winnerName}</p>
              <p className="num text-[11px] text-muted-foreground">
                {teamOf(r.winnerTeam).name}
                {r.strategy ? ` - ${r.strategy}` : ""}
              </p>
              {r.podium.length === 3 ? (
                <p className="num mt-2 text-[11px] text-muted-foreground">
                  Podium {r.podium.join(" - ")}
                </p>
              ) : null}
              <p className="mt-3 line-clamp-3 text-[11px] text-muted-foreground">
                {r.paceFactor ?? r.story ?? ""}
              </p>
              <p className="mt-3 text-[11px] font-bold uppercase text-primary">Read report {"->"}</p>
            </Link>
          ))}
        </div>
        {latest ? (
          <p className="num mt-2 text-[11px] text-muted-foreground">
            Latest: R{latest.round} {latest.name} - {latest.weather ?? latest.raceShape ?? ""}
          </p>
        ) : null}
        </section>
      </div>
    </SiteShell>

  );
}

type ChampionshipSectionProps = {
  drivers: Array<{
    driverCode: string;
    driverName: string;
    team: string;
    constructorName: string | null;
    position: number;
    points: number;
    wins: number;
  }>;
  constructors: Array<{
    id: string;
    name: string;
    position: number;
    points: number;
    wins: number;
  }>;
  standingsRound: number;
};

function ChampionshipSection({
  drivers,
  constructors,
  standingsRound,
}: ChampionshipSectionProps) {
  const maxDriverPoints = Math.max(1, ...drivers.map((driver) => driver.points));
  const maxConstructorPoints = Math.max(1, ...constructors.map((constructor) => constructor.points));

  return (
    <section>
      <SectionHeading
        kicker={`Championship - after R${standingsRound}`}
        title="Top 5 drivers and constructors"
        action={
          <Link to="/championship" className="whitespace-nowrap text-[11px] font-bold uppercase text-primary">
            Full tables {"->"}
          </Link>
        }
      />

      <div className="race-country-panel rounded-lg border p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <StandingsTable
            title="Drivers Championship"
            icon={<Medal className="size-4" />}
            rows={drivers.slice(0, 5).map((driver) => ({
              id: driver.driverCode,
              position: driver.position,
              name: driver.driverName,
              meta: `${teamOf(driver.constructorName ?? driver.team).name} - ${driver.wins} wins`,
              points: driver.points,
              color: teamOf(driver.constructorName ?? driver.team).color,
              pct: (driver.points / maxDriverPoints) * 100,
            }))}
          />
          <StandingsTable
            title="Constructors Championship"
            icon={<Trophy className="size-4" />}
            rows={constructors.slice(0, 5).map((constructor) => ({
              id: constructor.id,
              position: constructor.position,
              name: teamOf(constructor.name).name,
              meta: `${constructor.wins} wins`,
              points: constructor.points,
              color: teamOf(constructor.name).color,
              pct: (constructor.points / maxConstructorPoints) * 100,
            }))}
          />
        </div>
      </div>
    </section>
  );
}

type StandingsTableRow = {
  id: string;
  position: number;
  name: string;
  meta: string;
  points: number;
  color: string;
  pct: number;
};

function StandingsTable({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: ReactNode;
  rows: StandingsTableRow[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card/70">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-black uppercase italic">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <Link key={row.id} to="/championship" className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/60">
            <span className="num text-xs text-muted-foreground">{row.position}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-3 w-1.5 rounded-sm" style={{ backgroundColor: row.color }} />
                <p className="truncate text-xs font-black uppercase">{row.name}</p>
              </div>
              <p className="num mt-1 text-[10px] uppercase text-muted-foreground">{row.meta}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-background">
                <span
                  className="block h-full rounded-sm"
                  style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                />
              </div>
            </div>
            <span className="num text-sm font-black">{row.points}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
