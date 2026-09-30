import { BarChart3, BookOpen, Crosshair, Flag, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site-chrome";

export function SiteShell({ children, fullWidth = false, home = false }: { children: ReactNode; fullWidth?: boolean; home?: boolean }) {
  return (
    <div className={home ? "hx-site-shell" : "ix-page-shell"}>
      <SiteHeader />
      <main className={home ? "hx-site-main" : `race-page-enter relative z-10 mx-auto px-5 py-8 ${fullWidth ? "max-w-none" : "max-w-6xl"}`}>
        {children}
      </main>
      <SiteFooter />
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
  const Icon = /circuit|race|week|forecast/i.test(kicker)
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
      <div className="flex min-w-0 items-end gap-2.5">
        <span className="mb-0.5 grid size-7 place-items-center border border-border bg-card/70 text-primary">
          <Icon className="size-3.5" />
        </span>
        <div>
          <p className="label-xs">{kicker}</p>
          <h2 className="text-xl font-black uppercase italic tracking-tight">{title}</h2>
        </div>
      </div>
      {action ? <div className="shrink-0 text-right">{action}</div> : null}
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
