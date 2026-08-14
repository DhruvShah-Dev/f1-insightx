import { useState } from "react";
import { team } from "@/data/teams";
import { fmtDelta, fmtLapMs, fmtLapS } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Driver selector chips                                               */
/* ------------------------------------------------------------------ */

export function DriverChips({
  drivers,
  selected,
  onToggle,
}: {
  drivers: { code: string; team: string | null }[];
  selected: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {drivers.map((d) => {
        const t = team(d.team);
        const on = selected.includes(d.code);
        return (
          <button
            key={d.code}
            type="button"
            onClick={() => onToggle(d.code)}
            aria-pressed={on}
            className={`num flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all ${
              on
                ? "border-transparent text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            style={on ? { backgroundColor: t.color } : undefined}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: on ? "rgba(0,0,0,.55)" : t.color }}
            />
            {d.code}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Qualifying gap bars                                                 */
/* ------------------------------------------------------------------ */

export type QualiRow = {
  code: string;
  name: string;
  team: string;
  position: number | null;
  q1Ms: number | null;
  q2Ms: number | null;
  q3Ms: number | null;
  gapMs: number | null;
  segment: string;
};

export function QualiGapBars({ rows }: { rows: QualiRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const maxGap = Math.max(0.001, ...rows.map((r) => (r.gapMs ?? 0) / 1000));
  const best = (r: QualiRow) => r.q3Ms ?? r.q2Ms ?? r.q1Ms;

  return (
    <div className="space-y-1">
      {rows.map((r, i) => {
        const t = team(r.team);
        const gap = (r.gapMs ?? 0) / 1000;
        const w = Math.max(1.5, (gap / maxGap) * 100);
        const on = hover === r.code;
        return (
          <button
            key={r.code}
            type="button"
            onMouseEnter={() => setHover(r.code)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(r.code)}
            onBlur={() => setHover(null)}
            className={`pw-ticker flex w-full items-center gap-2 rounded px-1.5 py-1 text-left transition-colors ${
              on ? "bg-accent/50" : ""
            }`}
            style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}
          >
            <span className="num w-5 shrink-0 text-right text-[10px] text-muted-foreground">
              {r.position ?? "—"}
            </span>
            <span className="num w-10 shrink-0 text-[11px] font-black uppercase">{r.code}</span>
            <span className="num hidden w-20 shrink-0 text-[11px] tabular-nums sm:block">
              {fmtLapMs(best(r))}
            </span>
            <span className="relative h-3 flex-1 overflow-hidden rounded-sm bg-secondary/60">
              <span
                className="absolute inset-y-0 left-0 rounded-sm transition-[width] duration-500"
                style={{
                  width: `${w}%`,
                  backgroundColor: t.color,
                  opacity: on ? 1 : 0.8,
                }}
              />
            </span>
            <span className="num w-14 shrink-0 text-right text-[11px] text-muted-foreground">
              {r.gapMs == null ? "—" : gap === 0 ? "pole" : fmtDelta(gap)}
            </span>
            <span
              className={`num hidden w-8 shrink-0 text-right text-[10px] uppercase sm:block ${
                r.segment === "Q3" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {r.segment}
            </span>
          </button>
        );
      })}
      {hover ? <SegmentPeek row={rows.find((r) => r.code === hover)!} /> : null}
    </div>
  );
}

function SegmentPeek({ row }: { row: QualiRow }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 rounded border border-border bg-card/60 p-2">
      <span className="num text-[11px] font-black uppercase">{row.name}</span>
      {[
        { k: "Q1", v: row.q1Ms },
        { k: "Q2", v: row.q2Ms },
        { k: "Q3", v: row.q3Ms },
      ].map((x) => (
        <span key={x.k} className="flex items-baseline gap-1">
          <span className="label-xs">{x.k}</span>
          <span className="num text-[11px]">{fmtLapMs(x.v)}</span>
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Grid → flag ribbon                                                  */
/* ------------------------------------------------------------------ */

export type PositionRow = {
  code: string;
  name: string;
  team: string;
  start: number | null;
  finish: number | null;
  net: number | null;
};

export function PositionRibbon({ rows }: { rows: PositionRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const usable = rows.filter((r) => r.start != null && r.finish != null);
  if (!usable.length)
    return <p className="num py-6 text-center text-xs text-muted-foreground">No grid data stored.</p>;

  const n = Math.max(...usable.flatMap((r) => [r.start!, r.finish!]));
  const W = 900;
  const H = Math.max(320, n * 26);
  const y = (pos: number) => 20 + ((pos - 1) / Math.max(1, n - 1)) * (H - 40);
  const L = 120;
  const R = W - 120;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Grid to flag ribbon">
        <text x={L - 50} y="12" textAnchor="middle" fontSize="11" className="fill-muted-foreground font-mono">
          GRID
        </text>
        <text x={R + 50} y="12" textAnchor="middle" fontSize="11" className="fill-muted-foreground font-mono">
          FLAG
        </text>
        {usable.map((r) => {
          const t = team(r.team);
          const on = hover === r.code;
          const dim = hover != null && !on;
          const y1 = y(r.start!);
          const y2 = y(r.finish!);
          return (
            <g
              key={r.code}
              opacity={dim ? 0.18 : 1}
              onMouseEnter={() => setHover(r.code)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer" }}
            >
              <path
                d={`M${L},${y1} C${W / 2},${y1} ${W / 2},${y2} ${R},${y2}`}
                fill="none"
                stroke={t.color}
                strokeWidth={on ? 4 : 2}
              />
              <text x={L - 10} y={y1 + 4} textAnchor="end" fontSize="12" className="fill-foreground font-mono">
                {r.start} {r.code}
              </text>
              <text
                x={R + 10}
                y={y2 + 4}
                textAnchor="start"
                fontSize="12"
                className="fill-foreground font-mono"
              >
                {r.finish} {r.code}
              </text>
              <circle cx={L} cy={y1} r={on ? 4.5 : 3} fill={t.color} />
              <circle cx={R} cy={y2} r={on ? 4.5 : 3} fill={t.color} />
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
          <span className="num rounded border border-border bg-card px-2 py-1 text-[11px]">
            {(() => {
              const r = usable.find((x) => x.code === hover)!;
              const net = (r.start ?? 0) - (r.finish ?? 0);
              return `${r.name} · ${net > 0 ? `+${net} gained` : net < 0 ? `${net} lost` : "held station"}`;
            })()}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Race pace dot plot                                                  */
/* ------------------------------------------------------------------ */

export type PaceRow = {
  code: string;
  name: string;
  team?: string | null;
  medianFuelDeltaS: number | null;
  bestLapS: number | null;
  lapCount: number;
};

export function PaceDots({ rows }: { rows: PaceRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const vals = rows.map((r) => r.medianFuelDeltaS).filter((v): v is number => v != null);
  if (!vals.length)
    return <p className="num py-6 text-center text-xs text-muted-foreground">No pace model stored.</p>;
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  return (
    <div className="space-y-1">
      {rows.map((r, i) => {
        const t = team(r.team);
        const v = r.medianFuelDeltaS;
        const pct = v == null ? 0 : ((v - min) / (max - min || 1)) * 100;
        const on = hover === r.code;
        return (
          <button
            key={r.code}
            type="button"
            onMouseEnter={() => setHover(r.code)}
            onMouseLeave={() => setHover(null)}
            className={`pw-ticker flex w-full items-center gap-2 rounded px-1.5 py-1 text-left ${
              on ? "bg-accent/50" : ""
            }`}
            style={{ animationDelay: `${Math.min(i, 14) * 26}ms` }}
          >
            <span className="num w-5 text-right text-[10px] text-muted-foreground">{i + 1}</span>
            <span className="num w-10 text-[11px] font-black uppercase">{r.code}</span>
            <span className="relative h-4 flex-1">
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <span
                className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full ring-2 ring-background transition-all"
                style={{
                  left: `calc(${pct}% - 5px)`,
                  backgroundColor: t.color,
                  transform: on ? "translateY(-50%) scale(1.4)" : undefined,
                }}
              />
            </span>
            <span className="num w-14 text-right text-[11px]">
              {v == null ? "—" : fmtDelta(v)}
            </span>
            <span className="num hidden w-20 text-right text-[11px] text-muted-foreground sm:block">
              {fmtLapS(r.bestLapS)}
            </span>
            <span className="num hidden w-8 text-right text-[10px] text-muted-foreground sm:block">
              {r.lapCount}
            </span>
          </button>
        );
      })}
      <p className="num px-1.5 text-[10px] text-muted-foreground">
        Left = quickest fuel-corrected median · right = slowest
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pit stop timeline                                                   */
/* ------------------------------------------------------------------ */

export type PitRow = {
  code: string;
  team: string;
  stop: number | null;
  lap: number | null;
  from: string | null;
  to: string | null;
  posBefore: number | null;
  posAfter: number | null;
  net: number | null;
  label: string | null;
  effect: string | null;
};

export function PitTimeline({ pits, maxLap }: { pits: PitRow[]; maxLap: number }) {
  const [active, setActive] = useState<PitRow | null>(null);
  const byDriver = new Map<string, PitRow[]>();
  for (const p of pits) {
    const list = byDriver.get(p.code) ?? [];
    list.push(p);
    byDriver.set(p.code, list);
  }
  const total = Math.max(maxLap, ...pits.map((p) => p.lap ?? 0), 1);

  return (
    <div>
      <div className="space-y-1">
        {[...byDriver.entries()].map(([code, list], i) => {
          const t = team(list[0]!.team);
          return (
            <div
              key={code}
              className="pw-ticker flex items-center gap-2"
              style={{ animationDelay: `${Math.min(i, 14) * 26}ms` }}
            >
              <span className="num w-10 text-[11px] font-black uppercase">{code}</span>
              <span className="relative h-5 flex-1 rounded-sm bg-secondary/40">
                {list.map((p) => {
                  const left = ((p.lap ?? 0) / total) * 100;
                  const net = p.net ?? 0;
                  return (
                    <button
                      key={`${p.stop}-${p.lap}`}
                      type="button"
                      onMouseEnter={() => setActive(p)}
                      onFocus={() => setActive(p)}
                      onClick={() => setActive(p)}
                      aria-label={`${code} stop ${p.stop} on lap ${p.lap}`}
                      className="absolute top-1/2 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[8px] font-black transition-transform hover:scale-125"
                      style={{
                        left: `${left}%`,
                        backgroundColor: t.color,
                        borderColor: net > 0 ? "#35c759" : net < 0 ? "var(--destructive)" : "transparent",
                        color: "rgba(0,0,0,.7)",
                      }}
                    >
                      {p.stop ?? ""}
                    </button>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="num text-[10px] text-muted-foreground">L1</span>
        <span className="num text-[10px] text-muted-foreground">L{total}</span>
      </div>
      <div className="mt-2 min-h-9 rounded border border-border bg-card/60 p-2">
        {active ? (
          <p className="num text-[11px]">
            <span className="font-black uppercase">{active.code}</span> · stop {active.stop} · lap{" "}
            {active.lap} ·{" "}
            {[active.from, active.to].filter(Boolean).join(" → ") || "compound n/a"} · P
            {active.posBefore ?? "?"} → P{active.posAfter ?? "?"}{" "}
            <span
              style={{
                color:
                  (active.net ?? 0) > 0
                    ? "#35c759"
                    : (active.net ?? 0) < 0
                      ? "var(--destructive)"
                      : undefined,
              }}
            >
              {active.net == null ? "" : `(${fmtDelta(active.net, 0)})`}
            </span>
          </p>
        ) : (
          <p className="num text-[11px] text-muted-foreground">
            Hover a stop marker for the pit cycle detail.
          </p>
        )}
      </div>
    </div>
  );
}
