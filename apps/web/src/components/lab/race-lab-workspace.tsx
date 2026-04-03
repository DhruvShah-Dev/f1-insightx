"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamBadge } from "@/components/ui/team-badge";
import { StatePanel } from "@/components/ui/state-panel";
import { TrackLayoutCard } from "@/components/ui/track-layout-card";
import { getNetworkErrorMessage, readClientErrorMessage } from "@/lib/errors/client";
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

type TargetType = "driver" | "constructor";

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
  const [contextReloadKey, setContextReloadKey] = useState(0);
  const [weatherScenario, setWeatherScenario] = useState<"dry" | "mixed" | "wet">("dry");
  const [pitStopCount, setPitStopCount] = useState(2);
  const [safetyCarProbability, setSafetyCarProbability] = useState(0.35);
  const [aggressionFactor, setAggressionFactor] = useState(62);
  const [reliabilityBias, setReliabilityBias] = useState(0);
  const [tirePreset, setTirePreset] = useState<keyof typeof tirePlanPresets>("balanced");
  const [targetType, setTargetType] = useState<TargetType>("driver");
  const [selectedTargetId, setSelectedTargetId] = useState("");

  useEffect(() => {
    if (!selectedRaceId) {
      setRaceContext(null);
      setError("Choose a race weekend before running the strategy workspace.");
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
          setError(readClientErrorMessage(payload, "The selected race context is unavailable right now."));
          setRaceContext(null);
          return;
        }

        setRaceContext(payload.data);
        setTargetType("driver");
        setSelectedTargetId(payload.data.entrants[0]?.driverId ?? "");
      } catch {
        if (active) {
          setError(getNetworkErrorMessage("Race context loading"));
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
  }, [contextReloadKey, selectedRaceId]);

  const constructors = useMemo(() => {
    const names = new Map<string, string>();
    raceContext?.entrants.forEach((entrant) => {
      if (!names.has(entrant.constructorId)) {
        names.set(entrant.constructorId, entrant.constructorName);
      }
    });
    return [...names.entries()].map(([id, name]) => ({ id, name }));
  }, [raceContext]);

  const targetOptions = useMemo(() => {
    if (!raceContext) {
      return [];
    }

    if (targetType === "driver") {
      return raceContext.entrants.map((entrant) => ({
        id: entrant.driverId,
        label: entrant.fullName,
        meta: entrant.constructorName,
      }));
    }

    return constructors.map((constructor) => ({
      id: constructor.id,
      label: constructor.name,
      meta: "Constructor focus",
    }));
  }, [constructors, raceContext, targetType]);

  useEffect(() => {
    if (targetOptions.length === 0) {
      return;
    }

    const hasSelectedTarget = targetOptions.some((option) => option.id === selectedTargetId);
    if (!hasSelectedTarget) {
      setSelectedTargetId(targetOptions[0]?.id ?? "");
    }
  }, [selectedTargetId, targetOptions]);

  const selectedRace = races.find((race) => race.id === selectedRaceId);
  const selectedRaceDateLabel = selectedRace
    ? new Date(selectedRace.scheduledAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const selectedTargetLabel =
    targetOptions.find((option) => option.id === selectedTargetId)?.label ?? "Select a target";

  const targetEntrants = useMemo(() => {
    if (!raceContext) {
      return [];
    }

    if (targetType === "driver") {
      return raceContext.entrants.filter((entrant) => entrant.driverId === selectedTargetId);
    }

    return raceContext.entrants.filter((entrant) => entrant.constructorId === selectedTargetId);
  }, [raceContext, selectedTargetId, targetType]);

  const targetDescriptor = useMemo(() => {
    if (targetEntrants.length === 0) {
      return "Choose a subject to compare against the default field baseline.";
    }

    if (targetType === "constructor") {
      return `${targetEntrants.length} drivers inherit the custom strategy while the rest of the field stays on the default race profile.`;
    }

    return `${targetEntrants[0]?.fullName ?? "The selected driver"} gets the custom strategy while every rival runs the default race profile.`;
  }, [targetEntrants, targetType]);

  const fieldBaselineSummary = useMemo(() => {
    const entrants = raceContext?.entrants ?? [];
    if (entrants.length === 0) {
      return [];
    }

    const averageReliability =
      entrants.reduce((sum, entrant) => sum + entrant.reliabilityScore, 0) / entrants.length;
    const averageOvertake =
      entrants.reduce((sum, entrant) => sum + entrant.overtakeScore, 0) / entrants.length;

    return [
      { label: "Field size", value: `${entrants.length} entrants` },
      { label: "Default baseline", value: "Balanced two-stop" },
      { label: "Avg. reliability", value: averageReliability.toFixed(0) },
      { label: "Avg. overtaking", value: averageOvertake.toFixed(0) },
    ];
  }, [raceContext]);

  const competitorNames = useMemo(
    () => simulation?.finishingOrder.filter((entrant) => !entrant.isTarget).map((entrant) => entrant.fullName) ?? [],
    [simulation],
  );

  async function runSimulation() {
    if (!raceContext || !selectedTargetId) {
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
          driverIds: raceContext.entrants.map((entrant) => entrant.driverId),
          comparisonTargetType: targetType,
          comparisonTargetId: selectedTargetId,
          constructorFocus: targetType === "constructor" ? [selectedTargetId] : [],
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
        setError(readClientErrorMessage(payload, "The strategy engine could not finish that scenario."));
        setSimulation(null);
        return;
      }

      setSimulation(payload.data);
    } catch {
      setError(getNetworkErrorMessage("Strategy simulation"));
      setSimulation(null);
    } finally {
      setIsSimulating(false);
    }
  }

  return (
    <div className="lab-layout lab-layout--strategy">
      <section className="lab-controls">
        <div className="workspace-panel workspace-panel--lab">
          <div className="strategy-workspace__header strategy-workspace__header--dense">
            <div>
              <div className="workspace-panel__eyebrow">Strategy workstation</div>
              <div className="workspace-panel__headline">Build one race decision, then read its effect against the field.</div>
              <p className="lab-copy">
                Keep the rest of the grid stable, tune one target, and get back a focused comparison brief instead of a wall of race output.
              </p>
            </div>
            {selectedRace ? (
              <div className="strategy-context-chip">
                <span>{selectedRace.season}</span>
                <strong>R{selectedRace.round}</strong>
              </div>
            ) : null}
          </div>

          {selectedRace ? (
            <div className="panel-hero panel-hero--lab panel-hero--lab-grid">
              <TrackLayoutCard
                circuitId={selectedRace.circuitId}
                title={selectedRace.raceName}
                showSource={false}
                showMeta={false}
              />
              <div className="panel-hero__copy">
                <div className="section-meta">Race context</div>
                <h3>{selectedRace.raceName}</h3>
                <p className="section-copy">
                  {selectedRaceDateLabel} | {raceContext?.entrants.length ?? 0} entrants loaded from qualifying and recent form.
                </p>
              </div>
            </div>
          ) : null}

          {error && !raceContext && !isContextLoading ? (
            <StatePanel
              eyebrow="Race context"
              title="The Strategy Lab could not load this weekend."
              message={error}
              tone="error"
              action={(
                <button
                  type="button"
                  className="hero__cta hero__cta--secondary"
                  onClick={() => setContextReloadKey((current) => current + 1)}
                >
                  Retry context
                </button>
              )}
            />
          ) : null}

          <div className="lab-builder-grid">
            <section className="lab-builder-group lab-builder-group--target">
              <div className="lab-builder-group__header">
                <div className="section-meta">Analysis target</div>
                <h2 className="lab-builder-group__title">Choose the subject you want to move.</h2>
              </div>

              <div className="lab-grid-two lab-grid-two--top">
                <div className="control-block control-block--tight">
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

                <div className="control-block control-block--tight">
                  <label className="control-label">Target type</label>
                  <div className="segmented-row">
                    {(["driver", "constructor"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`segment ${targetType === value ? "segment--active" : ""}`}
                        onClick={() => setTargetType(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lab-grid-two">
                <div className="control-block">
                  <label className="control-label">{targetType === "driver" ? "Driver target" : "Constructor target"}</label>
                  <select
                    className="control-select"
                    value={selectedTargetId}
                    onChange={(event) => setSelectedTargetId(event.target.value)}
                    disabled={targetOptions.length === 0 || !raceContext}
                  >
                    {targetOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} | {option.meta}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lab-baseline-note">
                  <span>Field baseline</span>
                  <strong>Everyone else runs a normal race.</strong>
                  <p>{targetDescriptor}</p>
                </div>
              </div>

              <div className="lab-target-strip">
                {targetEntrants.map((entrant) => (
                  <div key={entrant.driverId} className="lab-target-strip__item">
                    <div>
                      <strong>{entrant.fullName}</strong>
                      <p>P{entrant.qualifyingPosition} start</p>
                    </div>
                    <TeamBadge teamId={entrant.constructorId} label={entrant.constructorName} compact />
                  </div>
                ))}
              </div>
            </section>

            <section className="lab-builder-group lab-builder-group--scenario">
              <div className="lab-builder-group__header">
                <div className="section-meta">Scenario setup</div>
                <h2 className="lab-builder-group__title">Shape the race plan around that target.</h2>
              </div>

              <div className="lab-grid-two">
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
                  <label className="control-label">
                    Safety car pressure <span>{Math.round(safetyCarProbability * 100)}%</span>
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
            </section>
          </div>

          <div className="result-summary result-summary--compact result-summary--baseline">
            {fieldBaselineSummary.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="lab-action-bar">
            <button
              type="button"
              className="hero__cta hero__cta--primary"
              onClick={() => void runSimulation()}
              disabled={isContextLoading || isSimulating || !selectedTargetId}
            >
              {isSimulating ? "Running comparison" : "Run comparison"}
            </button>

            {selectedRace ? (
              <p className="lab-footnote">
                {selectedRace.season} round {selectedRace.round}: {selectedRace.raceName} | {selectedTargetLabel}
              </p>
            ) : null}
          </div>

          <div className="lab-results-flow">
            <div className="workspace-panel workspace-panel--dark workspace-panel--results">
          <div className="strategy-output__header strategy-output__header--dense">
            <div>
              <div className="workspace-panel__eyebrow">Comparison briefing</div>
              <div className="workspace-panel__headline">
                {simulation ? simulation.targetSummary?.title ?? simulation.raceName : "Run a strategy against the field baseline."}
              </div>
              {simulation?.targetSummary ? (
                <p className="lab-copy">{simulation.targetSummary.narrative}</p>
              ) : (
                <p className="lab-copy">
                  The output focuses on one target versus a normal race baseline, so the effect of the strategy reads clearly instead of getting lost in a full-grid form.
                </p>
              )}
            </div>
            {simulation ? <div className="strategy-output__state">{simulation.confidence}</div> : null}
          </div>

          {error && raceContext ? <p className="lab-error">{error}</p> : null}
          {isContextLoading ? <div className="loading-block">Loading race context...</div> : null}
          {!isContextLoading && raceContext && !simulation ? (
            <div className="status-banner">
              {raceContext.entrants.length} entrants ready. Choose a target, set the scenario, then run the comparison.
            </div>
          ) : null}

          {simulation ? (
            <>
              <div className="result-summary">
                <div>
                  <span>Target</span>
                  <strong>{simulation.comparisonTarget?.label ?? "Field comparison"}</strong>
                </div>
                <div>
                  <span>Avg. position delta</span>
                  <strong>
                    {simulation.targetSummary
                      ? `${simulation.targetSummary.averageFinishDelta > 0 ? "+" : ""}${simulation.targetSummary.averageFinishDelta.toFixed(1)}`
                      : "0.0"}
                  </strong>
                </div>
                <div>
                  <span>Points swing</span>
                  <strong>
                    {simulation.targetSummary
                      ? `${simulation.targetSummary.aggregatePointsDelta > 0 ? "+" : ""}${simulation.targetSummary.aggregatePointsDelta.toFixed(1)}`
                      : "0.0"}
                  </strong>
                </div>
                <div>
                  <span>Field baseline</span>
                  <strong>Normal race</strong>
                </div>
              </div>

              {simulation.targetSummary ? (
                <div className="lab-target-outcome lab-target-outcome--brief">
                  {simulation.targetSummary.entrants.map((entrant) => (
                    <article key={entrant.driverId} className="lab-target-card">
                      <div className="lab-target-card__topline">
                        <div>
                          <span className="section-meta">Target entrant</span>
                          <h3>{entrant.fullName}</h3>
                        </div>
                        <TeamBadge teamId={entrant.constructorId} label={entrant.constructorName} compact />
                      </div>
                      <div className="lab-target-card__metrics">
                        <div>
                          <span>Baseline</span>
                          <strong>P{entrant.baselineFinish}</strong>
                        </div>
                        <div>
                          <span>Scenario</span>
                          <strong>P{entrant.projectedFinish}</strong>
                        </div>
                        <div>
                          <span>Delta</span>
                          <strong>{entrant.finishDelta > 0 ? "+" : ""}{entrant.finishDelta}</strong>
                        </div>
                        <div>
                          <span>Points</span>
                          <strong>{entrant.projectedPoints}</strong>
                        </div>
                      </div>
                      <p className="lab-copy">{entrant.explanationSummary}</p>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="lab-insight-stack lab-insight-stack--two">
                <article className="lab-insight-card">
                  <div className="section-meta">Confidence read</div>
                  <p className="lab-copy">{simulation.confidenceReason}</p>
                </article>
                <article className="lab-insight-card">
                  <div className="section-meta">Strategy pressure</div>
                  <p className="lab-copy">{simulation.undercutNarrative}</p>
                </article>
              </div>

              <div className="lab-competitor-roster">
                <div className="result-table__header">
                  <div className="section-meta">Field context</div>
                  <p className="lab-copy">
                    The rest of the field stays on the baseline race profile. These names anchor the comparison without turning the readout into a second dense results dump.
                  </p>
                </div>
                <div className="lab-competitor-roster__grid">
                  {competitorNames.map((name) => (
                    <span key={name} className="chip chip--static lab-competitor-chip">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="placeholder-stack">
              <div className="result-summary">
                <div>
                  <span>Workflow</span>
                  <strong>Choose target</strong>
                </div>
                <div>
                  <span>Comparison</span>
                  <strong>Against full field</strong>
                </div>
                <div>
                  <span>Baseline</span>
                  <strong>Normal race profile</strong>
                </div>
                <div>
                  <span>Output</span>
                  <strong>Target brief + field names</strong>
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

