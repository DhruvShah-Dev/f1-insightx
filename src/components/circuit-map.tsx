import { useMemo, useState } from "react";
import { cornersForCircuit, type CircuitCorner } from "@/data/circuit-corners";
import type { TrackPath } from "@/lib/f1.functions";

type Pt = { x: number; y: number };

const DEFAULT_SECTOR_COLORS = ["#ff3f76", "#38bdf8", "#f6d84a"] as const;
const ITALY_SECTOR_COLORS = ["#009246", "#ffffff", "#ce2b37"] as const;

function parsePath(pathData: string): Pt[] {
  const nums = pathData.match(/-?\d+(\.\d+)?/g);
  if (!nums) return [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  }
  return pts;
}

const toPath = (pts: Pt[]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

function buildSectors(pathData: string) {
  const pts = parsePath(pathData);
  if (pts.length < 8) return null;
  const xs = pts.map((point) => point.x);
  const ys = pts.map((point) => point.y);
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
  const pad = 44;

  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const point = pts[i]!;
    cum.push(cum[i - 1]! + Math.hypot(point.x - prev.x, point.y - prev.y));
  }

  const total = cum[cum.length - 1] ?? 0;
  const cutAt = (frac: number) => Math.max(1, cum.findIndex((distance) => distance >= total * frac));
  const c1 = cutAt(1 / 3);
  const c2 = Math.max(c1 + 1, cutAt(2 / 3));

  return {
    full: toPath(pts),
    sectors: [pts.slice(0, c1 + 1), pts.slice(c1, c2 + 1), pts.slice(c2)].map(toPath),
    start: pts[0]!,
    bounds,
    viewBox: `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.maxX - bounds.minX + pad * 2} ${bounds.maxY - bounds.minY + pad * 2}`,
  };
}

function tooltipPosition(corner: CircuitCorner) {
  switch (corner.tooltipSide) {
    case "left":
      return { x: corner.x - 12, y: corner.y - 20, anchor: "end" as const };
    case "above":
      return { x: corner.x, y: corner.y - 32, anchor: "middle" as const };
    case "below":
      return { x: corner.x, y: corner.y + 42, anchor: "middle" as const };
    default:
      return { x: corner.x + 12, y: corner.y - 20, anchor: "start" as const };
  }
}

export function CircuitMap({
  path,
  circuitId,
  circuitName,
  className,
}: {
  path: TrackPath | null;
  circuitId?: string | null;
  circuitName?: string | null;
  className?: string;
}) {
  const [active, setActive] = useState<CircuitCorner | null>(null);
  const model = useMemo(() => (path?.pathData ? buildSectors(path.pathData) : null), [path]);
  const corners = useMemo(
    () => cornersForCircuit(circuitId ?? path?.circuitId ?? null),
    [circuitId, path?.circuitId],
  );
  const sectorColors = (circuitId ?? path?.circuitId) === "monza" ? ITALY_SECTOR_COLORS : DEFAULT_SECTOR_COLORS;
  const name = circuitName ?? path?.raceName?.replace(/ Grand Prix$/i, "") ?? "Circuit";

  if (!model) {
    return (
      <div className={`flex min-h-[360px] items-center justify-center border border-border bg-card/40 ${className ?? ""}`}>
        <p className="num text-xs text-muted-foreground">No circuit geometry stored.</p>
      </div>
    );
  }

  const activeCorner = active ?? corners[0] ?? null;

  return (
    <div className={`relative overflow-hidden border border-border bg-background/70 ${className ?? ""}`}>
      <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <div>
          <p className="label-xs">{name} circuit</p>
          <p className="text-sm font-black uppercase italic">
            {corners.length ? `${corners.length} turns - ` : ""}3 sectors
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {sectorColors.map((color, index) => (
            <span key={color} className="flex items-center gap-1.5">
              <span className="h-[3px] w-5" style={{ backgroundColor: color }} />
              <span className="label-xs">S{index + 1}</span>
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={model.viewBox}
        className="h-[390px] w-full pt-8 sm:h-[460px]"
        role="img"
        aria-label={`Interactive ${name} circuit map with corner numbers and sectors`}
      >
        <path
          d={model.full}
          fill="none"
          stroke="var(--border)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={22}
          opacity={0.6}
        />
        {model.sectors.map((sector, index) => (
          <path
            key={sector}
            d={sector}
            fill="none"
            stroke={sectorColors[index]}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={13}
          />
        ))}
        <line
          x1={model.start.x - 16}
          y1={model.start.y - 4}
          x2={model.start.x + 16}
          y2={model.start.y + 4}
          stroke="#ffffff"
          strokeLinecap="round"
          strokeWidth={5}
        />

        {corners.map((corner) => {
          const isActive = activeCorner?.number === corner.number;
          return (
            <g
              key={corner.number}
              role="button"
              tabIndex={0}
              aria-label={`Turn ${corner.number}, ${corner.name}, sector ${corner.sector}`}
              className="cursor-pointer outline-none"
              onMouseEnter={() => setActive(corner)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(corner)}
              onBlur={() => setActive(null)}
            >
              <title>{`Turn ${corner.number}: ${corner.name}`}</title>
              <circle
                cx={corner.x}
                cy={corner.y}
                r={isActive ? 16 : 13}
                fill={isActive ? "#ffffff" : "var(--background)"}
                stroke={sectorColors[corner.sector - 1]}
                strokeWidth={4}
              />
              <text
                x={corner.x}
                y={corner.y + 5}
                textAnchor="middle"
                fontSize="18"
                className={isActive ? "fill-background font-mono font-black" : "fill-foreground font-mono font-black"}
              >
                {corner.number}
              </text>
            </g>
          );
        })}

        {active ? (
          <g pointerEvents="none">
            {(() => {
              const pos = tooltipPosition(active);
              const width = Math.max(96, active.name.length * 9 + 46);
              const rawX =
                pos.anchor === "end" ? pos.x - width : pos.anchor === "middle" ? pos.x - width / 2 : pos.x;
              const x = Math.max(model.bounds.minX - 36, Math.min(model.bounds.maxX + 36 - width, rawX));
              return (
                <>
                  <line
                    x1={active.x}
                    y1={active.y}
                    x2={pos.x}
                    y2={pos.y + 11}
                    stroke="#ffffff"
                    strokeWidth={1.4}
                    opacity={0.65}
                  />
                  <rect
                    x={x}
                    y={pos.y - 20}
                    width={width}
                    height={39}
                    rx={6}
                    fill="var(--background)"
                    stroke={sectorColors[active.sector - 1]}
                    strokeWidth={2}
                  />
                  <text
                    x={x + 12}
                    y={pos.y - 4}
                    fontSize="12"
                    className="fill-muted-foreground font-mono font-bold uppercase"
                  >
                    Turn {active.number} - Sector {active.sector}
                  </text>
                  <text x={x + 12} y={pos.y + 12} fontSize="17" className="fill-foreground font-sans font-black">
                    {active.name}
                  </text>
                </>
              );
            })()}
          </g>
        ) : null}
      </svg>

      <div className="border-t border-border bg-card/40 px-4 py-3">
        <p className="label-xs">Hover or focus a number</p>
        {activeCorner ? (
          <p className="mt-1 text-sm font-bold uppercase">
            T{activeCorner.number} - {activeCorner.name}
          </p>
        ) : (
          <p className="mt-1 text-sm font-bold uppercase">Corner labels unavailable</p>
        )}
      </div>
    </div>
  );
}
