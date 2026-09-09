import { useMemo, useState } from "react";
import {
  cornerGuideForCircuit,
  cornersForCircuit,
  type CircuitCorner,
} from "@/data/circuit-corners";
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

function buildSectors(pathData: string, sourceRotation = 0) {
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
  const cutAt = (frac: number) =>
    Math.max(
      1,
      cum.findIndex((distance) => distance >= total * frac),
    );
  const c1 = cutAt(1 / 3);
  const c2 = Math.max(c1 + 1, cutAt(2 / 3));

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  // Preserve any hand-tuned source rotation, then turn portrait geometry sideways
  // so the circuit always uses the available horizontal space.
  let rotation = Number.isFinite(sourceRotation) ? sourceRotation : 0;
  const normalizedRotation = Math.abs(rotation % 180);
  const quarterTurn = Math.abs(normalizedRotation - 90) < 0.01;
  const orientedWidth = quarterTurn ? height : width;
  const orientedHeight = quarterTurn ? width : height;
  if (orientedHeight > orientedWidth) rotation += 90;
  // Present the circuit in the conventional left-to-right race direction.
  rotation += 180;
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const radians = (rotation * Math.PI) / 180;
  const rotated = pts.map((point) => ({
    x:
      center.x +
      (point.x - center.x) * Math.cos(radians) -
      (point.y - center.y) * Math.sin(radians),
    y:
      center.y +
      (point.x - center.x) * Math.sin(radians) +
      (point.y - center.y) * Math.cos(radians),
  }));
  const rotatedBounds = {
    minX: Math.min(...rotated.map((point) => point.x)),
    maxX: Math.max(...rotated.map((point) => point.x)),
    minY: Math.min(...rotated.map((point) => point.y)),
    maxY: Math.max(...rotated.map((point) => point.y)),
  };

  return {
    full: toPath(pts),
    sectors: [pts.slice(0, c1 + 1), pts.slice(c1, c2 + 1), pts.slice(c2)].map(toPath),
    start: pts[0]!,
    bounds,
    center,
    rotation,
    viewBox: `${rotatedBounds.minX - pad} ${rotatedBounds.minY - pad} ${rotatedBounds.maxX - rotatedBounds.minX + pad * 2} ${rotatedBounds.maxY - rotatedBounds.minY + pad * 2}`,
  };
}

function rotatePoint(point: Pt, center: Pt, rotation: number): Pt {
  const radians = (rotation * Math.PI) / 180;
  return {
    x:
      center.x +
      (point.x - center.x) * Math.cos(radians) -
      (point.y - center.y) * Math.sin(radians),
    y:
      center.y +
      (point.x - center.x) * Math.sin(radians) +
      (point.y - center.y) * Math.cos(radians),
  };
}

function tooltipPosition(corner: CircuitCorner, point: Pt = corner) {
  switch (corner.tooltipSide) {
    case "left":
      return { x: point.x - 12, y: point.y - 20, anchor: "end" as const };
    case "above":
      return { x: point.x, y: point.y - 32, anchor: "middle" as const };
    case "below":
      return { x: point.x, y: point.y + 42, anchor: "middle" as const };
    default:
      return { x: point.x + 12, y: point.y - 20, anchor: "start" as const };
  }
}

function cornerLabelPosition(corner: CircuitCorner, point: Pt) {
  const side = corner.tooltipSide ?? "right";
  const gap = 24;
  switch (side) {
    case "left":
      return { x: point.x - gap, y: point.y - 9, anchor: "end" as const };
    case "above":
      return { x: point.x, y: point.y - gap, anchor: "middle" as const };
    case "below":
      return { x: point.x, y: point.y + gap + 10, anchor: "middle" as const };
    default:
      return { x: point.x + gap, y: point.y - 9, anchor: "start" as const };
  }
}

function labelBoxX(x: number, width: number, anchor: "start" | "middle" | "end") {
  if (anchor === "end") return x - width;
  if (anchor === "middle") return x - width / 2;
  return x;
}

export function CircuitMap({
  path,
  circuitId,
  circuitName,
  className,
  compact = false,
}: {
  path: TrackPath | null;
  circuitId?: string | null | undefined;
  circuitName?: string | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  const [active, setActive] = useState<CircuitCorner | null>(null);
  const model = useMemo(
    () => (path?.pathData ? buildSectors(path.pathData, path.rotation) : null),
    [path],
  );
  const corners = useMemo(
    () => cornersForCircuit(circuitId ?? path?.circuitId ?? null),
    [circuitId, path?.circuitId],
  );
  const cornerGuide = useMemo(
    () => cornerGuideForCircuit(circuitId ?? path?.circuitId ?? null),
    [circuitId, path?.circuitId],
  );
  const sectorColors =
    (circuitId ?? path?.circuitId) === "monza" ? ITALY_SECTOR_COLORS : DEFAULT_SECTOR_COLORS;
  const name = circuitName ?? "Circuit";

  if (!model) {
    return (
      <div
        className={`relative flex min-h-[360px] items-center justify-center overflow-hidden border border-border bg-[#070b10] text-white ${className ?? ""}`}
        style={{ backgroundColor: "#070b10", color: "#ffffff" }}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 flex h-2">
          {sectorColors.map((color, index) => (
            <span key={`${color}-${index}`} className="flex-1" style={{ backgroundColor: color }} />
          ))}
        </div>
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div className="relative max-w-sm px-6 text-center">
          <p className="label-xs text-white/58">{name} circuit</p>
          <p className="mt-2 text-2xl font-black uppercase italic">Track map pending</p>
          <p className="mt-2 text-sm text-white/64">
            Verified geometry will appear here when source circuit path data is available.
          </p>
          {cornerGuide.length ? (
            <div className="mt-5 grid max-h-56 gap-1.5 overflow-y-auto text-left sm:grid-cols-2">
              {cornerGuide.map((corner) => (
                <div
                  key={corner.number}
                  className="flex items-center gap-2 border border-white/10 bg-white/6 px-2 py-1.5"
                >
                  <span className="num grid size-6 shrink-0 place-items-center bg-white text-[10px] font-black text-[#07110c]">
                    {corner.number}
                  </span>
                  <span className="truncate text-[11px] font-black uppercase text-white/82">
                    {corner.name}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const activeCorner = active ?? corners[0] ?? null;
  const rotatedCorners = corners.map((corner) => ({
    corner,
    point: rotatePoint(corner, model.center, model.rotation),
  }));

  return (
    <div className={`overflow-hidden border border-border bg-background ${className ?? ""}`}>
      <div className={compact ? "relative min-h-[330px]" : "relative min-h-[460px]"}>
        <div
          className={`absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background ${compact ? "px-3 py-2" : "px-4 py-3"}`}
        >
          <div>
            <p className="label-xs">{name} circuit</p>
            <p
              className={
                compact
                  ? "text-xs font-black uppercase italic"
                  : "text-sm font-black uppercase italic"
              }
            >
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
          className={compact ? "h-[330px] w-full pt-7" : "h-[390px] w-full pt-8 sm:h-[460px]"}
          role="img"
          aria-label={`Interactive ${name} circuit map with corner names, numbers, and sectors`}
        >
          <g transform={`rotate(${model.rotation} ${model.center.x} ${model.center.y})`}>
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
          </g>

          {rotatedCorners.map(({ corner, point }) => {
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
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? 16 : 13}
                  fill={isActive ? "#ffffff" : "var(--background)"}
                  stroke={sectorColors[corner.sector - 1]}
                  strokeWidth={4}
                />
                <text
                  x={point.x}
                  y={point.y + 5}
                  textAnchor="middle"
                  fontSize="18"
                  className={
                    isActive
                      ? "fill-background font-mono font-black"
                      : "fill-foreground font-mono font-black"
                  }
                >
                  {corner.number}
                </text>
              </g>
            );
          })}

          {!compact && rotatedCorners.length ? (
            <g pointerEvents="none">
              {rotatedCorners.map(({ corner, point }) => {
                const label = `${corner.number} ${corner.name}`;
                const pos = cornerLabelPosition(corner, point);
                const width = Math.min(188, Math.max(76, label.length * 6.4 + 16));
                const x = labelBoxX(pos.x, width, pos.anchor);
                return (
                  <g key={`label-${corner.number}`}>
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={pos.x}
                      y2={pos.y - 5}
                      stroke="var(--foreground)"
                      strokeWidth={1}
                      opacity={0.28}
                    />
                    <rect
                      x={x}
                      y={pos.y - 17}
                      width={width}
                      height={22}
                      rx={4}
                      fill="var(--background)"
                      stroke={sectorColors[corner.sector - 1]}
                      strokeWidth={1.4}
                      opacity={0.94}
                    />
                    <text
                      x={
                        pos.anchor === "end"
                          ? x + width - 8
                          : pos.anchor === "middle"
                            ? x + width / 2
                            : x + 8
                      }
                      y={pos.y - 2}
                      textAnchor={pos.anchor}
                      fontSize="11"
                      className="fill-foreground font-sans font-black uppercase"
                    >
                      {label.length > 24 ? `${label.slice(0, 22)}...` : label}
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}

          {active ? (
            <g pointerEvents="none">
              {(() => {
                const activePoint = rotatePoint(active, model.center, model.rotation);
                const pos = tooltipPosition(active, activePoint);
                const width = Math.max(96, active.name.length * 9 + 46);
                const rawX =
                  pos.anchor === "end"
                    ? pos.x - width
                    : pos.anchor === "middle"
                      ? pos.x - width / 2
                      : pos.x;
                const x = Math.max(
                  model.bounds.minX - 36,
                  Math.min(model.bounds.maxX + 36 - width, rawX),
                );
                return (
                  <>
                    <line
                      x1={activePoint.x}
                      y1={activePoint.y}
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
                    <text
                      x={x + 12}
                      y={pos.y + 12}
                      fontSize="17"
                      className="fill-foreground font-sans font-black"
                    >
                      {active.name}
                    </text>
                  </>
                );
              })()}
            </g>
          ) : null}
        </svg>

        <div className="border-t border-border bg-card/40 px-4 py-3">
          <p className="label-xs">{corners.length ? "Corner names" : "Corner data"}</p>
          {activeCorner ? (
            <p className="mt-1 text-sm font-bold uppercase">
              T{activeCorner.number} - {activeCorner.name}
            </p>
          ) : (
            <p className="mt-1 text-sm font-bold uppercase">Corner labels unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
}
