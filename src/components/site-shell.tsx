import { Link } from "@tanstack/react-router";
import { BarChart3, BookOpen, Crosshair, Flag, Home, ShieldCheck, Swords, Trophy, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { StartLightRails } from "@/components/race-atmosphere";
import { seasonState } from "@/data/season";
import { fmtDate } from "@/lib/format";

const nav = [
  { to: "/", label: "Race Control", icon: Home },
  { to: "/raceweek", label: "Race Week", icon: Flag },
  { to: "/analysis", label: "Analysis", icon: BarChart3 },
  { to: "/championship", label: "Championship", icon: Trophy },
  { to: "/vs", label: "Vs", icon: Swords },
  { to: "/picks", label: "Picks", icon: Crosshair },
  { to: "/method", label: "Method", icon: BookOpen },
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
      <StartLightRails />

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="race-mark grid size-8 place-items-center rounded-sm border border-primary/70 bg-primary text-[11px] font-black italic text-primary-foreground shadow-[0_0_22px_color-mix(in_oklab,var(--primary)_50%,transparent)]">IX</span>
            <span className="flex items-baseline gap-2">
              <span className="font-display text-lg font-black uppercase italic leading-none tracking-tight">
                F1 Insight<span className="text-primary">X</span>
              </span>
              <span className="label-xs hidden sm:inline">Race intelligence</span>
            </span>
          </Link>
          <nav
            aria-label="Main"
            className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 md:order-2 md:w-auto"
          >
            {nav.slice(1).map((item) => {
              const Icon = item.icon;
              return <Link
                key={item.to}
                to={item.to}
                className="group inline-flex items-center gap-1.5 border-b-2 border-transparent pb-0.5 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "border-primary text-foreground" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <Icon className="size-3 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:opacity-100" />
                {item.label}
              </Link>
            })}
          </nav>
          <Link
            to="/account"
            className="order-2 ml-auto inline-flex min-h-8 items-center gap-2 border border-border bg-card/70 px-3 text-[10px] font-black uppercase tracking-widest text-foreground transition-colors hover:border-primary hover:bg-accent md:order-3"
            activeProps={{ className: "border-primary bg-primary text-primary-foreground" }}
          >
            <UserRound className="size-3.5" />
            Account
          </Link>
        </div>
      </header>

      <main className="race-page-enter relative z-10 mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="relative z-10 mt-16 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-primary" />
              F1 InsightX — {seasonState.season} season. Standings complete through{" "}
              {fmtDate(seasonState.resultsThrough.date)}.
            </p>
            <nav aria-label="Footer" className="flex flex-wrap gap-4 sm:ml-auto">
              {nav.map((item) => {
                const Icon = item.icon;
                return <Link key={item.to} to={item.to} className="inline-flex items-center gap-1.5 hover:text-foreground">
                  <Icon className="size-3" />
                  {item.label}
                </Link>
              })}
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
  const Icon =
    /circuit|race|week|forecast/i.test(kicker)
      ? Flag
      : /championship|standing/i.test(kicker)
        ? Trophy
        : /pick|prediction/i.test(kicker)
          ? Crosshair
          : /method|guide/i.test(kicker)
            ? BookOpen
            : BarChart3;

  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-border pb-2">
      <div className="flex items-end gap-2.5">
        <span className="mb-0.5 grid size-7 place-items-center border border-border bg-card/70 text-primary">
          <Icon className="size-3.5" />
        </span>
        <div>
        <p className="label-xs">{kicker}</p>
        <h2 className="text-xl font-black uppercase italic tracking-tight">{title}</h2>
        </div>
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

