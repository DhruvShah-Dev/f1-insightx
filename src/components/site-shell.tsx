import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { seasonState } from "@/data/season";
import { fmtDate, fmtDateTime } from "@/lib/format";

const nav = [
  { to: "/", label: "Race Control" },
  { to: "/raceweek", label: "Race Week" },
  { to: "/analysis", label: "Analysis" },
  { to: "/championship", label: "Championship" },
  { to: "/vs", label: "Vs" },
  { to: "/picks", label: "Picks" },
  { to: "/method", label: "Method" },
];

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient background: drifting hatch + soft corner glows (decorative) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="pw-drift absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, var(--foreground) 0 1px, transparent 1px 14px)",
          }}
        />
        <div
          className="pw-glow absolute -left-40 top-[-10rem] size-[34rem] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(closest-side, var(--primary), transparent 70%)",
            opacity: 0.14,
          }}
        />
        <div
          className="pw-glow absolute -right-40 top-[40vh] size-[30rem] rounded-full blur-3xl"
          style={{
            background: "radial-gradient(closest-side, var(--dutch-orange), transparent 70%)",
            opacity: 0.1,
          }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-lg font-black uppercase italic leading-none tracking-tight">
              F1 Insight<span className="text-primary">X</span>
            </span>
            <span className="label-xs hidden sm:inline">Race intelligence</span>
          </Link>
          <nav
            aria-label="Main"
            className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 md:order-2 md:w-auto"
          >
            {nav.slice(1).map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="border-b-2 border-transparent pb-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "border-primary text-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="order-2 ml-auto flex items-center gap-2 rounded border border-positive/25 bg-positive/10 px-2 py-1 md:order-3">
            <span className="size-1.5 rounded-full bg-positive" />
            <span className="num text-[10px] font-bold uppercase tracking-tight text-positive">
              Data live
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="label-xs">Results through</span>
          <span className="num text-foreground">
            R{seasonState.resultsThrough.round} {seasonState.resultsThrough.name}
          </span>
          <span className="text-border">/</span>
          <span className="label-xs">Race week</span>
          <span className="num text-foreground">R{seasonState.raceWeekRound}</span>
          <span className="text-border">/</span>
          <span className="label-xs">Updated</span>
          <span className="num text-foreground">{fmtDateTime(seasonState.pipelineRunISO)}</span>
          <Link to="/method" className="ml-auto text-primary underline underline-offset-2">
            How this is built
          </Link>
        </div>
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="relative z-10 mt-16 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p>
              F1 InsightX — {seasonState.season} season. Standings complete through{" "}
              {fmtDate(seasonState.resultsThrough.date)}.
            </p>
            <nav aria-label="Footer" className="flex flex-wrap gap-4 sm:ml-auto">
              {nav.map((item) => (
                <Link key={item.to} to={item.to} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <p className="max-w-3xl text-[11px] leading-relaxed text-muted-foreground/80">
            Independent, unofficial project for analysis and entertainment. Not associated with,
            endorsed by, or affiliated with Formula 1, the FIA, or any team. F1, FORMULA 1, GRAND
            PRIX and related marks are trademarks of Formula One Licensing BV. Projections and picks
            are informational only — not betting advice, and no money is staked or handled.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-border pb-2">
      <div>
        <p className="label-xs">{kicker}</p>
        <h2 className="text-xl font-black uppercase italic tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  icon,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
  note?: string | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-border bg-card/60 p-3 backdrop-blur">
      <span className="flex items-center gap-1.5">
        {icon ? <span className="text-primary">{icon}</span> : null}
        <span className="label-xs">{label}</span>
      </span>
      <span className="mt-2 flex items-baseline gap-1">
        <span className="num text-xl font-bold text-foreground">{value}</span>
        {unit ? <span className="text-xs font-bold text-muted-foreground">{unit}</span> : null}
      </span>
      {note ? <span className="mt-1 text-[11px] text-muted-foreground">{note}</span> : null}
    </div>
  );
}

