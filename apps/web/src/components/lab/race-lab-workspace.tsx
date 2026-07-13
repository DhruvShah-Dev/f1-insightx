"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { StatePanel } from "@/components/ui/state-panel";
import { AssetImage } from "@/components/ui/asset-image";
import { RaceWeekCircuitVisualization } from "@/components/race-week/race-week-circuit-visualization";
import { getNetworkErrorMessage, readClientErrorMessage } from "@/lib/errors/client";
import type { StrategyLabRaceProduct, StrategyLabRaceSummary } from "@/lib/server/strategy-lab-product";
import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";
import type { RaceSimulationResponse } from "@/lib/server/strategy-lab-simulator";
import { getTeamAsset } from "@/lib/ui/asset-manifest";
import { getRaceWeekCircuitMetadata } from "@/lib/ui/race-week-circuit-metadata";

type StrategyLabResponse = { ok: boolean; data?: { product: StrategyLabRaceProduct; runtime: RuntimeSourceMetadata }; error?: { message: string } };
type SimulationResponse = { ok: boolean; data?: RaceSimulationResponse; error?: { message: string } };
type ValidationResponse = {
  ok: boolean;
  data?: { warnings: string[]; message: string };
  error?: { message: string; details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> } };
};
type Props = {
  races: StrategyLabRaceSummary[];
  trackPaths: Record<string, string | null>;
  initialProduct: StrategyLabRaceProduct | null;
  initialRuntime: RuntimeSourceMetadata | null;
  apiAccessToken?: string | null;
};
type TargetType = "driver" | "constructor";
type WeatherMode = "dry" | "mixed" | "wet";
type Compound = "soft" | "medium" | "hard" | "intermediate" | "wet";
type Stint = { compound: Compound; laps: number };

const compounds: Compound[] = ["soft", "medium", "hard", "intermediate", "wet"];
const dryCompounds = new Set<Compound>(["soft", "medium", "hard"]);
const defaultPressure = { frontPsi: 23, rearPsi: 21 };

const fmtBand = (low?: number | null, high?: number | null, fallback?: number | null) =>
  low && high ? (low === high ? `P${low}` : `P${low}-P${high}`) : fallback ? `P${fallback}` : "Open";
const fmtDelta = (value?: number | null, suffix = "") =>
  value === null || value === undefined ? "Flat" : Math.abs(value) < 0.1 ? `Flat${suffix}` : `${value > 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
const fmtConfidence = (score?: number | null) => (score == null ? "Calibrating" : score >= 0.74 ? "High" : score >= 0.48 ? "Medium" : "Low");
const fmtRisk = (weather: WeatherMode, sc: number) => (weather !== "dry" || sc >= 0.58 ? "High variance" : sc >= 0.38 ? "Moderate variance" : "Controlled");
const fmtSensitivity = (factor: string) => factor.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
const avg = (values: Array<number | null | undefined>) => {
  const cleaned = values.filter((value): value is number => value !== null && value !== undefined);
  return cleaned.length > 0 ? cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length : null;
};

function timelineFromBaseline(entrant: StrategyLabRaceProduct["entrants"][number] | undefined, totalLaps: number): Stint[] {
  if (!entrant) {
    return [{ compound: "medium", laps: Math.floor(totalLaps / 2) }, { compound: "hard", laps: Math.ceil(totalLaps / 2) }];
  }
  const scenario = entrant.scenarios.find((item) => item.scenarioCode === entrant.baselineStrategyCode) ?? entrant.scenarios[0];
  const sequence = (scenario?.compoundSequence ?? "medium / hard").split(" / ").map((item) => {
    const compound = item.trim().toLowerCase() as Compound;
    return compounds.includes(compound) ? compound : "medium";
  });
  const windows = entrant.pitWindows
    .filter((item) => item.scenarioCode === (scenario?.scenarioCode ?? entrant.baselineStrategyCode))
    .sort((a, b) => (a.stopNumber ?? 0) - (b.stopNumber ?? 0));
  if (windows.length === 0) {
    return scalePlan(sequence.map((compound) => ({ compound, laps: Math.floor(totalLaps / sequence.length) })), totalLaps);
  }

  const plan: Stint[] = [];
  let lastStop = 0;
  windows.forEach((window, index) => {
    const stop = Math.max(1, Math.min(totalLaps - 1, Math.round(((window.windowStartLap ?? 1) + (window.windowEndLap ?? 1)) / 2)));
    plan.push({ compound: sequence[index] ?? "medium", laps: Math.max(1, stop - lastStop) });
    lastStop = stop;
  });
  plan.push({ compound: sequence[sequence.length - 1] ?? "hard", laps: Math.max(1, totalLaps - lastStop) });
  return scalePlan(plan, totalLaps);
}

function scalePlan(plan: Stint[], totalLaps: number) {
  const total = plan.reduce((sum, stint) => sum + stint.laps, 0) || totalLaps;
  const scaled = plan.map((stint) => ({ ...stint, laps: Math.max(1, Math.round((stint.laps / total) * totalLaps)) }));
  const used = scaled.reduce((sum, stint) => sum + stint.laps, 0);
  scaled[scaled.length - 1]!.laps += totalLaps - used;
  return scaled;
}

function pitLapsFromPlan(plan: Stint[]) {
  let elapsed = 0;
  return plan.slice(0, -1).map((stint) => {
    elapsed += stint.laps;
    return elapsed;
  });
}

function planStyle(plan: Stint[], totalLaps: number): CSSProperties {
  const template = plan.map((stint) => `${Math.max(1, (stint.laps / Math.max(1, totalLaps)) * 100)}fr`).join(" ");
  return { gridTemplateColumns: template };
}

function StintTimeline({ label, plan, totalLaps, active = false }: { label: string; plan: Stint[]; totalLaps: number; active?: boolean }) {
  const pitLaps = pitLapsFromPlan(plan);
  return (
    <div className={`strategy-timeline ${active ? "strategy-timeline--active" : ""}`}>
      <div className="strategy-timeline__label">
        <span>{label}</span>
        <strong>{plan.length - 1} stop{plan.length - 1 === 1 ? "" : "s"}</strong>
      </div>
      <div className="strategy-timeline__ruler" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((position) => <span key={position}>L{Math.round(totalLaps * position)}</span>)}
      </div>
      <div className="strategy-timeline__track" style={planStyle(plan, totalLaps)}>
        {plan.map((stint, index) => (
          <div key={`${label}-${stint.compound}-${index}`} className={`strategy-timeline__segment strategy-timeline__segment--${stint.compound}`}>
            <span>{stint.compound}</span>
            <strong>{stint.laps} laps</strong>
            {pitLaps[index] ? <i className="strategy-timeline__pit" aria-label={`Pit stop on lap ${pitLaps[index]}`} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildDataQualityNotes(product: StrategyLabRaceProduct | null) {
  if (!product) return ["Strategy product is unavailable."];
  const notes: string[] = [];
  const entrantIds = product.entrants.map((entrant) => entrant.driverId);
  if (new Set(entrantIds).size !== entrantIds.length) notes.push("Duplicate driver rows detected in strategy features.");
  if (product.entrants.some((entrant) => !entrant.strategyFeature.nominalRaceLaps || !entrant.strategyFeature.pitLossS)) {
    notes.push("Some entrants are missing race-distance or pit-loss inputs.");
  }
  if (product.entrants.some((entrant) => entrant.scenarios.some((scenario) => scenario.compoundSequence.split(" / ").some((compound) => !compounds.includes(compound.trim().toLowerCase() as Compound))))) {
    notes.push("One or more scenario compound sequences use unknown tyre values.");
  }
  if (product.entrants.some((entrant) => Object.values(entrant.strategyFeature.compoundProfiles).some((profile) => (profile.degradationSPerLap ?? 0) < 0))) {
    notes.push("Negative tyre degradation values found in compound profiles.");
  }
  if (product.entrants.some((entrant) => entrant.pitWindows.some((window) => {
    const start = window.windowStartLap ?? 0;
    const end = window.windowEndLap ?? 0;
    const total = entrant.strategyFeature.nominalRaceLaps ?? product.overview.nominalRaceLaps ?? 0;
    return start < 1 || end < start || end >= total;
  }))) {
    notes.push("Some pit windows fall outside the race distance.");
  }
  return notes.length ? notes : ["Strategy grain, joins, compounds, pit windows, and degradation inputs look usable."];
}

export function RaceLabWorkspace({ races, trackPaths, initialProduct, initialRuntime, apiAccessToken }: Props) {
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
  const [weatherScenario, setWeatherScenario] = useState<WeatherMode>("dry");
  const [safetyCarProbability, setSafetyCarProbability] = useState(0.35);
  const [aggressionFactor, setAggressionFactor] = useState(62);
  const [reliabilityBias, setReliabilityBias] = useState(0);
  const [tyrePressure, setTyrePressure] = useState(defaultPressure);
  const [stints, setStints] = useState<Stint[]>(() => timelineFromBaseline(initialProduct?.entrants[0], initialProduct?.overview.nominalRaceLaps ?? 57));
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const strategyLabHeaders = useMemo(() => (
    apiAccessToken ? { "x-strategy-lab-access": apiAccessToken } : undefined
  ), [apiAccessToken]);

  useEffect(() => {
    if (!selectedRaceId) return;
    let active = true;
    setLoading(true);
    setError(null);
    setSimulation(null);
    setRuntimeMeta(null);
    void fetch(`/api/strategy-lab/races/${selectedRaceId}`, { cache: "no-store", headers: strategyLabHeaders })
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
        setStints(timelineFromBaseline(payload.data.product.entrants[0], payload.data.product.overview.nominalRaceLaps ?? 57));
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
  }, [reloadKey, selectedRaceId, strategyLabHeaders]);

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
  const baselinePlan = useMemo(() => timelineFromBaseline(representativeEntrant, totalLaps), [representativeEntrant, totalLaps]);
  const activePlan = useMemo(() => scalePlan(stints, totalLaps), [stints, totalLaps]);
  const pitLaps = useMemo(() => pitLapsFromPlan(activePlan), [activePlan]);
  const targetLabel = targetOptions.find((item) => item.id === selectedTargetId)?.label ?? "Select target";
  const team = getTeamAsset(representativeEntrant?.constructorId ?? representativeEntrant?.constructorName);
  const dataQualityNotes = useMemo(() => buildDataQualityNotes(raceProduct), [raceProduct]);

  const scenarioPayload = useMemo(() => ({
    raceId: selectedRaceId,
    driverIds: raceProduct?.entrants.map((entrant) => entrant.driverId) ?? [],
    comparisonTargetType: targetType,
    comparisonTargetId: selectedTargetId,
    constructorFocus: targetType === "constructor" ? [selectedTargetId] : [],
    pitStopCount: Math.max(0, activePlan.length - 1),
    tirePlan: activePlan,
    pitLaps,
    tyrePressure,
    safetyCarProbability,
    weatherScenario,
    aggressionFactor,
    reliabilityBias,
    qualifyingOverrides: [],
  }), [activePlan, aggressionFactor, pitLaps, raceProduct, reliabilityBias, safetyCarProbability, selectedRaceId, selectedTargetId, targetType, tyrePressure, weatherScenario]);

  const localRuleMessages = useMemo(() => {
    const messages: string[] = [];
    const distinctCompounds = new Set(activePlan.map((stint) => stint.compound));
    if (activePlan.length < 2) messages.push("At least one pit stop is required.");
    if (distinctCompounds.size < 2) messages.push("Use at least two tyre compounds.");
    if (weatherScenario === "dry" && activePlan.some((stint) => !dryCompounds.has(stint.compound))) messages.push("Dry mode accepts soft, medium, and hard only.");
    if (activePlan.reduce((sum, stint) => sum + stint.laps, 0) !== totalLaps) messages.push("Stint lengths must equal race distance.");
    return messages;
  }, [activePlan, totalLaps, weatherScenario]);
  const isScenarioValid = localRuleMessages.length === 0 && validationErrors.length === 0 && Boolean(selectedTargetId && raceProduct);

  useEffect(() => {
    if (!raceProduct || !selectedTargetId) return;
    const timeout = window.setTimeout(() => {
      void fetch("/api/race-scenarios/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(strategyLabHeaders ?? {}) },
        body: JSON.stringify(scenarioPayload),
      })
        .then((res) => res.json() as Promise<ValidationResponse>)
        .then((payload) => {
          if (payload.ok && payload.data) {
            setValidationWarnings(payload.data.warnings);
            setValidationErrors([]);
            return;
          }
          const fieldErrors = payload.error?.details?.fieldErrors ?? {};
          setValidationWarnings([]);
          setValidationErrors([
            ...(payload.error?.details?.formErrors ?? []),
            ...Object.values(fieldErrors).flatMap((items) => items ?? []),
            payload.error?.message ?? "Scenario contract is invalid.",
          ]);
        })
        .catch(() => {
          setValidationWarnings([]);
          setValidationErrors(["Scenario validation is temporarily unavailable."]);
        });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [raceProduct, scenarioPayload, selectedTargetId, strategyLabHeaders]);

  function changePitLap(index: number, value: number) {
    setStints((current) => {
      const plan = scalePlan(current, totalLaps);
      const boundaries = [0, ...pitLapsFromPlan(plan), totalLaps];
      const min = boundaries[index]! + 1;
      const max = boundaries[index + 2]! - 1;
      const nextPit = Math.max(min, Math.min(max, value));
      boundaries[index + 1] = nextPit;
      return plan.map((stint, stintIndex) => ({ ...stint, laps: boundaries[stintIndex + 1]! - boundaries[stintIndex]! }));
    });
    setSimulation(null);
  }

  function changeCompound(index: number, compound: Compound) {
    setStints((current) => current.map((stint, stintIndex) => stintIndex === index ? { ...stint, compound } : stint));
    setSimulation(null);
  }

  function addStint() {
    setStints((current) => {
      if (current.length >= 4) return current;
      const plan = scalePlan(current, totalLaps);
      const splitIndex = plan.reduce((best, stint, index) => stint.laps > plan[best]!.laps ? index : best, 0);
      const split = plan[splitIndex]!;
      const first = Math.max(1, Math.floor(split.laps / 2));
      const second = Math.max(1, split.laps - first);
      const nextCompound = (["medium", "hard", "soft"] as Compound[]).find((compound) => compound !== split.compound) ?? "hard";
      return [...plan.slice(0, splitIndex), { ...split, laps: first }, { compound: nextCompound, laps: second }, ...plan.slice(splitIndex + 1)];
    });
    setSimulation(null);
  }

  function setStintCount(stintCount: number) {
    setStints((current) => {
      const targetCount = Math.max(2, Math.min(4, stintCount));
      let plan = scalePlan(current, totalLaps);
      while (plan.length < targetCount) {
        const splitIndex = plan.reduce((best, stint, index) => stint.laps > plan[best]!.laps ? index : best, 0);
        const split = plan[splitIndex]!;
        const first = Math.max(1, Math.floor(split.laps / 2));
        const second = Math.max(1, split.laps - first);
        const nextCompound = (["medium", "hard", "soft"] as Compound[]).find((compound) => compound !== split.compound) ?? "hard";
        plan = [...plan.slice(0, splitIndex), { ...split, laps: first }, { compound: nextCompound, laps: second }, ...plan.slice(splitIndex + 1)];
      }
      while (plan.length > targetCount) {
        const targetIndex = plan.length - 1;
        const target = plan[targetIndex]!;
        const next = plan.slice(0, -1);
        next[next.length - 1] = { ...next[next.length - 1]!, laps: next[next.length - 1]!.laps + target.laps };
        plan = next;
      }
      return scalePlan(plan, totalLaps);
    });
    setSimulation(null);
  }

  function removeStint(index: number) {
    setStints((current) => {
      if (current.length <= 2) return current;
      const plan = scalePlan(current, totalLaps);
      const target = plan[index]!;
      const next = plan.filter((_, stintIndex) => stintIndex !== index);
      const mergeIndex = Math.max(0, index - 1);
      next[mergeIndex] = { ...next[mergeIndex]!, laps: next[mergeIndex]!.laps + target.laps };
      return next;
    });
    setSimulation(null);
  }

  async function runSimulation() {
    if (!isScenarioValid) return;
    setSimulating(true);
    setError(null);
    try {
      const response = await fetch("/api/race-scenarios/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(strategyLabHeaders ?? {}) },
        body: JSON.stringify(scenarioPayload),
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

  const liveTargetEntrants = simulation?.targetSummary?.entrants ?? [];
  const liveTransitionBands = simulation?.positionTransitionBands.filter((band) => liveTargetEntrants.some((entrant) => entrant.driverId === band.driverId)) ?? [];
  const liveFinishBand = liveTargetEntrants.length > 0
    ? { low: Math.min(...liveTargetEntrants.map((entrant) => entrant.projectedFinishBandLow)), high: Math.max(...liveTargetEntrants.map((entrant) => entrant.projectedFinishBandHigh)) }
    : null;
  const projectedGain = avg(liveTargetEntrants.map((entrant) => entrant.finishDelta)) ?? simulation?.targetSummary?.averageFinishDelta ?? null;
  const resultBand = liveFinishBand ? fmtBand(liveFinishBand.low, liveFinishBand.high, liveFinishBand.low) : fmtBand(representativeEntrant?.finishBandLow, representativeEntrant?.finishBandHigh, representativeEntrant?.projectedFinish);
  const heroStyle = {
    "--strategy-team-primary": team.primary,
    "--strategy-team-secondary": team.secondary,
    "--strategy-team-accent": team.accent,
  } as CSSProperties;

  return (
    <div className="strategy-free-roam" style={heroStyle}>
      <header className="strategy-race-hero strategy-race-hero--free">
        {team.carImagePath ? (
          <AssetImage
            src={team.carImagePath}
            fallbackSrc={team.fallbackImagePath}
            alt=""
            className="strategy-race-hero__car"
            fill
            priority
            sizes="100vw"
            style={{ objectFit: team.imageFit ?? "cover", objectPosition: team.imagePosition }}
          />
        ) : null}
        <div className="strategy-race-hero__copy">
          <span className="strategy-kicker">Strategy Lab</span>
          <h1>{selectedRace?.raceName ?? "Strategy Lab"}</h1>
          <p className="strategy-race-hero__date">{selectedRaceDateLabel} {selectedRace ? `/ Round ${selectedRace.round}` : ""}</p>
          <p className="strategy-race-hero__insight">{raceProduct?.overview.keyInsight ?? "Build a race strategy from pit laps, compound choice, and tyre-pressure setup."}</p>
          <div className="strategy-race-hero__metrics">
            <div><span>Race distance</span><strong>{totalLaps} laps</strong></div>
            <div><span>Pit-loss anchor</span><strong>{(raceProduct?.overview.pitLossEstimateS ?? 22).toFixed(1)}s</strong></div>
            <div><span>Confidence</span><strong>{fmtConfidence(raceProduct?.overview.confidenceScore)}</strong></div>
            <div><span>Mode</span><strong>{fmtRisk(weatherScenario, safetyCarProbability)}</strong></div>
          </div>
          <ProductRuntimeNote runtime={runtimeMeta} className="strategy-race-hero__runtime" primaryLabel="Strategy data" degradedLabel="Backup data source" />
        </div>
        <div className="strategy-race-hero__track">
          {selectedRace && trackPaths[selectedRace.circuitId] ? (
            <RaceWeekCircuitVisualization title={selectedRace.raceName} trackPath={trackPaths[selectedRace.circuitId]!} metadata={getRaceWeekCircuitMetadata(selectedRace.circuitId)} />
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
        <div className="strategy-workbench strategy-workbench--free">
          <aside className="strategy-command-rail strategy-command-rail--free" aria-label="Strategy scenario controls">
            <div className="strategy-command-rail__head">
              <span className="strategy-kicker">Pit wall controls</span>
              <strong>{targetLabel}</strong>
              <p>{activePlan.length - 1} stops / {pitLaps.map((lap) => `L${lap}`).join(", ") || "No stops"}</p>
            </div>

            <div className="strategy-command-rail__sections">
              <section className="strategy-control-section" aria-labelledby="strategy-situation-heading">
                <div className="strategy-control-section__head">
                  <span className="strategy-control-section__number">1</span>
                  <div>
                    <h2 id="strategy-situation-heading">Situation</h2>
                    <p>Track, weather, target, and safety-car context.</p>
                  </div>
                </div>
                <div className="strategy-command-rail__controls">
                  <div className="control-block"><label className="control-label">Track</label><select className="control-select" value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)}>{races.map((race) => <option key={race.id} value={race.id}>{race.season} R{race.round} - {race.raceName}</option>)}</select></div>
                  <div className="control-block"><label className="control-label">Weather <span>{weatherScenario}</span></label><div className="segmented-row">{(["dry", "mixed", "wet"] as const).map((value) => <button key={value} type="button" className={`segment ${weatherScenario === value ? "segment--active" : ""}`} onClick={() => setWeatherScenario(value)}>{value}</button>)}</div></div>
                  <div className="control-block"><label className="control-label">Target type</label><div className="segmented-row">{(["driver", "constructor"] as const).map((value) => <button key={value} type="button" className={`segment ${targetType === value ? "segment--active" : ""}`} onClick={() => setTargetType(value)}>{value}</button>)}</div></div>
                  <div className="control-block"><label className="control-label">Driver / constructor</label><select className="control-select" value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)} disabled={!raceProduct || targetOptions.length === 0}>{targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label} - {option.meta}</option>)}</select></div>
                  <div className="control-block"><label className="control-label">Safety car <span>{Math.round(safetyCarProbability * 100)}%</span></label><input className="control-range" type="range" min={0} max={100} value={Math.round(safetyCarProbability * 100)} onChange={(event) => setSafetyCarProbability(Number(event.target.value) / 100)} /></div>
                </div>
              </section>

              <section className="strategy-control-section" aria-labelledby="strategy-options-heading">
                <div className="strategy-control-section__head">
                  <span className="strategy-control-section__number">2</span>
                  <div>
                    <h2 id="strategy-options-heading">Strategy options</h2>
                    <p>Stints, aggression, reliability, and tyre pressures.</p>
                  </div>
                </div>
                <div className="strategy-command-rail__controls">
                  <div className="control-block"><label className="control-label">Stints <span>{activePlan.length}</span></label><div className="segmented-row">{[2, 3, 4].map((value) => <button key={value} type="button" className={`segment ${activePlan.length === value ? "segment--active" : ""}`} onClick={() => setStintCount(value)}>{value}</button>)}</div></div>
                  <div className="control-block"><label className="control-label">Aggression <span>{aggressionFactor}</span></label><input className="control-range" type="range" min={0} max={100} value={aggressionFactor} onChange={(event) => setAggressionFactor(Number(event.target.value))} /></div>
                  <div className="control-block"><label className="control-label">Reliability <span>{reliabilityBias > 0 ? `+${reliabilityBias}` : reliabilityBias}</span></label><input className="control-range" type="range" min={-25} max={25} value={reliabilityBias} onChange={(event) => setReliabilityBias(Number(event.target.value))} /></div>
                  <div className="control-block"><label className="control-label">Front pressure <span>{tyrePressure.frontPsi.toFixed(1)} psi</span></label><input className="control-range" type="range" min={18} max={30} step={0.1} value={tyrePressure.frontPsi} onChange={(event) => setTyrePressure((current) => ({ ...current, frontPsi: Number(event.target.value) }))} /></div>
                  <div className="control-block"><label className="control-label">Rear pressure <span>{tyrePressure.rearPsi.toFixed(1)} psi</span></label><input className="control-range" type="range" min={18} max={30} step={0.1} value={tyrePressure.rearPsi} onChange={(event) => setTyrePressure((current) => ({ ...current, rearPsi: Number(event.target.value) }))} /></div>
                </div>
              </section>
            </div>

            <div className={`strategy-rule-panel ${isScenarioValid ? "strategy-rule-panel--valid" : "strategy-rule-panel--invalid"}`}>
              <span>Scenario rules</span>
              <strong>{isScenarioValid ? "Ready to run" : "Needs attention"}</strong>
              {[...localRuleMessages, ...validationErrors].slice(0, 4).map((message) => <p key={message}>{message}</p>)}
              {isScenarioValid ? <p>{new Set(activePlan.map((stint) => stint.compound)).size} compounds / {activePlan.reduce((sum, stint) => sum + stint.laps, 0)} laps / {activePlan.length - 1} stops</p> : null}
              {validationWarnings.slice(0, 3).map((warning) => <p key={warning}>{warning}</p>)}
            </div>

            <button type="button" className="strategy-run-button" onClick={() => void runSimulation()} disabled={loading || simulating || !isScenarioValid}>
              {simulating ? "Running scenario..." : "Run scenario"}
            </button>
          </aside>

          <div className="strategy-console strategy-console--free">
            <section className="strategy-result-stage" aria-label="Strategy result">
              <div className="strategy-result-stage__lead">
                <span className="strategy-kicker">{simulation ? "Active strategy call" : "Free-roam setup"}</span>
                <h2>{simulation?.targetSummary?.title ?? `${targetLabel} race plan`}</h2>
                <p>{simulation?.targetSummary?.narrative ?? "Adjust compounds, pit laps, and pressure before committing a strategy run."}</p>
              </div>
              <div className="strategy-result-stage__band"><span>Projected band</span><strong>{resultBand}</strong><em>{simulation ? fmtDelta(projectedGain, " positions") : `${activePlan.length - 1} planned stops`}</em></div>
              {error && raceProduct ? <p className="lab-error">{error}</p> : null}
            </section>

            <section className="strategy-console-band strategy-console-band--stints">
              <div className="strategy-console-band__head"><div><span className="strategy-kicker">Race shape</span><h3>Tyre plan and pit laps</h3></div><strong>{totalLaps} laps</strong></div>
              <div className="strategy-timeline-grid">
                {baselinePlan.length > 0 ? <StintTimeline label="Baseline race" plan={baselinePlan} totalLaps={totalLaps} /> : null}
                <StintTimeline label="Active scenario" plan={activePlan} totalLaps={totalLaps} active />
              </div>
              <div className="strategy-stint-editor">
                {activePlan.map((stint, index) => {
                  const previousPit = index === 0 ? 0 : pitLaps[index - 1]!;
                  const nextPit = index >= pitLaps.length ? totalLaps : pitLaps[index]!;
                  return (
                    <article className={`strategy-stint-card strategy-stint-card--${stint.compound}`} key={`${index}-${stint.compound}`}>
                      <div><span>Stint {index + 1}</span><strong>{stint.laps} laps</strong><em>L{previousPit + 1}-L{nextPit}</em></div>
                      <select className="control-select" value={stint.compound} onChange={(event) => changeCompound(index, event.target.value as Compound)}>
                        {compounds.map((compound) => <option key={compound} value={compound}>{compound}</option>)}
                      </select>
                      {index < pitLaps.length ? (
                        <label className="strategy-stint-card__pit">
                          <span>Pit lap <strong>{pitLaps[index]}</strong></span>
                          <input className="control-range" type="range" min={(pitLaps[index - 1] ?? 0) + 1} max={(pitLaps[index + 1] ?? totalLaps) - 1} value={pitLaps[index]} onChange={(event) => changePitLap(index, Number(event.target.value))} />
                        </label>
                      ) : null}
                      {activePlan.length > 2 ? <button type="button" onClick={() => removeStint(index)}>Remove</button> : null}
                    </article>
                  );
                })}
              </div>
              <div className="strategy-pit-lap-editor">
                <button type="button" onClick={addStint} disabled={activePlan.length >= 4}>Add stint</button>
              </div>
            </section>

            <section className="strategy-console-band strategy-console-band--position">
              <div className="strategy-console-band__head"><div><span className="strategy-kicker">Position transition</span><h3>{simulation ? "Scenario movement" : "Baseline target range"}</h3></div><strong>{targetLabel}</strong></div>
              <div className="strategy-position-lanes">
                {simulation && liveTransitionBands.length > 0 ? liveTransitionBands.map((band) => (
                  <div key={band.driverId} className={`strategy-position-lane strategy-position-lane--${band.transition}`}><span>{band.fullName}</span><div><i /><strong>{band.baselineBand} to {band.projectedBand}</strong></div><em>{band.transition}</em></div>
                )) : targetEntrants.map((entrant) => (
                  <div key={entrant.driverId} className="strategy-position-lane"><span>{entrant.fullName}</span><div><i /><strong>{fmtBand(entrant.finishBandLow, entrant.finishBandHigh, entrant.projectedFinish)}</strong></div><em>baseline</em></div>
                ))}
              </div>
              {simulation ? <div className="strategy-field-order strategy-field-order--rail">{simulation.finishingOrder.slice(0, 8).map((entrant) => <div key={entrant.driverId} className={`strategy-field-order__item ${entrant.isTarget ? "strategy-field-order__item--target" : ""}`}><span>P{entrant.projectedFinish}</span><strong>{entrant.fullName}</strong><em>{entrant.isTarget ? fmtDelta(entrant.finishDelta, " pos") : entrant.constructorName}</em></div>)}</div> : null}
            </section>

            <section className="strategy-risk-strip">
              <article><span>Tyre pressure</span><strong>{tyrePressure.frontPsi.toFixed(1)}F / {tyrePressure.rearPsi.toFixed(1)}R</strong><p>Pressure changes affect warmup, degradation, and rejoin stability.</p></article>
              <article><span>Risks</span><strong>{fmtRisk(weatherScenario, safetyCarProbability)}</strong><p>{simulation?.confidenceReason ?? "Risk updates after a scenario run."}</p></article>
              <article className="strategy-risk-strip__assumption"><span>Weakest assumption</span><strong>{simulation?.weakestAssumption.title ?? "Race-week conditions"}</strong><p>{simulation?.weakestAssumption.detail ?? "The setup remains sensitive to weather, neutralization timing, tyre pressure, and incomplete practice evidence."}</p></article>
              <article><span>Data quality</span><strong>{dataQualityNotes[0]}</strong>{dataQualityNotes.slice(1, 4).map((note) => <p key={note}>{note}</p>)}</article>
              {simulation?.topSensitivityDrivers.length ? <article><span>Sensitivity</span><strong>Top modeled factors</strong>{simulation.topSensitivityDrivers.slice(0, 3).map((driver) => <div className="strategy-sensitivity-rail" key={driver.factor}><span>{fmtSensitivity(driver.factor)}</span><i style={{ width: `${Math.min(100, Math.abs(driver.impactS) * 16)}%` }} /><em>{driver.impactS.toFixed(1)}s</em></div>)}</article> : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
