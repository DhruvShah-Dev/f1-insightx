import { useMemo, useState } from "react";
import type { TrackPath, TrafficLap } from "@/lib/f1.functions";
import { fmtLapS, fmtNum, titleCase } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Inputs                                                             */
/* ------------------------------------------------------------------ */

export type DomLapInput = {
  lap: number;
  lapTimeS: number | null;
  fuelCorrectedDeltaS: number | null;
  compound: string | null;
  tyreAge: number | null;
};

export type DomPitInput = {
  lap: number | null;
  lossS: number | null;
  from: string | null;
  to: string | null;
  label: string | null;
};

export type StatusPhase = { label: string; fromLap: number; toLap: number };

type SideLap = {
  timeS: number | null;
  compound: string | null;
  tyreAge: number | null;
  pit: DomPitInput | null;
  outLap: boolean;
  traffic: string | null;
  dirtyAirS: number | null;
  /** seconds slower than this driver's own recent baseline */
  spikeS: number | null;
  cause: string | null;
};

export type DomLap = {
  lap: number;
  a: SideLap;
  b: SideLap;
  /** a − b, negative means A quicker */
  deltaS: number | null;
  winner: "a" | "b" | null;
  neutral: string | null;
};

const NEUTRAL_RE = /safety|vsc|red|yellow|caution/i;

function isNeutral(label: string | null | undefined) {
  return Boolean(label && NEUTRAL_RE.test(label));
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
}

/**
 * Builds the per-lap dominance model from stored rows only: lap times decide the
 * faster driver, and every pace spike is attributed to a stored cause (pit lap,
 * out lap, neutralised phase, traffic label, fresh compound) instead of a guess.
 */
export function buildDominance({
  lapsA,
  lapsB,
  pitsA,
  pitsB,
  trafficA,
  trafficB,
  statusPhases,
}: {
  lapsA: DomLapInput[];
  lapsB: DomLapInput[];
  pitsA: DomPitInput[];
  pitsB: DomPitInput[];
  trafficA: TrafficLap[];
  trafficB: TrafficLap[];
  statusPhases: StatusPhase[];
}): DomLap[] {
  const byLap = (rows: DomLapInput[]) => new Map(rows.map((r) => [r.lap, r]));
  const ma = byLap(lapsA);
  const mb = byLap(lapsB);
  const ta = new Map(trafficA.map((r) => [r.lap, r]));
  const tb = new Map(trafficB.map((r) => [r.lap, r]));
  const pitLap = (pits: DomPitInput[], lap: number) =>
    pits.find((p) => p.lap === lap) ?? null;
  const wasPit = (pits: DomPitInput[], lap: number) => pits.some((p) => p.lap === lap - 1);

  const statusAt = (lap: number) =>
    statusPhases.find((p) => lap >= p.fromLap && lap <= p.toLap && isNeutral(p.label))?.label ??
    null;

  const laps = [...new Set([...ma.keys(), ...mb.keys()])].sort((x, y) => x - y);

  const rollingBaseline = (rows: DomLapInput[]) => {
    const clean = rows
      .filter((r) => r.lapTimeS != null)
      .map((r) => r.lapTimeS!)
      .sort((x, y) => x - y);
    // use the quicker 60% of laps as the driver's own reference pace
    const keep = clean.slice(0, Math.max(3, Math.floor(clean.length * 0.6)));
    return median(keep);
  };
  const baseA = rollingBaseline(lapsA);
  const baseB = rollingBaseline(lapsB);

  const side = (
    row: DomLapInput | undefined,
    pits: DomPitInput[],
    traffic: TrafficLap | undefined,
    base: number | null,
    lap: number,
    neutral: string | null,
  ): SideLap => {
    const pit = pitLap(pits, lap);
    const outLap = wasPit(pits, lap);
    const label = traffic?.label ?? null;
    const dirty = traffic?.dirtyAirS ?? null;
    const spike =
      row?.lapTimeS != null && base != null ? Number((row.lapTimeS - base).toFixed(3)) : null;
    let cause: string | null = null;
    if (spike != null && spike > 1.2) {
      if (pit) cause = `Pit stop L${lap}${pit.lossS != null ? ` · ${pit.lossS.toFixed(1)}s stationary+lane` : ""}`;
      else if (outLap) cause = "Out lap on new tyres";
      else if (neutral) cause = titleCase(neutral) || "Neutralised";
      else if (label && /traffic/i.test(label))
        cause = `In traffic${dirty != null ? ` · dirty air ${dirty.toFixed(2)}s` : ""}`;
      else if (lap === 1) cause = "Race start / lap 1 traffic";
      else if (spike > 8) cause = "Heavy time loss · in-lap or off-track (no phase stored)";
      else if ((row?.tyreAge ?? 0) >= 15) cause = `Worn tyres · ${row?.tyreAge} laps old`;
      else cause = "No stored cause";
    }
    return {
      timeS: row?.lapTimeS ?? null,
      compound: row?.compound ?? null,
      tyreAge: row?.tyreAge ?? null,
      pit,
      outLap,
      traffic: label,
      dirtyAirS: dirty,
      spikeS: spike,
      cause,
    };
  };

  return laps.map((lap) => {
    const neutral = statusAt(lap);
    const a = side(ma.get(lap), pitsA, ta.get(lap), baseA, lap, neutral);
    const b = side(mb.get(lap), pitsB, tb.get(lap), baseB, lap, neutral);
    const delta = a.timeS != null && b.timeS != null ? a.timeS - b.timeS : null;
    return {
      lap,
      a,
      b,
      deltaS: delta,
      winner: delta == null ? null : delta < 0 ? "a" : delta > 0 ? "b" : null,
      neutral,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Track dominance ring                                               */
/* ------------------------------------------------------------------ */

type Pt = { x: number; y: number };

function parsePath(pathData: string): Pt[] {
  const nums = pathData.match(/-?\d+(\.\d+)?/g);
  if (!nums) return [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  return pts;
}

function normalise(pts: Pt[], size: number, pad: number) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - minX);
  const h = Math.max(1, Math.max(...ys) - minY);
  const scale = (size - pad * 2) / Math.max(w, h);
  const offX = pad + (size - pad * 2 - w * scale) / 2;
  const offY = pad + (size - pad * 2 - h * scale) / 2;
  return pts.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }));
}

const toPath = (slice: Pt[]) =>
  slice.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/** Splits the circuit outline into one arc per race lap, coloured by the faster driver. */
export function TrackDominanceRing({
  path,
  laps,
  colorA,
  colorB,
  codeA,
  codeB,
  selected,
  onSelect,
}: {
  path: TrackPath | null;
  laps: DomLap[];
  colorA: string;
  colorB: string;
  codeA: string;
  codeB: string;
  selected: number | null;
  onSelect: (lap: number | null) => void;
}) {
  const model = useMemo(() => {
    if (!path?.pathData) return null;
    const raw = parsePath(path.pathData);
    if (raw.length < 8) return null;
    const size = 100;
    const pts = normalise(raw, size, 9);
    const closed = [...pts, pts[0]!];
    const cum: number[] = [0];
    for (let i = 1; i < closed.length; i++) {
      cum.push(cum[i - 1]! + Math.hypot(closed[i]!.x - closed[i - 1]!.x, closed[i]!.y - closed[i - 1]!.y));
    }
    const total = cum[cum.length - 1]!;
    const at = (dist: number) => {
      let i = 1;
      while (i < cum.length && cum[i]! < dist) i++;
      const p0 = closed[i - 1]!;
      const p1 = closed[Math.min(i, closed.length - 1)]!;
      const seg = cum[Math.min(i, cum.length - 1)]! - cum[i - 1]!;
      const t = seg > 0 ? (dist - cum[i - 1]!) / seg : 0;
      return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
    };
    const slice = (from: number, to: number) => {
      const out: Pt[] = [at(from)];
      for (let i = 1; i < closed.length; i++) {
        if (cum[i]! > from && cum[i]! < to) out.push(closed[i]!);
      }
      out.push(at(to));
      return out;
    };
    return { full: toPath(closed), total, slice, at };
  }, [path?.pathData]);

  if (!model || !laps.length) {
    return (
      <p className="num py-8 text-center text-xs text-muted-foreground">
        No stored circuit geometry or lap times for this pairing.
      </p>
    );
  }

  const n = laps.length;
  const seg = model.total / n;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full"
      role="img"
      aria-label={`Track dominance ring: each arc is one race lap coloured by the faster of ${codeA} and ${codeB}`}
      onMouseLeave={() => onSelect(null)}
    >
      <path d={model.full} fill="none" stroke="var(--border)" strokeWidth={7} strokeLinejoin="round" />
      {laps.map((l, i) => {
        const from = i * seg;
        const to = (i + 1) * seg - seg * 0.12;
        const color = l.winner === "a" ? colorA : l.winner === "b" ? colorB : "var(--border)";
        const gap = l.deltaS == null ? 0 : Math.min(1, Math.abs(l.deltaS) / 1.5);
        const on = selected === l.lap;
        return (
          <path
            key={l.lap}
            d={toPath(model.slice(from, to))}
            fill="none"
            stroke={color}
            strokeWidth={on ? 6.5 : 3 + gap * 2.5}
            strokeLinecap="butt"
            opacity={l.winner == null ? 0.35 : on ? 1 : 0.55 + gap * 0.45}
            onMouseEnter={() => onSelect(l.lap)}
            className="cursor-pointer"
          />
        );
      })}
      {/* pit-stop markers, positioned on the lap they happened */}
      {laps.flatMap((l, i) =>
        [
          { p: l.a.pit, color: colorA },
          { p: l.b.pit, color: colorB },
        ]
          .filter((x) => x.p)
          .map((x, k) => {
            const pt = model.at(Math.min(model.total, (i + 0.5) * seg));
            return (
              <circle
                key={`${l.lap}-${k}`}
                cx={pt.x}
                cy={pt.y}
                r={1.9}
                fill={x.color}
                stroke="var(--background)"
                strokeWidth={0.7}
              />
            );
          }),
      )}
      {/* neutralised laps */}
      {laps.map((l, i) =>
        l.neutral ? (
          <path
            key={`n-${l.lap}`}
            d={toPath(model.slice(i * seg, (i + 1) * seg))}
            fill="none"
            stroke="#ffd400"
            strokeWidth={9}
            opacity={0.14}
          />
        ) : null,
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Per-lap dominance strip                                            */
/* ------------------------------------------------------------------ */

type PhaseBand = { label: string; from: number; to: number };

/** Groups contiguous neutralised laps into labelled bands aligned to the strip. */
function neutralBands(laps: DomLap[]): PhaseBand[] {
  const out: PhaseBand[] = [];
  laps.forEach((l, i) => {
    if (!l.neutral) return;
    const prev = out[out.length - 1];
    if (prev && prev.label === l.neutral && prev.to === i - 1) prev.to = i;
    else out.push({ label: l.neutral, from: i, to: i });
  });
  return out;
}

export function DominanceStrip({
  laps,
  colorA,
  colorB,
  codeA,
  codeB,
  selected,
  onSelect,
}: {
  laps: DomLap[];
  colorA: string;
  colorB: string;
  codeA: string;
  codeB: string;
  selected: number | null;
  onSelect: (lap: number | null) => void;
}) {
  const maxAbs = Math.max(0.4, ...laps.map((l) => Math.abs(l.deltaS ?? 0)));
  const cap = Math.min(maxAbs, 4);
  const cur = laps.find((l) => l.lap === selected) ?? null;
  const n = laps.length;
  const bands = useMemo(() => neutralBands(laps), [laps]);
  const pct = (i: number) => (i / n) * 100;

  const pitLane = (side: "a" | "b", color: string, code: string) => (
    <div className="flex items-center gap-2">
      <span className="num w-9 shrink-0 text-right text-[9px] font-black uppercase" style={{ color }}>
        {code}
      </span>
      <div className="relative h-5 flex-1 rounded bg-background/60 ring-1 ring-inset ring-border">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {laps.map((l, i) => {
          const p = side === "a" ? l.a.pit : l.b.pit;
          if (!p) return null;
          return (
            <button
              key={l.lap}
              type="button"
              onMouseEnter={() => onSelect(l.lap)}
              onFocus={() => onSelect(l.lap)}
              onClick={() => onSelect(l.lap)}
              aria-label={`${code} pit stop on lap ${l.lap}${p.lossS != null ? `, ${p.lossS.toFixed(1)}s lost` : ""}`}
              className="absolute top-0 h-full -translate-x-1/2 focus:outline-none"
              style={{ left: `${pct(i + 0.5)}%` }}
            >
              <span
                className="block h-full w-[3px] rounded-full"
                style={{ backgroundColor: color, opacity: selected === l.lap ? 1 : 0.85 }}
              />
              <span
                className="num absolute left-1/2 top-1/2 -translate-y-1/2 translate-x-1 whitespace-nowrap text-[9px] font-bold"
                style={{ color }}
              >
                L{l.lap}
                {p.lossS != null ? ` ${p.lossS.toFixed(1)}s` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="num text-[10px] font-black uppercase tracking-wider" style={{ color: colorA }}>
          {codeA} quicker ↑
        </span>
        <span className="num text-[10px] text-muted-foreground">±{cap.toFixed(1)}s per lap</span>
        <span className="num text-[10px] font-black uppercase tracking-wider" style={{ color: colorB }}>
          {codeB} quicker ↓
        </span>
      </div>

      {/* neutralisation timeline above the strip */}
      <div className="relative mt-2 h-4">
        {bands.map((b) => (
          <span
            key={`${b.label}-${b.from}`}
            className="num absolute top-0 flex h-4 items-center justify-center overflow-hidden rounded-sm border border-[#ffd400]/50 bg-[#ffd400]/15 px-1 text-[9px] font-black uppercase tracking-wider text-[#ffd400]"
            style={{ left: `${pct(b.from)}%`, width: `${pct(b.to - b.from + 1)}%` }}
            title={`${titleCase(b.label)} · laps ${laps[b.from]!.lap}–${laps[b.to]!.lap}`}
          >
            {b.to - b.from >= 1 ? titleCase(b.label) : "SC"}
          </span>
        ))}
      </div>

      <div className="relative mt-1 flex h-28 items-stretch gap-px" onMouseLeave={() => onSelect(null)}>
        {/* neutralisation wash behind the bars */}
        {bands.map((b) => (
          <span
            key={`wash-${b.from}`}
            className="pointer-events-none absolute inset-y-0 border-x border-dashed border-[#ffd400]/40 bg-[#ffd400]/10"
            style={{ left: `${pct(b.from)}%`, width: `${pct(b.to - b.from + 1)}%` }}
          />
        ))}
        {laps.map((l) => {
          const d = l.deltaS;
          const frac = d == null ? 0 : Math.min(1, Math.abs(d) / cap);
          const aQuick = (d ?? 0) < 0;
          const on = selected === l.lap;
          return (
            <button
              key={l.lap}
              type="button"
              onMouseEnter={() => onSelect(l.lap)}
              onFocus={() => onSelect(l.lap)}
              onClick={() => onSelect(l.lap)}
              aria-label={`Lap ${l.lap}`}
              className="relative flex-1 focus:outline-none"
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <span
                className="absolute left-0 right-0"
                style={{
                  backgroundColor: d == null ? "var(--border)" : aQuick ? colorA : colorB,
                  opacity: d == null ? 0.4 : on ? 1 : 0.75,
                  height: `${Math.max(2, frac * 46)}%`,
                  ...(aQuick ? { bottom: "50%" } : { top: "50%" }),
                }}
              />
              {l.a.pit ? (
                <span
                  className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2"
                  style={{ backgroundColor: colorA, opacity: 0.55 }}
                />
              ) : null}
              {l.b.pit ? (
                <span
                  className="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2"
                  style={{ backgroundColor: colorB, opacity: 0.55 }}
                />
              ) : null}
              {on ? <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/50" /> : null}
            </button>
          );
        })}
      </div>

      {/* pit-stop timeline lanes */}
      <div className="mt-2 space-y-1">
        <p className="label-xs">Pit-stop timeline</p>
        {pitLane("a", colorA, codeA)}
        {pitLane("b", colorB, codeB)}
      </div>

      <div className="num mt-2 flex flex-wrap items-center gap-3 text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 border border-[#ffd400]/50 bg-[#ffd400]/20" />
          neutralised phase
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-[3px]" style={{ backgroundColor: colorA }} />
          {codeA} pit
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-[3px]" style={{ backgroundColor: colorB }} />
          {codeB} pit
        </span>
      </div>

      <div className="num mt-2 grid gap-1 rounded-lg border border-border bg-background/40 p-2 text-[11px] sm:grid-cols-3">
        <span className="text-muted-foreground">
          {cur ? `Lap ${cur.lap}` : "Hover a lap for the full telemetry read"}
          {cur?.neutral ? ` · ${titleCase(cur.neutral)}` : ""}
        </span>
        {cur
          ? (
              [
                { code: codeA, color: colorA, s: cur.a },
                { code: codeB, color: colorB, s: cur.b },
              ] as const
            ).map(({ code, color, s }) => (
              <span key={code} className="flex flex-wrap items-center gap-1.5">
                <span className="font-black uppercase" style={{ color }}>
                  {code}
                </span>
                <span>{fmtLapS(s.timeS)}</span>
                <span className="text-muted-foreground">
                  {titleCase(s.compound) || "—"}
                  {s.tyreAge != null ? ` ${s.tyreAge}L` : ""}
                  {s.pit
                    ? ` · PIT${s.pit.lossS != null ? ` ${s.pit.lossS.toFixed(1)}s` : ""}`
                    : s.outLap
                      ? " · out lap"
                      : ""}
                  {s.traffic && /traffic/i.test(s.traffic) ? " · traffic" : ""}
                </span>
              </span>
            ))
          : null}
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Pace-drop attribution                                              */
/* ------------------------------------------------------------------ */

export function PaceDropTable({
  laps,
  codeA,
  codeB,
  colorA,
  colorB,
  onSelect,
}: {
  laps: DomLap[];
  codeA: string;
  codeB: string;
  colorA: string;
  colorB: string;
  onSelect: (lap: number | null) => void;
}) {
  const events = laps
    .flatMap((l) => [
      ...(l.a.cause ? [{ lap: l.lap, code: codeA, color: colorA, s: l.a }] : []),
      ...(l.b.cause ? [{ lap: l.lap, code: codeB, color: colorB, s: l.b }] : []),
    ])
    .sort((x, y) => (y.s.spikeS ?? 0) - (x.s.spikeS ?? 0))
    .slice(0, 14);

  if (!events.length) {
    return (
      <p className="num py-4 text-xs text-muted-foreground">
        No lap was more than 1.2s off either driver&apos;s own reference pace.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[520px] text-[11px]">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-1.5 pr-2">Lap</th>
            <th className="py-1.5 pr-2">Driver</th>
            <th className="py-1.5 pr-2">Lap time</th>
            <th className="py-1.5 pr-2">Lost</th>
            <th className="py-1.5">Why</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr
              key={`${e.lap}-${e.code}`}
              onMouseEnter={() => onSelect(e.lap)}
              className="border-b border-border/50 last:border-b-0 hover:bg-card/60"
            >
              <td className="py-1.5 pr-2 font-bold">L{e.lap}</td>
              <td className="py-1.5 pr-2 font-black uppercase" style={{ color: e.color }}>
                {e.code}
              </td>
              <td className="py-1.5 pr-2">{fmtLapS(e.s.timeS)}</td>
              <td className="py-1.5 pr-2 text-destructive">+{fmtNum(e.s.spikeS, 2)}s</td>
              <td className="py-1.5 text-muted-foreground">{e.s.cause}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Headline dominance numbers                                         */
/* ------------------------------------------------------------------ */

export function DominanceSummary({
  laps,
  codeA,
  codeB,
  colorA,
  colorB,
}: {
  laps: DomLap[];
  codeA: string;
  codeB: string;
  colorA: string;
  colorB: string;
}) {
  const scored = laps.filter((l) => l.winner);
  const wonA = scored.filter((l) => l.winner === "a").length;
  const wonB = scored.filter((l) => l.winner === "b").length;
  const streak = (side: "a" | "b") => {
    let best = 0;
    let run = 0;
    for (const l of laps) {
      if (l.winner === side) run += 1;
      else run = 0;
      best = Math.max(best, run);
    }
    return best;
  };
  const deltas = laps.map((l) => l.deltaS).filter((d): d is number => d != null && Math.abs(d) < 8);
  const meanDelta = deltas.length ? deltas.reduce((x, y) => x + y, 0) / deltas.length : null;

  const tiles: { l: string; v: string; color?: string | undefined }[] = [
    { l: `${codeA} laps quicker`, v: String(wonA), color: colorA },
    { l: `${codeB} laps quicker`, v: String(wonB), color: colorB },
    { l: "Best streak", v: `${codeA} ${streak("a")} · ${codeB} ${streak("b")}` },
    {
      l: "Mean lap delta",
      v: meanDelta == null ? "—" : `${Math.abs(meanDelta).toFixed(3)}s to ${meanDelta < 0 ? codeA : codeB}`,
      color: meanDelta == null ? undefined : meanDelta < 0 ? colorA : colorB,
    },
    { l: "Laps compared", v: String(scored.length) },
    {
      l: "Neutralised laps",
      v: String(laps.filter((l) => l.neutral).length),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.l} className="rounded-lg border border-border bg-background/40 p-2.5">
          <p className="label-xs truncate">{t.l}</p>
          <p className="num mt-1 text-sm font-black" style={t.color ? { color: t.color } : undefined}>
            {t.v}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Shared hover state helper for the dominance panel. */
export function useSelectedLap() {
  return useState<number | null>(null);
}
