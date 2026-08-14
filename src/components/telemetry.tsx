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
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

export function LapTraceChart({ series }: { series: Series[] }) {
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
  const W = 720;
  const H = 220;
  const padL = 46;
  const padB = 22;
  const yMin = fastest - 0.2;
  const yMax = cap;
  const x = (lap: number) => padL + ((lap - 1) / Math.max(1, maxLap - 1)) * (W - padL - 8);
  const y = (t: number) =>
    8 + ((Math.min(t, yMax) - yMin) / (yMax - yMin || 1)) * (H - padB - 8 - 8);

  const gridTimes = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Lap time trace">
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
        const pts = s.laps
          .filter((l) => l.lapTimeS != null && l.lapTimeS! <= yMax)
          .map((l) => ({ x: x(l.lap), y: y(l.lapTimeS!) }));
        return (
          <path
            key={s.code}
            d={buildPath(pts)}
            fill="none"
            stroke={s.color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        );
      })}
      <text
        x={padL}
        y={H - 6}
        className="fill-muted-foreground font-mono"
        fontSize="9"
      >
        L1
      </text>
      <text x={W - 8} y={H - 6} textAnchor="end" className="fill-muted-foreground font-mono" fontSize="9">
        L{maxLap}
      </text>
    </svg>
  );
}

export function DeltaChart({ series }: { series: [Series, Series] }) {
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

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative gap">
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
        <text x={padL - 6} y={20} textAnchor="end" className="fill-muted-foreground font-mono" fontSize="9">
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
      <p className="num mt-1 text-[11px] text-muted-foreground">
        Above the line means {b.code} is ahead on cumulative race time. Final swing{" "}
        {Math.abs(last).toFixed(2)}s to {last > 0 ? b.code : a.code}.
      </p>
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
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: compoundColor(c) }}
          />
          <span className="label-xs">{c}</span>
        </span>
      ))}
    </div>
  );
}
