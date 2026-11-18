import { useState } from "react";
import type { VerdictEvidence } from "@/lib/f1.functions";
import { verdictResult, verdictSentence, type VerdictDriver } from "@/lib/verdict-story";
import "./verdict-story.css";

const utc = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : `${date.toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC`;
};

export function VerdictStory({ drivers, selectedCode, compareCode, evidence, onDriver, onCompare, loading }: {
  drivers: VerdictDriver[]; selectedCode: string | null; compareCode: string | null;
  evidence: VerdictEvidence; onDriver: (code: string) => void; onCompare: (code: string) => void; loading: boolean;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedRadioId, setSelectedRadioId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const selected = [selectedCode, compareCode].filter((code): code is string => Boolean(code));
  const rows = selected.map((code) => drivers.find((row) => row.code === code)).filter((row): row is VerdictDriver => Boolean(row));
  const maxPosition = Math.max(20, ...drivers.map((row) => row.grid ?? 0), ...drivers.map((row) => row.finish ?? 0));
  const x = (position: number) => `${((position - 1) / Math.max(1, maxPosition - 1)) * 100}%`;
  const event = evidence.raceControl.find((row) => row.id === selectedEventId) ?? evidence.raceControl[0] ?? null;
  const clips = evidence.radio.filter((row) => selected.includes(row.code));
  const radio = clips.find((row) => row.id === selectedRadioId) ?? null;

  return <section id="verdict" className="verdict-story" aria-labelledby="verdict-title">
    <header className="verdict-heading"><div><p>06 / The verdict</p><h2 id="verdict-title">Where did they finish?</h2></div><p>The race grid is the pre-race baseline. The official classification shows where each driver ended up.</p></header>
    <div className="verdict-top">
      <div className="verdict-chart">
        <div className="verdict-chart-header"><strong>Started vs finished</strong><span>Position · P1 to P{maxPosition}</span></div>
        <div className="verdict-axis"><span>P1</span><span>P{Math.ceil(maxPosition / 2)}</span><span>P{maxPosition}</span></div>
        {rows.length ? rows.map((row, index) => {
          const result = verdictResult(row);
          const hasLine = row.grid != null && row.grid > 0 && result.plotFinish != null;
          return <div className={`verdict-chart-row ${index === 0 ? "is-a" : "is-b"}`} key={row.code}>
            <div className="verdict-row-label"><span>{index === 0 ? "A" : "B"}</span><strong>{row.code}</strong><small>{row.name}</small></div>
            <div className="verdict-track" role="img" aria-label={`${row.name}: grid ${result.gridLabel}, finish ${result.finishLabel}; ${result.changeLabel}`}>
              {hasLine ? <span className="verdict-connector" style={{ left: x(Math.min(row.grid!, result.plotFinish!)), width: `${Math.abs(row.grid! - result.plotFinish!) / Math.max(1, maxPosition - 1) * 100}%` }} /> : null}
              {row.grid != null && row.grid > 0 ? <span className="verdict-dot is-grid" style={{ left: x(row.grid) }} title={`Grid P${row.grid}`} /> : null}
              {result.plotFinish != null ? <span className="verdict-dot is-finish" style={{ left: x(result.plotFinish) }} title={`Finished P${result.plotFinish}`} /> : null}
              {!hasLine ? <span className="verdict-unplotted">{result.finishLabel}</span> : null}
            </div>
            <strong className="verdict-delta">{result.changeLabel}</strong>
          </div>;
        }) : <p className="verdict-empty">Official classification is unavailable for this report.</p>}
        <div className="verdict-legend"><span><i className="is-grid" />Race grid</span><span><i className="is-finish" />Official finish</span></div>
        <p className="verdict-source">Grid and finish: curated race results. Position difference is calculated only for classified finishers. A retired or unclassified driver keeps their official status and is not plotted as a completed finish.</p>
      </div>
      <div className="verdict-inspector">
        <div className="verdict-selectors"><label>Driver A<select value={selectedCode ?? ""} onChange={(event) => onDriver(event.target.value)}>{drivers.map((driver) => <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>)}</select></label><label>Driver B<select value={compareCode ?? ""} onChange={(event) => onCompare(event.target.value)}>{drivers.filter((driver) => driver.code !== selectedCode).map((driver) => <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>)}</select></label></div>
        <div className="verdict-results" aria-label="Driver result comparison">{rows.map((row, index) => { const result = verdictResult(row); const count = evidence.overtakes.find((item) => item.code === row.code); return <div className={`verdict-result ${index === 0 ? "is-a" : "is-b"}`} key={row.code}><div className="verdict-result-name"><b>{index === 0 ? "A" : "B"}</b><strong>{row.name}</strong></div><dl><div><dt>Grid</dt><dd>{result.gridLabel}</dd></div><div><dt>Official result</dt><dd>{result.finishLabel}</dd></div><div><dt>Status</dt><dd>{row.status ?? "Unavailable"}</dd></div><div><dt>Places</dt><dd>{result.changeLabel}</dd></div><div><dt>Points</dt><dd>{row.points == null ? "Unavailable" : row.points}</dd></div><div><dt>Recorded overtakes</dt><dd>{loading ? "Loading…" : count?.count ?? "Unavailable"}</dd></div></dl></div>; })}</div>
        <p className="verdict-source">Overtakes: OpenF1 recorded exchanges credited to each driver. Their circumstances and effect on the final result are unverified.</p>
      </div>
    </div>
    <div className="verdict-context">
      <div className="verdict-control"><h3>Race-control record</h3>{loading ? <p>Loading messages…</p> : evidence.raceControl.length ? <><div className="verdict-event-rail" role="group" aria-label="Select race-control message">{evidence.raceControl.map((item, index) => <button type="button" key={item.id} aria-pressed={event?.id === item.id} onClick={() => setSelectedEventId(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.lap == null ? "Lap unavailable" : `Lap ${item.lap}`}</strong><small>{utc(item.timestampUtc)}</small></button>)}</div>{event ? <div className="verdict-event-detail"><strong>{event.detail}</strong><span>{utc(event.timestampUtc)} · {event.source}</span><small>{event.limitation ?? "Recorded race-control message; no cause is inferred."}</small></div> : null}</> : <p>{evidence.availability.raceControl ? "No selected race-control messages were recorded." : "Race-control messages are unavailable for this report."}</p>}</div>
      <div className="verdict-radio"><h3>Team radio</h3>{loading ? <p>Loading clips…</p> : clips.length ? <><div className="verdict-radio-list" role="group" aria-label="Available team-radio audio">{clips.map((clip, index) => <button key={clip.id} type="button" aria-pressed={radio?.id === clip.id} onClick={() => { setSelectedRadioId(clip.id); setAudioError(false); }}>{clip.code} · Clip {index + 1}<small>{utc(clip.timestampUtc)}</small></button>)}</div>{radio ? <div className="verdict-radio-player"><p>{radio.code} · {utc(radio.timestampUtc)} · {radio.source}</p><audio key={radio.id} controls preload="none" src={radio.url} onError={() => setAudioError(true)}>Audio playback is unavailable in this browser.</audio>{audioError ? <p role="status">This audio link is unavailable at its source.</p> : null}<small>External Formula 1 audio link. No transcript is available; the recording has not been interpreted.</small></div> : <p>Select a clip to load audio from Formula 1.</p>}</> : <p>{evidence.availability.radio ? "No usable radio link was recorded for these drivers." : "Team-radio audio is unavailable for this race."}</p>}</div>
    </div>
    <div className="verdict-takeaway"><span>What the record shows</span><p>{rows.length ? rows.map(verdictSentence).join(" ") : "The official race result is unavailable."}</p><small>The comparison describes recorded results. Race-control messages, recorded overtakes, and radio do not establish why a driver finished there.</small></div>
  </section>;
}
