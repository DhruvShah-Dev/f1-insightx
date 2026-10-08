import { useMemo } from "react";
import type { TrackPath } from "@/lib/f1.functions";

type Point = { x: number; y: number };

// Positions follow the Marina Bay layout in the curated FastF1 path.
const turns: Point[] = [
  { x: 884, y: 109 }, { x: 837, y: 64 }, { x: 795, y: 37 },
  { x: 783, y: 113 }, { x: 808, y: 265 }, { x: 501, y: 242 },
  { x: 340, y: 154 }, { x: 266, y: 252 }, { x: 180, y: 184 },
  { x: 42, y: 402 }, { x: 99, y: 462 }, { x: 130, y: 526 },
  { x: 190, y: 583 }, { x: 278, y: 278 }, { x: 391, y: 359 },
  { x: 690, y: 392 }, { x: 710, y: 430 }, { x: 859, y: 448 },
  { x: 918, y: 377 },
];

function nearestIndex(points: Point[], target: Point, start = 0) {
  let best = start;
  let distance = Infinity;
  for (let i = start; i < points.length; i++) {
    const value = Math.hypot(points[i]!.x - target.x, points[i]!.y - target.y);
    if (value < distance) {
      distance = value;
      best = i;
    }
  }
  return best;
}

function pathFrom(points: Point[]) {
  return points.map((point, i) => `${i ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

export function SingaporeCircuitProfile({ path }: { path: TrackPath }) {
  const model = useMemo(() => {
    const values = path.pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const points: Point[] = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      points.push({ x: values[i]!, y: values[i + 1]! });
    }
    if (points.length < 20) return null;
    const firstCut = nearestIndex(points, { x: 450, y: 213 });
    const secondCut = nearestIndex(points, { x: 278, y: 278 }, firstCut + 1);
    return {
      full: pathFrom(points),
      sectors: [
        pathFrom(points.slice(0, firstCut + 1)),
        pathFrom(points.slice(firstCut, secondCut + 1)),
        pathFrom(points.slice(secondCut)),
      ],
    };
  }, [path.pathData]);

  if (!model) return <div className="rw-map-empty">Circuit profile pending</div>;

  return (
    <div className="rw-map-canvas rw-map-singapore">
      <svg viewBox="0 0 1010 630" role="img" aria-labelledby="singapore-map-title singapore-map-desc" preserveAspectRatio="xMidYMid meet">
        <title id="singapore-map-title">Marina Bay Street Circuit, Singapore</title>
        <desc id="singapore-map-desc">2026 race week track map using the {path.sourceSeason ?? "available"} season circuit coordinates. Three colored sectors and 19 numbered turns.</desc>
        <g className="rw-sg-track">
          <path d={model.full} className="rw-sg-border" />
          <path d={model.full} className="rw-sg-road" />
          {model.sectors.map((sector, index) => <path key={index} d={sector} className={`rw-sg-sector rw-sg-sector-${index + 1}`} />)}
        </g>
        <g className="rw-sg-finish" transform="translate(911 315) rotate(-12)">
          <rect x="-9" y="-2" width="18" height="5" fill="#f5f6f7" />
          <path d="M-9 -2h4v2h-4m8-2h4v2h-4m8-2h2v2h-2M-5 0h4v3h-4m8-3h4v3H3" fill="#17191c" />
        </g>
        {turns.map((point, index) => (
          <g key={index} className="rw-sg-turn" transform={`translate(${point.x} ${point.y})`}>
            <circle r="11" />
            <text textAnchor="middle" dominantBaseline="central">{index + 1}</text>
          </g>
        ))}
        <g className="rw-sg-callout">
          <circle cx="891" cy="194" r="6" fill="#e8ed49" />
          <path d="M897 194h30" />
          <rect x="927" y="183" width="76" height="22" rx="3" className="rw-sg-speed" />
          <text x="965" y="198" textAnchor="middle" className="rw-sg-callout-text">SPEED TRAP</text>
        </g>
        <g className="rw-sg-callout">
          <circle cx="695" cy="404" r="6" fill="#6bdfaa" />
          <path d="M695 398v-45h40" />
          <rect x="735" y="341" width="92" height="25" rx="3" className="rw-sg-detection" />
          <text x="781" y="352" textAnchor="middle" className="rw-sg-callout-text"><tspan x="781">OVERTAKE</tspan><tspan x="781" dy="10">DETECTION</tspan></text>
        </g>
        <g className="rw-sg-callout">
          <circle cx="747" cy="443" r="6" fill="#6bdfaa" />
          <path d="M747 449v55" />
          <rect x="706" y="504" width="88" height="25" rx="3" className="rw-sg-activation" />
          <text x="750" y="515" textAnchor="middle" className="rw-sg-callout-text"><tspan x="750">OVERTAKE</tspan><tspan x="750" dy="10">ACTIVATION</tspan></text>
        </g>
        <g className="rw-sg-sector-labels">
          <text x="799" y="182" transform="rotate(72 799 182)">SECTOR 1</text>
          <text x="210" y="219" transform="rotate(39 210 219)">SECTOR 2</text>
          <text x="488" y="383" transform="rotate(3 488 383)">SECTOR 3</text>
        </g>
      </svg>
      <span className="rw-sg-source">Track coordinates: {path.sourceSeason ?? "archived"} FastF1 qualifying</span>
    </div>
  );
}
