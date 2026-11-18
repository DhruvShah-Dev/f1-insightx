import { useMemo, useState, type PointerEvent } from "react";
import type { DecisiveLapEvidence } from "@/lib/f1.functions";
import "./decisive-lap-story.css";

type Trace = DecisiveLapEvidence["traces"][number];
type Point = Trace & { progress: number };
type Driver = { code: string; name: string };
const fmt = (value: number | null, unit = "s") => value == null ? "—" : `${value.toFixed(3)}${unit}`;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

function gpsProgress(rows: Trace[]): Point[] {
  const ordered = rows.filter((row) => row.x != null && row.y != null).sort((a, b) => a.index - b.index);
  let distance = 0;
  const cumulative = ordered.map((row, index) => {
    if (index) distance += Math.hypot(row.x! - ordered[index - 1]!.x!, row.y! - ordered[index - 1]!.y!);
    return distance;
  });
  return ordered.map((row, index) => ({ ...row, progress: distance > 0 ? cumulative[index]! / distance : row.timeProgress }));
}

function alignToGps(row: Trace, gps: Point[]): number {
  if (gps.length < 2) return row.timeProgress;
  const stamp = Date.parse(row.timestampUtc);
  if (stamp <= Date.parse(gps[0]!.timestampUtc)) return gps[0]!.progress;
  for (let index = 1; index < gps.length; index++) {
    const next = Date.parse(gps[index]!.timestampUtc);
    if (stamp <= next) {
      const prior = gps[index - 1]!;
      const start = Date.parse(prior.timestampUtc);
      const fraction = (stamp - start) / Math.max(1, next - start);
      return clamp(prior.progress + fraction * (gps[index]!.progress - prior.progress));
    }
  }
  return gps[gps.length - 1]!.progress;
}

function linePath(rows: Point[], value: (row: Point) => number | null, x: (row: Point) => number, y: (value: number) => number, stepped = false) {
  let previousY: number | null = null;
  return rows.map((row) => {
    const number = value(row);
    if (number == null || !Number.isFinite(number)) { previousY = null; return ""; }
    const nextX = x(row).toFixed(1), nextY = y(number);
    const command = previousY == null ? `M${nextX},${nextY.toFixed(1)}`
      : stepped ? `L${nextX},${previousY.toFixed(1)} L${nextX},${nextY.toFixed(1)}`
        : `L${nextX},${nextY.toFixed(1)}`;
    previousY = nextY;
    return command;
  }).join(" ");
}

function TrackPlot({ a, b, focus }: { a: Point[]; b: Point[]; focus: number }) {
  const all = [...a, ...b];
  if (!all.length) return <p className="decisive-empty">GPS path unavailable for the selected drivers. Car-data charts remain available where recorded.</p>;
  const xs = all.map((row) => row.x!), ys = all.map((row) => row.y!);
  const minX = Math.min(...xs), minY = Math.min(...ys), spanX = Math.max(1, Math.max(...xs) - minX), spanY = Math.max(1, Math.max(...ys) - minY);
  const scale = Math.min(285 / spanX, 220 / spanY);
  const x = (row: Point) => 26 + (row.x! - minX) * scale + (285 - spanX * scale) / 2;
  const y = (row: Point) => 26 + (row.y! - minY) * scale + (220 - spanY * scale) / 2;
  const path = (rows: Point[]) => rows.map((row, index) => `${index ? "L" : "M"}${x(row).toFixed(1)},${y(row).toFixed(1)}`).join(" ");
  return <svg className="decisive-track" viewBox="0 0 340 275" role="img" aria-label="Track-relative GPS paths for Drivers A and B; focused path progress is marked with circles">
    {a.length ? <path className="decisive-track-a" d={path(a)} /> : null}
    {b.length ? <path className="decisive-track-b" d={path(b)} /> : null}
    {[{ rows: a, label: "A", className: "is-a" }, { rows: b, label: "B", className: "is-b" }].map(({ rows, label, className }) => {
      const row = rows.reduce<Point | null>((closest, point) => !closest || Math.abs(point.progress - focus) < Math.abs(closest.progress - focus) ? point : closest, null);
      return row ? <g key={label} className={className}><circle cx={x(row)} cy={y(row)} r="8" /><text x={x(row) + 11} y={y(row) - 10}>{label}</text></g> : null;
    })}
  </svg>;
}

function SignalPlot({ label, unit, a, b, focus, max, value, onFocus, stepped = false }: {
  label: string; unit: string; a: Point[]; b: Point[]; focus: number; max: number;
  value: (row: Point) => number | null; onFocus: (value: number) => void; stepped?: boolean;
}) {
  const left = 35, right = 31, top = 13, bottom = 24, width = 700, height = 126;
  const x = (row: Point) => left + clamp(row.progress) * (width - left - right);
  const y = (number: number) => top + (1 - Math.min(max, Math.max(0, number)) / max) * (height - top - bottom);
  const scrub = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onFocus(clamp((event.clientX - box.left) / box.width));
  };
  return <div className="decisive-signal"><div className="decisive-signal-heading"><strong>{label}</strong><span>{unit} · {stepped ? "recorded state" : "sampled"}</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} against approximate normalized path progress; use the shared focus slider for keyboard access`}>
    {[0, max / 2, max].map((tick) => <g key={tick} className="decisive-grid"><line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} /><text x={left - 5} y={y(tick) + 4} textAnchor="end">{tick.toFixed(0)}</text></g>)}
    {a.length ? <path className="decisive-line-a" d={linePath(a, value, x, y, stepped)} /> : null}
    {b.length ? <path className="decisive-line-b" d={linePath(b, value, x, y, stepped)} /> : null}
    <line className="decisive-cursor" x1={left + focus * (width - left - right)} x2={left + focus * (width - left - right)} y1={top} y2={height - bottom} />
    <text className="decisive-axis" x={left} y={height - 5}>0%</text><text className="decisive-axis" x={width - right} y={height - 5} textAnchor="end">100%</text>
    <rect className="decisive-hit" x={left} y={top} width={width - left - right} height={height - top - bottom} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }} onPointerMove={(event) => { if (event.buttons) scrub(event); }} />
  </svg></div>;
}

export function DecisiveLapStory({ evidence, drivers, selectedCode, compareCode, onLap, loading }: {
  evidence: DecisiveLapEvidence; drivers: Driver[]; selectedCode: string | null; compareCode: string | null;
  onLap: (lap: number) => void; loading: boolean;
}) {
  const [mobileView, setMobileView] = useState<"track" | "speed" | "controls">("track");
  const [focus, setFocus] = useState(0.5);
  const trace = useMemo(() => [selectedCode, compareCode].map((code) => {
    const gps = gpsProgress(evidence.traces.filter((row) => row.code === code && row.kind === "gps"));
    const car = evidence.traces.filter((row) => row.code === code && row.kind === "car")
      .sort((a, b) => a.index - b.index).map((row) => ({ ...row, progress: alignToGps(row, gps) }));
    return { gps, car };
  }), [evidence.traces, selectedCode, compareCode]);
  const [a, b] = trace;
  const feature = evidence.featuredLaps.find((item) => item.lap === evidence.selectedLap);
  const sectorFor = (code: string | null) => evidence.sectors.find((row) => row.code === code);
  const driverName = (code: string | null) => drivers.find((row) => row.code === code)?.name ?? code ?? "Unavailable";
  const maxSpeed = Math.max(200, Math.ceil(Math.max(0, ...a!.car.map((row) => row.speedKph ?? 0), ...b!.car.map((row) => row.speedKph ?? 0)) / 50) * 50);
  const signal = (kind: "speed" | "controls") => <div className="decisive-signals">
    {kind === "speed" ? <SignalPlot label="Speed" unit="km/h" a={a!.car} b={b!.car} focus={focus} max={maxSpeed} value={(row) => row.speedKph} onFocus={setFocus} /> : <>
      <SignalPlot label="Throttle" unit="%" a={a!.car} b={b!.car} focus={focus} max={100} value={(row) => row.throttlePct} onFocus={setFocus} />
      <SignalPlot label="Brake" unit="%" a={a!.car} b={b!.car} focus={focus} max={100} value={(row) => row.brakePct} onFocus={setFocus} />
      <SignalPlot label="Gear" unit="gear" a={a!.car} b={b!.car} focus={focus} max={8} value={(row) => row.gear} onFocus={setFocus} stepped />
    </>}
  </div>;
  const sectorRows = [["Lap", "lapTimeS"], ["Sector 1", "sector1S"], ["Sector 2", "sector2S"], ["Sector 3", "sector3S"]] as const;
  return <section id="decisive-lap" className="decisive-story" aria-labelledby="decisive-title">
    <header className="decisive-heading"><div><p>04 / The decisive lap · Close-up</p><h2 id="decisive-title">Where did their laps diverge?</h2></div><p>Compare recorded car and GPS samples on a featured lap. The selection highlights evidence; it does not prove what decided the result.</p></header>
    {loading ? <p className="decisive-empty" role="status">Loading featured-lap evidence…</p> : !feature ? <p className="decisive-empty">Featured-lap traces are unavailable for this report. The race-shape scene and official result remain available.</p> : <>
      <div className="decisive-lap-picker" role="group" aria-label="Featured lap">{evidence.featuredLaps.map((item) => <button key={item.lap} type="button" aria-pressed={item.lap === evidence.selectedLap} onClick={() => onLap(item.lap)}>Lap {item.lap}<span>{item.rank === 1 ? "Featured" : "Alternative"}</span></button>)}</div>
      <div className="decisive-feature"><strong>{feature.title}</strong><span>{feature.reason} · {feature.evidenceType.replaceAll("_", " ")} · {feature.carDriverCount}/{feature.driverCount} car traces, {feature.gpsDriverCount}/{feature.driverCount} GPS traces</span></div>
      <div className="decisive-mobile-tabs" role="group" aria-label="Featured lap view">{(["track", "speed", "controls"] as const).map((view) => <button key={view} type="button" aria-pressed={mobileView === view} onClick={() => setMobileView(view)}>{view === "track" ? "Track" : view === "speed" ? "Speed" : "Controls"}</button>)}</div>
      <div className="decisive-layout"><div className="decisive-track-panel" data-mobile-active={mobileView === "track"}><h3>Track-relative GPS path</h3><TrackPlot a={a!.gps} b={b!.gps} focus={focus} /><p>Coordinates show circuit shape, not geographic location. A and B paths use their own samples.</p></div><div className="decisive-chart-panel"><div className="decisive-speed-panel" data-mobile-active={mobileView === "speed"}>{signal("speed")}</div><div className="decisive-controls-panel" data-mobile-active={mobileView === "controls"}>{signal("controls")}</div></div></div>
      <div className="decisive-focus"><label htmlFor="decisive-focus-point">Focus <strong>{Math.round(focus * 100)}%</strong></label><input id="decisive-focus-point" type="range" min="0" max="100" value={Math.round(focus * 100)} onChange={(event) => setFocus(Number(event.target.value) / 100)} aria-label="Focus point on selected lap" /><span>Approximate path progress</span></div>
      <div className="decisive-details"><div><h3>Recorded sector times · lap {feature.lap}</h3><div className="decisive-sector-head"><span></span><strong className="is-a">A · {driverName(selectedCode)}</strong><strong className="is-b">B · {driverName(compareCode)}</strong></div>{sectorRows.map(([label, key]) => <div className="decisive-sector-row" key={key}><span>{label}</span><strong>{fmt(sectorFor(selectedCode)?.[key] ?? null)}</strong><strong>{fmt(sectorFor(compareCode)?.[key] ?? null)}</strong></div>)}</div><aside><h3>Evidence notes</h3><p>{selectedCode && a!.car.length ? `${selectedCode}: ${a!.car.length} car samples${a!.gps.length ? `, ${a!.gps.length} GPS samples` : "; GPS unavailable"}.` : `${driverName(selectedCode)} has no car trace on this lap.`}</p><p>{compareCode && b!.car.length ? `${compareCode}: ${b!.car.length} car samples${b!.gps.length ? `, ${b!.gps.length} GPS samples` : "; GPS unavailable"}.` : `${driverName(compareCode)} has no car trace on this lap.`}</p><p>Source: OpenF1 car data, location, and laps; feature selection: {feature.source}. {feature.limitation}</p></aside></div>
      <p className="decisive-source">Car and GPS samples are aligned by UTC time and shown against each driver’s approximate GPS path progress. When GPS is missing, the car trace uses elapsed-lap progress. Missing channels and sectors are left blank. This comparison does not establish the cause of a position or result change.</p>
    </>}
  </section>;
}
