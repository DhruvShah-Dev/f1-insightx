import { useMemo } from "react";
import type { TrackPath } from "@/lib/f1.functions";

type Pt = { x: number; y: number };

const SECTOR_COLORS = ["#e8002d", "#3fa9f5", "#ffd400"];

export type Corner = {
  number: number;
  apex: Pt;
  label: Pt;
  turnDeg: number;
  direction: "left" | "right";
  radius: number;
  type: "Slow" | "Medium" | "Fast";
  sector: 1 | 2 | 3;
  lapPct: number;
};

export type Straight = {
  index: number;
  from: number | null;
  to: number | null;
  lapPct: number;
  mid: Pt;
  isLongest: boolean;
};

export type CornerModel = {
  full: string;
  sectors: string[];
  corners: Corner[];
  straights: Straight[];
  speedTrap: Pt | null;
  start: Pt;
  startTick: { x1: number; y1: number; x2: number; y2: number };
  rotation: number;
};

function parsePath(pathData: string): Pt[] {
  const nums = pathData.match(/-?\d+(\.\d+)?/g);
  if (!nums) return [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

function resample(pts: Pt[], step: number) {
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1]!;
    const p = pts[i]!;
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d < step) continue;
    const n = Math.floor(d / step);
    for (let k = 1; k <= n; k++) {
      const t = (k * step) / d;
      out.push({ x: a.x + (p.x - a.x) * t, y: a.y + (p.y - a.y) * t });
    }
  }
  return out;
}

const toPath = (slice: Pt[]) =>
  slice.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/**
 * Derives numbered corners, corner type and straight segments from the stored
 * circuit geometry in `circuit_track_paths`. Nothing is invented: corner count,
 * radius class and straight lengths all come from the path itself.
 */
export function buildCornerModel(path: TrackPath | null): CornerModel | null {
  if (!path?.pathData) return null;
  const raw = parsePath(path.pathData);
  if (raw.length < 12) return null;

  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(1, Math.max(...xs) - minX);
  const h = Math.max(1, Math.max(...ys) - minY);
  const pad = 10;
  const size = 100;
  const scale = (size - pad * 2) / Math.max(w, h);
  const offX = pad + (size - pad * 2 - w * scale) / 2;
  const offY = pad + (size - pad * 2 - h * scale) / 2;
  const norm = raw.map((p) => ({
    x: offX + (p.x - minX) * scale,
    y: offY + (p.y - minY) * scale,
  }));

  const step = 1.8;
  const pts = resample(norm, step);
  const n = pts.length;
  if (n < 20) return null;

  const heading = (i: number) => {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  const turn: number[] = [];
  for (let i = 0; i < n; i++) {
    let d = heading((i + 1) % n) - heading(i);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turn.push(d);
  }
  // light smoothing so sampling noise does not split one corner into three
  const smooth = turn.map((_, i) => {
    const a = turn[(i - 1 + n) % n]!;
    const b = turn[i]!;
    const c = turn[(i + 1) % n]!;
    return (a + b + c) / 3;
  });

  const threshold = 0.05; // rad per ~1.8 units of normalised track
  type Seg = { start: number; end: number; sum: number };
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  for (let i = 0; i < n; i++) {
    const t = smooth[i]!;
    if (Math.abs(t) >= threshold) {
      if (cur && Math.sign(t) === Math.sign(cur.sum) && i - cur.end <= 1) {
        cur.end = i;
        cur.sum += t;
      } else {
        if (cur) segs.push(cur);
        cur = { start: i, end: i, sum: t };
      }
    }
  }
  if (cur) segs.push(cur);

  const corners: Corner[] = [];
  for (const s of segs) {
    const turnDeg = Math.abs((s.sum * 180) / Math.PI);
    if (turnDeg < 20) continue; // kinks, not corners
    const arc = (s.end - s.start + 1) * step;
    const radius = arc / Math.max(0.05, Math.abs(s.sum));
    const mid = pts[Math.round((s.start + s.end) / 2) % n]!;
    const before = pts[Math.max(0, s.start - 2)]!;
    const after = pts[(s.end + 2) % n]!;
    const ang = Math.atan2(after.y - before.y, after.x - before.x);
    const outward = Math.sign(s.sum) >= 0 ? -1 : 1;
    const lapPct = ((s.start + s.end) / 2 / n) * 100;
    corners.push({
      number: 0,
      apex: mid,
      label: {
        x: mid.x + Math.cos(ang + (Math.PI / 2) * outward) * 5.2,
        y: mid.y + Math.sin(ang + (Math.PI / 2) * outward) * 5.2,
      },
      turnDeg: Math.round(turnDeg),
      direction: s.sum > 0 ? "right" : "left",
      radius,
      type: radius > 11 ? "Fast" : radius > 6 ? "Medium" : "Slow",
      sector: lapPct < 100 / 3 ? 1 : lapPct < 200 / 3 ? 2 : 3,
      lapPct,
    });
  }
  corners.sort((a, b) => a.lapPct - b.lapPct).forEach((c, i) => (c.number = i + 1));

  // straights = gaps between consecutive corner segments
  const straights: Straight[] = [];
  const marks = corners.map((c) => c.lapPct);
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i]!;
    const to = marks[(i + 1) % marks.length]!;
    const lapPct = (to - from + 100) % 100;
    if (lapPct < 6) continue;
    const midPct = (from + lapPct / 2) % 100;
    straights.push({
      index: straights.length + 1,
      from: corners[i]!.number,
      to: corners[(i + 1) % corners.length]!.number,
      lapPct,
      mid: pts[Math.round((midPct / 100) * n) % n]!,
      isLongest: false,
    });
  }
  const longest = straights.reduce<Straight | null>(
    (best, s) => (!best || s.lapPct > best.lapPct ? s : best),
    null,
  );
  if (longest) longest.isLongest = true;

  const c1 = Math.round(n / 3);
  const c2 = Math.round((2 * n) / 3);
  const start = pts[0]!;
  const nextPt = pts[Math.min(4, n - 1)]!;
  const ang0 = Math.atan2(nextPt.y - start.y, nextPt.x - start.x);
  const nx = Math.cos(ang0 + Math.PI / 2) * 4;
  const ny = Math.sin(ang0 + Math.PI / 2) * 4;

  return {
    full: toPath(pts),
    sectors: [pts.slice(0, c1 + 1), pts.slice(c1, c2 + 1), pts.slice(c2)].map(toPath),
    corners,
    straights,
    speedTrap: longest?.mid ?? null,
    start,
    startTick: { x1: start.x - nx, y1: start.y - ny, x2: start.x + nx, y2: start.y + ny },
    rotation: path.rotation ?? 0,
  };
}

export function CornerMap({
  path,
  className,
  highlightCorner,
}: {
  path: TrackPath | null;
  className?: string;
  highlightCorner?: number | null;
}) {
  const model = useMemo(() => buildCornerModel(path), [path]);

  if (!model) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-border bg-card/40 ${className ?? ""}`}
      >
        <p className="num text-[11px] text-muted-foreground">No circuit geometry stored</p>
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Circuit corner map with numbered corners and sectors"
    >
      <g transform={`rotate(${model.rotation} 50 50)`}>
        <path
          d={model.full}
          fill="none"
          stroke="var(--border)"
          strokeWidth={5.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
        />
        {model.sectors.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={SECTOR_COLORS[i]}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <line
          x1={model.startTick.x1}
          y1={model.startTick.y1}
          x2={model.startTick.x2}
          y2={model.startTick.y2}
          stroke="#ffffff"
          strokeWidth={1.6}
        />
        {model.speedTrap ? (
          <g>
            <circle cx={model.speedTrap.x} cy={model.speedTrap.y} r={2.2} fill="#ff2ea6" />
            <circle
              cx={model.speedTrap.x}
              cy={model.speedTrap.y}
              r={3.6}
              fill="none"
              stroke="#ff2ea6"
              strokeWidth={0.5}
            />
          </g>
        ) : null}
        {model.corners.map((c) => {
          const on = highlightCorner === c.number;
          return (
            <g key={c.number}>
              <circle
                cx={c.label.x}
                cy={c.label.y}
                r={2.9}
                fill={on ? "#ffffff" : "var(--card)"}
                stroke={on ? "#ffffff" : "var(--border)"}
                strokeWidth={0.5}
              />
              <text
                x={c.label.x}
                y={c.label.y + 1.15}
                textAnchor="middle"
                fontSize="3"
                className={on ? "fill-background font-mono" : "fill-foreground font-mono"}
              >
                {c.number}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function CornerMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {["Sector 1", "Sector 2", "Sector 3"].map((s, i) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="h-[3px] w-4" style={{ backgroundColor: SECTOR_COLORS[i] }} />
          <span className="label-xs">{s}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-[2px] bg-white" />
        <span className="label-xs">Start / finish</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: "#ff2ea6" }} />
        <span className="label-xs">Longest straight (trap)</span>
      </span>
    </div>
  );
}
