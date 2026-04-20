"use client";

import { useEffect, useMemo, useState } from "react";
import { TeamBadge } from "@/components/ui/team-badge";
import { ProductRuntimeNote } from "@/components/ui/product-runtime-note";
import { StatePanel } from "@/components/ui/state-panel";
import { TrackLayoutCard } from "@/components/ui/track-layout-card";
import { getNetworkErrorMessage, readClientErrorMessage } from "@/lib/errors/client";
import type { StrategyLabRaceProduct, StrategyLabRaceSummary } from "@/lib/server/strategy-lab-product";
import type { RuntimeSourceMetadata } from "@/lib/server/runtime-source";
import type { RaceSimulationResponse } from "@/lib/server/strategy-lab-simulator";

type StrategyLabResponse = { ok: boolean; data?: { product: StrategyLabRaceProduct; runtime: RuntimeSourceMetadata }; error?: { message: string } };
type SimulationResponse = { ok: boolean; data?: RaceSimulationResponse; error?: { message: string } };
type Props = { races: StrategyLabRaceSummary[] };
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
const fmtOddsProxy = (value?: number | null) => (value == null ? "n/a" : `${Math.round(value / 5) * 5}%`); 
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
      <div className="strategy-timeline__track">
        {plan.map((stint, index) => (
          <div key={`${label}-${stint.compound}-${index}`} className={`strategy-timeline__segment strategy-timeline__segment--${stint.compound}`} style={{ width: `${(stint.laps / Math.max(totalLaps, 1)) * 100}%` }}>
            <span>{stint.compound}</span><strong>{stint.laps}</strong>
          </div>
        ))}
      </div>
    </div>
  );
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

export function RaceLabWorkspace({ races }: Props) {
  const [selectedRaceId, setSelectedRaceId] = useState(races[0]?.id ?? "");
  const [raceProduct, setRaceProduct] = useState<StrategyLabRaceProduct | null>(null);
  const [runtimeMeta, setRuntimeMeta] = useState<RuntimeSourceMetadata | null>(null);
  const [simulation, setSimulation] = useState<RaceSimulationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [targetType, setTargetType] = useState<TargetType>("driver");
  const [selectedTargetId, setSelectedTargetId] = useState("");
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
    const avgConfidence = entrants.reduce((sum, entrant) => sum + (entrant.confidenceScore ?? 0.5), 0) / entrants.length;
    return [
      { label: "Race difficulty", value: raceProduct?.overview.raceDifficulty ?? "Balanced" },
      { label: "Baseline call", value: raceProduct?.overview.bestStrategyLabel ?? "Balanced" },
      { label: "Pit-loss anchor", value: `${(raceProduct?.overview.pitLossEstimateS ?? 22).toFixed(1)}s` },
      { label: "Signal strength", value: `${Math.round(avgConfidence * 100)}%` },
    ];
  }, [raceProduct]);

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

  return (
    <div className="lab-layout lab-layout--strategy">
      <section className="strategy-lab-surface">
        <div className="strategy-lab-hero">
          <div className="strategy-lab-hero__media">{selectedRace ? <TrackLayoutCard circuitId={selectedRace.circuitId} title={selectedRace.raceName} showSource={false} showMeta={false} /> : null}</div>
          <div className="strategy-lab-hero__body">
            <div className="section-meta">Strategy Lab</div>
            <h2 className="strategy-lab-hero__title">{selectedRace?.raceName ?? "Strategy Lab"}</h2>
            <p className="strategy-lab-hero__lede">{selectedRaceDateLabel} {selectedRaceDateLabel ? "|" : ""} scenario the race before lights out.</p>
            <p className="lab-copy">{raceProduct?.overview.keyInsight ?? "Compare one race call against the field baseline and surface the most likely strategic swing."}</p>
            <ProductRuntimeNote runtime={runtimeMeta} className="strategy-lab-hero__runtime" primaryLabel="Primary Strategy Lab race view" degradedLabel="Fallback Strategy Lab race snapshot" />
            <div className="strategy-lab-overview">{setupStats.map((item) => <div key={item.label} className="strategy-lab-overview__item"><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
          </div>
        </div>

        {error && !raceProduct && !loading ? (
          <StatePanel eyebrow="Strategy Lab" title="The Strategy Lab could not load this weekend." message={error} tone="error" action={(<button type="button" className="hero__cta hero__cta--secondary" onClick={() => setReloadKey((current) => current + 1)}>Retry context</button>)} />
        ) : null}

        <section className="strategy-lab-section">
          <div className="strategy-lab-section__header"><div className="section-meta">1. Scenario setup</div><h3>Start with the race shape, then aim it at one target.</h3><p className="lab-copy">Choose the scenario first. The target and conditions come after.</p></div>
          <div className="strategy-scenario-grid">
            {(Object.keys(scenarioPresets) as Array<keyof typeof scenarioPresets>).map((key) => (
              <button key={key} type="button" className={`strategy-scenario-card ${preset === key ? "strategy-scenario-card--active" : ""}`} onClick={() => setPreset(key)}>
                <span>{scenarioPresets[key].pitch}</span><strong>{scenarioPresets[key].label}</strong><p>{scenarioPresets[key].pitStopCount} planned stop{scenarioPresets[key].pitStopCount === 1 ? "" : "s"} with a {scenarioPresets[key].pitch.toLowerCase()} bias.</p>
              </button>
            ))}
          </div>
          <div className="strategy-config-grid">
            <div className="strategy-config-main">
              <div className="lab-grid-two lab-grid-two--top">
                <div className="control-block control-block--tight"><label className="control-label">Race</label><select className="control-select" value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)}>{races.map((race) => <option key={race.id} value={race.id}>{race.season} R{race.round} | {race.raceName}</option>)}</select></div>
                <div className="control-block control-block--tight"><label className="control-label">Target type</label><div className="segmented-row">{(["driver", "constructor"] as const).map((value) => <button key={value} type="button" className={`segment ${targetType === value ? "segment--active" : ""}`} onClick={() => setTargetType(value)}>{value}</button>)}</div></div>
              </div>
              <div className="lab-grid-two">
                <div className="control-block"><label className="control-label">Target</label><select className="control-select" value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)} disabled={!raceProduct || targetOptions.length === 0}>{targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label} | {option.meta}</option>)}</select></div>
                <div className="strategy-target-note"><span>Scenario focus</span><strong>{targetOptions.find((item) => item.id === selectedTargetId)?.label ?? "Select a target"}</strong><p>{targetType === "constructor" ? "Both cars inherit the scenario while the field stays on the baseline strategy." : "Only the selected driver changes strategy. The field remains stable."}</p></div>
              </div>
              <div className="strategy-adjustments">
                <div className="control-block"><label className="control-label">Weather <span>{weatherScenario}</span></label><div className="segmented-row">{(["dry", "mixed", "wet"] as const).map((value) => <button key={value} type="button" className={`segment ${weatherScenario === value ? "segment--active" : ""}`} onClick={() => setWeatherScenario(value)}>{value}</button>)}</div></div>
                <div className="control-block"><label className="control-label">Safety car pressure <span>{Math.round(safetyCarProbability * 100)}%</span></label><input className="control-range" type="range" min={0} max={100} value={Math.round(safetyCarProbability * 100)} onChange={(event) => setSafetyCarProbability(Number(event.target.value) / 100)} /></div>
                <div className="control-block"><label className="control-label">Aggression <span>{aggressionFactor}</span></label><input className="control-range" type="range" min={0} max={100} value={aggressionFactor} onChange={(event) => setAggressionFactor(Number(event.target.value))} /></div>
                <div className="control-block"><label className="control-label">Reliability bias <span>{reliabilityBias > 0 ? `+${reliabilityBias}` : reliabilityBias}</span></label><input className="control-range" type="range" min={-25} max={25} value={reliabilityBias} onChange={(event) => setReliabilityBias(Number(event.target.value))} /></div>
              </div>
            </div>
            <aside className="strategy-setup-rail">
              <div className="strategy-setup-rail__header"><span>Scenario brief</span><strong>{scenarioPresets[preset].label}</strong></div>
              <p className="lab-copy">{scenarioPresets[preset].pitch} with {fmtRisk(weatherScenario, safetyCarProbability).toLowerCase()}.</p>
              {representativeEntrant ? (
                <div className="strategy-setup-rail__focus">
                  <div>
                    <span>Focus target</span>
                    <strong>{representativeEntrant.fullName}</strong>
                    <p>{fmtBand(representativeEntrant.finishBandLow, representativeEntrant.finishBandHigh, representativeEntrant.projectedFinish)} baseline band</p>
                  </div>
                  <TeamBadge teamId={representativeEntrant.constructorId} label={representativeEntrant.constructorName} compact />
                </div>
              ) : null}
              {bestPrecomputedScenario ? (
                <div className="strategy-setup-rail__focus strategy-setup-rail__focus--recommendation">
                  <div>
                    <span>Current recommendation</span>
                    <strong>{raceProduct?.overview.bestStrategyLabel ?? bestPrecomputedScenario.label}</strong>
                    <p>{bestPrecomputedScenario.rationale}</p>
                  </div>
                </div>
              ) : null}
              <div className="strategy-setup-rail__stats"><div><span>Confidence</span><strong>{fmtConfidence(raceProduct?.overview.confidenceScore)}</strong></div><div><span>Risk</span><strong>{fmtRisk(weatherScenario, safetyCarProbability)}</strong></div><div><span>Pit shape</span><strong>{scenarioPresets[preset].pitStopCount} stop{scenarioPresets[preset].pitStopCount === 1 ? "" : "s"}</strong></div></div>
              <button type="button" className="hero__cta hero__cta--primary" onClick={() => void runSimulation()} disabled={loading || simulating || !selectedTargetId}>{simulating ? "Running scenario" : "Run scenario"}</button>
            </aside>
          </div>
          <div className="strategy-timeline-grid">{baselinePlan.length > 0 ? <StintTimeline label="Baseline race" plan={baselinePlan} totalLaps={totalLaps} /> : null}<StintTimeline label="Scenario preview" plan={scenarioPlan} totalLaps={totalLaps} active /></div>
        </section>

        <section className="strategy-lab-section">
          <div className="strategy-lab-section__header"><div className="section-meta">2. Strategy comparison</div><h3>Read the likely finish range before you commit.</h3><p className="lab-copy">These cards surface ranking, finish band, and confidence instead of raw timing totals.</p></div>
          <div className="strategy-comparison-grid">
            {simulation?.targetSummary ? <article className="strategy-comparison-card strategy-comparison-card--live"><span>Live simulation</span><strong>{selectedTargetId ? targetOptions.find((item) => item.id === selectedTargetId)?.label : "Scenario"}</strong><div className="strategy-comparison-card__band">{liveFinishBand ? fmtBand(liveFinishBand.low, liveFinishBand.high, liveFinishBand.low) : "Open range"}</div><p>{simulation.targetSummary.narrative}</p><div className="strategy-comparison-card__meta"><span>{simulation.confidence}</span><strong>{fmtDelta(projectedGain, " pos vs baseline")}</strong></div></article> : null}
            {bestPrecomputedScenario ? <article className="strategy-comparison-card strategy-comparison-card--recommended"><span>Recommended baseline</span><strong>{raceProduct?.overview.bestStrategyLabel ?? bestPrecomputedScenario.label}</strong><div className="strategy-comparison-card__band">{fmtBand(bestPrecomputedScenario.low, bestPrecomputedScenario.high, null)}</div><p>{bestPrecomputedScenario.rationale}</p><div className="strategy-comparison-card__meta"><span>{fmtConfidence(bestPrecomputedScenario.confidence)}</span><strong>{fmtDelta(bestPrecomputedScenario.delta, "s vs baseline")}</strong></div></article> : null}
            {precomputedScenarios.slice(0, 2).map((scenario) => <article key={scenario.code} className="strategy-comparison-card"><span>{scenario.rank === 1 ? "Top precomputed call" : "Alternative"}</span><strong>{scenario.label}</strong><div className="strategy-comparison-card__band">{fmtBand(scenario.low, scenario.high, null)}</div><p>{scenario.rationale}</p><div className="strategy-comparison-card__meta"><span>{fmtConfidence(scenario.confidence)}</span><strong>{fmtDelta(scenario.delta, "s vs baseline")}</strong></div></article>)}
          </div>
        </section>

        <section className="strategy-lab-section">
          <div className="strategy-lab-section__header"><div className="section-meta">3. Race projection</div><h3>Translate the scenario into a race outcome.</h3></div>
          <div className="strategy-projection-grid">
            {targetEntrants.map((entrant) => <article key={entrant.driverId} className="strategy-projection-card"><div className="strategy-projection-card__head"><div><span className="section-meta">Projection</span><h4>{entrant.fullName}</h4></div><TeamBadge teamId={entrant.constructorId} label={entrant.constructorName} compact /></div><div className="strategy-projection-card__metrics"><div><span>Baseline range</span><strong>{fmtBand(entrant.finishBandLow, entrant.finishBandHigh, entrant.projectedFinish)}</strong></div><div><span>Podium odds proxy</span><strong>{fmtOddsProxy(entrant.podiumProbability)}</strong></div><div><span>Win odds proxy</span><strong>{fmtOddsProxy(entrant.winProbability)}</strong></div><div><span>Confidence</span><strong>{fmtConfidence(entrant.confidenceScore)}</strong></div></div><p className="lab-copy">{simulation?.targetSummary?.entrants.find((item) => item.driverId === entrant.driverId)?.explanationSummary ?? `${entrant.fullName} starts from a ${fmtBand(entrant.finishBandLow, entrant.finishBandHigh, entrant.projectedFinish)} baseline before the scenario moves the race shape.`}</p></article>)}
            {simulation ? <article className="strategy-projection-card strategy-projection-card--field"><div className="strategy-projection-card__head"><div><span className="section-meta">Field read</span><h4>Projected order</h4></div></div><div className="strategy-field-order">{simulation.finishingOrder.slice(0, 8).map((entrant) => <div key={entrant.driverId} className={`strategy-field-order__item ${entrant.isTarget ? "strategy-field-order__item--target" : ""}`}><span>P{entrant.projectedFinish}</span><strong>{entrant.fullName}</strong><em>{entrant.isTarget ? fmtDelta(entrant.finishDelta, " pos") : entrant.constructorName}</em></div>)}</div></article> : null}
          </div>
        </section>

        <section className="strategy-lab-section">
          <div className="strategy-lab-section__header"><div className="section-meta">4. Pit windows and stint timeline</div><h3>Make the race shape readable at a glance.</h3><p className="lab-copy">Pit windows and compounds should feel like race choreography, not hidden configuration.</p></div>
          <div className="strategy-pit-grid">
            <div className="strategy-pit-grid__timelines">
              {baselinePlan.length > 0 ? <StintTimeline label="Baseline race" plan={baselinePlan} totalLaps={totalLaps} /> : null}
              <StintTimeline label="Scenario preview" plan={scenarioPlan} totalLaps={totalLaps} active />
            </div>
            <div className="strategy-pit-grid__windows">
              {targetPitWindows.map((entrant) => (
                <article key={entrant.driverId} className="strategy-pit-window-card">
                  <div className="strategy-pit-window-card__head">
                    <div>
                      <span className="section-meta">Pit window</span>
                      <strong>{entrant.fullName}</strong>
                    </div>
                    <TeamBadge teamId={entrant.constructorId} label={entrant.constructorName} compact />
                  </div>
                  <div className="strategy-pit-window-list">
                    {entrant.windows.length > 0 ? entrant.windows.map((window) => (
                      <div key={`${entrant.driverId}-${window.scenarioCode}-${window.stopNumber}`} className="strategy-pit-window-list__item">
                        <span>Stop {window.stopNumber}</span>
                        <strong>Laps {window.windowStartLap ?? "--"}-{window.windowEndLap ?? "--"}</strong>
                        <p>{window.compoundOut ?? "Current"} to {window.compoundIn ?? "next compound"}</p>
                      </div>
                    )) : <p className="lab-copy">No precomputed pit window is available for this target yet.</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="strategy-lab-section strategy-lab-section--final">
          <div className="strategy-lab-section__header"><div className="section-meta">5. Why this strategy works</div><h3>Explain the scenario in race language, not simulator language.</h3></div>
          <div className="strategy-explanation-grid">
            <article className="strategy-explanation-card"><span>Why this works</span><strong>{targetOptions.find((item) => item.id === selectedTargetId)?.label ?? "Target"}</strong><div className="strategy-reason-list">{whyItWorks.map((reason) => <div key={reason.label} className="strategy-reason-list__item"><span>{reason.label}</span><p>{reason.value}</p></div>)}</div></article>
            <article className="strategy-explanation-card"><span>Scenario narrative</span><strong>{scenarioPresets[preset].label}</strong><p className="lab-copy">{simulation?.undercutNarrative ?? `${scenarioPresets[preset].label} pushes the race toward ${preset === "aggressive" ? "undercut pressure and earlier movement." : preset === "conservative" ? "long-run control and reduced pit-lane exposure." : "the default strategic balance."}`}</p>{error && raceProduct ? <p className="lab-error">{error}</p> : null}</article>
          </div>
        </section>

        <section className="strategy-lab-section">
          <div className="strategy-lab-section__header"><div className="section-meta">6. Confidence and caveats</div><h3>Keep the recommendation transparent.</h3><p className="lab-copy">The strongest call is only useful if the user can see what makes it robust and what can still break it.</p></div>
          <div className="strategy-caveat-grid">
            <article className="strategy-explanation-card">
              <span>Confidence</span>
              <strong>{simulation?.confidence ? `${simulation.confidence} confidence` : fmtConfidence(raceProduct?.overview.confidenceScore)}</strong>
              <p className="lab-copy">{simulation?.confidenceReason ?? "Confidence is anchored to the precomputed race-week priors, signal completeness, and agreement across strategy features."}</p>
              {simulation?.modelMeta ? <p className="lab-copy">Engine {simulation.modelMeta.simulatorVersion} · templates {simulation.modelMeta.scenarioTemplateVersion}{simulation.modelMeta.featureBuildVersion ? ` · feature build ${simulation.modelMeta.featureBuildVersion}` : ""}</p> : null}
            </article>
            <article className="strategy-explanation-card">
              <span>Caveats</span>
              <strong>{fmtRisk(weatherScenario, safetyCarProbability)}</strong>
              <div className="strategy-reason-list">
                {caveats.map((caveat) => <div key={caveat} className="strategy-reason-list__item"><p>{caveat}</p></div>)}
              </div>
            </article>
          </div>
        </section>
      </section>
    </div>
  );
}
