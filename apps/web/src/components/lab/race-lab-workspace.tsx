"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { StatePanel } from "@/components/ui/state-panel";
import { RaceWeekCircuitVisualization } from "@/components/race-week/race-week-circuit-visualization";
import { getNetworkErrorMessage, readClientErrorMessage } from "@/lib/errors/client";
import type { StrategyLabRaceProduct, StrategyLabRaceSummary } from "@/lib/server/strategy-lab-product";
import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";
import type { RaceSimulationResponse } from "@/lib/server/strategy-lab-simulator";
import { getRaceWeekCircuitMetadata } from "@/lib/ui/race-week-circuit-metadata";

type StrategyLabResponse = { ok: boolean; data?: { product: StrategyLabRaceProduct; runtime: RuntimeSourceMetadata }; error?: { message: string } };
type SimulationResponse = { ok: boolean; data?: RaceSimulationResponse; error?: { message: string } };
type Props = {
  races: StrategyLabRaceSummary[];
  trackPaths: Record<string, string | null>;
  initialProduct: StrategyLabRaceProduct | null;
  initialRuntime: RuntimeSourceMetadata | null;
};
type TargetType = "driver" | "constructor";
type Stint = { compound: string; laps: number };

const scenarioPresets = {
  balanced: {
    label: "Balanced 2-stop",
    pitch: "Default race shape",
    pitStopCount: 2,
    tirePlan: [{ compound: "medium", laps: 18 }, { compound: "hard", laps: 24 }, { compound: "soft", laps: 15 }],
  },
  conservative: {
    label: "Long-run 1-stop",
    pitch: "Track-position bias",
    pitStopCount: 1,
    tirePlan: [{ compound: "hard", laps: 26 }, { compound: "medium", laps: 24 }],
  },
  aggressive: {
    label: "Attack 2-stop",
    pitch: "Undercut pressure",
    pitStopCount: 2,
    tirePlan: [{ compound: "soft", laps: 14 }, { compound: "medium", laps: 18 }, { compound: "soft", laps: 13 }],
  },
} as const;

const fmtBand = (low?: number | null, high?: number | null, fallback?: number | null) =>
  low && high ? (low === high ? `P${low}` : `P${low}-P${high}`) : fallback ? `P${fallback}` : "Open";
const fmtDelta = (value?: number | null, suffix = "") =>
  value === null || value === undefined ? "Flat" : Math.abs(value) < 0.1 ? `Flat${suffix}` : `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
const fmtConfidence = (score?: number | null) => (score == null ? "Calibrating" : score >= 0.74 ? "High confidence" : score >= 0.48 ? "Medium confidence" : "Low confidence");
const fmtRisk = (weather: "dry" | "mixed" | "wet", sc: number) => (weather !== "dry" || sc >= 0.58 ? "High variance" : sc >= 0.38 ? "Moderate variance" : "Controlled variance");
const fmtSensitivity = (factor: string) => factor.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
const avg = (values: Array<number | null | undefined>) => {
  const cleaned = values.filter((value): value is number => value !== null && value !== undefined);
  return cleaned.length > 0 ? cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length : null;
};

function scalePlan(plan: Stint[], totalLaps: number) {
  const total = plan.reduce((sum, stint) => sum + stint.laps, 0) || totalLaps;
  const scaled = plan.map((stint) => ({ ...stint, laps: Math.max(1, Math.round((stint.laps / total) * totalLaps)) }));
  const used = scaled.reduce((sum, stint) => sum + stint.laps, 0);
  scaled[scaled.length - 1]!.laps += totalLaps - used;
  return scaled;
}

function timelineFromBaseline(entrant: StrategyLabRaceProduct["entrants"][number], totalLaps: number) {
  const scenario = entrant.scenarios.find((item) => item.scenarioCode === entrant.baselineStrategyCode) ?? entrant.scenarios[0];
  const compounds = (scenario?.compoundSequence ?? "medium / hard").split(" / ").map((item) => item.trim().toLowerCase());
  const windows = entrant.pitWindows
    .filter((item) => item.scenarioCode === (scenario?.scenarioCode ?? entrant.baselineStrategyCode))
    .sort((a, b) => (a.stopNumber ?? 0) - (b.stopNumber ?? 0));
  if (windows.length === 0) return scalePlan(compounds.map((compound) => ({ compound, laps: Math.floor(totalLaps / compounds.length) })), totalLaps);
  const plan: Stint[] = [];
  let last = 0;
  windows.forEach((window, index) => {
    const stop = Math.round(((window.windowStartLap ?? 1) + (window.windowEndLap ?? 1)) / 2);
    plan.push({ compound: compounds[index] ?? "medium", laps: Math.max(1, stop - last) });
    last = stop;
  });
  plan.push({ compound: compounds[compounds.length - 1] ?? "hard", laps: Math.max(1, totalLaps - last) });
  return plan;
}

function StintTimeline({ label, plan, totalLaps, active = false }: { label: string; plan: Stint[]; totalLaps: number; active?: boolean }) {
  return (
    <div className={`strategy-timeline ${active ? "strategy-timeline--active" : ""}`}>
      <div className="strategy-timeline__label"><span>{label}</span><strong>{plan.length - 1} stop{plan.length - 1 === 1 ? "" : "s"}</strong></div>
      <div className="strategy-timeline__ruler" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((position) => <span key={position} style={{ left: `${position * 100}%` }}>L{Math.round(totalLaps * position)}</span>)}
      </div>
      <div className="strategy-timeline__track">
        {plan.map((stint, index) => {
          const elapsedLaps = plan.slice(0, index + 1).reduce((sum, item) => sum + item.laps, 0);
          return (
            <div key={`${label}-${stint.compound}-${index}`} className={`strategy-timeline__segment strategy-timeline__segment--${stint.compound}`} style={{ width: `${(stint.laps / Math.max(totalLaps, 1)) * 100}%` }}>
              <span>{stint.compound}</span><strong>{stint.laps} laps</strong>
              {index < plan.length - 1 ? <i className="strategy-timeline__pit" style={{ left: "100%" }} aria-label={`Pit stop near lap ${elapsedLaps}`} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StrategyControlRail({ children }: { children: ReactNode }) {
  return <aside className="strategy-command-rail" aria-label="Strategy scenario controls">{children}</aside>;
}

function StrategyResultStage({ children }: { children: ReactNode }) {
  return <section className="strategy-result-stage" aria-label="Strategy result">{children}</section>;
}

function StrategyStintLanes({ children }: { children: ReactNode }) {
  return <section className="strategy-console-band strategy-console-band--stints">{children}</section>;
}

function StrategyPositionBand({ children }: { children: ReactNode }) {
  return <section className="strategy-console-band strategy-console-band--position">{children}</section>;
}

function StrategyRiskStrip({ children }: { children: ReactNode }) {
  return <section className="strategy-risk-strip">{children}</section>;
}

function buildCaveats({
  raceProduct,
  weatherScenario,
  safetyCarProbability,
  targetType,
  simulation,
}: {
  raceProduct: StrategyLabRaceProduct | null;
  weatherScenario: "dry" | "mixed" | "wet";
  safetyCarProbability: number;
  targetType: TargetType;
  simulation: RaceSimulationResponse | null;
}) {
  const notes = [];

  if (weatherScenario !== "dry") {
    notes.push("Confidence softens outside dry running because the current priors are calibrated around dry baseline behavior.");
  }

  if (safetyCarProbability >= 0.55) {
    notes.push("A high safety-car assumption can invalidate the precomputed pit-window advantage and flatten timing deltas quickly.");
  }

  if ((raceProduct?.overview.confidenceScore ?? 0) < 0.5) {
    notes.push("The weekend read is still building, so the strategy recommendation carries less signal than a fully populated race week.");
  }

  if (targetType === "constructor") {
    notes.push("Constructor scenarios inherit a two-car assumption, so one weak driver can dilute the headline upside of the strategy call.");
  }

  if (simulation?.confidenceReason) {
    notes.push(simulation.confidenceReason);
  }

  return notes.slice(0, 3);
}

export function RaceLabWorkspace({ races, trackPaths, initialProduct, initialRuntime }: Props) {
  const [selectedRaceId, setSelectedRaceId] = useState(races[0]?.id ?? "");
  const [raceProduct, setRaceProduct] = useState<StrategyLabRaceProduct | null>(initialProduct);
  const [runtimeMeta, setRuntimeMeta] = useState<RuntimeSourceMetadata | null>(initialRuntime);
  const [simulation, setSimulation] = useState<RaceSimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [targetType, setTargetType] = useState<TargetType>("driver");
  const [selectedTargetId, setSelectedTargetId] = useState(initialProduct?.entrants[0]?.driverId ?? "");
  const [preset, setPreset] = useState<keyof typeof scenarioPresets>("balanced");
  const [weatherScenario, setWeatherScenario] = useState<"dry" | "mixed" | "wet">("dry");
  const [safetyCarProbability, setSafetyCarProbability] = useState(0.35);
  const [aggressionFactor, setAggressionFactor] = useState(62);
  const [reliabilityBias, setReliabilityBias] = useState(0);

  useEffect(() => {
    if (!selectedRaceId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setSimulation(null);
    setRuntimeMeta(null);
    void fetch(`/api/strategy-lab/races/${selectedRaceId}`, { cache: "no-store" })
      .then((res) => res.json() as Promise<StrategyLabResponse>)
      .then((payload) => {
        if (!active) return;
        if (!payload.ok || !payload.data) {
          setError(readClientErrorMessage(payload, "The selected race context is unavailable right now."));
          setRaceProduct(null);
          setRuntimeMeta(null);
          return;
        }
        setRaceProduct(payload.data.product);
        setRuntimeMeta(payload.data.runtime);
        setTargetType("driver");
        setSelectedTargetId(payload.data.product.entrants[0]?.driverId ?? "");
      })
      .catch(() => {
        if (active) {
          setError(getNetworkErrorMessage("Strategy Lab loading"));
          setRaceProduct(null);
          setRuntimeMeta(null);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey, selectedRaceId]);

  const selectedRace = races.find((race) => race.id === selectedRaceId);
  const selectedRaceDateLabel = selectedRace ? new Date(selectedRace.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const constructors = useMemo(() => [...new Map((raceProduct?.entrants ?? []).map((item) => [item.constructorId, item.constructorName])).entries()].map(([id, name]) => ({ id, name })), [raceProduct]);
  const targetOptions = useMemo(() => {
    if (!raceProduct) return [];
    return targetType === "driver"
      ? raceProduct.entrants.map((entrant) => ({ id: entrant.driverId, label: entrant.fullName, meta: entrant.constructorName }))
      : constructors.map((constructor) => ({ id: constructor.id, label: constructor.name, meta: "Two-car scenario" }));
  }, [constructors, raceProduct, targetType]);

  useEffect(() => {
    if (targetOptions.length > 0 && !targetOptions.some((option) => option.id === selectedTargetId)) {
      setSelectedTargetId(targetOptions[0]?.id ?? "");
    }
  }, [selectedTargetId, targetOptions]);

  const targetEntrants = useMemo(() => {
    if (!raceProduct) return [];
    return targetType === "driver"
      ? raceProduct.entrants.filter((entrant) => entrant.driverId === selectedTargetId)
      : raceProduct.entrants.filter((entrant) => entrant.constructorId === selectedTargetId);
  }, [raceProduct, selectedTargetId, targetType]);

  const representativeEntrant = targetEntrants[0];
  const totalLaps = raceProduct?.overview.nominalRaceLaps ?? representativeEntrant?.strategyFeature.nominalRaceLaps ?? 57;
  const baselinePlan = representativeEntrant ? timelineFromBaseline(representativeEntrant, totalLaps) : [];
  const scenarioPlan = scalePlan(scenarioPresets[preset].tirePlan.map((stint) => ({ ...stint })), totalLaps);
  const precomputedScenarios = useMemo(() => {
    const rows = targetEntrants.flatMap((entrant) => entrant.scenarios);
    const byCode = new Map<string, typeof rows>();
    rows.forEach((row) => byCode.set(row.scenarioCode, [...(byCode.get(row.scenarioCode) ?? []), row]));
    return [...byCode.entries()].map(([code, values]) => ({
      code,
      label: values[0]?.scenarioLabel ?? code,
      rank: Math.round((values.reduce((sum, row) => sum + (row.recommendationRank ?? 99), 0) / values.length) || 99),
      confidence: values.reduce((sum, row) => sum + (row.confidenceScore ?? 0), 0) / values.length,
      low: Math.min(...values.map((row) => row.estimatedFinishBandLow ?? 99)),
      high: Math.max(...values.map((row) => row.estimatedFinishBandHigh ?? 99)),
      delta: values.reduce((sum, row) => sum + (row.deltaVsBaselineS ?? 0), 0) / values.length,
      rationale: values[0]?.rationale ?? "",
    })).sort((a, b) => a.rank - b.rank);
  }, [targetEntrants]);
  const bestPrecomputedScenario = precomputedScenarios[0] ?? null;
  const liveTargetEntrants = simulation?.targetSummary?.entrants ?? [];
  const liveTransitionBands = simulation?.positionTransitionBands.filter((band) => liveTargetEntrants.some((entrant) => entrant.driverId === band.driverId)) ?? [];
  const liveFinishBand = liveTargetEntrants.length > 0
    ? {
        low: Math.min(...liveTargetEntrants.map((entrant) => entrant.projectedFinishBandLow)),
        high: Math.max(...liveTargetEntrants.map((entrant) => entrant.projectedFinishBandHigh)),
      }
    : null;
  const projectedGain = avg(liveTargetEntrants.map((entrant) => entrant.finishDelta)) ?? simulation?.targetSummary?.averageFinishDelta ?? null;
  const targetPitWindows = useMemo(
    () =>
      targetEntrants.map((entrant) => ({
        driverId: entrant.driverId,
        fullName: entrant.fullName,
        constructorId: entrant.constructorId,
        constructorName: entrant.constructorName,
        windows: entrant.pitWindows
          .filter((window) => window.scenarioCode === (entrant.baselineStrategyCode ?? entrant.scenarios[0]?.scenarioCode))
          .sort((a, b) => (a.stopNumber ?? 0) - (b.stopNumber ?? 0)),
      })),
    [targetEntrants],
  );

  const whyItWorks = useMemo(() => {
    if (!representativeEntrant) return [];
    return [
      { label: "Pace base", value: (representativeEntrant.strategyFeature.baseRacePaceS ?? 99) < 90 ? "Strong underlying race pace" : "Needs clean execution to stay in the lead pack" },
      { label: "Tyre shape", value: (representativeEntrant.driverProfile.tyreManagementScore ?? 0.5) >= 0.62 ? "Tyre management supports longer stints" : "Shorter stints hide degradation better" },
      { label: "Pit lane", value: (representativeEntrant.constructorProfile.pitEfficiencyScore ?? 0.5) >= 0.58 ? "Pit crew supports aggressive timing" : "Pit lane time rewards fewer stop losses" },
      { label: "Racecraft", value: (representativeEntrant.driverProfile.racecraftProxyScore ?? 0.5) >= 0.6 ? "Traffic recovery is a strength" : "Track position matters more than overtaking upside" },
    ];
  }, [representativeEntrant]);
  const caveats = useMemo(
    () =>
      buildCaveats({
        raceProduct,
        weatherScenario,
        safetyCarProbability,
        targetType,
        simulation,
      }),
    [raceProduct, weatherScenario, safetyCarProbability, targetType, simulation],
  );

  const setupStats = useMemo(() => {
    const entrants = raceProduct?.entrants ?? [];
    if (entrants.length === 0) return [];
    return [
      { label: "Race difficulty", value: raceProduct?.overview.raceDifficulty ?? "Balanced" },
      { label: "Baseline call", value: raceProduct?.overview.bestStrategyLabel ?? "Balanced" },
      { label: "Pit-loss anchor", value: `${(raceProduct?.overview.pitLossEstimateS ?? 22).toFixed(1)}s` },
      { label: "Race distance", value: `${raceProduct?.overview.nominalRaceLaps ?? totalLaps} laps` },
    ];
  }, [raceProduct, totalLaps]);

  async function runSimulation() {
    if (!raceProduct || !selectedTargetId) return;
    setSimulating(true);
    setError(null);
    try {
      const response = await fetch("/api/race-scenarios/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raceId: selectedRaceId,
          driverIds: raceProduct.entrants.map((entrant) => entrant.driverId),
          comparisonTargetType: targetType,
          comparisonTargetId: selectedTargetId,
          constructorFocus: targetType === "constructor" ? [selectedTargetId] : [],
          pitStopCount: scenarioPresets[preset].pitStopCount,
          tirePlan: scenarioPresets[preset].tirePlan,
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
      setSimulating(false);
    }
  }

  const targetLabel = targetOptions.find((item) => item.id === selectedTargetId)?.label ?? "Select target";
  const resultBand = liveFinishBand
    ? fmtBand(liveFinishBand.low, liveFinishBand.high, liveFinishBand.low)
    : representativeEntrant
      ? fmtBand(representativeEntrant.finishBandLow, representativeEntrant.finishBandHigh, representativeEntrant.projectedFinish)
      : "Open";

  return (
    <div className="strategy-pitwall">
      <header className="strategy-race-hero">
        <div className="strategy-race-hero__copy">
          <span className="strategy-kicker">{selectedRace?.raceName ?? "Strategy Lab"} strategy lab</span>
          <h1>{selectedRace?.raceName ?? "Strategy Lab"}</h1>
          <p className="strategy-race-hero__date">{selectedRaceDateLabel} {selectedRace ? `/ Round ${selectedRace.round}` : ""}</p>
          <p className="strategy-race-hero__insight">{raceProduct?.overview.keyInsight ?? "Compare one race call against the field baseline."}</p>
          <div className="strategy-race-hero__metrics">
            {setupStats.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
          </div>
          <ProductRuntimeNote runtime={runtimeMeta} className="strategy-race-hero__runtime" primaryLabel="Strategy data" degradedLabel="Backup data source" />
        </div>
        <div className="strategy-race-hero__track">
          {selectedRace && trackPaths[selectedRace.circuitId] ? (
            <RaceWeekCircuitVisualization
              title={selectedRace.raceName}
              trackPath={trackPaths[selectedRace.circuitId]!}
              metadata={getRaceWeekCircuitMetadata(selectedRace.circuitId)}
            />
          ) : <div className="strategy-loading-block" />}
        </div>
      </header>

      {error && !raceProduct && !loading ? (
        <StatePanel eyebrow="Strategy Lab" title="Strategy context unavailable." message={error} tone="error" action={<button type="button" className="hero__cta hero__cta--secondary" onClick={() => setReloadKey((current) => current + 1)}>Retry context</button>} />
      ) : null}

      {loading && !raceProduct ? (
        <div className="strategy-pitwall__loading" aria-label="Loading strategy context">
          <div className="strategy-loading-block" /><div className="strategy-loading-block" /><div className="strategy-loading-block strategy-loading-block--wide" />
        </div>
      ) : (
        <div className="strategy-workbench">
          <StrategyControlRail>
            <div className="strategy-command-rail__head">
              <span className="strategy-kicker">Pit wall controls</span>
              <strong>{scenarioPresets[preset].label}</strong>
              <p>{scenarioPresets[preset].pitch} / {fmtRisk(weatherScenario, safetyCarProbability)}</p>
            </div>
            <div className="strategy-preset-strip">
              {(Object.keys(scenarioPresets) as Array<keyof typeof scenarioPresets>).map((key) => (
                <button key={key} type="button" className={preset === key ? "is-active" : ""} onClick={() => setPreset(key)}>
                  <span>{scenarioPresets[key].pitStopCount} stop</span><strong>{scenarioPresets[key].label}</strong>
                </button>
              ))}
            </div>
            <div className="strategy-command-rail__controls">
              <div className="control-block"><label className="control-label">Race</label><select className="control-select" value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)}>{races.map((race) => <option key={race.id} value={race.id}>{race.season} R{race.round} - {race.raceName}</option>)}</select></div>
              <div className="control-block"><label className="control-label">Target type</label><div className="segmented-row">{(["driver", "constructor"] as const).map((value) => <button key={value} type="button" className={`segment ${targetType === value ? "segment--active" : ""}`} onClick={() => setTargetType(value)}>{value}</button>)}</div></div>
              <div className="control-block"><label className="control-label">Target</label><select className="control-select" value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)} disabled={!raceProduct || targetOptions.length === 0}>{targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label} - {option.meta}</option>)}</select></div>
              <div className="control-block"><label className="control-label">Weather <span>{weatherScenario}</span></label><div className="segmented-row">{(["dry", "mixed", "wet"] as const).map((value) => <button key={value} type="button" className={`segment ${weatherScenario === value ? "segment--active" : ""}`} onClick={() => setWeatherScenario(value)}>{value}</button>)}</div></div>
              <div className="control-block"><label className="control-label">Safety car pressure <span>{Math.round(safetyCarProbability * 100)}%</span></label><input className="control-range" type="range" min={0} max={100} value={Math.round(safetyCarProbability * 100)} onChange={(event) => setSafetyCarProbability(Number(event.target.value) / 100)} /></div>
              <div className="control-block"><label className="control-label">Aggression <span>{aggressionFactor}</span></label><input className="control-range" type="range" min={0} max={100} value={aggressionFactor} onChange={(event) => setAggressionFactor(Number(event.target.value))} /></div>
              <div className="control-block"><label className="control-label">Reliability bias <span>{reliabilityBias > 0 ? `+${reliabilityBias}` : reliabilityBias}</span></label><input className="control-range" type="range" min={-25} max={25} value={reliabilityBias} onChange={(event) => setReliabilityBias(Number(event.target.value))} /></div>
            </div>
            <div className="strategy-command-rail__footer">
              <div><span>Focus</span><strong>{targetLabel}</strong></div>
              <div><span>Data quality</span><strong>{fmtConfidence(raceProduct?.overview.confidenceScore)}</strong></div>
              <button type="button" className="strategy-run-button" onClick={() => void runSimulation()} disabled={loading || simulating || !selectedTargetId}>{simulating ? "Running scenario..." : "Run scenario"}</button>
            </div>
          </StrategyControlRail>

          <div className="strategy-console">
            <StrategyResultStage>
              <div className="strategy-result-stage__lead">
                <span className="strategy-kicker">{simulation ? "Active strategy call" : "Baseline strategy call"}</span>
                <h2>{simulation?.targetSummary?.title ?? raceProduct?.overview.bestStrategyLabel ?? scenarioPresets[preset].label}</h2>
                <p>{simulation?.targetSummary?.narrative ?? bestPrecomputedScenario?.rationale ?? raceProduct?.overview.keyInsight}</p>
              </div>
              <div className="strategy-result-stage__band"><span>Projected band</span><strong>{resultBand}</strong><em>{simulation ? fmtDelta(projectedGain, " positions") : `${scenarioPresets[preset].pitStopCount} planned stops`}</em></div>
              <div className="strategy-call-strip">
                {precomputedScenarios.slice(0, 3).map((scenario, index) => <div key={scenario.code} className={index === 0 ? "is-leading" : ""}><span>{index === 0 ? "Recommended" : `Option ${index + 1}`}</span><strong>{scenario.label}</strong><em>{fmtBand(scenario.low, scenario.high, null)} / {fmtDelta(scenario.delta, "s")}</em></div>)}
                {simulation ? <div className="is-live"><span>Live scenario</span><strong>{targetLabel}</strong><em>{resultBand} / {fmtDelta(projectedGain, " pos")}</em></div> : null}
              </div>
              {error && raceProduct ? <p className="lab-error">{error}</p> : null}
            </StrategyResultStage>

            <StrategyStintLanes>
              <div className="strategy-console-band__head"><div><span className="strategy-kicker">Race shape</span><h3>Stint plan and pit windows</h3></div><strong>{totalLaps} laps</strong></div>
              <div className="strategy-timeline-grid">{baselinePlan.length > 0 ? <StintTimeline label="Baseline race" plan={baselinePlan} totalLaps={totalLaps} /> : null}<StintTimeline label="Active scenario" plan={scenarioPlan} totalLaps={totalLaps} active /></div>
              <div className="strategy-window-strip">
                {targetPitWindows.flatMap((entrant) => entrant.windows.map((window) => (
                  <div key={`${entrant.driverId}-${window.scenarioCode}-${window.stopNumber}`}><span>{entrant.fullName} / Stop {window.stopNumber}</span><strong>Laps {window.windowStartLap ?? "--"}-{window.windowEndLap ?? "--"}</strong><em>{window.compoundOut ?? "Current"} to {window.compoundIn ?? "next"}</em></div>
                )))}
              </div>
            </StrategyStintLanes>

            <StrategyPositionBand>
              <div className="strategy-console-band__head"><div><span className="strategy-kicker">Position transition</span><h3>{simulation ? "Scenario movement" : "Baseline target range"}</h3></div><strong>{targetLabel}</strong></div>
              <div className="strategy-position-lanes">
                {simulation && liveTransitionBands.length > 0 ? liveTransitionBands.map((band) => (
                  <div key={band.driverId} className={`strategy-position-lane strategy-position-lane--${band.transition}`}><span>{band.fullName}</span><div><i /><strong>{band.baselineBand} to {band.projectedBand}</strong></div><em>{band.transition}</em></div>
                )) : targetEntrants.map((entrant) => (
                  <div key={entrant.driverId} className="strategy-position-lane"><span>{entrant.fullName}</span><div><i /><strong>{fmtBand(entrant.finishBandLow, entrant.finishBandHigh, entrant.projectedFinish)}</strong></div><em>baseline</em></div>
                ))}
              </div>
              {simulation ? <div className="strategy-field-order strategy-field-order--rail">{simulation.finishingOrder.slice(0, 8).map((entrant) => <div key={entrant.driverId} className={`strategy-field-order__item ${entrant.isTarget ? "strategy-field-order__item--target" : ""}`}><span>P{entrant.projectedFinish}</span><strong>{entrant.fullName}</strong><em>{entrant.isTarget ? fmtDelta(entrant.finishDelta, " pos") : entrant.constructorName}</em></div>)}</div> : null}
            </StrategyPositionBand>

            <StrategyRiskStrip>
              <article><span>Strategy drivers</span><strong>{targetLabel}</strong>{whyItWorks.slice(0, 3).map((reason) => <p key={reason.label}>{reason.value}</p>)}</article>
              <article><span>Risks</span><strong>{fmtRisk(weatherScenario, safetyCarProbability)}</strong>{caveats.slice(0, 3).map((caveat) => <p key={caveat}>{caveat}</p>)}</article>
              <article className="strategy-risk-strip__assumption"><span>Weakest assumption</span><strong>{simulation?.weakestAssumption.title ?? "Race-week conditions"}</strong><p>{simulation?.weakestAssumption.detail ?? "The baseline remains sensitive to weather, neutralization timing, and incomplete practice evidence."}</p></article>
              {simulation?.topSensitivityDrivers.length ? <article><span>Sensitivity</span><strong>Top modeled factors</strong>{simulation.topSensitivityDrivers.slice(0, 3).map((driver) => <div className="strategy-sensitivity-rail" key={driver.factor}><span>{fmtSensitivity(driver.factor)}</span><i style={{ width: `${Math.min(100, Math.abs(driver.impactS) * 16)}%` }} /><em>{driver.impactS.toFixed(1)}s</em></div>)}</article> : null}
            </StrategyRiskStrip>
          </div>
        </div>
      )}
    </div>
  );
}
