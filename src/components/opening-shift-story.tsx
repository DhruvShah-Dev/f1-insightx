import { useMemo, type PointerEvent } from "react";
import { team } from "@/data/teams";
import type { RacePositionStoryRow } from "@/lib/f1.functions";
import "./opening-shift-story.css";

type Driver = { code: string; name: string; team: string; grid: number | null };

const rank = (value: number | null | undefined) => value != null && value > 0 ? `P${value}` : "—";

function PositionPlot({
  rows, selectedCode, lap, maxLap, maxPosition, onSelectLap, compact,
}: {
  rows: RacePositionStoryRow[];
  selectedCode: string | null;
  lap: number;
  maxLap: number;
  maxPosition: number;
  onSelectLap: (lap: number) => void;
  compact: boolean;
}) {
  const width = compact ? 390 : 1000;
  const height = compact ? 380 : 440;
  const left = compact ? 37 : 48;
  const right = compact ? 15 : 24;
  const top = 24;
  const bottom = compact ? 48 : 47;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (value: number) => left + ((value - 1) / Math.max(1, maxLap - 1)) * plotWidth;
  const y = (value: number) => top + ((value - 1) / Math.max(1, maxPosition - 1)) * plotHeight;
  const byDriver = useMemo(() => {
    const map = new Map<string, RacePositionStoryRow[]>();
    for (const row of rows) {
      const list = map.get(row.code) ?? [];
      list.push(row);
      map.set(row.code, list);
    }
    return map;
  }, [rows]);
  const pathParts = (series: RacePositionStoryRow[]) => {
    let previous = 0;
    return series.map((row) => {
      const command = previous > 0 && previous === row.lap - 1 ? "L" : "M";
      previous = row.lap;
      return `${command}${x(row.lap).toFixed(1)},${y(row.position).toFixed(1)}`;
    }).join(" ");
  };
  const selected = selectedCode ? byDriver.get(selectedCode) ?? [] : [];
  const selectedAtLap = selected.find((row) => row.lap === lap);
  const ticks = [...new Set([1, Math.ceil(maxLap * .25), Math.ceil(maxLap * .5), Math.ceil(maxLap * .75), maxLap])];
  const statusLaps = new Set(rows.filter((row) => row.status && !/^(green|clear|normal|unknown)$/i.test(row.status)).map((row) => row.lap));
  const scrub = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    onSelectLap(Math.max(1, Math.min(maxLap, Math.round(1 + fraction * (maxLap - 1)))));
  };
  return (
    <svg className={compact ? "opening-plot-mobile" : "opening-plot-desktop"} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Running position by lap. Selected lap ${lap}. Use the lap slider to select a lap.`}>
      {[1, 5, 10, 15, 20, maxPosition].filter((value, index, all) => value <= maxPosition && all.indexOf(value) === index).map((value) => (
        <g key={value} className="opening-grid"><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} /><text x={left - 8} y={y(value) + 4} textAnchor="end">P{value}</text></g>
      ))}
      {[...byDriver].filter(([code]) => code !== selectedCode).map(([code, series]) => <path key={code} className="opening-context-line" d={pathParts(series)} />)}
      {selected.length ? <path className="opening-selected-line" d={pathParts(selected)} /> : null}
      <line className="opening-cursor" x1={x(lap)} x2={x(lap)} y1={top - 7} y2={height - bottom + 9} />
      {selectedAtLap ? <circle className="opening-selected-dot" cx={x(lap)} cy={y(selectedAtLap.position)} r={compact ? 6 : 7} /> : null}
      <text className="opening-cursor-label" x={Math.max(left + 20, Math.min(width - right - 20, x(lap)))} y="15" textAnchor="middle">LAP {lap}</text>
      {[...statusLaps].map((value) => <line key={value} className="opening-status-tick" x1={x(value)} x2={x(value)} y1={height - bottom + 13} y2={height - bottom + 20} />)}
      {ticks.map((value) => <text key={value} className="opening-lap-tick" x={x(value)} y={height - 9} textAnchor="middle">{value}</text>)}
      <rect className="opening-scrub-hit" x={left} y={top} width={plotWidth} height={plotHeight + 22} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); scrub(event); }} onPointerMove={(event) => { if (event.buttons) scrub(event); }} />
    </svg>
  );
}

export function OpeningShiftStory({
  rows, drivers, selectedCode, selectedLap, onSelectDriver, onSelectLap, loading,
}: {
  rows: RacePositionStoryRow[];
  drivers: Driver[];
  selectedCode: string | null;
  selectedLap: number | undefined;
  onSelectDriver: (code: string) => void;
  onSelectLap: (lap: number) => void;
  loading: boolean;
}) {
  const availableCodes = useMemo(() => new Set(rows.map((row) => row.code)), [rows]);
  const allDrivers = useMemo(() => {
    const known = new Set(drivers.map((driver) => driver.code));
    return [...drivers, ...[...availableCodes].filter((code) => !known.has(code)).map((code) => ({ code, name: code, team: "", grid: null }))];
  }, [drivers, availableCodes]);
  const chartDrivers = allDrivers.filter((driver) => availableCodes.has(driver.code));
  const selected = allDrivers.find((driver) => driver.code === selectedCode) ?? chartDrivers[0] ?? null;
  const minLap = rows.length ? Math.min(...rows.map((row) => row.lap)) : 1;
  const maxLap = Math.max(0, ...rows.map((row) => row.lap));
  const maxPosition = Math.max(20, ...rows.map((row) => row.position));
  const estimated = rows.some((row) => row.source === "lap-timing-estimate");
  const openf1 = rows.some((row) => row.source === "openf1-position");
  const hasStatusMarkers = rows.some((row) => row.status && !/^(green|clear|normal|unknown)$/i.test(row.status));
  const lap = maxLap ? Math.min(maxLap, Math.max(minLap, selectedLap ?? minLap)) : 1;
  const runningOrder = rows.filter((row) => row.lap === lap).sort((a, b) => a.position - b.position);
  const selectedPosition = runningOrder.find((row) => row.code === selected?.code)?.position ?? null;
  const gain = selected && selected.grid != null && selected.grid > 0 && selectedPosition != null ? selected.grid - selectedPosition : null;
  const selectedName = selected?.name ?? selected?.code ?? "No driver selected";

  return (
    <section className="opening-story" aria-labelledby="opening-title">
      <div className="opening-heading"><div><p className="opening-eyebrow">02 / Opening shift · After lights out</p><h2 id="opening-title">How did the running order change?</h2></div><p>Follow a driver through the race, then select a lap to inspect the order at that moment.</p></div>
      <div className="opening-layout">
        <div className="opening-main">
          <div className="opening-chart-head"><strong>{estimated ? "Estimated running order, lap by lap" : "Running position, lap by lap"}</strong><span>{rows.length ? `${chartDrivers.length} drivers · ${maxLap} laps recorded` : "Grand Prix"}</span></div>
          {loading ? <p className="opening-empty" role="status">Loading lap positions…</p> : rows.length ? <>
            <div className="opening-chart-frame"><PositionPlot rows={rows} selectedCode={selected?.code ?? null} lap={lap} maxLap={maxLap} maxPosition={maxPosition} onSelectLap={onSelectLap} compact={false} /><PositionPlot rows={rows} selectedCode={selected?.code ?? null} lap={lap} maxLap={maxLap} maxPosition={maxPosition} onSelectLap={onSelectLap} compact /></div>
            <div className="opening-controls"><label htmlFor="opening-lap-range">Lap <strong>{lap}</strong></label><input id="opening-lap-range" type="range" min={minLap} max={maxLap} value={lap} onChange={(event) => onSelectLap(Number(event.target.value))} aria-label="Select race lap" /><span>of {maxLap}</span></div>
            <div className="opening-legend"><span className="opening-legend-selected">Selected driver</span><span className="opening-legend-context">Other drivers</span>{hasStatusMarkers ? <span className="opening-legend-status">Track status marker</span> : null}</div>
          </> : <p className="opening-empty">Lap-by-lap running order is unavailable for this report. The official result remains in the report below.</p>}
          <p className="opening-source-note">{estimated ? "Positions are estimated by ordering recorded lap-completion times. They do not verify pass-by-pass overtakes. Missing timing stays blank, and official classification may differ." : openf1 ? "OpenF1 position events are sampled when the leader completes each lap. Missing records stay blank; official classification may differ." : "Running order is derived from stored lap positions. Gaps mean no position was recorded. The final plotted lap may differ from official classification."}</p>
        </div>
        <aside className="opening-inspector">
          <p className="opening-inspector-eyebrow">Lap {lap} / Driver focus</p>
          {rows.length && !loading ? <>
            <label className="opening-driver-select">Driver<select value={selected?.code ?? ""} onChange={(event) => onSelectDriver(event.target.value)}>{allDrivers.map((driver) => <option key={driver.code} value={driver.code}>{driver.name}{availableCodes.has(driver.code) ? "" : " · no lap positions"}</option>)}</select></label>
            <div className="opening-driver-name"><i style={{ background: selected ? team(selected.team).color : "#e7464a" }} /><strong>{selectedName}</strong></div>
            <div className="opening-measures" aria-live="polite" aria-atomic="true"><div><span>Starting grid</span><strong>{selected?.grid === 0 ? "Pit lane" : rank(selected?.grid)}</strong></div><div><span>Running · lap {lap}</span><strong>{rank(selectedPosition)}</strong></div><div><span>Change from grid</span><strong className={gain != null && gain > 0 ? "is-gain" : ""}>{gain == null ? "—" : gain > 0 ? `+${gain} places` : gain < 0 ? `${gain} places` : "No change"}</strong></div></div>
            {selectedPosition == null ? <p className="opening-no-position">No running position is recorded for {selected?.code} on lap {lap}.</p> : null}
            <div className="opening-order"><div><strong>Running order</strong><span>Lap {lap}</span></div>{runningOrder.length ? <ol>{runningOrder.map((row) => { const driver = allDrivers.find((item) => item.code === row.code); return <li key={row.code}><button type="button" aria-pressed={row.code === selected?.code} onClick={() => onSelectDriver(row.code)}><span>P{row.position}</span><i style={{ background: team(driver?.team).color }} /><strong>{row.code}</strong><small>{driver?.name ?? row.code}</small></button></li>; })}</ol> : <p>No positions are recorded for this lap.</p>}</div>
          </> : <p className="opening-inspector-empty">{loading ? "Preparing running order…" : "Driver and lap details appear when position data is available."}</p>}
        </aside>
      </div>
    </section>
  );
}
