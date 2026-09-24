import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Calendar, DashFlag, FastArrowRight, MapPin, Timer } from "iconoir-react/regular";
import type { CSSProperties } from "react";
import { Countdown } from "@/components/countdown";
import { SiteShell } from "@/components/site-shell";
import { countryTheme } from "@/data/country-theme";
import { team as teamOf } from "@/data/teams";
import { getRaceReports, getRaceWeek, getSeasonTelemetry } from "@/lib/f1.functions";
import { fmtDate } from "@/lib/format";

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
        <section className="home-section-enter relative overflow-hidden border border-white/12 bg-black text-white">
          <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-2">
            {theme.flag.map((col, index) => (
              <span key={`${col}-${index}`} className="flex-1" style={{ backgroundColor: col }} />
            ))}
          </div>

          <div className="relative grid gap-8 p-4 pt-8 sm:p-6 sm:pt-10 xl:min-h-[720px] xl:grid-cols-[minmax(380px,0.82fr)_minmax(680px,1fr)] xl:items-center xl:gap-10 xl:p-8">
            <div className="relative z-10 flex min-w-0 flex-col justify-center xl:pb-2">
              {rw?.scheduledAt ? (
                <div className="mb-6 w-full max-w-2xl text-white">
                  <Countdown targetISO={rw.scheduledAt} label="Lights out" variant="hero" />
                </div>
              ) : null}

              <div className="mb-9 flex h-1.5 w-80 max-w-full overflow-hidden border border-white/18">
                {theme.flag.map((col, index) => (
                  <span
                    key={`${col}-hero-${index}`}
                    className="flex-1"
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase italic tracking-widest text-[#6fffe0]">
                  <DashFlag className="size-4" /> Round {rw?.round ?? "-"}
                </span>
              </div>

              <h1 className="mt-5 max-w-full text-[clamp(4rem,6.6vw,7.25rem)] font-black uppercase italic leading-[0.78] tracking-normal text-[#ef3340]">
                {gpTitle} Grand Prix
              </h1>

              <p className="mt-5 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest text-white/82">
                <MapPin className="size-4 text-white/70" />
                {rw?.circuit.name ?? "Circuit pending"}
                {rw?.circuit.country ? (
                  <span className="text-white/42">{rw.circuit.country}</span>
                ) : null}
              </p>

              <div className="mt-6 grid max-w-2xl gap-2 sm:grid-cols-2">
                <Link
                  to="/raceweek"
                  className="inline-flex min-h-12 items-center justify-between gap-3 bg-[#ef3340] px-4 text-xs font-black uppercase tracking-widest text-white"
                >
                  <Calendar className="size-4" />
                  Race week
                  <FastArrowRight className="size-4" />
                </Link>
                <Link
                  to="/championship"
                  className="inline-flex min-h-12 items-center justify-between gap-3 border border-white/16 bg-[#0b0f14] px-4 text-xs font-black uppercase tracking-widest text-white"
                >
                  <DashFlag className="size-4" />
                  Championship
                  <FastArrowRight className="size-4" />
                </Link>
                <Link
                  to="/picks"
                  className="inline-flex min-h-12 items-center justify-between gap-3 border border-white/16 bg-[#0b0f14] px-4 text-xs font-black uppercase tracking-widest text-white"
                >
                  <DashFlag className="size-4" />
                  Picks
                  <FastArrowRight className="size-4" />
                </Link>
                {latest ? (
                  <Link
                    to="/analysis/$slug"
                    params={{ slug: latest.slug }}
                    className="inline-flex min-h-12 items-center justify-between gap-3 border border-white/16 bg-[#0b0f14] px-4 text-xs font-black uppercase tracking-widest text-white"
                  >
                    <Timer className="size-4" />
                    Last race analysis
                    <FastArrowRight className="size-4" />
                  </Link>
                ) : (
                  <Link
                    to="/analysis"
                    className="inline-flex min-h-12 items-center justify-between gap-3 border border-white/16 bg-[#0b0f14] px-4 text-xs font-black uppercase tracking-widest text-white"
                  >
                    <Timer className="size-4" />
                    Last race analysis
                    <FastArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            </div>

            <div className="relative z-10 grid gap-4 self-center">
              <BakuTrackPanel circuitName={rw?.circuit.name ?? "Baku City Circuit"} />
            </div>
          </div>
        </section>

        <ChampionshipSection
          drivers={data.drivers}
          constructors={data.constructors}
          standingsRound={data.standingsRound}
        />

        <RecentRacesSection reports={reports} />
      </div>
    </SiteShell>
  );
}

const bakuCorners = [
  { n: 1, x: 760, y: 410 },
  { n: 2, x: 836, y: 326 },
  { n: 3, x: 582, y: 220 },
  { n: 4, x: 534, y: 310 },
  { n: 5, x: 426, y: 310 },
  { n: 6, x: 394, y: 286 },
  { n: 7, x: 338, y: 284 },
  { n: 8, x: 318, y: 246 },
  { n: 9, x: 310, y: 214 },
  { n: 10, x: 324, y: 188 },
  { n: 11, x: 340, y: 166 },
  { n: 12, x: 384, y: 150 },
  { n: 13, x: 240, y: 72 },
  { n: 14, x: 150, y: 104 },
  { n: 15, x: 72, y: 158 },
  { n: 16, x: 100, y: 294 },
  { n: 17, x: 178, y: 264 },
  { n: 18, x: 286, y: 280 },
  { n: 19, x: 362, y: 278 },
  { n: 20, x: 498, y: 338 },
] as const;

const bakuStats = [
  { label: "Circuit Length", value: "6.003km", wide: true },
  { label: "First Grand Prix", value: "2016" },
  { label: "Number of Laps", value: "51" },
  { label: "Fastest lap time", value: "1:43.009", meta: "Charles Leclerc (2019)" },
  { label: "Race Distance", value: "306.049km" },
] as const;

function BakuTrackPanel({ circuitName }: { circuitName: string }) {
  return (
    <section className="border-2 border-[#ffde59] bg-black">
      <div className="relative overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/12 px-4 py-4 sm:px-5">
          <span className="num text-[10px] font-black uppercase tracking-widest text-white/62">
            Track layout
          </span>
          <span className="num text-[10px] font-black uppercase tracking-[0.18em] text-[#ffde59]">
            {circuitName}
          </span>
        </div>

        <div className="relative px-2 py-5 sm:px-5 sm:py-6">
          <svg
            viewBox="0 0 900 520"
            className="h-[340px] w-full sm:h-[430px] xl:h-[470px]"
            role="img"
            aria-label="Baku City Circuit track layout with sectors, corner numbers, overtaking zones, and speed trap"
          >
            <defs>
              <path
                id="baku-track-full"
                d="M760 410 L836 326 L620 230 L582 220 L534 310 L426 310 L394 286 L338 284 L318 246 L310 214 L324 188 L340 166 L384 150 L240 72 L150 104 L72 158 L100 294 L178 264 L286 280 L362 278 L498 338 L690 448 L760 410"
              />
            </defs>

            <use
              href="#baku-track-full"
              fill="none"
              stroke="#f6f7fb"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="25"
            />
            <use
              href="#baku-track-full"
              fill="none"
              stroke="#050608"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="17"
            />
            <path
              d="M760 410 L836 326 L620 230 L582 220 L534 310 L426 310"
              fill="none"
              stroke="#ff2f8f"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="8"
            />
            <path
              d="M426 310 L394 286 L338 284 L318 246 L310 214 L324 188 L340 166 L384 150 L240 72 L150 104 L72 158 L100 294"
              fill="none"
              stroke="#ffde21"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="8"
            />
            <path
              d="M100 294 L178 264 L286 280 L362 278 L498 338 L690 448 L760 410"
              fill="none"
              stroke="#3aa0ff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="8"
            />

            <path
              d="M805 360 L690 448 L560 376 L498 338"
              fill="none"
              stroke="#ef3340"
              strokeDasharray="3 8"
              strokeLinecap="round"
              strokeWidth="8"
            />
            <path
              d="M836 326 L720 274 L620 230"
              fill="none"
              stroke="#ef3340"
              strokeDasharray="3 8"
              strokeLinecap="round"
              strokeWidth="7"
            />
            <path
              d="M360 284 L498 338"
              fill="none"
              stroke="#ef3340"
              strokeDasharray="3 8"
              strokeLinecap="round"
              strokeWidth="6"
              opacity=".7"
            />

            <line x1="772" y1="356" x2="772" y2="474" stroke="#ffffff" strokeOpacity=".34" />
            <line x1="498" y1="338" x2="498" y2="456" stroke="#ffffff" strokeOpacity=".34" />
            <line x1="836" y1="326" x2="836" y2="220" stroke="#ffffff" strokeOpacity=".34" />
            <circle cx="772" cy="356" r="9" fill="#68e6be" stroke="#050608" strokeWidth="3" />
            <circle cx="836" cy="326" r="9" fill="#68e6be" stroke="#050608" strokeWidth="3" />
            <circle cx="498" cy="338" r="10" fill="#68e6be" stroke="#050608" strokeWidth="3" />
            <circle cx="404" cy="300" r="10" fill="#e4ff50" stroke="#050608" strokeWidth="3" />

            <LabelBox x={704} y={470} text="ZONE 2" subText="347M AFTER T20" color="#68e6be" />
            <LabelBox x={754} y={198} text="ZONE 1" subText="54M AFTER T2" color="#68e6be" />
            <LabelBox x={420} y={452} text="DETECTION" subText="T20 APEX" color="#68e6be" />
            <LabelBox x={648} y={216} text="DETECTION" subText="SC2 LINE" color="#68e6be" />
            <LabelBox x={332} y={390} text="SPEED TRAP" color="#e4ff50" />
            <SectorLabel x={622} y={326} label="SECTOR 1" rotate={29} />
            <SectorLabel x={262} y={105} label="SECTOR 2" rotate={26} />
            <SectorLabel x={234} y={276} label="SECTOR 3" rotate={8} />
            <text
              x="576"
              y="414"
              rotate="31"
              className="fill-[#ef3340] font-mono text-[15px] font-black uppercase"
            >
              Straight mode
            </text>
            <text
              x="604"
              y="432"
              rotate="31"
              className="fill-[#ef3340] font-mono text-[15px] font-black uppercase"
            >
              zone 2
            </text>
            <text
              x="686"
              y="265"
              rotate="23"
              className="fill-[#ef3340] font-mono text-[15px] font-black uppercase"
            >
              Straight mode
            </text>
            <text
              x="716"
              y="282"
              rotate="23"
              className="fill-[#ef3340] font-mono text-[15px] font-black uppercase"
            >
              zone 1
            </text>

            {bakuCorners.map((corner) => (
              <g key={corner.n}>
                <circle cx={corner.x} cy={corner.y} r="15" fill="#f5f6f8" />
                <text
                  x={corner.x}
                  y={corner.y + 5}
                  textAnchor="middle"
                  className="fill-black font-mono text-[14px] font-black"
                >
                  {corner.n}
                </text>
              </g>
            ))}

            <circle cx="658" cy="431" r="12" fill="#f5f6f8" />
            <path d="M654 425 h8 l-3 5 4 5 h-8 l3-5z" fill="#050608" />
          </svg>
        </div>

        <div className="grid border-t border-white/12 sm:grid-cols-5">
          {bakuStats.map((stat) => (
            <div
              key={stat.label}
              className="border-b border-white/12 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <p className="text-[11px] font-black uppercase tracking-normal text-white/56">
                {stat.label}
              </p>
              <p
                className={
                  stat.wide
                    ? "num mt-2 text-3xl font-black uppercase leading-none text-white sm:text-4xl"
                    : "num mt-2 text-2xl font-black uppercase leading-none text-white"
                }
              >
                {stat.value}
              </p>
              {stat.meta ? (
                <p className="mt-1 text-[11px] font-bold leading-tight text-white/62">
                  {stat.meta}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LabelBox({
  x,
  y,
  text,
  subText,
  color,
}: {
  x: number;
  y: number;
  text: string;
  subText?: string;
  color: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width="92" height={subText ? 38 : 25} rx="5" fill={color} />
      <text
        x={x + 46}
        y={y + 15}
        textAnchor="middle"
        className="fill-black font-mono text-[11px] font-black"
      >
        {text}
      </text>
      {subText ? (
        <text
          x={x + 46}
          y={y + 29}
          textAnchor="middle"
          className="fill-black font-mono text-[11px] font-black"
        >
          {subText}
        </text>
      ) : null}
    </g>
  );
}

function SectorLabel({
  x,
  y,
  label,
  rotate,
}: {
  x: number;
  y: number;
  label: string;
  rotate: number;
}) {
  return (
    <g transform={`rotate(${rotate} ${x} ${y})`}>
      <rect x={x - 43} y={y - 13} width="86" height="24" rx="3" fill="#f5f6f8" />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        className="fill-black font-mono text-[11px] font-black"
      >
        {label}
      </text>
    </g>
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

function ChampionshipSection({ drivers, constructors, standingsRound }: ChampionshipSectionProps) {
  const driverPodium = podiumOrder(drivers.slice(0, 3));
  const constructorPodium = podiumOrder(constructors.slice(0, 3));

  return (
    <section className="home-section-enter mt-8 space-y-8">
      <div className="border border-white/12 bg-black text-white">
        <SectionBar title="Drivers" detail={`After round ${standingsRound}`} />
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.85fr)]">
          <div className="border-b border-white/12 p-4 lg:border-b-0 lg:border-r">
            <div className="grid min-h-[310px] grid-cols-3 items-end gap-2 sm:gap-4">
              {driverPodium.map((driver) => (
                <DriverPodiumSpot key={driver.driverCode} driver={driver} />
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/10">
            {drivers.slice(3, 10).map((driver) => (
              <Link
                key={driver.driverCode}
                to="/championship"
                className="grid grid-cols-[2rem_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              >
                <span className="num text-xs font-black text-white/46">P{driver.position}</span>
                <DriverHeadshot
                  code={driver.driverCode}
                  name={driver.driverName}
                  teamName={driver.constructorName ?? driver.team}
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black uppercase italic text-white">
                    {driver.driverName}
                  </span>
                  <HomeTeamBadge teamName={driver.constructorName ?? driver.team} />
                </span>
                <span className="num text-sm font-black text-white">{driver.points}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-white/12 bg-black text-white">
        <SectionBar title="Constructors" detail={`After round ${standingsRound}`} />
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.85fr)]">
          <div className="border-b border-white/12 p-4 lg:border-b-0 lg:border-r">
            <div className="grid min-h-[310px] grid-cols-3 items-end gap-2 sm:gap-4">
              {constructorPodium.map((constructor) => (
                <ConstructorPodiumSpot key={constructor.id} constructor={constructor} />
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/10">
            {constructors.slice(3, 10).map((constructor) => {
              const t = teamOf(constructor.name);
              return (
                <Link
                  key={constructor.id}
                  to="/championship"
                  className="grid grid-cols-[2rem_auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
                >
                  <span className="num text-xs font-black text-white/46">
                    P{constructor.position}
                  </span>
                  <TeamMark teamName={constructor.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black uppercase italic text-white">
                      {t.name}
                    </span>
                    <span className="num text-[10px] font-black uppercase tracking-widest text-white/42">
                      {constructor.wins} wins
                    </span>
                  </span>
                  <span className="num text-sm font-black text-white">{constructor.points}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionBar({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/12 px-4 py-3">
      <h2 className="text-center text-xl font-black uppercase italic tracking-normal text-[#ef3340]">
        {title}
      </h2>
      <span className="num text-[10px] font-black uppercase tracking-widest text-white/46">
        {detail}
      </span>
    </div>
  );
}

type DriverStanding = ChampionshipSectionProps["drivers"][number];
type ConstructorStanding = ChampionshipSectionProps["constructors"][number];

function podiumOrder<T>(rows: T[]) {
  return [rows[1], rows[0], rows[2]].filter(Boolean) as T[];
}

function DriverPodiumSpot({ driver }: { driver: DriverStanding }) {
  const t = teamOf(driver.constructorName ?? driver.team);
  const height = podiumHeight(driver.position);

  return (
    <Link to="/championship" className="group flex min-w-0 flex-col items-center">
      <DriverFullBody
        code={driver.driverCode}
        name={driver.driverName}
        teamName={driver.constructorName ?? driver.team}
        position={driver.position}
      />
      <div
        className="mt-3 flex w-full min-w-0 flex-col justify-between border border-white/12 bg-[#050608] p-3 transition-colors group-hover:bg-white/5"
        style={{ borderTopColor: t.color, borderTopWidth: 4, minHeight: height }}
      >
        <span className="num text-xs font-black text-white/46">P{driver.position}</span>
        <span>
          <span className="block truncate text-sm font-black uppercase italic text-white">
            {driver.driverName}
          </span>
          <span className="mt-1 block">
            <HomeTeamBadge teamName={driver.constructorName ?? driver.team} />
          </span>
        </span>
        <span className="num text-lg font-black text-white">{driver.points}</span>
      </div>
    </Link>
  );
}

function DriverFullBody({
  code,
  name,
  teamName,
  position,
}: {
  code: string;
  name: string;
  teamName?: string | null;
  position: number;
}) {
  const t = teamOf(teamName);
  const imageHeight = position === 1 ? "h-[11rem]" : position === 2 ? "h-[9.75rem]" : "h-[8.75rem]";
  return (
    <span
      className="relative flex h-[11.5rem] w-full items-end justify-center overflow-hidden border border-white/12 bg-[#050608]"
      style={{
        borderColor: `color-mix(in oklab, ${t.color} 42%, #ffffff1f)`,
        boxShadow: `inset 0 -34px 46px color-mix(in oklab, ${t.color} 14%, transparent)`,
      }}
      title={`${name} - ${t.name}`}
    >
      <span
        className="absolute inset-x-4 bottom-2 h-8"
        style={{
          backgroundColor: `color-mix(in oklab, ${t.color} 20%, transparent)`,
          filter: "blur(18px)",
        }}
        aria-hidden
      />
      <img
        src={driverAssetPath(code, "full-body/front")}
        alt={`${name} driver portrait`}
        className={`${imageHeight} relative z-10 max-w-full object-contain object-bottom transition-transform duration-300 group-hover:scale-[1.035]`}
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

function DriverHeadshot({
  code,
  name,
  teamName,
}: {
  code: string;
  name: string;
  teamName?: string | null;
}) {
  const t = teamOf(teamName);
  return (
    <span
      className="grid size-10 shrink-0 place-items-center overflow-hidden border bg-[#050608]"
      style={{
        borderColor: `color-mix(in oklab, ${t.color} 58%, #ffffff22)`,
      }}
      title={`${name} - ${t.name}`}
    >
      <img
        src={driverAssetPath(code, "headshots")}
        alt={`${name} headshot`}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}

function driverAssetPath(code: string, set: "headshots" | "full-body/front") {
  const assetCode = code.toUpperCase() === "MAX" ? "ver" : code.toLowerCase();
  return `/assets/drivers/2026/${set}/${assetCode}.png`;
}

function ConstructorPodiumSpot({ constructor }: { constructor: ConstructorStanding }) {
  const t = teamOf(constructor.name);
  const height = podiumHeight(constructor.position);

  return (
    <Link to="/championship" className="group flex min-w-0 flex-col items-center">
      <TeamMark teamName={constructor.name} large />
      <div
        className="mt-3 flex w-full min-w-0 flex-col justify-between border border-white/12 bg-[#050608] p-3 transition-colors group-hover:bg-white/5"
        style={{ borderTopColor: t.color, borderTopWidth: 4, minHeight: height }}
      >
        <span className="num text-xs font-black text-white/46">P{constructor.position}</span>
        <span>
          <span className="block truncate text-sm font-black uppercase italic text-white">
            {t.name}
          </span>
          <span className="num text-[10px] font-black uppercase tracking-widest text-white/42">
            {constructor.wins} wins
          </span>
        </span>
        <span className="num text-lg font-black text-white">{constructor.points}</span>
      </div>
    </Link>
  );
}

function podiumHeight(position: number) {
  if (position === 1) return 210;
  if (position === 2) return 150;
  return 125;
}

function TeamMark({ teamName, large = false }: { teamName: string; large?: boolean }) {
  const t = teamOf(teamName);
  const imageSize = large ? "h-14 w-14" : "h-7 w-7";
  return (
    <span
      className={`grid shrink-0 place-items-center border ${
        large ? "size-18 p-2" : "size-10 p-1.5"
      }`}
      style={{
        borderColor: t.color,
        backgroundColor: `color-mix(in oklab, ${t.color} 10%, #050608)`,
        boxShadow: `inset 0 0 18px color-mix(in oklab, ${t.color} 16%, transparent)`,
      }}
      title={t.name}
    >
      {t.logoPng ? (
        <img
          src={t.logoPng}
          alt={`${t.name} logo`}
          className={`${imageSize} object-contain`}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="num font-black uppercase italic" style={{ color: t.color }}>
          {t.short}
        </span>
      )}
    </span>
  );
}

function HomeTeamBadge({ teamName }: { teamName?: string | null }) {
  const t = teamOf(teamName);
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span
        className="grid size-6 shrink-0 place-items-center border border-white/12 bg-[#050608] p-1"
        style={{ borderColor: `color-mix(in oklab, ${t.color} 48%, #ffffff22)` }}
        aria-hidden
      >
        {t.logoPng ? (
          <img
            src={t.logoPng}
            alt=""
            className="h-full w-full object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="num text-[8px] font-black uppercase" style={{ color: t.color }}>
            {t.short}
          </span>
        )}
      </span>
      <span className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {t.name}
      </span>
    </span>
  );
}

type RaceReport = {
  slug: string;
  round: number;
  name: string;
  circuit: string;
  dateISO: string;
  winnerName: string;
  winnerTeam: string;
  podium: string[];
  strategy: string | null;
  raceShape: string | null;
  story: string | null;
  weather: string | null;
  paceFactor: string | null;
};

function RecentRacesSection({ reports }: { reports: RaceReport[] }) {
  return (
    <section className="home-section-enter mt-10 text-white">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <h2 className="text-3xl font-black uppercase italic tracking-normal text-[#ef3340]">
          Recent Races
        </h2>
        <select
          aria-label="Season"
          defaultValue="2026"
          className="h-9 border border-white/18 bg-black px-4 text-sm font-black text-white outline-none"
        >
          <option value="2026">2026</option>
        </select>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
        {reports.slice(0, 5).map((report) => (
          <RaceCard key={report.slug} report={report} />
        ))}
      </div>
    </section>
  );
}

function RaceCard({ report }: { report: RaceReport }) {
  const t = teamOf(report.winnerTeam);

  return (
    <article className="relative w-[290px] shrink-0 snap-start overflow-hidden border border-white/12 bg-black">
      <div className="absolute inset-x-0 top-0 flex h-2">
        <span className="flex-1" style={{ backgroundColor: t.color }} />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#ef3340]" />
      </div>
      <div className="relative h-28 overflow-hidden border-b border-white/12 bg-[#050608]">
        <svg viewBox="0 0 290 112" className="absolute inset-0 h-full w-full opacity-70">
          <path
            d="M-12 86 C42 20 88 24 126 58 S210 104 306 24"
            fill="none"
            stroke="#f5f6f8"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M-12 86 C42 20 88 24 126 58 S210 104 306 24"
            fill="none"
            stroke="#050608"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M-12 86 C42 20 88 24 126 58"
            fill="none"
            stroke={t.color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M126 58 C158 88 210 104 306 24"
            fill="none"
            stroke="#ffde21"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 p-4">
          <p className="num text-[10px] font-black uppercase tracking-widest text-white/62">
            Round {report.round} - {fmtDate(report.dateISO)}
          </p>
          <h3 className="mt-2 line-clamp-2 text-lg font-black uppercase italic leading-none text-white">
            {report.name}
          </h3>
        </div>
      </div>
      <div className="p-4">
        <p className="text-xs font-black uppercase italic text-white">{report.winnerName}</p>
        <div className="mt-1">
          <HomeTeamBadge teamName={report.winnerTeam} />
        </div>
        {report.podium.length ? (
          <p className="num mt-3 text-[11px] font-black uppercase tracking-widest text-white/52">
            Podium {report.podium.slice(0, 3).join(" / ")}
          </p>
        ) : null}
        <p className="mt-3 line-clamp-3 min-h-12 text-[11px] leading-relaxed text-white/58">
          {report.paceFactor ?? report.raceShape ?? report.story ?? report.weather ?? ""}
        </p>
        <div className="mt-4 grid gap-2">
          <Link
            to="/analysis/$slug"
            params={{ slug: report.slug }}
            className="inline-flex min-h-10 items-center justify-between bg-[#ef3340] px-3 text-[11px] font-black uppercase tracking-widest text-white"
          >
            Race analysis
            <FastArrowRight className="size-4" />
          </Link>
          <Link
            to="/analysis"
            className="inline-flex min-h-9 items-center justify-between border border-white/16 bg-[#050608] px-3 text-[10px] font-black uppercase tracking-widest text-white/72"
          >
            History
            <FastArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
