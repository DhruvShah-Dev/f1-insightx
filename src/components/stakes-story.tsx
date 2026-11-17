import { useMemo } from "react";
import { team } from "@/data/teams";
import { fmtLapMs } from "@/lib/format";
import "./stakes-story.css";

type Qualifying = {
  code: string;
  name: string;
  team: string;
  position: number | null;
  bestMs: number | null;
  segment: string;
  status: string | null;
};

type Classification = {
  code: string;
  name: string;
  team: string;
  grid: number | null;
  finish: number | null;
};

type PriorResult = { code: string; round: number; finish: number | null; status: string | null };

type StakesDriver = {
  code: string;
  name: string;
  team: string;
  qualifying: Qualifying | null;
  classification: Classification | null;
  qualiRank: number | null;
  gridRank: number | null;
};

const rank = (value: number | null | undefined) => value != null && value > 0 ? value : null;
const rankLabel = (value: number | null) => value == null ? "—" : `P${value}`;

export function StakesStory({
  qualifying,
  classification,
  priorResults,
  priorResultsAvailable,
  selectedCode,
  onSelect,
  question,
  round,
}: {
  qualifying: Qualifying[];
  classification: Classification[];
  priorResults: PriorResult[];
  priorResultsAvailable: boolean;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  question: string;
  round: number;
}) {
  const drivers = useMemo(() => {
    const byCode = new Map<string, StakesDriver>();
    for (const q of qualifying) {
      byCode.set(q.code, {
        code: q.code, name: q.name, team: q.team, qualifying: q, classification: null,
        qualiRank: rank(q.position), gridRank: null,
      });
    }
    for (const c of classification) {
      const previous = byCode.get(c.code);
      byCode.set(c.code, {
        code: c.code, name: c.name, team: c.team || previous?.team || "",
        qualifying: previous?.qualifying ?? null, classification: c,
        qualiRank: previous?.qualiRank ?? null, gridRank: rank(c.grid),
      });
    }
    return [...byCode.values()].sort((a, b) =>
      (a.qualiRank ?? a.gridRank ?? 99) - (b.qualiRank ?? b.gridRank ?? 99) || a.code.localeCompare(b.code),
    );
  }, [qualifying, classification]);

  const selected = drivers.find((driver) => driver.code === selectedCode) ?? drivers[0] ?? null;
  const history = selected
    ? priorResults.filter((result) => result.code === selected.code).sort((a, b) => b.round - a.round).slice(0, 3)
    : [];
  const chartDrivers = drivers.filter((driver) => driver.qualiRank != null || driver.gridRank != null);
  const maxRank = Math.max(20, ...chartDrivers.flatMap((driver) => [driver.qualiRank ?? 0, driver.gridRank ?? 0]));
  const x = (position: number) => 48 + ((position - 1) / Math.max(1, maxRank - 1)) * 904;
  const ticks = [1, 5, 10, 15, 20, maxRank].filter((value, index, values) => value <= maxRank && values.indexOf(value) === index);

  return (
    <section className="stakes-story" aria-labelledby="stakes-title">
      <div className="stakes-heading">
        <div>
          <p className="stakes-eyebrow">01 / Stakes · Before lights out</p>
          <h2 id="stakes-title">{question}</h2>
        </div>
        <p className="stakes-heading-note">Qualifying order and the starting grid are separate records. Select a driver to see what changed.</p>
      </div>

      <div className="stakes-layout">
        <div className="stakes-main">
          <div className="stakes-chart-head"><span>Qualifying → Grid</span><span>{chartDrivers.length} drivers with a recorded position</span></div>
          {chartDrivers.length ? (
            <>
              <div className="stakes-chart-desktop">
                <svg viewBox="0 0 1000 298" role="img" aria-label="Qualifying position compared with starting grid position. Use the driver buttons below to select a driver.">
                  {ticks.map((tick) => <g key={tick} className="stakes-axis-tick"><line x1={x(tick)} x2={x(tick)} y1="53" y2="241" /><text x={x(tick)} y="270" textAnchor="middle">{tick}</text></g>)}
                  <text className="stakes-axis-label" x="48" y="27">QUALIFYING</text>
                  <text className="stakes-axis-label" x="48" y="238">STARTING GRID</text>
                  {chartDrivers.filter((driver) => driver.code !== selected?.code).map((driver) => (
                    <g key={driver.code} className="stakes-driver-mark" onClick={() => onSelect(driver.code)}>
                      {driver.qualiRank != null && driver.gridRank != null ? <line x1={x(driver.qualiRank)} x2={x(driver.gridRank)} y1="69" y2="216" /> : null}
                      {driver.qualiRank != null ? <circle cx={x(driver.qualiRank)} cy="69" r="5" /> : null}
                      {driver.gridRank != null ? <circle cx={x(driver.gridRank)} cy="216" r="5" /> : null}
                    </g>
                  ))}
                  {selected && (selected.qualiRank != null || selected.gridRank != null) ? (
                    <g className="stakes-selected-mark" style={{ color: team(selected.team).color }}>
                      {selected.qualiRank != null && selected.gridRank != null ? <line x1={x(selected.qualiRank)} x2={x(selected.gridRank)} y1="69" y2="216" /> : null}
                      {selected.qualiRank != null ? <circle cx={x(selected.qualiRank)} cy="69" r="9" /> : null}
                      {selected.gridRank != null ? <circle cx={x(selected.gridRank)} cy="216" r="9" /> : null}
                      {selected.qualiRank != null ? <text x={x(selected.qualiRank)} y="51" textAnchor="middle">{selected.code}</text> : null}
                      {selected.gridRank != null ? <text x={x(selected.gridRank)} y="198" textAnchor="middle">{selected.code}</text> : null}
                    </g>
                  ) : null}
                </svg>
              </div>
              {selected ? <label className="stakes-mobile-selector">Choose driver
                <select value={selected.code} onChange={(event) => onSelect(event.target.value)}>
                  {drivers.map((driver) => <option key={driver.code} value={driver.code}>{driver.name}</option>)}
                </select>
              </label> : null}
              {selected ? <div className="stakes-mobile-focus" style={{ "--stakes-team": team(selected.team).color } as React.CSSProperties} aria-label={`${selected.name}: qualified ${rankLabel(selected.qualiRank)}, started ${selected.classification?.grid === 0 ? "from the pit lane" : rankLabel(selected.gridRank)}`}>
                <div><span>Qualified</span><strong>{rankLabel(selected.qualiRank)}</strong></div>
                <span className="stakes-mobile-connector" aria-hidden="true" />
                <div><span>Started</span><strong>{selected.classification?.grid === 0 ? "Pit lane" : rankLabel(selected.gridRank)}</strong></div>
              </div> : null}
              <div className="stakes-driver-picker" role="group" aria-label="Select driver">
                {drivers.map((driver) => (
                  <button key={driver.code} type="button" aria-pressed={driver.code === selected?.code} onClick={() => onSelect(driver.code)} style={{ "--stakes-team": team(driver.team).color } as React.CSSProperties}>
                    {driver.code}
                  </button>
                ))}
              </div>
            </>
          ) : <p className="stakes-empty">Qualifying and starting-grid positions are not stored for this report.</p>}
          <p className="stakes-source-note">Positions are observed session results. A blank position means no usable position was recorded; pit-lane starts are identified separately.</p>
        </div>

        <aside className="stakes-inspector" aria-live="polite">
          <p className="stakes-inspector-label">Selected driver</p>
          {selected ? (
            <>
              <div className="stakes-identity"><span style={{ background: team(selected.team).color }} /><div><strong>{selected.name}</strong><small>{team(selected.team).name}</small></div></div>
              <div className="stakes-position-pair"><div><span>Qualified</span><strong>{rankLabel(selected.qualiRank)}</strong></div><div><span>Started</span><strong>{selected.classification?.grid === 0 ? "Pit lane" : rankLabel(selected.gridRank)}</strong></div></div>
              <p className="stakes-grid-note">{selected.qualiRank != null && selected.gridRank != null
                ? selected.qualiRank === selected.gridRank ? "Started in the position earned in qualifying."
                  : `Started ${Math.abs(selected.gridRank - selected.qualiRank)} place${Math.abs(selected.gridRank - selected.qualiRank) === 1 ? "" : "s"} ${selected.gridRank > selected.qualiRank ? "behind" : "ahead of"} the qualifying result.`
                : "A direct qualifying-to-grid comparison is unavailable for this driver."}</p>
              <div className="stakes-qualifying-detail"><span>Best qualifying lap</span><strong>{fmtLapMs(selected.qualifying?.bestMs ?? null)}</strong><small>{selected.qualifying?.bestMs != null ? selected.qualifying?.segment : selected.qualifying?.status ?? "No recorded time"}</small></div>
              <div className="stakes-history"><div><span>Previous race results</span><small>Before round {round}</small></div>
                {!priorResultsAvailable ? <p>Recent results are unavailable in this data source.</p>
                  : history.length ? <ol>{history.map((result) => <li key={`${selected.code}-${result.round}`}><span>R{String(result.round).padStart(2, "0")}</span><strong>{result.finish != null ? `P${result.finish}` : result.status ?? "Unclassified"}</strong></li>)}</ol>
                  : <p>No earlier race result is recorded for this driver this season.</p>}
              </div>
            </>
          ) : <p className="stakes-empty">No driver results are stored for this report.</p>}
        </aside>
        {drivers.length ? <div className="stakes-mobile-list" role="group" aria-label="Choose a driver from qualifying and grid positions">
          <p className="stakes-mobile-list-title">Full qualifying and grid order</p>
          <div className="stakes-mobile-columns"><span>Quali</span><span>Driver</span><span>Grid</span></div>
          {drivers.map((driver) => (
            <button key={driver.code} type="button" className={driver.code === selected?.code ? "is-selected" : ""} aria-pressed={driver.code === selected?.code} onClick={() => onSelect(driver.code)}>
              <span>{rankLabel(driver.qualiRank)}</span><span className="stakes-mobile-name"><i style={{ background: team(driver.team).color }} />{driver.code}<small>{driver.name}</small></span><span>{driver.classification?.grid === 0 ? "Pit lane" : rankLabel(driver.gridRank)}</span>
            </button>
          ))}
        </div> : null}
      </div>
    </section>
  );
}
