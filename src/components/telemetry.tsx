import { useState } from "react";
import type { LapPoint } from "@/lib/f1.functions";

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd400",
  HARD: "#e8e8e8",
  INTERMEDIATE: "#43b02a",
  WET: "#0067ad",
};

function compoundColor(c: string | null) {
  return COMPOUND_COLORS[(c ?? "").toUpperCase()] ?? "#5a616b";
}

export function ChannelBar({
  label,
  unit,
  hint,
  a,
  b,
  min,
  max,
  lowerIsBetter,
  colorA,
  colorB,
  codeA,
  codeB,
  digits = 3,
}: {
  label: string;
  unit?: string | undefined;
  hint?: string | undefined;

  a: number | null;
  b: number | null;
  min: number;
  max: number;
  lowerIsBetter: boolean;
  colorA: string;
  colorB: string;
  codeA: string;
  codeB: string;
  digits?: number | undefined;
}) {
  const span = max - min || 1;
  const posOf = (v: number | null) =>
    v == null ? null : Math.min(100, Math.max(0, ((v - min) / span) * 100));
  const pa = posOf(a);
  const pb = posOf(b);
  const winner =
    a == null || b == null ? null : (lowerIsBetter ? a < b : a > b) ? "a" : a === b ? null : "b";
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(digits));

  return (
    <div className="border-b border-border/60 py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="label-xs">{label}</p>
          {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="num flex items-baseline gap-3 text-xs">
          <span className={winner === "a" ? "font-bold text-positive" : "text-muted-foreground"}>
            {fmt(a)}
            {unit}
          </span>
          <span className="text-border">|</span>
          <span className={winner === "b" ? "font-bold text-positive" : "text-muted-foreground"}>
            {fmt(b)}
            {unit}
          </span>
        </div>
      </div>
      <div className="relative mt-2 h-6">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <div className="absolute inset-y-0 left-0 w-px bg-border/70" />
        <div className="absolute inset-y-0 right-0 w-px bg-border/70" />
        {pa != null ? (
          <span
            className="absolute top-0 h-6 w-[3px] -translate-x-1/2"
            style={{ left: `${pa}%`, backgroundColor: colorA }}
            title={`${codeA} ${fmt(a)}`}
          />
        ) : null}
        {pb != null ? (
          <span
            className="absolute top-1 h-4 w-[3px] -translate-x-1/2 opacity-90"
            style={{ left: `${pb}%`, backgroundColor: colorB }}
            title={`${codeB} ${fmt(b)}`}
          />
        ) : null}
      </div>
      <div className="num mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{lowerIsBetter ? "best in field" : "worst in field"}</span>
        <span>{lowerIsBetter ? "worst in field" : "best in field"}</span>
      </div>
    </div>
  );
}

type Series = { code: string; color: string; laps: LapPoint[] };

function buildPath(points: { x: number; y: number }[]) {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

type StatusPhase = { label: string; fromLap: number; toLap: number };

function phaseKind(label: string): { short: string; color: string } | null {
  const value = label.toLowerCase();
  if (value.includes("red")) return { short: "RED", color: "#f16768" };
  if (value.includes("virtual") || value.includes("vsc")) return { short: "VSC", color: "#b99aff" };
  if (value.includes("safety") || value === "sc") return { short: "SC", color: "#f6cb5b" };
  if (value.includes("yellow")) return { short: "YELLOW", color: "#f5df83" };
  if (value.includes("mixed")) return { short: "MIXED", color: "#9ba5b5" };
  return null;
}

export function LapTraceChart({
  series,
  statusPhases = [],
}: {
  series: Series[];
  statusPhases?: StatusPhase[];
}) {
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const all = series.flatMap((s) => s.laps.filter((l) => l.lapTimeS != null));
  if (all.length === 0) {
    return (
      <p className="num py-8 text-center text-xs text-muted-foreground">
        No lap telemetry stored for this race.
      </p>
    );
  }
  const times = all.map((l) => l.lapTimeS!).sort((x, y) => x - y);
  const fastest = times[0]!;
  // clip the slow tail (pit / SC laps) so the racing pace is readable
  const cap = times[Math.floor(times.length * 0.92)]! + 0.4;
  const maxLap = Math.max(...all.map((l) => l.lap));
  const W = 960;
  const H = 290;
  const padL = 54;
  const padB = 27;
  const yMin = fastest - 0.2;
  const yMax = cap;
  const x = (lap: number) => padL + ((lap - 1) / Math.max(1, maxLap - 1)) * (W - padL - 8);
  const y = (t: number) => 18 + ((yMax - Math.min(t, yMax)) / (yMax - yMin || 1)) * (H - padB - 36);

  const gridTimes = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const events = statusPhases
    .map((phase) => ({ ...phase, kind: phaseKind(phase.label) }))
    .filter((phase) => phase.kind && phase.toLap >= 1 && phase.fromLap <= maxLap);
  const current = selectedLap == null ? null : Math.min(maxLap, Math.max(1, selectedLap));
  const currentEvent =
    current == null ? null : events.find((e) => current >= e.fromLap && current <= e.toLap);

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label="Interactive lap time trace with race-control events"
        onMouseLeave={() => setSelectedLap(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - box.left) / box.width) * W;
          setSelectedLap(
            Math.min(
              maxLap,
              Math.max(1, Math.round(((px - padL) / (W - padL - 8)) * (maxLap - 1)) + 1),
            ),
          );
        }}
      >
        {events.map((event, index) => (
          <g key={`${event.label}-${event.fromLap}-${index}`}>
            <rect
              x={x(Math.max(1, event.fromLap)) - 3}
              y={10}
              width={Math.max(
                5,
                x(Math.min(maxLap, event.toLap)) - x(Math.max(1, event.fromLap)) + 6,
              )}
              height={H - padB - 10}
              fill={event.kind!.color}
              opacity="0.14"
            />
            <text
              x={x(Math.max(1, event.fromLap)) + 2}
              y={21}
              fill={event.kind!.color}
              fontSize="10"
              fontWeight="700"
            >
              {event.kind!.short}
            </text>
          </g>
        ))}
        {gridTimes.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - 8}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              className="text-border"
              strokeWidth="0.5"
            />
            <text
              x={padL - 6}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              fontSize="9"
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          const paths: { x: number; y: number }[][] = [];
          for (const lap of s.laps) {
            if (lap.lapTimeS == null || lap.lapTimeS > yMax) continue;
            const point = { x: x(lap.lap), y: y(lap.lapTimeS) };
            const previous = paths[paths.length - 1];
            if (
              previous?.length &&
              s.laps.find((item) => item.lap === lap.lap - 1)?.lapTimeS != null &&
              s.laps.find((item) => item.lap === lap.lap - 1)!.lapTimeS! <= yMax
            )
              previous.push(point);
            else paths.push([point]);
          }
          return (
            <g key={s.code}>
              {paths.map((points, index) => (
                <path
                  key={index}
                  d={buildPath(points)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {s.laps
                .filter((lap) => lap.lapTimeS != null && lap.lapTimeS > yMax)
                .map((lap) => (
                  <path
                    key={`clip-${lap.lap}`}
                    d={`M${x(lap.lap) - 4},28 L${x(lap.lap) + 4},28 L${x(lap.lap)},21 Z`}
                    fill={s.color}
                    opacity=".9"
                  />
                ))}
            </g>
          );
        })}
        {current != null ? (
          <g>
            <line
              x1={x(current)}
              x2={x(current)}
              y1={9}
              y2={H - padB}
              stroke="#e6e8e5"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity=".8"
            />
            {series.map((s) => {
              const lap = s.laps.find(
                (l) => l.lap === current && l.lapTimeS != null && l.lapTimeS <= yMax,
              );
              return lap ? (
                <circle
                  key={s.code}
                  cx={x(current)}
                  cy={y(lap.lapTimeS!)}
                  r="5"
                  fill={s.color}
                  stroke="#111216"
                  strokeWidth="2"
                />
              ) : null;
            })}
          </g>
        ) : null}
        <text x={padL} y={H - 6} className="fill-muted-foreground font-mono" fontSize="9">
          L1
        </text>
        <text
          x={W - 8}
          y={H - 6}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize="9"
        >
          L{maxLap}
        </text>
      </svg>
      <div
        className="num flex min-h-8 flex-wrap items-center gap-x-5 gap-y-1 text-xs"
        aria-live="polite"
      >
        <span className="font-bold text-foreground">
          {current == null ? "Select a lap" : `LAP ${current}`}
        </span>
        {series.map((s) => {
          const lap = current == null ? null : s.laps.find((l) => l.lap === current);
          return (
            <span key={s.code} style={{ color: s.color }}>
              <span className="font-bold">{s.code}</span>{" "}
              {lap?.lapTimeS == null ? "—" : `${lap.lapTimeS.toFixed(3)}s`}
            </span>
          );
        })}
        {currentEvent ? (
          <span style={{ color: currentEvent.kind!.color }}>
            {currentEvent.kind!.short} · L{currentEvent.fromLap}
            {currentEvent.toLap > currentEvent.fromLap ? `–${currentEvent.toLap}` : ""}
          </span>
        ) : null}
      </div>
      <input
        type="range"
        min={1}
        max={maxLap}
        value={current ?? 1}
        onChange={(event) => setSelectedLap(Number(event.target.value))}
        className="w-full accent-[#fad732]"
        aria-label="Inspect race lap"
      />
      <div className="num flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        {events.map((event, index) => (
          <span key={`${event.label}-${index}`}>
            <i
              className="mr-1 inline-block size-2 rounded-sm"
              style={{ backgroundColor: event.kind!.color }}
            />
            {event.kind!.short} L{event.fromLap}
            {event.toLap > event.fromLap ? `–${event.toLap}` : ""}
          </span>
        ))}
        <span>▲ lap above pace scale · inspect for full time</span>
      </div>
    </div>
  );
}

export function DeltaChart({ series }: { series: [Series, Series] }) {
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [a, b] = series;
  const mapB = new Map(b.laps.map((l) => [l.lap, l.lapTimeS]));
  let cum = 0;
  const pts: { lap: number; delta: number }[] = [];
  for (const l of a.laps) {
    const other = mapB.get(l.lap);
    if (l.lapTimeS == null || other == null) continue;
    const d = l.lapTimeS - other;
    if (Math.abs(d) > 25) continue; // ignore pit / SC distortion
    cum += d;
    pts.push({ lap: l.lap, delta: cum });
  }
  if (pts.length < 2) {
    return (
      <p className="num py-6 text-center text-xs text-muted-foreground">
        Not enough shared laps to build a delta trace.
      </p>
    );
  }
  const W = 720;
  const H = 150;
  const padL = 46;
  const maxAbs = Math.max(...pts.map((p) => Math.abs(p.delta))) || 1;
  const maxLap = Math.max(...pts.map((p) => p.lap));
  const x = (lap: number) => padL + ((lap - 1) / Math.max(1, maxLap - 1)) * (W - padL - 8);
  const y = (d: number) => H / 2 - (d / maxAbs) * (H / 2 - 14);
  const path = buildPath(pts.map((p) => ({ x: x(p.lap), y: y(p.delta) })));
  const last = pts[pts.length - 1]!.delta;
  const selected =
    selectedLap == null
      ? null
      : pts.reduce(
          (best, point) =>
            Math.abs(point.lap - selectedLap) < Math.abs(best.lap - selectedLap) ? point : best,
          pts[0]!,
        );

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Interactive cumulative gap"
        onMouseLeave={() => setSelectedLap(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - box.left) / box.width) * W;
          setSelectedLap(
            Math.min(
              maxLap,
              Math.max(1, Math.round(((px - padL) / (W - padL - 8)) * (maxLap - 1)) + 1),
            ),
          );
        }}
      >
        <line
          x1={padL}
          x2={W - 8}
          y1={H / 2}
          y2={H / 2}
          stroke="currentColor"
          className="text-border"
          strokeWidth="0.7"
        />
        <path
          d={`${path} L${x(maxLap).toFixed(2)},${(H / 2).toFixed(2)} L${x(1).toFixed(2)},${(H / 2).toFixed(2)} Z`}
          fill={last > 0 ? b.color : a.color}
          opacity="0.14"
        />
        <path d={path} fill="none" stroke={last > 0 ? b.color : a.color} strokeWidth="1.6" />
        {selected ? (
          <g>
            <line
              x1={x(selected.lap)}
              x2={x(selected.lap)}
              y1={8}
              y2={H - 6}
              stroke="#eeeeee"
              opacity=".7"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(selected.lap)}
              cy={y(selected.delta)}
              r={4}
              fill={selected.delta > 0 ? b.color : a.color}
            />
          </g>
        ) : null}
        <text
          x={padL - 6}
          y={20}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize="9"
        >
          +{maxAbs.toFixed(1)}
        </text>
        <text
          x={padL - 6}
          y={H - 10}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize="9"
        >
          -{maxAbs.toFixed(1)}
        </text>
      </svg>
      <div className="num mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span>Above zero: {b.code} quicker</span>
        <span>
          {selected
            ? `L${selected.lap} · ${Math.abs(selected.delta).toFixed(2)}s ${selected.delta > 0 ? b.code : a.code}`
            : `Final · ${Math.abs(last).toFixed(2)}s ${last > 0 ? b.code : a.code}`}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={maxLap}
        value={selected?.lap ?? 1}
        onChange={(event) => setSelectedLap(Number(event.target.value))}
        aria-label="Inspect cumulative gap lap"
        className="mt-2 w-full accent-[#fad732]"
      />
    </div>
  );
}

export function StintStrip({ code, color, laps }: Series) {
  const valid = laps.filter((l) => l.compound);
  if (valid.length === 0) return null;
  const maxLap = Math.max(...valid.map((l) => l.lap));
  const blocks: { compound: string; from: number; to: number }[] = [];
  for (const l of valid) {
    const prev = blocks[blocks.length - 1];
    if (prev && prev.compound === l.compound && l.lap === prev.to + 1) prev.to = l.lap;
    else blocks.push({ compound: l.compound!, from: l.lap, to: l.lap });
  }
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-[3px]" style={{ backgroundColor: color }} />
        <span className="num text-[11px] font-bold uppercase">{code}</span>
      </div>
      <div className="mt-1 flex h-4 w-full overflow-hidden rounded-sm">
        {blocks.map((b) => (
          <span
            key={`${b.compound}-${b.from}`}
            title={`${b.compound} L${b.from}–L${b.to}`}
            style={{
              width: `${((b.to - b.from + 1) / maxLap) * 100}%`,
              backgroundColor: compoundColor(b.compound),
            }}
          />
        ))}
      </div>
      <p className="num mt-1 text-[10px] text-muted-foreground">
        {blocks.map((b) => `${b.compound[0]}${b.to - b.from + 1}`).join(" → ")}
      </p>
    </div>
  );
}

export function CompoundLegend() {
  return (
    <div className="flex flex-wrap gap-3">
      {["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"].map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: compoundColor(c) }} />
          <span className="label-xs">{c}</span>
        </span>
      ))}
    </div>
  );
}
