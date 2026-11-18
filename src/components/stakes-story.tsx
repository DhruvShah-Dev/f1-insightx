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
const qualifyingLabel = (driver: StakesDriver) => driver.qualiRank != null
  ? `P${driver.qualiRank}`
  : driver.qualifying ? "No position" : "No record";
const gridLabel = (driver: StakesDriver) => driver.gridRank != null
  ? `P${driver.gridRank}`
  : driver.classification?.grid === 0 ? "Pit lane" : driver.classification ? "No position" : "No record";

export function StakesStory({
  qualifying,
  classification,
  priorResults,
  priorResultsAvailable,
  selectedCode,
  onSelect,
  question,
  round,
  sprintWeekend,
}: {
  qualifying: Qualifying[];
  classification: Classification[];
  priorResults: PriorResult[];
  priorResultsAvailable: boolean;
  selectedCode: string | null;
  onSelect: (code: string) => void;
  question: string;
  round: number;
  sprintWeekend: boolean;
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
    ? priorResults.filter((result) => result.code === selected.code && result.round < round).sort((a, b) => b.round - a.round).slice(0, 3)
    : [];
  const chartDrivers = drivers.filter((driver) => driver.qualiRank != null || driver.gridRank != null);
  const maxRank = Math.max(20, ...chartDrivers.flatMap((driver) => [driver.qualiRank ?? 0, driver.gridRank ?? 0]));
  const x = (position: number) => 48 + ((position - 1) / Math.max(1, maxRank - 1)) * 904;
  const mobileX = (position: number) => 22 + ((position - 1) / Math.max(1, maxRank - 1)) * 316;
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
          <div className="stakes-chart-head"><span>{sprintWeekend ? "Grand Prix qualifying" : "Qualifying"} → Race grid</span><span>{chartDrivers.length} drivers with a recorded position</span></div>
          {chartDrivers.length ? (
            <>
              <div className="stakes-chart-desktop">
                <svg viewBox="0 0 1000 298" role="img" aria-label="Qualifying position compared with starting grid position. Use the driver buttons below to select a driver.">
                  {ticks.map((tick) => <g key={tick} className="stakes-axis-tick"><line x1={x(tick)} x2={x(tick)} y1="53" y2="241" /><text x={x(tick)} y="270" textAnchor="middle">{tick}</text></g>)}
                  <text className="stakes-axis-label" x="48" y="27">{sprintWeekend ? "GRAND PRIX QUALIFYING" : "QUALIFYING"}</text>
                  <text className="stakes-axis-label" x="48" y="238">RACE STARTING GRID</text>
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
              <div className="stakes-chart-mobile">
                <svg viewBox="0 0 360 166" role="img" aria-label="Qualifying position compared with race grid position. Select a driver using the buttons below.">
                  {[1, 5, 10, 15, 20, maxRank].filter((value, index, values) => value <= maxRank && values.indexOf(value) === index).map((tick) =>
                    <g key={tick} className="stakes-axis-tick"><line x1={mobileX(tick)} x2={mobileX(tick)} y1="38" y2="130" /><text x={mobileX(tick)} y="157" textAnchor="middle">{tick}</text></g>,
                  )}
                  <text className="stakes-axis-label" x="22" y="17">{sprintWeekend ? "GRAND PRIX QUALIFYING" : "QUALIFYING"}</text>
                  <text className="stakes-axis-label" x="22" y="126">RACE GRID</text>
                  {chartDrivers.filter((driver) => driver.code !== selected?.code).map((driver) =>
                    <g key={driver.code} className="stakes-driver-mark">
                      {driver.qualiRank != null && driver.gridRank != null ? <line x1={mobileX(driver.qualiRank)} x2={mobileX(driver.gridRank)} y1="46" y2="105" /> : null}
                      {driver.qualiRank != null ? <circle cx={mobileX(driver.qualiRank)} cy="46" r="3" /> : null}
                      {driver.gridRank != null ? <circle cx={mobileX(driver.gridRank)} cy="105" r="3" /> : null}
                    </g>,
                  )}
                  {selected && (selected.qualiRank != null || selected.gridRank != null) ?
                    <g className="stakes-selected-mark" style={{ color: team(selected.team).color }}>
                      {selected.qualiRank != null && selected.gridRank != null ? <line x1={mobileX(selected.qualiRank)} x2={mobileX(selected.gridRank)} y1="46" y2="105" /> : null}
                      {selected.qualiRank != null ? <circle cx={mobileX(selected.qualiRank)} cy="46" r="7" /> : null}
                      {selected.gridRank != null ? <circle cx={mobileX(selected.gridRank)} cy="105" r="7" /> : null}
                    </g> : null}
                </svg>
              </div>
            </>
          ) : <p className="stakes-empty">Qualifying and starting-grid positions are not stored for this report.</p>}
          {selected ? <div className="stakes-mobile-focus" style={{ "--stakes-team": team(selected.team).color } as React.CSSProperties} aria-label={`${selected.name}: qualified ${qualifyingLabel(selected)}, grid ${gridLabel(selected)}`}>
            <div><span>Qualified</span><strong className={selected.qualiRank == null ? "is-missing" : ""}>{qualifyingLabel(selected)}</strong></div>
            <span className="stakes-mobile-connector" aria-hidden="true" />
            <div><span>Grid</span><strong className={selected.gridRank == null ? "is-missing" : ""}>{gridLabel(selected)}</strong></div>
          </div> : null}
          {drivers.length ? <div className="stakes-driver-picker" role="group" aria-label="Select driver">
            {drivers.map((driver) => (
              <button key={driver.code} type="button" aria-label={`Select ${driver.name}: qualifying ${qualifyingLabel(driver)}, grid ${gridLabel(driver)}`} aria-pressed={driver.code === selected?.code} onClick={() => onSelect(driver.code)} style={{ "--stakes-team": team(driver.team).color } as React.CSSProperties}>
                {driver.code}
              </button>
            ))}
          </div> : null}
          <p className="stakes-source-note">Recorded positions come from curated Grand Prix qualifying results and the race starting grid in race results. Earlier form uses race results from prior rounds only. Missing records and pit-lane starts are shown explicitly; a grid change alone does not establish its cause.</p>
        </div>

        <aside className="stakes-inspector" aria-live="polite">
          <p className="stakes-inspector-label">Selected driver</p>
          {selected ? (
            <>
              <div className="stakes-identity"><span style={{ background: team(selected.team).color }} /><div><strong>{selected.name}</strong><small>{team(selected.team).name}</small></div></div>
              <div className="stakes-position-pair"><div><span>Qualified</span><strong className={selected.qualiRank == null ? "is-missing" : ""}>{qualifyingLabel(selected)}</strong></div><div><span>Grid</span><strong className={selected.gridRank == null ? "is-missing" : ""}>{gridLabel(selected)}</strong></div></div>
              <p className="stakes-grid-note">{selected.qualiRank != null && selected.gridRank != null
                ? selected.qualiRank === selected.gridRank ? "Started in the position earned in qualifying."
                  : `Grid place was ${Math.abs(selected.gridRank - selected.qualiRank)} position${Math.abs(selected.gridRank - selected.qualiRank) === 1 ? "" : "s"} ${selected.gridRank > selected.qualiRank ? "behind" : "ahead of"} the qualifying result.`
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
      </div>
    </section>
  );
}
