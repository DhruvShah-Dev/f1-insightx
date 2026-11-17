import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { RotateCcw } from "lucide-react";
import { buildDominance } from "@/components/dominance";
import { CornerMap } from "@/components/corner-profile";
import type { getHeadToHead, TrackPath } from "@/lib/f1.functions";
import { fmtLapS, fmtNum, titleCase } from "@/lib/format";
import {
  approximateSegmentRange,
  buildGearDiffPoints,
  buildSpeedDominanceZones,
  type ComparisonView,
  type GearDiffPoint,
  type SpeedDominanceZone,
  type TelemetryComparison,
  type TelemetryPoint,
  type TelemetrySegment,
} from "@/lib/telemetry-comparison";
import "./driver-comparison-broadcast.css";

type H2H = NonNullable<Awaited<ReturnType<typeof getHeadToHead>>>;

type BroadcastProps = {
  view: ComparisonView;
  telemetry: TelemetryComparison | null;
  h2h: H2H;
  codeA: string;
  codeB: string;
  colorA: string;
  colorB: string;
  segment: string | null;
  lap: number | null;
  point: number | null;
  range: [number, number];
  onSegmentChange: (segment: string | null) => void;
  onLapChange: (lap: number | null) => void;
  onPointChange: (point: number | null) => void;
  onRangeChange: (range: [number, number]) => void;
};

const signed = (value: number | null, digits = 1, unit = "") =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${fmtNum(value, digits)}${unit}`;

const gear = (value: number | null | undefined) => (value == null ? "—" : `G${Math.round(value)}`);

const pointAt = (trace: TelemetryComparison["traces"][number], index: number | null) => {
  if (!trace?.points.length || index == null) return null;
  return trace.points[Math.max(0, Math.min(trace.points.length - 1, index))] ?? null;
};

function EmptyEvidence({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="bc-empty" role="status">
      <span>Data status</span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

function ViewHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return (
    <header className="bc-view-heading">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <span>{detail}</span>
    </header>
  );
}

function RangeControl({ range, onChange }: { range: [number, number]; onChange: (range: [number, number]) => void }) {
  return (
    <div className="bc-range" role="group" aria-label="Visible lap range">
      <label>
        <span>Start {Math.round(range[0] * 100)}%</span>
        <input
          type="range"
          min={0}
          max={95}
          value={Math.round(range[0] * 100)}
          onChange={(event) => onChange([Math.min(Number(event.target.value) / 100, range[1] - 0.05), range[1]])}
        />
      </label>
      <label>
        <span>End {Math.round(range[1] * 100)}%</span>
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round(range[1] * 100)}
          onChange={(event) => onChange([range[0], Math.max(Number(event.target.value) / 100, range[0] + 0.05)])}
        />
      </label>
      <button type="button" onClick={() => onChange([0, 1])} disabled={range[0] === 0 && range[1] === 1}>
        <RotateCcw size={13} /> Reset
      </button>
    </div>
  );
}

function DriverValue({ code, color, value, detail }: { code: string; color: string; value: string; detail: string }) {
  return (
    <div className="bc-driver-value" style={{ borderTopColor: color }}>
      <span style={{ color }}>{code}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function focusIndexFromPointer(
  event: PointerEvent<SVGRectElement>,
  rows: { x: number; index: number }[],
  range: [number, number],
) {
  if (!rows.length) return null;
  const rect = event.currentTarget.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const x = range[0] + fraction * (range[1] - range[0]);
  return rows.reduce((best, row) => (Math.abs(row.x - x) < Math.abs(best.x - x) ? row : best), rows[0]!).index;
}

function chartKeyboard(
  event: KeyboardEvent<SVGRectElement>,
  current: number,
  count: number,
  onChange: (point: number | null) => void,
) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    onChange(Math.max(0, Math.min(count - 1, current + (event.key === "ArrowLeft" ? -1 : 1))));
  } else if (event.key === "Escape") {
    onChange(null);
  }
}

function stepPath(rows: GearDiffPoint[], range: [number, number], maxAbs: number) {
  const visible = rows.filter((row) => row.diff != null && row.x >= range[0] && row.x <= range[1]);
  const x = (value: number) => 70 + ((value - range[0]) / Math.max(0.001, range[1] - range[0])) * 860;
  const y = (value: number) => 242 - (value / maxAbs) * 120;
  return visible
    .map((row, index) => {
      const previous = visible[index - 1];
      const here = `${x(row.x).toFixed(1)},${y(row.diff ?? 0).toFixed(1)}`;
      if (!previous) return `M${here}`;
      return `L${x(row.x).toFixed(1)},${y(previous.diff ?? 0).toFixed(1)} L${here}`;
    })
    .join(" ");
}

function GearDiffView(props: BroadcastProps) {
  const { telemetry, codeA, codeB, colorA, colorB, point, range, onPointChange, onRangeChange } = props;
  const rows = useMemo(() => buildGearDiffPoints(telemetry?.traces[0] ?? null, telemetry?.traces[1] ?? null), [telemetry]);
  const [hover, setHover] = useState<number | null>(null);
  if (!telemetry || !rows.length) return <EmptyEvidence title="Gear comparison unavailable" detail="Both representative telemetry traces need a recorded gear channel." />;
  const active = Math.max(0, Math.min(rows.length - 1, point ?? hover ?? Math.floor(rows.length / 2)));
  const selected = rows[active]!;
  const maxAbs = Math.ceil(Math.max(2, ...rows.map((row) => Math.abs(row.diff ?? 0))));
  const x = 70 + ((selected.x - range[0]) / Math.max(0.001, range[1] - range[0])) * 860;
  const distance = Math.max(telemetry.traces[0]?.distanceM ?? 0, telemetry.traces[1]?.distanceM ?? 0);
  const visibleRows = rows.filter((row) => row.x >= range[0] && row.x <= range[1]);
  return (
    <section className="bc-view bc-enter">
      <ViewHeading eyebrow={`${telemetry.session.code} · transmission`} title="Gear difference" detail={`${codeA} gear minus ${codeB} gear · zero means the same selected gear`} />
      <div className="bc-chart-scroll">
        <svg viewBox="0 0 1000 410" className="bc-main-chart" role="group" aria-label="Gear difference over lap distance">
          <title>Selected gear difference over normalized lap distance</title>
          <text x="18" y="44" className="bc-svg-code" fill={colorA}>{codeA}</text>
          <text x="18" y="79" className="bc-svg-code" fill={colorB}>{codeB}</text>
          {visibleRows.map((row, index) => {
            const next = visibleRows[index + 1];
            const start = 70 + ((row.x - range[0]) / (range[1] - range[0])) * 860;
            const end = next ? 70 + ((next.x - range[0]) / (range[1] - range[0])) * 860 : 930;
            return (
              <g key={row.index}>
                <rect x={start} y={25} width={Math.max(2, end - start)} height={24} fill={colorA} opacity={0.16 + (row.gearA ?? 0) * 0.055} />
                <rect x={start} y={60} width={Math.max(2, end - start)} height={24} fill={colorB} opacity={0.16 + (row.gearB ?? 0) * 0.055} />
                {(row.shiftA || row.shiftB) && <line x1={start} x2={start} y1={20} y2={90} className="bc-shift-mark" />}
              </g>
            );
          })}
          {[maxAbs, Math.ceil(maxAbs / 2), 0, -Math.ceil(maxAbs / 2), -maxAbs].map((tick) => {
            const y = 242 - (tick / maxAbs) * 120;
            return <g key={tick}><line x1="70" x2="930" y1={y} y2={y} className={tick === 0 ? "bc-zero" : "bc-grid"} /><text x="55" y={y + 4} textAnchor="end" className="bc-axis">{tick > 0 ? `+${tick}` : tick}</text></g>;
          })}
          <path d={stepPath(rows, range, maxAbs)} className="bc-diff-line" />
          <line x1={x} x2={x} y1="18" y2="370" className="bc-crosshair" />
          <circle cx={x} cy={242 - ((selected.diff ?? 0) / maxAbs) * 120} r="6" className="bc-focus" />
          <text x="70" y="394" className="bc-axis">{distance ? `${fmtNum(range[0] * distance, 0)} m` : `${Math.round(range[0] * 100)}%`}</text>
          <text x="930" y="394" textAnchor="end" className="bc-axis">{distance ? `${fmtNum(range[1] * distance, 0)} m` : `${Math.round(range[1] * 100)}%`}</text>
          <rect
            x="70" y="12" width="860" height="365" fill="transparent" role="slider" tabIndex={0}
            aria-label="Gear comparison distance" aria-valuemin={0} aria-valuemax={rows.length - 1} aria-valuenow={active}
            onPointerMove={(event) => setHover(focusIndexFromPointer(event, rows, range))}
            onPointerLeave={() => setHover(null)}
            onClick={() => onPointChange(active)}
            onKeyDown={(event) => chartKeyboard(event, active, rows.length, onPointChange)}
          />
        </svg>
      </div>
      <div className="bc-inspector" aria-live="polite">
        <div className="bc-focus-value"><span>Distance</span><strong>{distance ? `${fmtNum(selected.x * distance, 0)} m` : `${fmtNum(selected.x * 100, 1)}%`}</strong><small>{point == null ? "Move to inspect · click to pin" : "Pinned · arrow keys step · Esc clears"}</small></div>
        <DriverValue code={codeA} color={colorA} value={gear(selected.gearA)} detail={selected.shiftA ? "Shift point at this sample" : "Selected gear"} />
        <DriverValue code={codeB} color={colorB} value={gear(selected.gearB)} detail={selected.shiftB ? "Shift point at this sample" : "Selected gear"} />
        <div className="bc-delta-value"><span>Difference</span><strong>{signed(selected.diff, 0, " gears")}</strong><small>Positive means {codeA} is in the higher gear</small></div>
      </div>
      <RangeControl range={range} onChange={onRangeChange} />
    </section>
  );
}

function speedDeltaPath(pointsA: TelemetryPoint[], pointsB: TelemetryPoint[], range: [number, number], maxAbs: number) {
  const count = Math.min(pointsA.length, pointsB.length);
  const rows: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const a = pointsA[index]!;
    const b = pointsB[index]!;
    if (a.x < range[0] || a.x > range[1] || a.speed == null || b.speed == null) continue;
    const x = 60 + ((a.x - range[0]) / Math.max(0.001, range[1] - range[0])) * 880;
    const y = 170 - ((a.speed - b.speed) / maxAbs) * 115;
    rows.push(`${rows.length ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return rows.join(" ");
}

function StraightSpeedView(props: BroadcastProps) {
  const { telemetry, codeA, codeB, colorA, colorB, point, range, segment, onPointChange, onRangeChange, onSegmentChange } = props;
  const [hover, setHover] = useState<number | null>(null);
  const traceA = telemetry?.traces[0] ?? null;
  const traceB = telemetry?.traces[1] ?? null;
  const zones = useMemo(() => buildSpeedDominanceZones(traceA, traceB), [traceA, traceB]);
  if (!telemetry || !traceA || !traceB || !zones.length) return <EmptyEvidence title="Straight-line comparison unavailable" detail="Both representative speed traces are required for this view." />;
  const active = Math.max(0, Math.min(zones.length - 1, point ?? hover ?? Math.floor(zones.length / 2)));
  const zone = zones[active]!;
  const a = pointAt(traceA, active);
  const b = pointAt(traceB, active);
  const maxAbs = Math.max(5, ...zones.map((item) => Math.abs(item.deltaKph ?? 0)));
  const x = 60 + ((zone.midpoint - range[0]) / Math.max(0.001, range[1] - range[0])) * 880;
  const selectedStraight = telemetry.straights.find((row) => row.segmentId === segment) ?? telemetry.straights[0] ?? null;
  const distance = Math.max(traceA.distanceM ?? 0, traceB.distanceM ?? 0);
  return (
    <section className="bc-view bc-enter">
      <ViewHeading eyebrow={`${telemetry.session.code} · velocity`} title="Straight-line speed" detail={`${codeA} speed minus ${codeB} speed · shaded zones are approximate straights`} />
      <div className="bc-chart-scroll">
        <svg viewBox="0 0 1000 350" className="bc-main-chart" role="group" aria-label="Speed difference over lap distance">
          <title>Straight-line speed difference over lap distance</title>
          {telemetry.straights.map((row, index) => {
            const band = approximateSegmentRange(row.segmentId, index, telemetry.straights.length);
            const start = Math.max(range[0], band.start);
            const end = Math.min(range[1], band.end);
            if (end <= start) return null;
            return <rect key={row.segmentId} x={60 + ((start - range[0]) / (range[1] - range[0])) * 880} y="28" width={((end - start) / (range[1] - range[0])) * 880} height="270" className={row.segmentId === selectedStraight?.segmentId ? "bc-straight-band is-active" : "bc-straight-band"} />;
          })}
          {[-maxAbs, 0, maxAbs].map((tick) => {
            const y = 170 - (tick / maxAbs) * 115;
            return <g key={tick}><line x1="60" x2="940" y1={y} y2={y} className={tick === 0 ? "bc-zero" : "bc-grid"} /><text x="48" y={y + 4} textAnchor="end" className="bc-axis">{signed(tick, 0)}</text></g>;
          })}
          <text x="60" y="18" className="bc-svg-label" fill={colorA}>+ {codeA} faster</text>
          <text x="940" y="326" textAnchor="end" className="bc-svg-label" fill={colorB}>− {codeB} faster</text>
          <path d={speedDeltaPath(traceA.points, traceB.points, range, maxAbs)} className="bc-speed-line" />
          <line x1={x} x2={x} y1="22" y2="308" className="bc-crosshair" />
          <circle cx={x} cy={170 - ((zone.deltaKph ?? 0) / maxAbs) * 115} r="6" className="bc-focus" />
          <rect x="60" y="18" width="880" height="294" fill="transparent" role="slider" tabIndex={0} aria-label="Speed comparison distance" aria-valuemin={0} aria-valuemax={zones.length - 1} aria-valuenow={active}
            onPointerMove={(event) => setHover(focusIndexFromPointer(event, zones.map((item) => ({ x: item.midpoint, index: item.index })), range))}
            onPointerLeave={() => setHover(null)} onClick={() => onPointChange(active)} onKeyDown={(event) => chartKeyboard(event, active, zones.length, onPointChange)} />
        </svg>
      </div>
      <div className="bc-inspector" aria-live="polite">
        <div className="bc-focus-value"><span>Distance</span><strong>{distance ? `${fmtNum(zone.midpoint * distance, 0)} m` : `${fmtNum(zone.midpoint * 100, 1)}%`}</strong><small>{zone.leader === "neutral" ? "Within 1 km/h neutral threshold" : `${zone.leader === "a" ? codeA : codeB} quicker here`}</small></div>
        <DriverValue code={codeA} color={colorA} value={`${fmtNum(a?.speed, 1)} km/h`} detail={`${gear(a?.gear)} · DRS ${a?.drs ? "open" : "closed"}`} />
        <DriverValue code={codeB} color={colorB} value={`${fmtNum(b?.speed, 1)} km/h`} detail={`${gear(b?.gear)} · DRS ${b?.drs ? "open" : "closed"}`} />
        <div className="bc-delta-value"><span>Speed delta</span><strong>{signed(zone.deltaKph, 1, " km/h")}</strong><small>Representative-lap sample</small></div>
      </div>
      <RangeControl range={range} onChange={onRangeChange} />
      {telemetry.straights.length ? <div className="bc-zone-list" aria-label="Approximate straight comparisons">{telemetry.straights.map((row) => <button key={row.segmentId} type="button" aria-pressed={selectedStraight?.segmentId === row.segmentId} onClick={() => onSegmentChange(row.segmentId)}><span>{row.label}</span><strong>{signed(row.terminalSpeedDeltaKph, 1, " km/h")}</strong><small>terminal · entry {signed(row.entrySpeedDeltaKph, 1)} · accel {signed(row.accelerationDelta, 2)} · DRS use {signed(row.drsActiveDeltaPct, 1, "%")}</small></button>)}</div> : null}
      <p className="bc-method-note">Straight zones are approximate telemetry-derived regions. DRS state is shown as context, not as a causal attribution.</p>
    </section>
  );
}

function cornerNumber(row: TelemetrySegment) {
  const match = `${row.label} ${row.segmentId}`.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function CornerAnalysisView(props: BroadcastProps) {
  const { telemetry, h2h, codeA, codeB, colorA, colorB, segment, onSegmentChange } = props;
  if (!telemetry?.segments.length) return <EmptyEvidence title="Corner analysis unavailable" detail="No prepared corner comparison rows exist for this driver pair and session." />;
  const selected = telemetry.segments.find((row) => row.segmentId === segment) ?? telemetry.segments[0]!;
  const highlight = cornerNumber(selected);
  return (
    <section className="bc-view bc-enter">
      <ViewHeading eyebrow={`${telemetry.session.code} · corner phase`} title="Corner analysis" detail="Select a telemetry-derived corner zone to compare braking, minimum speed and traction" />
      <div className="bc-corner-layout">
        <div className="bc-circuit-panel"><CornerMap path={h2h.trackPath} className="bc-circuit-map" highlightCorner={highlight} /><p>Approximate corner alignment · not official circuit boundaries</p></div>
        <div className="bc-corner-detail">
          <div className="bc-corner-title"><div><span>Selected zone</span><h3>{selected.label}</h3></div><strong style={{ color: selected.fasterDriver === codeB ? colorB : colorA }}>{selected.fasterDriver ?? "EVEN"}</strong></div>
          <div className="bc-phase-table">
            {[
              ["Entry", selected.entrySpeedA, selected.entrySpeedB, selected.entryDeltaKph, selected.entryGearA, selected.entryGearB],
              ["Apex", selected.apexSpeedA, selected.apexSpeedB, selected.apexDeltaKph, selected.apexGearA, selected.apexGearB],
              ["Exit", selected.exitSpeedA, selected.exitSpeedB, selected.exitDeltaKph, selected.exitGearA, selected.exitGearB],
            ].map(([label, a, b, delta, ga, gb]) => <div key={String(label)}><span>{label}</span><strong style={{ color: colorA }}>{fmtNum(a as number | null, 1)} <small>{gear(ga as number | null)}</small></strong><i>{signed(delta as number | null, 1)}</i><strong style={{ color: colorB }}>{fmtNum(b as number | null, 1)} <small>{gear(gb as number | null)}</small></strong></div>)}
          </div>
          <div className="bc-engineering-readout">
            <div><span>Brake point</span><strong>{signed(selected.brakingStartDeltaM, 1, " m")}</strong></div>
            <div><span>Brake duration</span><strong>{signed(selected.brakingDurationDeltaS, 2, " s")}</strong></div>
            <div><span>Throttle pickup</span><strong>{signed(selected.throttlePickupDeltaM, 1, " m")}</strong></div>
            <div><span>Traction delta</span><strong>{signed(selected.tractionDelta, 2)}</strong></div>
          </div>
          <p className="bc-confidence">Confidence {selected.confidence == null ? "—" : `${fmtNum(selected.confidence * 100, 0)}%`} · positive deltas favor {codeA}</p>
        </div>
      </div>
      <div className="bc-corner-rail" aria-label="Corner zones">{telemetry.segments.map((row) => <button key={row.segmentId} type="button" aria-pressed={row.segmentId === selected.segmentId} onClick={() => onSegmentChange(row.segmentId)}><span>{row.label}</span><small>{row.fasterDriver ?? "even"}</small></button>)}</div>
    </section>
  );
}

function Dumbbell({ a, b, colorA, colorB, min, max }: { a: number | null; b: number | null; colorA: string; colorB: string; min: number; max: number }) {
  if (a == null || b == null) return <span className="bc-no-value">No paired value</span>;
  const pct = (value: number) => ((value - min) / Math.max(1, max - min)) * 100;
  return <div className="bc-dumbbell"><span className="bc-dumbbell-line" style={{ left: `${Math.min(pct(a), pct(b))}%`, width: `${Math.abs(pct(a) - pct(b))}%` }} /><span className="bc-dumbbell-dot" style={{ left: `${pct(a)}%`, background: colorA }} /><span className="bc-dumbbell-dot" style={{ left: `${pct(b)}%`, background: colorB }} /></div>;
}

function EntryExitView(props: BroadcastProps) {
  const { telemetry, codeA, codeB, colorA, colorB, segment, onSegmentChange } = props;
  if (!telemetry?.segments.length) return <EmptyEvidence title="Entry and exit speeds unavailable" detail="Paired absolute corner speeds were not prepared for this session." />;
  const values = telemetry.segments.flatMap((row) => [row.entrySpeedA, row.entrySpeedB, row.exitSpeedA, row.exitSpeedB]).filter((value): value is number => value != null);
  const min = Math.floor(Math.min(...values, 0) / 10) * 10;
  const max = Math.ceil(Math.max(...values, 1) / 10) * 10;
  const selected = telemetry.segments.find((row) => row.segmentId === segment) ?? telemetry.segments[0]!;
  return (
    <section className="bc-view bc-enter">
      <ViewHeading eyebrow={`${telemetry.session.code} · corner velocity`} title="Entry / exit speed" detail="Shared scale across every corner · exact values remain visible beside each mark" />
      <div className="bc-dumbbell-legend"><span style={{ color: colorA }}>● {codeA}</span><span style={{ color: colorB }}>● {codeB}</span><small>{min}–{max} km/h shared scale</small></div>
      <div className="bc-entry-grid">
        <div className="bc-entry-head"><span>Corner</span><span>Entry</span><span>Exit</span></div>
        {telemetry.segments.map((row) => <button key={row.segmentId} type="button" aria-pressed={selected.segmentId === row.segmentId} onClick={() => onSegmentChange(row.segmentId)}><span className="bc-entry-name">{row.label}</span><span className="bc-dumbbell-cell"><Dumbbell a={row.entrySpeedA} b={row.entrySpeedB} colorA={colorA} colorB={colorB} min={min} max={max} /><small>{fmtNum(row.entrySpeedA, 1)} / {fmtNum(row.entrySpeedB, 1)} · {signed(row.entryDeltaKph, 1)}</small></span><span className="bc-dumbbell-cell"><Dumbbell a={row.exitSpeedA} b={row.exitSpeedB} colorA={colorA} colorB={colorB} min={min} max={max} /><small>{fmtNum(row.exitSpeedA, 1)} / {fmtNum(row.exitSpeedB, 1)} · {signed(row.exitDeltaKph, 1)}</small></span></button>)}
      </div>
      <div className="bc-inspector bc-inspector-compact"><div className="bc-focus-value"><span>Selected corner</span><strong>{selected.label}</strong><small>Positive delta favors {codeA}</small></div><DriverValue code={codeA} color={colorA} value={`${fmtNum(selected.entrySpeedA, 1)} → ${fmtNum(selected.exitSpeedA, 1)}`} detail={`${gear(selected.entryGearA)} entry · ${gear(selected.exitGearA)} exit`} /><DriverValue code={codeB} color={colorB} value={`${fmtNum(selected.entrySpeedB, 1)} → ${fmtNum(selected.exitSpeedB, 1)}`} detail={`${gear(selected.entryGearB)} entry · ${gear(selected.exitGearB)} exit`} /></div>
    </section>
  );
}

function PitStopsView(props: BroadcastProps) {
  const { h2h, codeA, codeB, colorA, colorB, lap, onLapChange } = props;
  const maxLap = Math.max(1, ...h2h.laps.flat().map((row) => row.lap), ...h2h.pits.flat().map((row) => row.lap ?? 0));
  const sides = [
    { code: codeA, color: colorA, pits: h2h.pits[0] ?? [], stints: h2h.stints[0] ?? [] },
    { code: codeB, color: colorB, pits: h2h.pits[1] ?? [], stints: h2h.stints[1] ?? [] },
  ];
  const selectedStops = sides.flatMap((side) => side.pits.filter((pit) => pit.lap === lap).map((pit) => ({ ...pit, code: side.code, color: side.color })));
  const sum = (rows: (number | null)[]) => { const values = rows.filter((value): value is number => value != null); return values.length ? values.reduce((a, b) => a + b, 0) : null; };
  if (!h2h.pits[0]?.length && !h2h.pits[1]?.length) return <EmptyEvidence title="No recorded pit stops" detail="This race has no stored pit-stop events for the selected drivers." />;
  return (
    <section className="bc-view bc-enter">
      <ViewHeading eyebrow="Race · strategy execution" title="Pit stops" detail="Stint sequence, lane loss and position swing on a shared race-lap axis" />
      <div className="bc-pit-timeline">
        <div className="bc-lap-axis"><span>L1</span><span>L{Math.round(maxLap / 2)}</span><span>L{maxLap}</span></div>
        {sides.map((side) => <div className="bc-pit-lane" key={side.code}><strong style={{ color: side.color }}>{side.code}</strong><div className="bc-stint-track">{side.stints.map((stint) => { const startLap = stint.startLap ?? 1; const endLap = stint.endLap ?? startLap; return <span key={stint.stint} className={`bc-compound bc-${String(stint.compound ?? "unknown").toLowerCase()}`} style={{ left: `${((startLap - 1) / maxLap) * 100}%`, width: `${((endLap - startLap + 1) / maxLap) * 100}%` }}><i>{titleCase(stint.compound)?.slice(0, 1) || "?"}</i></span>; })}{side.pits.map((pit) => <button key={`${pit.stop}-${pit.lap}`} type="button" style={{ left: `${(((pit.lap ?? 1) - 1) / maxLap) * 100}%`, borderColor: side.color }} aria-label={`${side.code} pit stop on lap ${pit.lap}`} aria-pressed={lap === pit.lap} onClick={() => onLapChange(pit.lap ?? null)}><span>L{pit.lap ?? "—"}</span></button>)}</div></div>)}
      </div>
      <div className="bc-pit-summary">{sides.map((side) => <div key={side.code}><span style={{ color: side.color }}>{side.code}</span><strong>{side.pits.length} stop{side.pits.length === 1 ? "" : "s"}</strong><small>Total modelled loss {fmtNum(sum(side.pits.map((pit) => pit.lossS)), 2)}s · net positions {signed(sum(side.pits.map((pit) => pit.net)), 0)}</small></div>)}</div>
      <div className="bc-pit-ledger">{sides.flatMap((side) => side.pits.map((pit) => <button key={`${side.code}-${pit.stop}-${pit.lap}`} type="button" aria-pressed={lap === pit.lap} onClick={() => onLapChange(pit.lap ?? null)}><span style={{ color: side.color }}>{side.code} · STOP {pit.stop}</span><strong>L{pit.lap ?? "—"} · {[pit.from, pit.to].filter(Boolean).join(" → ") || "compound n/a"}</strong><small>{pit.lossS == null ? "Loss not modelled" : `${fmtNum(pit.lossS, 2)}s modelled loss`} · P{pit.posBefore ?? "?"} → P{pit.posAfter ?? "?"} · net {signed(pit.net, 0)}{pit.trafficPenaltyS != null ? ` · traffic proxy ${fmtNum(pit.trafficPenaltyS, 2)}s` : ""}</small></button>))}</div>
      <div className="bc-inspector bc-inspector-compact"><div className="bc-focus-value"><span>Selected race lap</span><strong>{lap ? `L${lap}` : "Select a stop"}</strong><small>Race-only evidence</small></div>{selectedStops.length ? selectedStops.map((pit) => <DriverValue key={`${pit.code}-${pit.stop}`} code={pit.code} color={pit.color} value={`${fmtNum(pit.lossS, 2)} s`} detail={`${pit.from ?? "?"} → ${pit.to ?? "?"} · P${pit.posBefore ?? "?"} → P${pit.posAfter ?? "?"}`} />) : <div className="bc-delta-value"><span>Stop detail</span><strong>—</strong><small>Select a marker or ledger row</small></div>}</div>
      <p className="bc-method-note">Pit-loss and traffic values are shown only where stored; traffic penalty remains a proxy.</p>
    </section>
  );
}

function parseTrack(path: TrackPath | null) {
  const values = path?.pathData.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const raw: { x: number; y: number }[] = [];
  for (let index = 0; index + 1 < values.length; index += 2) raw.push({ x: values[index]!, y: values[index + 1]! });
  if (raw.length < 2) return [];
  const xs = raw.map((p) => p.x); const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs); const minY = Math.min(...ys); const width = Math.max(1, Math.max(...xs) - minX); const height = Math.max(1, Math.max(...ys) - minY);
  const scale = 82 / Math.max(width, height); const ox = 9 + (82 - width * scale) / 2; const oy = 9 + (82 - height * scale) / 2;
  return raw.map((p) => ({ x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale }));
}

function DominanceCircuit({ path, zones, colorA, colorB, selected, onSelect }: { path: TrackPath | null; zones: SpeedDominanceZone[]; colorA: string; colorB: string; selected: number | null; onSelect: (index: number) => void }) {
  const points = useMemo(() => parseTrack(path), [path]);
  if (!points.length || !zones.length) return <div className="bc-track-empty">Circuit dominance map unavailable</div>;
  return <svg viewBox="0 0 100 100" className="bc-dominance-map" role="group" aria-label="Approximate track dominance by representative-lap speed"><title>Track dominance by telemetry distance</title><g transform={`rotate(${path?.rotation ?? 0} 50 50)`}>{points.slice(0, -1).map((point, index) => { const next = points[index + 1]!; const zoneIndex = Math.min(zones.length - 1, Math.floor((index / Math.max(1, points.length - 2)) * zones.length)); const zone = zones[zoneIndex]!; const color = zone.leader === "a" ? colorA : zone.leader === "b" ? colorB : "#596170"; return <line key={index} x1={point.x} y1={point.y} x2={next.x} y2={next.y} stroke={color} strokeWidth={selected === zoneIndex ? 5.2 : 3.4} strokeLinecap="round" tabIndex={0} role="button" aria-label={`Track sample ${zoneIndex + 1}, ${zone.leader === "neutral" ? "neutral" : `${zone.leader === "a" ? "driver one" : "driver two"} quicker`}`} onClick={() => onSelect(zoneIndex)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(zoneIndex); }} />; })}</g></svg>;
}

function DominanceView(props: BroadcastProps) {
  const { telemetry, h2h, codeA, codeB, colorA, colorB, lap, point, onLapChange, onPointChange } = props;
  const zones = useMemo(() => buildSpeedDominanceZones(telemetry?.traces[0] ?? null, telemetry?.traces[1] ?? null), [telemetry]);
  const laps = useMemo(() => buildDominance({ lapsA: h2h.laps[0] ?? [], lapsB: h2h.laps[1] ?? [], pitsA: h2h.pits[0] ?? [], pitsB: h2h.pits[1] ?? [], trafficA: h2h.trafficLaps?.[0] ?? [], trafficB: h2h.trafficLaps?.[1] ?? [], statusPhases: h2h.statusPhases ?? [] }), [h2h]);
  const selectedLap = laps.find((row) => row.lap === lap) ?? laps.find((row) => row.deltaS != null) ?? null;
  const selectedZone = zones[Math.max(0, Math.min(zones.length - 1, point ?? Math.floor(zones.length / 2)))] ?? null;
  const maxLapDelta = Math.max(0.5, ...laps.map((row) => Math.min(4, Math.abs(row.deltaS ?? 0))));
  if (!zones.length && !laps.length) return <EmptyEvidence title="Dominance unavailable" detail="Neither paired representative traces nor paired race laps are stored for these drivers." />;
  return (
    <section className="bc-view bc-enter">
      <ViewHeading eyebrow="Race · where and when" title="Dominance" detail="Track regions use representative speed telemetry · race bars compare each completed lap" />
      <div className="bc-dominance-layout">
        <div className="bc-track-dominance"><div className="bc-section-label"><span>Track dominance</span><small>1 km/h neutral threshold</small></div><DominanceCircuit path={h2h.trackPath} zones={zones} colorA={colorA} colorB={colorB} selected={point} onSelect={onPointChange} /><div className="bc-track-legend"><span style={{ color: colorA }}>{codeA} quicker</span><span>Neutral</span><span style={{ color: colorB }}>{codeB} quicker</span></div></div>
        <div className="bc-lap-dominance"><div className="bc-section-label"><span>Lap-by-lap dominance</span><small>Click a lap for context</small></div><div className="bc-lap-zero"><span style={{ color: colorA }}>{codeA}</span><i>0</i><span style={{ color: colorB }}>{codeB}</span></div><div className="bc-lap-bars" style={{ gridTemplateColumns: `repeat(${Math.max(1, laps.length)}, minmax(7px, 1fr))` }}>{laps.map((row) => { const height = Math.max(3, (Math.min(maxLapDelta, Math.abs(row.deltaS ?? 0)) / maxLapDelta) * 92); const aQuick = (row.deltaS ?? 0) < 0; return <button key={row.lap} type="button" aria-label={`Lap ${row.lap}, ${row.deltaS == null ? "no paired time" : `${Math.abs(row.deltaS).toFixed(3)} seconds`}`} aria-pressed={selectedLap?.lap === row.lap} onClick={() => onLapChange(row.lap)} className={row.neutral ? "is-neutral" : ""}><span style={{ height, background: row.deltaS == null ? "#596170" : aQuick ? colorA : colorB, ...(aQuick ? { bottom: "50%" } : { top: "50%" }) }} /><i>{row.a.pit || row.b.pit ? "P" : row.lap % 10 === 0 ? row.lap : ""}</i></button>; })}</div></div>
      </div>
      <div className="bc-inspector" aria-live="polite">
        <div className="bc-focus-value"><span>Selected lap</span><strong>{selectedLap ? `L${selectedLap.lap}` : "—"}</strong><small>{selectedLap?.neutral ? titleCase(selectedLap.neutral) : selectedLap?.winner ? `${selectedLap.winner === "a" ? codeA : codeB} quicker` : "No paired delta"}</small></div>
        <DriverValue code={codeA} color={colorA} value={fmtLapS(selectedLap?.a.timeS ?? null)} detail={`${titleCase(selectedLap?.a.compound) || "compound n/a"} · tyre age ${selectedLap?.a.tyreAge ?? "—"}${selectedLap?.a.pit ? " · PIT" : ""}`} />
        <DriverValue code={codeB} color={colorB} value={fmtLapS(selectedLap?.b.timeS ?? null)} detail={`${titleCase(selectedLap?.b.compound) || "compound n/a"} · tyre age ${selectedLap?.b.tyreAge ?? "—"}${selectedLap?.b.pit ? " · PIT" : ""}`} />
        <div className="bc-delta-value"><span>Lap delta</span><strong>{signed(selectedLap?.deltaS ?? null, 3, " s")}</strong><small>{selectedLap?.a.cause ?? selectedLap?.b.cause ?? "No stored pace-loss cause"}</small></div>
      </div>
      {selectedZone ? <div className="bc-track-readout"><span>Selected track sample {selectedZone.index + 1}</span><strong>{signed(selectedZone.deltaKph, 1, " km/h")}</strong><small>{selectedZone.leader === "neutral" ? "Neutral" : `${selectedZone.leader === "a" ? codeA : codeB} quicker`} · approximate normalized circuit alignment</small></div> : null}
      <p className="bc-method-note">Track dominance is telemetry-derived and approximately aligned to the circuit outline; it does not represent official corner or marshal-sector boundaries.</p>
    </section>
  );
}

export function DriverComparisonBroadcast(props: BroadcastProps) {
  if (props.view === "gear") return <GearDiffView {...props} />;
  if (props.view === "straight") return <StraightSpeedView {...props} />;
  if (props.view === "corners") return <CornerAnalysisView {...props} />;
  if (props.view === "pits") return <PitStopsView {...props} />;
  if (props.view === "entry-exit") return <EntryExitView {...props} />;
  return <DominanceView {...props} />;
}
