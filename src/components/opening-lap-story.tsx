import { useMemo, useState, type PointerEvent } from "react";
import type { OpeningEvidence, RacePositionStoryRow } from "@/lib/f1.functions";
import "./opening-lap-story.css";

type Driver = { code: string; name: string; team: string; grid: number | null };
type Position = OpeningEvidence["positions"][number];

const place = (position: number | null | undefined) => position != null && position > 0 ? `P${position}` : "Not recorded";

function OpeningPlot({ evidence, a, b, gridA, gridB, time, onTime, compact = false }: {
  evidence: OpeningEvidence; a: string | null; b: string | null;
  gridA: number | null; gridB: number | null;
  time: number; onTime: (value: number) => void; compact?: boolean;
}) {
  const width = compact ? 390 : 1000, height = compact ? 300 : 360;
  const left = compact ? 55 : 63, right = compact ? 28 : 54, top = 36, bottom = 44;
  const duration = Math.max(1, evidence.window?.durationMs ?? 1);
  const maxPosition = Math.max(20, gridA ?? 0, gridB ?? 0, ...evidence.positions.map((row) => row.position));
  const x = (ms: number) => left + Math.min(1, Math.max(0, ms / duration)) * (width - left - right);
  const y = (position: number) => top + (position - 1) / Math.max(1, maxPosition - 1) * (height - top - bottom);
  const byDriver = useMemo(() => {
    const grouped = new Map<string, Position[]>();
    for (const row of evidence.positions) {
      const list = grouped.get(row.code) ?? [];
      list.push(row);
      grouped.set(row.code, list);
    }
    return grouped;
  }, [evidence.positions]);
  const path = (rows: Position[]) => rows.map((row, index) => index === 0
    ? `M${x(row.elapsedMs)},${y(row.position)}`
    : `H${x(row.elapsedMs)}V${y(row.position)}`).join(" ");
  const latest = (code: string | null) => code ? [...(byDriver.get(code) ?? [])].reverse().find((row) => row.elapsedMs <= time) : null;
  const scrub = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    onTime(Math.round(Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) * duration / 1000));
  };
  return <svg className={`opening-lap-plot ${compact ? "opening-lap-plot-mobile" : "opening-lap-plot-desktop"}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recorded position changes during the first timed lap. Grid markers are separate from the timed trace. Use the time slider and driver controls for details.">
    {[1, 5, 10, 15, 20, maxPosition].filter((value, index, all) => value <= maxPosition && all.indexOf(value) === index).map((value) =>
      <g className="opening-lap-grid" key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text x={left - 8} y={y(value) + 4} textAnchor="end">P{value}</text></g>,
    )}
    {[...byDriver.entries()].filter(([code]) => code !== a && code !== b).map(([code, rows]) =>
      <path key={code} className="opening-lap-context" d={path(rows)} />,
    )}
    <text className="opening-lap-grid-label" x={compact ? 23 : 29} y={top - 12} textAnchor="middle">GRID</text>
    {[{ code: a, position: gridA, kind: "a" }, { code: b, position: gridB, kind: "b" }].map(({ code, position, kind }) => code && position != null && position > 0 ?
      <g key={kind} className={`opening-lap-grid-marker opening-lap-grid-marker-${kind}`}><circle cx={compact ? 23 : 29} cy={y(position)} r="5" /><title>{`${code} race grid P${position}`}</title></g> : null,
    )}
    {a && byDriver.has(a) ? <path className="opening-lap-a" d={path(byDriver.get(a)!)} /> : null}
    {b && byDriver.has(b) ? <path className="opening-lap-b" d={path(byDriver.get(b)!)} /> : null}
    {evidence.raceControl.map((event) =>
      <line key={event.id} className="opening-lap-event" x1={x(event.elapsedMs)} x2={x(event.elapsedMs)} y1={top} y2={height - bottom} />,
    )}
    <line className="opening-lap-cursor" x1={x(time)} x2={x(time)} y1={top - 12} y2={height - bottom + 7} />
    {[{ code: a, row: latest(a), kind: "a" }, { code: b, row: latest(b), kind: "b" }].map(({ code, row, kind }) => row && code ?
      <g key={kind} className={`opening-lap-focus opening-lap-focus-${kind}`}><circle cx={x(row.elapsedMs)} cy={y(row.position)} r="6" /><text x={x(row.elapsedMs) + 9} y={y(row.position) - 8}>{code}</text></g> : null,
    )}
    {[0, .25, .5, .75, 1].map((fraction) =>
      <text key={fraction} className="opening-lap-tick" x={x(duration * fraction)} y={height - 9} textAnchor="middle">{Math.round(duration * fraction / 1000)}s</text>,
    )}
    <rect className="opening-lap-hit" x={left} y={top} width={width - left - right} height={height - top - bottom + 9}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }}
      onPointerMove={(event) => { if (event.buttons) scrub(event); }} />
  </svg>;
}

export function OpeningLapStory({ evidence, checkpoint, drivers, selectedCode, compareCode, selectedTime, onSelectDriver, onSelectCompare, onSelectTime, loading }: {
  evidence: OpeningEvidence;
  checkpoint: RacePositionStoryRow[];
  drivers: Driver[];
  selectedCode: string | null;
  compareCode: string | null;
  selectedTime: number | undefined;
  onSelectDriver: (code: string) => void;
  onSelectCompare: (code: string) => void;
  onSelectTime: (seconds: number) => void;
  loading: boolean;
}) {
  const codes = [...new Set([...drivers.map((driver) => driver.code), ...evidence.positions.map((row) => row.code)])];
  const byCode = new Map(drivers.map((driver) => [driver.code, driver]));
  const a = selectedCode && codes.includes(selectedCode) ? selectedCode : codes[0] ?? null;
  const gridOrder = [...drivers].filter((driver) => driver.grid != null && driver.grid > 0).sort((x, y) => x.grid! - y.grid!);
  const aIndex = gridOrder.findIndex((driver) => driver.code === a);
  const rival = aIndex >= 0 ? (gridOrder[aIndex + 1] ?? gridOrder[aIndex - 1])?.code : null;
  const b = compareCode && compareCode !== a && codes.includes(compareCode) ? compareCode : rival && rival !== a ? rival : codes.find((code) => code !== a) ?? null;
  const durationSeconds = Math.max(1, Math.ceil((evidence.window?.durationMs ?? 0) / 1000));
  const timeSeconds = Math.min(durationSeconds, Math.max(0, selectedTime ?? durationSeconds));
  const time = Math.min(evidence.window?.durationMs ?? 0, timeSeconds * 1000);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const event = evidence.raceControl.find((row) => row.id === selectedEvent) ?? null;
  const lapOne = new Map(checkpoint.filter((row) => row.lap === 1).map((row) => [row.code, row]));
  const latest = (code: string | null) => code ? [...evidence.positions].reverse().find((row) => row.code === code && row.elapsedMs <= time) : null;
  const focus = (code: string | null, label: string) => {
    const driver = code ? byCode.get(code) : null;
    const grid = driver?.grid;
    const finish = code ? lapOne.get(code)?.position : null;
    const change = grid != null && grid > 0 && finish != null ? grid - finish : null;
    const observation = latest(code);
    return <div className="opening-lap-driver" key={label}>
      <div className="opening-lap-driver-title"><span className={label === "A" ? "is-a" : "is-b"}>{label}</span><strong>{driver?.name ?? code ?? "Unavailable"}</strong></div>
      <div className="opening-lap-facts"><div><span>Race grid</span><strong>{grid === 0 ? "Pit lane" : place(grid)}</strong></div><div><span>Lap-one checkpoint</span><strong>{place(finish)}</strong></div><div><span>Change from grid</span><strong>{change == null ? "Unavailable" : change > 0 ? `+${change} places` : change < 0 ? `${change} places` : "No change"}</strong></div></div>
      <p>{observation ? `Latest recorded in-lap position at ${Math.round(observation.elapsedMs / 1000)}s: P${observation.position}.` : "No in-lap position event is recorded by this time."}</p>
    </div>;
  };
  const selectEvent = (id: string, elapsedMs: number) => { setSelectedEvent(id); onSelectTime(Math.round(elapsedMs / 1000)); };

  return <section className="opening-lap-story" aria-labelledby="opening-lap-title">
    <div className="opening-lap-heading"><div><p>02 / The opening · First timed lap</p><h2 id="opening-lap-title">How did the order shift in lap one?</h2></div><p>Follow two drivers through recorded position changes. The grid and lap-one checkpoint use separate sources.</p></div>
    <div className="opening-lap-layout">
      <div className="opening-lap-main">
        <div className="opening-lap-chart-head"><strong>Recorded positions · first timed lap</strong><span>{evidence.window ? `${evidence.positions.length} changes · ${Math.round(evidence.window.durationMs / 1000)}s window` : "No in-lap feed"}</span></div>
        {loading ? <p className="opening-lap-empty" role="status">Loading opening evidence…</p> : evidence.positions.length ? <>
          <OpeningPlot evidence={evidence} a={a} b={b} gridA={byCode.get(a ?? "")?.grid ?? null} gridB={byCode.get(b ?? "")?.grid ?? null} time={time} onTime={onSelectTime} />
          <OpeningPlot evidence={evidence} a={a} b={b} gridA={byCode.get(a ?? "")?.grid ?? null} gridB={byCode.get(b ?? "")?.grid ?? null} time={time} onTime={onSelectTime} compact />
          <div className="opening-lap-controls"><label htmlFor="opening-lap-range">Time <strong>{timeSeconds}s</strong></label><input id="opening-lap-range" type="range" min="0" max={durationSeconds} value={timeSeconds} onChange={(item) => onSelectTime(Number(item.target.value))} aria-label="Select time in first timed lap" /><span>{durationSeconds}s</span></div>
          <div className="opening-lap-key"><span className="is-a">A · selected</span><span className="is-b">B · compare</span><span className="is-context">Other drivers</span><span className="is-event">Race control</span></div>
        </> : <p className="opening-lap-empty">Recorded first-lap positions are unavailable. Grid and lap-one checkpoint details appear where stored.</p>}
        <p className="opening-lap-source">OpenF1 position events use recorded UTC timestamps within the first timed lap, ending when the leader completes lap one. Missing intervals are not drawn. A position change does not verify an on-track overtake or explain a race-control message.</p>
      </div>
      <aside className="opening-lap-inspector">
        <div className="opening-lap-selectors"><label>Driver A<select value={a ?? ""} onChange={(item) => onSelectDriver(item.target.value)}>{codes.map((code) => <option key={code} value={code}>{byCode.get(code)?.name ?? code}</option>)}</select></label><label>Driver B<select value={b ?? ""} onChange={(item) => onSelectCompare(item.target.value)}>{codes.filter((code) => code !== a).map((code) => <option key={code} value={code}>{byCode.get(code)?.name ?? code}</option>)}</select></label></div>
        {focus(a, "A")}{b ? focus(b, "B") : null}
        <div className="opening-lap-control-list"><h3>Race control · first lap</h3>{evidence.raceControl.length ? <ol>{evidence.raceControl.map((row) => <li key={row.id}><button type="button" aria-pressed={row.id === event?.id} onClick={() => selectEvent(row.id, row.elapsedMs)}><span>{Math.round(row.elapsedMs / 1000)}s</span><strong>{row.detail}</strong></button></li>)}</ol> : <p>No race-control message is recorded in this timed window.</p>}{event ? <p className="opening-lap-event-detail">{event.detail} · {event.source}. {event.limitation}</p> : null}</div>
        <p className="opening-lap-checkpoint-source">Grid: curated race results. Lap-one checkpoint: stored lap position timeline, which may be derived or sampled at lap completion. Race control: recorded provider messages in the timed window.</p>
      </aside>
    </div>
  </section>;
}
