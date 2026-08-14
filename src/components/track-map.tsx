import { useMemo } from "react";
import type { TrackPath } from "@/lib/f1.functions";

type Pt = { x: number; y: number };

const SECTOR_COLORS = ["#e8002d", "#3fa9f5", "#ffd400"];

function parsePath(pathData: string): Pt[] {
  const nums = pathData.match(/-?\d+(\.\d+)?/g);
  if (!nums) return [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

/**
 * Renders a circuit outline straight from `circuit_track_paths.path_data`,
 * split into three equal-distance sectors. Geometry only — no invented
 * corner names or speed-trap positions.
 */
export function TrackMap({
  path,
  className,
  showSectors = true,
  strokeWidth = 6,
}: {
  path: TrackPath | null;
  className?: string;
  showSectors?: boolean;
  strokeWidth?: number;
}) {
  const model = useMemo(() => {
    if (!path?.pathData) return null;
    const pts = parsePath(path.pathData);
    if (pts.length < 8) return null;

    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - minX);
    const h = Math.max(1, Math.max(...ys) - minY);
    const pad = 8;
    const size = 100;
    const scale = (size - pad * 2) / Math.max(w, h);
    const offX = pad + (size - pad * 2 - w * scale) / 2;
    const offY = pad + (size - pad * 2 - h * scale) / 2;
    const norm = pts.map((p) => ({
      x: offX + (p.x - minX) * scale,
      y: offY + (p.y - minY) * scale,
    }));

    // cumulative length so sectors split by distance, not point count
    const cum: number[] = [0];
    for (let i = 1; i < norm.length; i++) {
      const d = Math.hypot(norm[i]!.x - norm[i - 1]!.x, norm[i]!.y - norm[i - 1]!.y);
      cum.push(cum[i - 1]! + d);
    }
    const total = cum[cum.length - 1]!;
    const cutAt = (frac: number) => cum.findIndex((c) => c >= total * frac);
    const c1 = Math.max(1, cutAt(1 / 3));
    const c2 = Math.max(c1 + 1, cutAt(2 / 3));

    const toPath = (slice: Pt[]) =>
      slice.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

    const sectors = [
      norm.slice(0, c1 + 1),
      norm.slice(c1, c2 + 1),
      norm.slice(c2),
    ].map(toPath);

    const start = norm[0]!;
    const next = norm[Math.min(6, norm.length - 1)]!;
    const ang = Math.atan2(next.y - start.y, next.x - start.x);
    const nx = Math.cos(ang + Math.PI / 2) * 4;
    const ny = Math.sin(ang + Math.PI / 2) * 4;

    return {
      full: toPath(norm),
      sectors,
      start,
      startTick: { x1: start.x - nx, y1: start.y - ny, x2: start.x + nx, y2: start.y + ny },
      marks: [norm[c1]!, norm[c2]!],
      rotation: path.rotation ?? 0,
    };
  }, [path]);

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
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Circuit layout">
      <g transform={`rotate(${model.rotation} 50 50)`}>
        <path
          d={model.full}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth + 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.5}
        />
        {(showSectors ? model.sectors : [model.full]).map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={showSectors ? SECTOR_COLORS[i] : "var(--primary)"}
            strokeWidth={strokeWidth}
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
          strokeWidth={2}
        />
        {showSectors
          ? model.marks.map((m, i) => (
              <circle key={i} cx={m.x} cy={m.y} r={1.8} fill="#ffffff" opacity={0.85} />
            ))
          : null}
      </g>
    </svg>
  );
}

export function SectorLegend() {
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
    </div>
  );
}
