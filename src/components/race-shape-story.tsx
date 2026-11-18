import { useMemo, useState, type PointerEvent } from "react";
import type { RacePositionStoryRow, RaceShapeEvidence } from "@/lib/f1.functions";
import "./race-shape-story.css";

type Driver = { code: string; name: string; grid: number | null; finish: number | null };
type Event = { id: string; kind: "pit" | "status" | "rain"; lap: number; endLap: number; label: string; timestampUtc: string | null; source: string; limitation: string | null };

const place = (value: number | null | undefined) => value != null && value > 0 ? `P${value}` : "Unavailable";
const timeLabel = (value: string | null) => value ? `${new Date(value).toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC` : "No exact UTC time stored";
const statusLabel = (value: string) => value === "safety-car" ? "Safety car" : value === "virtual-safety-car" ? "Virtual safety car" : value === "yellow" ? "Yellow status" : "Mixed track status";

function seriesPath<T extends { lap: number }>(items: T[], x: (lap: number) => number, y: (item: T) => number, valid: (item: T) => boolean) {
  let previous = -1;
  return items.map((item) => {
    if (!valid(item)) { previous = -1; return ""; }
    const command = previous === item.lap - 1 ? "L" : "M";
    previous = item.lap;
    return `${command}${x(item.lap).toFixed(1)},${y(item).toFixed(1)}`;
  }).join(" ");
}

function RacePlot({ kind, rows, evidence, a, b, lap, maxLap, onLap, compact }: {
  kind: "position" | "gap"; rows: RacePositionStoryRow[]; evidence: RaceShapeEvidence;
  a: string | null; b: string | null; lap: number; maxLap: number; onLap: (lap: number) => void; compact: boolean;
}) {
  const width = compact ? 390 : 950, height = compact ? 290 : kind === "position" ? 330 : 220;
  const left = compact ? 38 : 48, right = compact ? 34 : 56, top = 27, bottom = 38;
  const maxPosition = Math.max(20, ...rows.map((row) => row.position));
  const gapValues = evidence.gaps.map((row) => row.gapSeconds).filter((value): value is number => value != null && Number.isFinite(value) && value >= 0);
  const maxGap = Math.max(10, Math.ceil(Math.max(0, ...gapValues) / 10) * 10);
  const x = (value: number) => left + (Math.max(1, Math.min(maxLap, value)) - 1) / Math.max(1, maxLap - 1) * (width - left - right);
  const y = (value: number) => kind === "position"
    ? top + (value - 1) / Math.max(1, maxPosition - 1) * (height - top - bottom)
    : top + value / maxGap * (height - top - bottom);
  const byDriver = new Map<string, RacePositionStoryRow[]>();
  for (const row of rows) { const list = byDriver.get(row.code) ?? []; list.push(row); byDriver.set(row.code, list); }
  const gapsByDriver = new Map<string, RaceShapeEvidence["gaps"]>();
  for (const row of evidence.gaps) { const list = gapsByDriver.get(row.code) ?? []; list.push(row); gapsByDriver.set(row.code, list); }
  const pathFor = (code: string) => kind === "position"
    ? seriesPath(byDriver.get(code) ?? [], x, (row) => y(row.position), () => true)
    : seriesPath(gapsByDriver.get(code) ?? [], x, (row) => y(row.gapSeconds ?? 0), (row) => row.gapSeconds != null && Number.isFinite(row.gapSeconds) && row.gapSeconds >= 0);
  const last = (code: string | null) => {
    if (!code) return null;
    if (kind === "position") { const list = byDriver.get(code) ?? []; return list.length ? { lap: list[list.length - 1]!.lap, value: list[list.length - 1]!.position } : null; }
    const list = (gapsByDriver.get(code) ?? []).filter((row) => row.gapSeconds != null && Number.isFinite(row.gapSeconds) && row.gapSeconds >= 0);
    return list.length ? { lap: list[list.length - 1]!.lap, value: list[list.length - 1]!.gapSeconds! } : null;
  };
  const aLast = last(a), bLast = last(b);
  const scrub = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    onLap(Math.round(1 + fraction * (maxLap - 1)));
  };
  const ticks = [...new Set([1, Math.max(1, Math.round(maxLap / 4)), Math.max(1, Math.round(maxLap / 2)), Math.max(1, Math.round(maxLap * 3 / 4)), maxLap])];
  const yTicks = kind === "position" ? [1, 5, 10, 15, 20, maxPosition] : [0, maxGap / 2, maxGap];
  return <svg className="race-shape-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${kind === "position" ? "Lap running position" : "Sampled gap to leader"} for selected drivers. Lap ${lap} selected; use the lap slider for keyboard control.`}>
    {evidence.statuses.map((item) => <rect key={item.id} className={`race-shape-band race-shape-band-${item.label}`} x={x(item.startLap)} y={top} width={Math.max(3, x(Math.min(maxLap, item.endLap + 1)) - x(item.startLap))} height={height - top - bottom} />)}
    {evidence.rain.map((item) => <rect key={item.lap} className="race-shape-rain-band" x={x(item.lap)} y={top} width={Math.max(2, (width - left - right) / Math.max(1, maxLap - 1))} height={height - top - bottom} />)}
    {[...new Set(yTicks)].map((value) => <g key={value} className="race-shape-grid"><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text x={left - 5} y={y(value) + 4} textAnchor="end">{kind === "position" ? `P${value}` : `${value.toFixed(0)}s`}</text></g>)}
    {kind === "position" ? [...byDriver.keys()].filter((code) => code !== a && code !== b).map((code) => <path key={code} className="race-shape-context" d={pathFor(code)} />) : null}
    {a ? <path className="race-shape-line-a" d={pathFor(a)} /> : null}
    {b ? <path className="race-shape-line-b" d={pathFor(b)} /> : null}
    <line className="race-shape-cursor" x1={x(lap)} x2={x(lap)} y1={top - 8} y2={height - bottom + 5} />
    {[{ code: a, last: aLast, letter: "A" }, { code: b, last: bLast, letter: "B" }].map(({ code, last: point, letter }) => code && point ? <g key={letter} className={`race-shape-end race-shape-end-${letter.toLowerCase()}`}><circle cx={x(point.lap)} cy={y(point.value)} r="4" /><text x={Math.min(width - 19, x(point.lap) + 7)} y={y(point.value) - 7}>{letter}</text></g> : null)}
    {ticks.map((value) => <text key={value} className="race-shape-tick" x={x(value)} y={height - 8} textAnchor="middle">{value}</text>)}
    <rect className="race-shape-hit" x={left} y={top} width={width - left - right} height={height - top - bottom + 8} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }} onPointerMove={(event) => { if (event.buttons) scrub(event); }} />
  </svg>;
}

export function RaceShapeStory({ rows, evidence, drivers, selectedCode, compareCode, selectedLap, onDriver, onCompare, onLap, loading }: {
  rows: RacePositionStoryRow[]; evidence: RaceShapeEvidence; drivers: Driver[];
  selectedCode: string | null; compareCode: string | null; selectedLap: number | undefined;
  onDriver: (code: string) => void; onCompare: (code: string) => void; onLap: (lap: number) => void; loading: boolean;
}) {
  const [mobileView, setMobileView] = useState<"position" | "gap">("position");
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const byCode = new Map(drivers.map((driver) => [driver.code, driver]));
  const codes = [...new Set([...drivers.map((driver) => driver.code), ...rows.map((row) => row.code)])];
  const a = selectedCode && codes.includes(selectedCode) ? selectedCode : codes[0] ?? null;
  const gridOrder = [...drivers].filter((driver) => driver.grid != null && driver.grid > 0).sort((x, y) => x.grid! - y.grid!);
  const aIndex = gridOrder.findIndex((driver) => driver.code === a);
  const rival = aIndex >= 0 ? (gridOrder[aIndex + 1] ?? gridOrder[aIndex - 1])?.code : null;
  const b = compareCode && compareCode !== a && codes.includes(compareCode) ? compareCode : rival && rival !== a ? rival : codes.find((code) => code !== a) ?? null;
  const maxLap = Math.max(0, ...rows.map((row) => row.lap), ...evidence.gaps.map((row) => row.lap));
  const lap = maxLap ? Math.max(1, Math.min(maxLap, selectedLap ?? Math.round(maxLap / 2))) : 1;
  const positionAt = (code: string | null) => rows.find((row) => row.code === code && row.lap === lap);
  const gapAt = (code: string | null) => evidence.gaps.find((row) => row.code === code && row.lap === lap);
  const events = useMemo<Event[]>(() => [
    ...evidence.pits.filter((item) => item.code === a || item.code === b).map((item) => ({ id: item.id, kind: "pit" as const, lap: item.lap, endLap: item.lap, label: `${item.code} pit stop · ${item.detail}`, timestampUtc: item.timestampUtc, source: item.source, limitation: item.limitation })),
    ...evidence.statuses.map((item) => ({ id: item.id, kind: "status" as const, lap: item.startLap, endLap: item.endLap, label: statusLabel(item.label), timestampUtc: null, source: item.source, limitation: item.limitation })),
    ...evidence.rain.map((item) => ({ id: `rain:${item.lap}`, kind: "rain" as const, lap: item.lap, endLap: item.lap, label: "Rainfall observed", timestampUtc: item.timestampUtc, source: item.source, limitation: item.limitation })),
  ].sort((x, y) => x.lap - y.lap || x.kind.localeCompare(y.kind)), [evidence, a, b]);
  const activeEvent = events.find((item) => item.id === selectedEvent && item.lap <= lap && item.endLap >= lap) ?? null;
  const atLap = events.filter((item) => item.lap <= lap && item.endLap >= lap);
  const selectedPits = events.filter((item) => item.kind === "pit");
  const hasGapSamples = evidence.gaps.some((item) => item.gapSeconds != null);
  const positionSource = rows.some((row) => row.source === "derived-lap") ? "Derived lap-completion running order" : rows.some((row) => row.source === "openf1-position") ? "OpenF1 lap-sampled position" : "Stored lap positions";
  const selectEvent = (item: Event) => { setSelectedEvent(item.id); onLap(item.lap); };
  const driverDetail = (code: string | null, letter: "A" | "B") => {
    const driver = code ? byCode.get(code) : null;
    const position = positionAt(code);
    const gap = gapAt(code);
    return <div className="race-shape-driver" key={letter}>
      <div className="race-shape-driver-name"><span className={letter === "A" ? "is-a" : "is-b"}>{letter}</span><strong>{driver?.name ?? code ?? "Unavailable"}</strong></div>
      <div className="race-shape-facts"><div><span>Running · lap {lap}</span><strong>{place(position?.position)}</strong></div><div><span>Gap to leader · sampled</span><strong>{gap?.gapSeconds != null ? `+${gap.gapSeconds.toFixed(3)}s` : "Unavailable / lapped"}</strong></div><div><span>Official finish</span><strong>{place(driver?.finish)}</strong></div></div>
      <p>{gap ? `Gap sample: ${timeLabel(gap.timestampUtc)} · ${gap.source}.` : "No gap sample for this driver and lap."}</p>
    </div>;
  };
  return <section id="race-shape" className="race-shape-story" aria-labelledby="race-shape-title">
    <div className="race-shape-heading"><div><p>03 / The race shape · Full race</p><h2 id="race-shape-title">Where did the order move?</h2></div><p>Follow running position and sampled gap to the leader across the race. Event context shares the lap axis.</p></div>
    <div className="race-shape-layout">
      <div className="race-shape-main">
        {loading ? <p className="race-shape-empty" role="status">Loading race-shape evidence…</p> : rows.length ? <>
          <div className="race-shape-desktop-charts"><div className="race-shape-chart-head"><strong>Running position · full race</strong><span>{positionSource}</span></div><RacePlot kind="position" rows={rows} evidence={evidence} a={a} b={b} lap={lap} maxLap={maxLap} onLap={onLap} compact={false} /><div className="race-shape-chart-head"><strong>Gap to leader · seconds</strong><span>OpenF1 samples after lap start</span></div>{hasGapSamples ? <RacePlot kind="gap" rows={rows} evidence={evidence} a={a} b={b} lap={lap} maxLap={maxLap} onLap={onLap} compact={false} /> : <p className="race-shape-gap-empty">Gap samples are unavailable for these drivers.</p>}</div>
          <div className="race-shape-mobile-charts"><div className="race-shape-mobile-tabs" role="group" aria-label="Race chart"><button type="button" aria-pressed={mobileView === "position"} onClick={() => setMobileView("position")}>Position</button><button type="button" aria-pressed={mobileView === "gap"} onClick={() => setMobileView("gap")}>Gap</button></div><div className="race-shape-chart-head"><strong>{mobileView === "position" ? "Running position" : "Gap to leader · seconds"}</strong><span>Lap {lap}</span></div>{mobileView === "position" || hasGapSamples ? <RacePlot kind={mobileView} rows={rows} evidence={evidence} a={a} b={b} lap={lap} maxLap={maxLap} onLap={onLap} compact /> : <p className="race-shape-gap-empty">Gap samples are unavailable for these drivers.</p>}</div>
          <div className="race-shape-event-rail" aria-label="Race event markers">
            <strong>Event context</strong><div className="race-shape-rail-track">
              {evidence.statuses.filter((item) => item.label === "safety-car" || item.label === "virtual-safety-car").map((item) => <button key={item.id} type="button" className={`race-shape-rail-status race-shape-rail-${item.label}`} style={{ left: `${(item.startLap - 1) / Math.max(1, maxLap - 1) * 100}%` }} title={`${statusLabel(item.label)} · laps ${item.startLap}–${item.endLap}`} onClick={() => selectEvent(events.find((event) => event.id === item.id)!)} aria-label={`${statusLabel(item.label)}, laps ${item.startLap} to ${item.endLap}`} />)}
              {selectedPits.filter((item, index, all) => all.findIndex((other) => other.lap === item.lap) === index).map((item) => <button key={item.id} type="button" className="race-shape-rail-pit" style={{ left: `${(item.lap - 1) / Math.max(1, maxLap - 1) * 100}%` }} title={`Selected driver pit stop · lap ${item.lap}`} onClick={() => selectEvent(item)} aria-label={`Selected driver pit stop, lap ${item.lap}`}>P</button>)}
              {evidence.rain.filter((item, index, all) => index === 0 || all[index - 1]!.lap !== item.lap - 1).map((item) => <button key={item.lap} type="button" className="race-shape-rail-rain" style={{ left: `${(item.lap - 1) / Math.max(1, maxLap - 1) * 100}%` }} title={`Rainfall observed · lap ${item.lap}`} onClick={() => { const found = events.find((event) => event.id === `rain:${item.lap}`); if (found) selectEvent(found); }} aria-label={`Rainfall observed, lap ${item.lap}`}>◆</button>)}
            </div></div>
          <div className="race-shape-lap-control"><label htmlFor="race-shape-lap">Lap <strong>{lap}</strong></label><input id="race-shape-lap" type="range" min="1" max={maxLap} value={lap} onChange={(item) => onLap(Number(item.target.value))} aria-label="Select full-race lap" /><span>of {maxLap}</span></div>
          <div className="race-shape-legend"><span className="is-a">A · selected</span><span className="is-b">B · compare</span><span className="is-context">Other drivers</span><span className="is-status">Track status</span><span className="is-rain">Observed rain</span></div>
        </> : <p className="race-shape-empty">Lap running positions are unavailable for this report. The official result remains below.</p>}
        <p className="race-shape-source">{positionSource}. Position lines connect only consecutive stored laps and may differ from official classification. OpenF1 gaps are the first provider samples after each lap starts; they are not simultaneous with the position checkpoints. Missing or lapped gaps stay blank. Event proximity does not establish cause.</p>
      </div>
      <aside className="race-shape-inspector"><div className="race-shape-selectors"><label>Driver A<select value={a ?? ""} onChange={(item) => onDriver(item.target.value)}>{codes.map((code) => <option key={code} value={code}>{byCode.get(code)?.name ?? code}</option>)}</select></label><label>Driver B<select value={b ?? ""} onChange={(item) => onCompare(item.target.value)}>{codes.filter((code) => code !== a).map((code) => <option key={code} value={code}>{byCode.get(code)?.name ?? code}</option>)}</select></label></div>
        <p className="race-shape-inspector-label">Lap {lap} · selected drivers</p>{driverDetail(a, "A")}{b ? driverDetail(b, "B") : null}
        <div className="race-shape-events"><h3>Context at lap {lap}</h3>{atLap.length ? <ol>{atLap.map((item) => <li key={item.id}><button type="button" aria-pressed={activeEvent?.id === item.id} onClick={() => selectEvent(item)}><span>{item.kind === "pit" ? "PIT" : item.kind === "rain" ? "RAIN" : "STATUS"}</span><strong>{item.label}</strong></button></li>)}</ol> : <p>No selected pit stop, track-status phase, or rainfall observation at this lap.</p>}{activeEvent ? <div className="race-shape-event-detail"><strong>{activeEvent.label}</strong><span>Lap {activeEvent.lap}{activeEvent.endLap > activeEvent.lap ? `–${activeEvent.endLap}` : ""} · {timeLabel(activeEvent.timestampUtc)}</span><span>Source: {activeEvent.source}</span><p>{activeEvent.limitation ?? "Recorded context only; no causal link to position or gap change is established."}</p></div> : null}</div>
      </aside>
    </div>
  </section>;
}
