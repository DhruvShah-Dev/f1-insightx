import { useState } from "react";
import type { PositionLap, TrafficLap } from "@/lib/f1.functions";
import type { CornerModel } from "@/components/corner-profile";

const SECTOR_COLORS = ["#e8002d", "#3fa9f5", "#ffd400"];

type Side = { code: string; color: string };

function line(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/* ------------------------------------------------------------------ */
/* Lap-by-lap running order                                           */
/* ------------------------------------------------------------------ */

export function PositionBattleChart({
  a,
  b,
  lapsA,
  lapsB,
  statusPhases,
}: {
  a: Side;
  b: Side;
  lapsA: PositionLap[];
  lapsB: PositionLap[];
  statusPhases: { label: string; fromLap: number; toLap: number }[];
}) {
  const [hoverLap, setHoverLap] = useState<number | null>(null);
  const all = [...lapsA, ...lapsB].filter((l) => l.position != null);
  if (all.length < 2) {
    return (
      <p className="num py-8 text-center text-xs text-muted-foreground">
        No lap-by-lap running order stored for this pairing.
      </p>
    );
  }
  const maxLap = Math.max(...all.map((l) => l.lap));
  const maxPos = Math.max(...all.map((l) => l.position!));
  const W = 720;
  const H = 250;
  const padL = 30;
  const padT = 12;
  const padB = 24;
  const x = (lap: number) => padL + ((lap - 1) / Math.max(1, maxLap - 1)) * (W - padL - 10);
  const y = (pos: number) => padT + ((pos - 1) / Math.max(1, maxPos - 1)) * (H - padT - padB);

  const neutralised = statusPhases.filter((p) => {
    const l = p.label.toLowerCase();
    return l.includes("safety") || l.includes("vsc") || l.includes("red") || l.includes("yellow");
  });

  const atLap = (rows: PositionLap[], lap: number | null) =>
    lap == null ? null : (rows.find((r) => r.lap === lap) ?? null);
  const ha = atLap(lapsA, hoverLap);
  const hb = atLap(lapsB, hoverLap);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Lap-by-lap running order for ${a.code} and ${b.code}`}
        onMouseLeave={() => setHoverLap(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * W;
          const lap = Math.round(((px - padL) / (W - padL - 10)) * (maxLap - 1)) + 1;
          setHoverLap(Math.min(maxLap, Math.max(1, lap)));
        }}
      >
        {neutralised.map((p) => (
          <rect
            key={`${p.label}-${p.fromLap}`}
            x={x(p.fromLap)}
            width={Math.max(1.5, x(p.toLap + 1) - x(p.fromLap))}
            y={padT}
            height={H - padT - padB}
            fill="#ffd400"
            opacity={0.1}
          />
        ))}
        {[1, 5, 10, 15, 20].filter((p) => p <= maxPos).map((p) => (
          <g key={p}>
            <line
              x1={padL}
              x2={W - 10}
              y1={y(p)}
              y2={y(p)}
              stroke="currentColor"
              className="text-border"
              strokeWidth="0.5"
            />
            <text
              x={padL - 5}
              y={y(p) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              fontSize="9"
            >
              P{p}
            </text>
          </g>
        ))}
        {[
          { s: a, rows: lapsA },
          { s: b, rows: lapsB },
        ].map(({ s, rows }) => (
          <path
            key={s.code}
            d={line(
              rows
                .filter((l) => l.position != null)
                .map((l) => ({ x: x(l.lap), y: y(l.position!) })),
            )}
            fill="none"
            stroke={s.color}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        ))}
        {hoverLap != null ? (
          <line
            x1={x(hoverLap)}
            x2={x(hoverLap)}
            y1={padT}
            y2={H - padB}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeWidth="0.6"
          />
        ) : null}
        {[
          { s: a, r: ha },
          { s: b, r: hb },
        ].map(({ s, r }) =>
          r?.position != null ? (
            <circle key={s.code} cx={x(r.lap)} cy={y(r.position)} r={3} fill={s.color} />
          ) : null,
        )}
        <text x={padL} y={H - 6} className="fill-muted-foreground font-mono" fontSize="9">
          L1
        </text>
        <text
          x={W - 10}
          y={H - 6}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize="9"
        >
          L{maxLap}
        </text>
      </svg>
      <div className="num mt-1 flex flex-wrap items-center gap-3 text-[11px]">
        <span className="text-muted-foreground">
          {hoverLap == null ? "Hover the chart to read a lap" : `Lap ${hoverLap}`}
        </span>
        {[
          { s: a, r: ha },
          { s: b, r: hb },
        ].map(({ s, r }) => (
          <span key={s.code} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: s.color }} />
            <span className="font-bold uppercase">{s.code}</span>
            <span className="text-muted-foreground">
              {r?.position != null ? `P${r.position}` : "—"}
              {r?.status ? ` · ${r.status}` : ""}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: "#ffd400", opacity: 0.4 }} />
          neutralised laps
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-lap dirty-air                                                   */
/* ------------------------------------------------------------------ */

export function DirtyAirChart({
  a,
  b,
  lapsA,
  lapsB,
}: {
  a: Side;
  b: Side;
  lapsA: TrafficLap[];
  lapsB: TrafficLap[];
}) {
  const all = [...lapsA, ...lapsB].filter((l) => l.dirtyAirS != null);
  if (!all.length) {
    return (
      <p className="num py-6 text-center text-xs text-muted-foreground">
        No per-lap dirty-air readings stored for this pairing.
      </p>
    );
  }
  const maxLap = Math.max(...all.map((l) => l.lap));
  const maxVal = Math.max(...all.map((l) => Math.abs(l.dirtyAirS!))) || 1;

  return (
    <div className="space-y-3">
      {[
        { s: a, rows: lapsA },
        { s: b, rows: lapsB },
      ].map(({ s, rows }) => (
        <div key={s.code}>
          <div className="flex items-baseline justify-between">
            <span className="num text-[11px] font-black uppercase" style={{ color: s.color }}>
              {s.code}
            </span>
            <span className="num text-[11px] text-muted-foreground">
              peak {Math.max(0, ...rows.map((r) => r.dirtyAirS ?? 0)).toFixed(2)}s
            </span>
          </div>
          <div className="mt-1 flex h-14 items-end gap-px">
            {Array.from({ length: maxLap }, (_, i) => i + 1).map((lap) => {
              const r = rows.find((x) => x.lap === lap);
              const v = r?.dirtyAirS ?? null;
              const inTraffic = (r?.label ?? "").toLowerCase().includes("traffic");
              return (
                <span
                  key={lap}
                  title={
                    r
                      ? `L${lap} · ${r.label ?? "unclassified"} · dirty air ${v == null ? "—" : `${v.toFixed(2)}s`}${
                          r.position != null ? ` · P${r.position}` : ""
                        }`
                      : `L${lap} · no row`
                  }
                  className="flex-1 rounded-t-[1px]"
                  style={{
                    height: `${v == null ? 2 : Math.max(3, (Math.abs(v) / maxVal) * 100)}%`,
                    backgroundColor: v == null ? "var(--border)" : s.color,
                    opacity: v == null ? 0.5 : inTraffic ? 1 : 0.4,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
      <p className="num text-[10px] text-muted-foreground">
        Bar height is the stored dirty-air proxy for that lap. Solid bars are laps the pipeline
        labelled as running in traffic, faded bars as clean air.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Corner + straight profile of the lap                                */
/* ------------------------------------------------------------------ */

export function CornerProfileChart({
  model,
  selected,
  onSelect,
}: {
  model: CornerModel;
  selected: number | null;
  onSelect: (corner: number | null) => void;
}) {
  const W = 720;
  const H = 150;
  const padB = 26;
  const maxDeg = Math.max(...model.corners.map((c) => c.turnDeg), 90);
  const x = (lapPct: number) => 6 + (lapPct / 100) * (W - 12);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Corner and straight profile across one lap"
      >
        {/* sector bands along lap distance */}
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={x((i * 100) / 3)}
            width={x(100 / 3) - x(0)}
            y={H - padB}
            height={5}
            fill={SECTOR_COLORS[i]}
            opacity={0.8}
          />
        ))}
        {/* straights */}
        {model.straights.map((s) => {
          const from = model.corners.find((c) => c.number === s.from);
          const start = from ? from.lapPct : 0;
          return (
            <rect
              key={`st-${s.index}`}
              x={x(start)}
              width={Math.max(1, x(start + s.lapPct) - x(start))}
              y={H - padB - 10}
              height={5}
              fill={s.isLongest ? "#ff2ea6" : "var(--border)"}
              opacity={s.isLongest ? 0.9 : 0.7}
            />
          );
        })}
        {/* corner bars */}
        {model.corners.map((c) => {
          const on = selected === c.number;
          const h = Math.max(6, (c.turnDeg / maxDeg) * (H - padB - 26));
          return (
            <g
              key={c.number}
              onMouseEnter={() => onSelect(c.number)}
              onMouseLeave={() => onSelect(null)}
              className="cursor-pointer"
            >
              <rect
                x={x(c.lapPct) - 4}
                width={8}
                y={H - padB - 12 - h}
                height={h}
                fill={SECTOR_COLORS[c.sector - 1]}
                opacity={on ? 1 : 0.55}
              />
              <text
                x={x(c.lapPct)}
                y={H - padB - 16 - h}
                textAnchor="middle"
                className={on ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                fontSize="8"
              >
                {c.number}
              </text>
              {on ? (
                <text
                  x={x(c.lapPct)}
                  y={H - 4}
                  textAnchor="middle"
                  className="fill-foreground font-mono"
                  fontSize="9"
                >
                  C{c.number} · {c.turnDeg}° {c.direction === "left" ? "L" : "R"}
                </text>
              ) : null}
            </g>
          );
        })}
        {selected == null ? (
          <text x={6} y={H - 4} className="fill-muted-foreground font-mono" fontSize="9">
            lap distance 0% → 100% · bar height = corner angle · pink = longest straight
          </text>
        ) : null}
      </svg>
    </div>
  );
}
