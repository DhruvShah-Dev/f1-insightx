"use client";

import { useEffect, useMemo, useState } from "react";
import { RaceSimulationCharts } from "@/components/lab/race-simulation-charts";
import { TeamBadge } from "@/components/ui/team-badge";
import { TrackLayoutCard } from "@/components/ui/track-layout-card";
import type { Race } from "@/lib/server/reference-data";
import type { RaceSimulationResponse } from "@/lib/server/race-simulator";

type RaceContextEntrant = {
  driverId: string;
  fullName: string;
  constructorId: string;
  constructorName: string;
  gridPosition: number;
  qualifyingPosition: number;
  baselineFinish: number | null;
  recentPointsAverage: number;
  overtakeScore: number;
  reliabilityScore: number;
};

type RaceContextResponse = {
  ok: boolean;
  data?: {
    race: Race;
    entrants: RaceContextEntrant[];
  };
};

type SimulationResponse = {
  ok: boolean;
  data?: RaceSimulationResponse;
  error?: {
    message: string;
  };
};

type Props = {
  races: Race[];
};

const tirePlanPresets = {
  balanced: [
    { compound: "medium", laps: 18 },
    { compound: "hard", laps: 24 },
    { compound: "soft", laps: 15 },
  ],
  conservative: [
    { compound: "hard", laps: 26 },
    { compound: "medium", laps: 24 },
  ],
  aggressive: [
    { compound: "soft", laps: 14 },
    { compound: "medium", laps: 18 },
    { compound: "soft", laps: 13 },
  ],
} as const;

export function RaceLabWorkspace({ races }: Props) {
  const [selectedRaceId, setSelectedRaceId] = useState(races[0]?.id ?? "");
  const [raceContext, setRaceContext] = useState<RaceContextResponse["data"] | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulation, setSimulation] = useState<RaceSimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weatherScenario, setWeatherScenario] = useState<"dry" | "mixed" | "wet">("dry");
  const [pitStopCount, setPitStopCount] = useState(2);
  const [safetyCarProbability, setSafetyCarProbability] = useState(0.35);
  const [aggressionFactor, setAggressionFactor] = useState(62);
  const [reliabilityBias, setReliabilityBias] = useState(0);
  const [focusedConstructors, setFocusedConstructors] = useState<string[]>([]);
  const [tirePreset, setTirePreset] = useState<keyof typeof tirePlanPresets>("balanced");
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedRaceId) {
      return;
    }

    let active = true;
    setIsContextLoading(true);
    setError(null);
    setSimulation(null);

    async function loadContext() {
      try {
        const response = await fetch(`/api/reference/races/${selectedRaceId}/context`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as RaceContextResponse;

        if (!active) {
          return;
        }

        if (!payload.ok || !payload.data) {
          setError("Race context could not be loaded.");
          setRaceContext(null);
          return;
        }

        setRaceContext(payload.data);
        setSelectedDriverIds(payload.data.entrants.slice(0, 10).map((entrant) => entrant.driverId));
        setFocusedConstructors([]);
      } catch {
        if (active) {
          setError("Race context could not be loaded.");
          setRaceContext(null);
        }
      } finally {
        if (active) {
          setIsContextLoading(false);
        }
      }
    }

    void loadContext();

    return () => {
      active = false;
    };
  }, [selectedRaceId]);

  const constructors = useMemo(() => {
    const names = new Map<string, string>();
    raceContext?.entrants.forEach((entrant) => {
      if (!names.has(entrant.constructorId)) {
        names.set(entrant.constructorId, entrant.constructorName);
      }
    });
    return [...names.entries()].map(([id, name]) => ({ id, name }));
  }, [raceContext]);

  const selectedDrivers = useMemo(
    () =>
      raceContext?.entrants.filter((entrant) => selectedDriverIds.includes(entrant.driverId)) ?? [],
    [raceContext, selectedDriverIds],
  );

  const selectedRace = races.find((race) => race.id === selectedRaceId);

  async function runSimulation() {
    if (!raceContext || selectedDriverIds.length === 0) {
      return;
    }

    setIsSimulating(true);
    setError(null);

    try {
      const response = await fetch("/api/race-scenarios/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raceId: selectedRaceId,
          driverIds: selectedDriverIds,
          constructorFocus: focusedConstructors,
          pitStopCount,
          tirePlan: tirePlanPresets[tirePreset],
          safetyCarProbability,
          weatherScenario,
          aggressionFactor,
          reliabilityBias,
          qualifyingOverrides: [],
        }),
      });

      const payload = (await response.json()) as SimulationResponse;
      if (!payload.ok || !payload.data) {
        setError(payload.error?.message ?? "Simulation failed.");
        setSimulation(null);
        return;
      }

      setSimulation(payload.data);
    } catch {
      setError("Simulation failed.");
      setSimulation(null);
    } finally {
      setIsSimulating(false);
    }
  }

  function toggleDriver(driverId: string) {
    setSelectedDriverIds((current) =>
      current.includes(driverId)
        ? current.filter((id) => id !== driverId)
        : [...current, driverId].slice(0, 20),
    );
  }

  function toggleConstructor(constructorId: string) {
    setFocusedConstructors((current) =>
      current.includes(constructorId)
        ? current.filter((id) => id !== constructorId)
        : [...current, constructorId],
    );
  }

  return (
    <div className="lab-layout">
      <section className="lab-controls">
        <div className="workspace-panel">
          <div className="workspace-panel__eyebrow">Scenario inputs</div>
          <div className="workspace-panel__headline">
            Select a race, tune the scenario, and compare the projected order.
          </div>
          {selectedRace ? (
            <div className="panel-hero">
              <TrackLayoutCard
                circuitId={selectedRace.circuitId}
                title={selectedRace.raceName}
                showSource
              />
              <div>
                <div className="section-meta">Circuit visual</div>
                <p className="section-copy">
                  Local circuit layout where available, with a clean fallback when not.
                </p>
              </div>
            </div>
          ) : null}

          <div className="control-block">
            <label className="control-label">Race</label>
            <select
              className="control-select"
              value={selectedRaceId}
              onChange={(event) => setSelectedRaceId(event.target.value)}
            >
              {races.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.season} R{race.round} | {race.raceName}
                </option>
              ))}
            </select>
          </div>

          <div className="lab-grid-two">
            <div className="control-block">
              <label className="control-label">Weather</label>
              <div className="segmented-row">
                {(["dry", "mixed", "wet"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`segment ${weatherScenario === value ? "segment--active" : ""}`}
                    onClick={() => setWeatherScenario(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-block">
              <label className="control-label">Tire plan</label>
              <div className="segmented-row">
                {(Object.keys(tirePlanPresets) as Array<keyof typeof tirePlanPresets>).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`segment ${tirePreset === value ? "segment--active" : ""}`}
                    onClick={() => setTirePreset(value)}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lab-grid-two">
            <div className="control-block">
              <label className="control-label">
                Pit stops <span>{pitStopCount}</span>
              </label>
              <input
                className="control-range"
                type="range"
                min={1}
                max={4}
                value={pitStopCount}
                onChange={(event) => setPitStopCount(Number(event.target.value))}
              />
            </div>

            <div className="control-block">
              <label className="control-label">
                Aggression <span>{aggressionFactor}</span>
              </label>
              <input
                className="control-range"
                type="range"
                min={0}
                max={100}
                value={aggressionFactor}
                onChange={(event) => setAggressionFactor(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="lab-grid-two">
            <div className="control-block">
              <label className="control-label">
                Safety car probability <span>{Math.round(safetyCarProbability * 100)}%</span>
              </label>
              <input
                className="control-range"
                type="range"
                min={0}
                max={100}
                value={Math.round(safetyCarProbability * 100)}
                onChange={(event) => setSafetyCarProbability(Number(event.target.value) / 100)}
              />
            </div>

            <div className="control-block">
              <label className="control-label">
                Reliability bias <span>{reliabilityBias > 0 ? `+${reliabilityBias}` : reliabilityBias}</span>
              </label>
              <input
                className="control-range"
                type="range"
                min={-25}
                max={25}
                value={reliabilityBias}
                onChange={(event) => setReliabilityBias(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="control-block">
            <label className="control-label">Constructor focus</label>
            <div className="chip-row">
              {constructors.map((constructor) => (
                <button
                  key={constructor.id}
                  type="button"
                  className={`chip ${focusedConstructors.includes(constructor.id) ? "chip--active" : ""}`}
                  onClick={() => toggleConstructor(constructor.id)}
                >
                  <TeamBadge
                    teamId={constructor.id}
                    label={constructor.name}
                    compact
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="control-block">
            <div className="control-label">
              Driver pool <span>{selectedDriverIds.length} selected</span>
            </div>
            <div className="driver-grid">
              {raceContext?.entrants.map((entrant) => (
                <button
                  key={entrant.driverId}
                  type="button"
                  className={`driver-chip ${selectedDriverIds.includes(entrant.driverId) ? "driver-chip--active" : ""}`}
                  onClick={() => toggleDriver(entrant.driverId)}
                >
                  <div>
                    <strong>{entrant.fullName}</strong>
                    <span>
                      P{entrant.qualifyingPosition} | {entrant.constructorName}
                    </span>
                  </div>
                  <TeamBadge teamId={entrant.constructorId} compact />
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="hero__cta hero__cta--primary"
            onClick={() => void runSimulation()}
            disabled={isContextLoading || isSimulating || selectedDriverIds.length === 0}
          >
            {isSimulating ? "Running simulation" : "Run simulation"}
          </button>

          {selectedRace ? (
            <p className="lab-footnote">
              {selectedRace.season} round {selectedRace.round}: {selectedRace.raceName}
            </p>
          ) : null}
        </div>
      </section>

      <section className="lab-results">
        <div className="workspace-panel workspace-panel--dark">
          <div className="workspace-panel__eyebrow">Scenario result</div>
          <div className="workspace-panel__headline">
            {simulation ? simulation.raceName : "Run a scenario to generate a projected order."}
          </div>

          {error ? <p className="lab-error">{error}</p> : null}
          {isContextLoading ? <div className="loading-block">Loading race context...</div> : null}
          {!isContextLoading && raceContext && !simulation ? (
            <div className="status-banner">
              {raceContext.entrants.length} entrants loaded. Tune the assumptions, then run the scenario.
            </div>
          ) : null}

          {simulation ? (
            <>
              <div className="result-summary">
                <div>
                  <span>Confidence</span>
                  <strong>{simulation.confidence}</strong>
                </div>
                <div>
                  <span>Undercut view</span>
                  <strong>{simulation.scenarioSummary.pitStopCount} stops</strong>
                </div>
                <div>
                  <span>Weather</span>
                  <strong>{simulation.scenarioSummary.weatherScenario}</strong>
                </div>
              </div>

              <p className="lab-copy">{simulation.confidenceReason}</p>
              <p className="lab-copy">{simulation.undercutNarrative}</p>
              <RaceSimulationCharts simulation={simulation} />

              <div className="result-table">
                {simulation.finishingOrder.map((entrant) => (
                  <article key={entrant.driverId} className="result-row">
                    <div className="result-row__rank">{entrant.projectedFinish}</div>
                    <div className="result-row__main">
                      <div className="result-row__head">
                        <div>
                          <h3>{entrant.fullName}</h3>
                          <p>
                            P{entrant.qualifyingPosition} start | {entrant.constructorName}
                          </p>
                          <div className="mt-3">
                            <TeamBadge teamId={entrant.constructorId} compact />
                          </div>
                        </div>
                        <div className="result-row__metrics">
                          <span>{entrant.projectedPoints} pts</span>
                          <span>{entrant.podiumProbability}% podium</span>
                          <span>{entrant.confidence} confidence</span>
                        </div>
                      </div>
                      <div className="chip-row chip-row--inline">
                        <span className="chip chip--static">Undercut {entrant.undercutImpact}</span>
                      </div>
                      <ul className="result-notes">
                        {entrant.explanation.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="placeholder-stack">
              <p className="lab-copy">
                The engine is heuristic. It combines grid position, form, overtaking, reliability,
                and your scenario inputs.
              </p>
              <div className="result-summary">
                <div>
                  <span>Model type</span>
                  <strong>Heuristic</strong>
                </div>
                <div>
                  <span>Guarantee</span>
                  <strong>None</strong>
                </div>
                <div>
                  <span>Goal</span>
                  <strong>Transparent tradeoffs</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="workspace-panel">
          <div className="workspace-panel__eyebrow">Selected field context</div>
          <div className="workspace-panel__headline">
            Entrant baselines from qualifying and rolling historical form.
          </div>
          <div className="context-list">
            {selectedDrivers.map((entrant) => (
              <div key={entrant.driverId} className="context-list__item">
                <div>
                  <strong>{entrant.fullName}</strong>
                  <p>
                    {entrant.constructorName} | baseline finish{" "}
                    {entrant.baselineFinish ? entrant.baselineFinish.toFixed(1) : "N/A"}
                  </p>
                </div>
                <div className="context-metrics">
                  <TeamBadge teamId={entrant.constructorId} compact />
                  <span>ovt {entrant.overtakeScore.toFixed(0)}</span>
                  <span>rel {entrant.reliabilityScore.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
