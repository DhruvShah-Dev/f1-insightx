import { useMemo } from "react";
import type { TrackPath } from "@/lib/f1.functions";

export function RaceCircuitProfile({
  path,
  circuitName,
}: {
  path: TrackPath | null;
  circuitName: string;
}) {
  const model = useMemo(() => {
    if (!path?.pathData) return null;
    const numbers = path.pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (numbers.length < 16) return null;
    const points = Array.from({ length: Math.floor(numbers.length / 2) }, (_, i) => ({
      x: numbers[i * 2]!,
      y: numbers[i * 2 + 1]!,
    }));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const center = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };
    const angle = (path.rotation * Math.PI) / 180;
    const rotated = points.map((p) => ({
      x: center.x + (p.x - center.x) * Math.cos(angle) - (p.y - center.y) * Math.sin(angle),
      y: center.y + (p.x - center.x) * Math.sin(angle) + (p.y - center.y) * Math.cos(angle),
    }));
    const rx = rotated.map((p) => p.x),
      ry = rotated.map((p) => p.y);
    const minX = Math.min(...rx),
      minY = Math.min(...ry);
    const width = Math.max(...rx) - minX,
      height = Math.max(...ry) - minY;
    const pad = Math.max(width, height) * 0.065;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`,
      center,
      start: points[0]!,
    };
  }, [path]);
  if (/sepang/i.test(circuitName))
    return (
      <div className="rw-map-canvas rw-map-reference">
        <svg
          viewBox="155 145 635 475"
          role="img"
          aria-label="Sepang International Circuit track profile from supplied reference"
          preserveAspectRatio="xMidYMid meet"
        >
          <image
            href="/images/sepang-circuit-reference.png"
            x="0"
            y="0"
            width="1827"
            height="635"
          />
        </svg>
      </div>
    );
  if (!path || !model) return <div className="rw-map-empty">Circuit profile pending</div>;
  return (
    <div className="rw-map-canvas">
      <svg
        viewBox={model.viewBox}
        role="img"
        aria-label={`Track profile of ${circuitName}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform={`rotate(${path.rotation} ${model.center.x} ${model.center.y})`}>
          <path d={path.pathData} className="rw-track-halo" />
          <path d={path.pathData} className="rw-track-outer" />
          <path d={path.pathData} className="rw-track-inner" />
          <circle cx={model.start.x} cy={model.start.y} r="8" className="rw-track-start" />
        </g>
      </svg>
    </div>
  );
}
