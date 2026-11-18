import { useState } from "react";
import type { RaceShapeEvidence } from "@/lib/f1.functions";
import {
  alternativeTimingCandidates,
  estimatedCycleForStint,
  recordedStopForStint,
  selectStrategyStint,
  type StrategyPit,
  type StrategyStint,
} from "@/lib/strategy-story";
import "./strategy-story.css";

type Driver = { code: string; name: string };

const COMPOUNDS: Record<string, string> = {
  SOFT: "#ef5155", MEDIUM: "#edc752", HARD: "#d9dfd7", INTERMEDIATE: "#6bbd78", WET: "#5d91d9",
  S: "#ef5155", M: "#edc752", H: "#d9dfd7", I: "#6bbd78", W: "#5d91d9",
};
const compoundName = (compound: string | null) => {
  const name = { S: "Soft", M: "Medium", H: "Hard", I: "Intermediate", W: "Wet" }[compound?.toUpperCase() as "S" | "M" | "H" | "I" | "W"];
  return name ?? (compound ? compound.toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "Unknown");
};
const utc = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "time unavailable" : `${date.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC`;
};
const fmtGap = (value: number | null) => value == null ? "Unavailable / lapped" : `+${value.toFixed(3)}s`;

export function StrategyStory({
  stints, pitCycles, evidence, drivers, selectedCode, compareCode, selectedStint, onStint, onDriver, onCompare, loading,
}: {
  stints: StrategyStint[]; pitCycles: StrategyPit[]; evidence: RaceShapeEvidence; drivers: Driver[];
  selectedCode: string | null; compareCode: string | null; selectedStint: string | undefined;
  onStint: (key: string) => void; onDriver: (code: string) => void; onCompare: (code: string) => void; loading: boolean;
}) {
  const [candidateLap, setCandidateLap] = useState<number | null>(null);
  const selected = selectStrategyStint(stints, selectedStint, selectedCode, compareCode);
  const maxLap = Math.max(1, ...stints.map((row) => row.endLap ?? 0), ...evidence.pits.map((row) => row.lap));
  const selectedStop = selected ? recordedStopForStint(selected, evidence.pits) : null;
  const estimate = selected ? estimatedCycleForStint(selected, pitCycles) : null;
  const rivalCode = selected?.code === selectedCode ? compareCode : selectedCode;
  const candidates = alternativeTimingCandidates(selectedStop, rivalCode, evidence.pits, evidence.statuses).slice(0, 3);
  const activeCandidate = candidates.find((row) => row.lap === candidateLap) ?? candidates[0] ?? null;
  const driverName = (code: string | null) => drivers.find((row) => row.code === code)?.name ?? code ?? "Unavailable";
  const gapAt = (lap: number | null) => lap == null || !selected ? null : evidence.gaps.find((row) => row.code === selected.code && row.lap === lap) ?? null;
  const startGap = gapAt(selected?.startLap ?? null);
  const endGap = gapAt(selected?.endLap ?? null);
  const ticks = [...new Set([1, Math.round(maxLap / 4), Math.round(maxLap / 2), Math.round(maxLap * 3 / 4), maxLap])].filter((lap) => lap >= 1).sort((a, b) => a - b);
  const bands = evidence.statuses.filter((row) => row.label === "safety-car" || row.label === "virtual-safety-car");
  const rainLaps = [...new Set(evidence.rain.map((row) => row.lap))];
  const lanes = [selectedCode, compareCode].filter((code): code is string => Boolean(code));
  const hasPlottedStints = stints.some((row) => lanes.includes(row.code) && row.startLap != null && row.endLap != null);
  const toPercent = (lap: number) => `${Math.min(100, Math.max(0, lap / maxLap * 100))}%`;

  return <section id="strategy" className="strategy-story" aria-labelledby="strategy-title">
    <header className="strategy-heading"><div><p>05 / The strategy</p><h2 id="strategy-title">When did they make the call?</h2></div><p>Compare recorded stop timing with the tyre stints and conditions around it. Nearby events are context, not proof of advantage.</p></header>
    <div className="strategy-layout">
      <div className="strategy-board">
        <div className="strategy-board-title"><strong>Tyre stints and pit stops</strong><span>Race lap</span></div>
        <div className="strategy-timeline">
          <div className="strategy-timeline-label">STATUS</div>
          <div className="strategy-status-track" aria-label="Safety car and virtual safety car lap bands">
            {bands.map((band) => <span key={band.id} className={`strategy-status-band ${band.label === "safety-car" ? "is-sc" : "is-vsc"}`} style={{ left: toPercent(band.startLap - 1), width: `${Math.max(1, (band.endLap - band.startLap + 1) / maxLap * 100)}%` }} title={`${band.label === "safety-car" ? "SC" : "VSC"} · laps ${band.startLap}–${band.endLap}`}><span>{band.label === "safety-car" ? "SC" : "VSC"}</span></span>)}
          </div>
          {lanes.map((code, index) => <div className="strategy-lane" key={code}>
            <div className={`strategy-lane-label ${index === 0 ? "is-a" : "is-b"}`}><span>{index === 0 ? "A" : "B"}</span><strong>{code}</strong></div>
            <div className={`strategy-lane-track ${index === 0 ? "is-a" : "is-b"}`} aria-label={`${code} tyre stints`}>{stints.filter((row) => row.code === code && row.startLap != null && row.endLap != null && row.endLap >= row.startLap).map((row) => <div key={`${code}-${row.stint}`} className="strategy-stint-bar" data-selected={selected?.code === code && selected.stint === row.stint} style={{ left: toPercent(row.startLap! - 1), width: `${Math.max(0, (row.endLap! - row.startLap! + 1) / maxLap * 100)}%`, backgroundColor: COMPOUNDS[(row.compound ?? "").toUpperCase()] ?? "#7d8781" }} title={`${code} · ${compoundName(row.compound)} · laps ${row.startLap}–${row.endLap}`} />)}
              {evidence.pits.filter((pit) => pit.code === code).map((pit) => <span key={pit.id} className="strategy-pit-marker" style={{ left: toPercent(pit.lap) }} title={`${code} recorded pit stop · lap ${pit.lap}`}>P</span>)}
            </div>
          </div>)}
          <div className="strategy-timeline-label">RAIN</div>
          <div className="strategy-rain-track" aria-label={`Observed rainfall on laps ${rainLaps.length ? rainLaps.join(", ") : "none"}`}>{rainLaps.map((lap) => <span key={lap} style={{ left: toPercent(lap - .5) }} title={`Rainfall observed · lap ${lap}`} />)}</div>
          <div className="strategy-timeline-label" aria-hidden="true" />
          <div className="strategy-axis">{ticks.map((lap) => <span key={lap} style={{ left: toPercent(lap - 1) }}><i />{lap}</span>)}</div>
        </div>
        {!hasPlottedStints ? <p className="strategy-board-empty">Lap boundaries for the selected drivers’ tyre stints are unavailable.</p> : null}
        <div className="strategy-legend"><span><i className="is-soft" />Soft</span><span><i className="is-medium" />Medium</span><span><i className="is-hard" />Hard</span><span><i className="is-intermediate" />Intermediate</span><span><i className="is-wet" />Wet</span><span><b>P</b>Recorded stop</span></div>
        {bands.length ? <p className="strategy-band-list">{bands.map((band) => `${band.label === "safety-car" ? "SC" : "VSC"} L${band.startLap}${band.endLap > band.startLap ? `–${band.endLap}` : ""}`).join(" · ")}</p> : <p className="strategy-band-list">No explicit SC or VSC phase recorded.</p>}
        <p className="strategy-source">Stint boundaries and pace: timing-derived. Pit markers: recorded OpenF1 pit events. SC/VSC bands identify lap-level track status, not exact start times or causes. Rain marks are individual observations.</p>
      </div>
      <div className="strategy-inspector">
        <div className="strategy-driver-selectors"><label>Driver A<select value={selectedCode ?? ""} onChange={(event) => onDriver(event.target.value)}>{drivers.map((driver) => <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>)}</select></label><label>Driver B<select value={compareCode ?? ""} onChange={(event) => onCompare(event.target.value)}>{drivers.filter((driver) => driver.code !== selectedCode).map((driver) => <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>)}</select></label></div>
        <div className="strategy-stint-picker" role="group" aria-label="Select a tyre stint">{lanes.map((code, index) => <div key={code}><strong className={index === 0 ? "is-a" : "is-b"}>{index === 0 ? "A" : "B"} · {code}</strong><div>{stints.filter((row) => row.code === code).sort((a, b) => a.stint - b.stint).map((row) => <button type="button" key={`${code}-${row.stint}`} aria-pressed={selected?.code === code && selected.stint === row.stint} onClick={() => onStint(`${code}-${row.stint}`)}>S{row.stint}<span>{compoundName(row.compound)}</span></button>)}{!stints.some((row) => row.code === code) ? <span className="strategy-no-stint">Stints unavailable</span> : null}</div></div>)}</div>
        {loading ? <p className="strategy-empty" role="status">Loading strategy evidence…</p> : !selected ? <p className="strategy-empty">Tyre stint evidence is unavailable for these drivers. The official report remains available.</p> : <>
          <div className="strategy-selected"><p>Selected stint</p><h3>{selected.code} · {compoundName(selected.compound)}</h3><span>Stint {selected.stint} · L{selected.startLap ?? "?"}–L{selected.endLap ?? "?"}</span></div>
          <dl className="strategy-facts"><div><dt>Duration</dt><dd>{selected.length == null ? "Unavailable" : `${selected.length} laps`}</dd></div><div><dt>Median lap · derived</dt><dd>{selected.medianS == null ? "Unavailable" : `${selected.medianS.toFixed(3)}s`}</dd></div><div><dt>Pit cycle loss · estimated</dt><dd>{estimate?.lossS == null ? "Unavailable" : `${estimate.lossS.toFixed(3)}s`}</dd></div></dl>
          <div className="strategy-detail-block"><h4>Recorded stop</h4>{selected.stint === 1 ? <p>No preceding pit stop for the opening stint.</p> : selectedStop ? <><p><strong>L{selectedStop.lap} · {utc(selectedStop.timestampUtc)}</strong><br />{selectedStop.detail}</p><small>Source: {selectedStop.source}{selectedStop.limitation ? ` · ${selectedStop.limitation}` : ""}</small></> : <p>No recorded pit event matches this timing-derived stint boundary.</p>}{estimate ? <p className="strategy-estimate-note">Pit-cycle estimate confidence field: {estimate.confidence == null ? "unavailable" : estimate.confidence.toFixed(2)}. {estimate.weakestAssumption ?? "Method limitation unavailable."} Recorded pit duration and estimated pit-cycle loss measure different intervals.</p> : null}</div>
          <div className="strategy-detail-block"><h4>Sampled gap to leader</h4>{[["Stint start", startGap], ["Stint end", endGap]].map(([label, row]) => <p key={label as string}><strong>{label as string}:</strong> {row ? `${fmtGap((row as RaceShapeEvidence["gaps"][number]).gapSeconds)} · ${utc((row as RaceShapeEvidence["gaps"][number]).timestampUtc)}` : "Unavailable"}</p>)}<small>OpenF1 samples occur after lap start; start and end samples are not pit-entry or pit-exit measurements.</small></div>
          <div className="strategy-alternative"><h4>Alternative timing to inspect</h4>{candidates.length ? <><div className="strategy-candidate-buttons" role="group" aria-label="Nearby timing windows">{candidates.map((item) => <button key={item.lap} type="button" aria-pressed={activeCandidate?.lap === item.lap} onClick={() => setCandidateLap(item.lap)}>Lap {item.lap}</button>)}</div>{activeCandidate ? <div className="strategy-candidate-detail"><p>Lap {activeCandidate.lap}{activeCandidate.rivalPit ? ` · ${rivalCode} recorded a pit stop at ${utc(activeCandidate.rivalPit.timestampUtc)} (${activeCandidate.rivalPit.source})` : ""}{activeCandidate.status ? ` · ${activeCandidate.status.label === "safety-car" ? "SC" : "VSC"} status recorded` : ""}.</p>{activeCandidate.status ? <small>Source: {activeCandidate.status.source}. {activeCandidate.status.limitation}</small> : null}</div> : null}<small>These laps are within three laps of the selected driver’s recorded stop. They are inspection points, not modeled pit calls or predicted outcomes.</small></> : <p>No nearby rival stop or explicit SC/VSC lap identifies an alternative timing window for this stint.</p>}</div>
          <p className="strategy-provenance">{selected.note ?? "Stint provenance unavailable."} The estimated pit-cycle loss uses lap timing and does not measure the full strategic effect.</p>
        </>}
      </div>
    </div>
  </section>;
}
