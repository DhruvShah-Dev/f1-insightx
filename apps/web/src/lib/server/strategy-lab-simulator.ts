import type { z } from "zod";
import { raceScenarioSchema } from "@/lib/api/validation";
import type { StrategyLabRaceProduct } from "@/lib/server/strategy-lab-product";
import { roundTo } from "@/lib/server/utils";

type RaceScenarioInput = z.infer<typeof raceScenarioSchema>;
type ConfidenceLabel = "high" | "medium" | "low";
type ComparisonTargetType = NonNullable<RaceScenarioInput["comparisonTargetType"]>;

type ComparisonTarget = {
  type: ComparisonTargetType;
  id: string;
  label: string;
  entrantIds: string[];
};

type SimulatedEntrant = {
  driverId: string;
  fullName: string;
  constructorId: string;
  constructorName: string;
  qualifyingPosition: number;
  projectedFinish: number;
  finishBandLow: number;
  finishBandHigh: number;
  projectedPoints: number;
  podiumProbability: number;
  confidence: ConfidenceLabel;
  undercutImpact: number;
  totalRaceTimeS: number;
  score: number;
  explanation: string[];
  sensitivity: Record<string, number>;
};

type TargetOutcomeEntrant = {
  driverId: string;
  fullName: string;
  constructorId: string;
  constructorName: string;
  qualifyingPosition: number;
  baselineFinish: number;
  projectedFinish: number;
  projectedFinishBandLow: number;
  projectedFinishBandHigh: number;
  finishDelta: number;
  baselinePoints: number;
  projectedPoints: number;
  pointsDelta: number;
  podiumProbability: number;
  undercutImpact: number;
  confidence: ConfidenceLabel;
  explanationSummary: string;
};

type SensitivityDriver = { factor: string; impactS: number; explanation: string };

export type RaceSimulationResponse = {
  raceId: string;
  raceName: string;
  comparisonTarget: {
    type: ComparisonTargetType;
    id: string;
    label: string;
    entrantCount: number;
  } | null;
  scenarioSummary: {
    fieldSize: number;
    selectedDrivers: number;
    weatherScenario: RaceScenarioInput["weatherScenario"];
    pitStopCount: number;
    safetyCarProbability: number;
    aggressionFactor: number;
    reliabilityBias: number;
    baselineMode: string;
  };
  confidence: ConfidenceLabel;
  confidenceReason: string;
  weakestAssumption: {
    factor: string;
    title: string;
    detail: string;
  };
  whatChangedOutcome: {
    headline: string;
    drivers: string[];
  };
  undercutNarrative: string;
  modelMeta: {
    simulatorVersion: string;
    scenarioTemplateVersion: string;
    featureBuildVersion: string | null;
    productBuildVersion: string | null;
    assumptions: string[];
  };
  targetSummary: {
    title: string;
    narrative: string;
    averageFinishDelta: number;
    aggregatePointsDelta: number;
    entrants: TargetOutcomeEntrant[];
  } | null;
  sensitivity: SensitivityDriver[];
  topSensitivityDrivers: SensitivityDriver[];
  positionTransitionBands: Array<{
    driverId: string;
    fullName: string;
    constructorName: string;
    baselineBand: string;
    projectedBand: string;
    transition: "gain" | "loss" | "stable";
    finishDelta: number;
    confidence: ConfidenceLabel;
  }>;
  finishingOrder: Array<
    SimulatedEntrant & {
      baselineFinish: number;
      finishDelta: number;
      baselinePoints: number;
      pointsDelta: number;
      isTarget: boolean;
    }
  >;
};

const POINTS_BY_POSITION: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

const STRATEGY_LAB_SIMULATOR_VERSION = "strategy_lab_sim_v2";
const STRATEGY_LAB_SCENARIO_TEMPLATE_VERSION = "strategy_templates_v1";
const DEFAULT_FUEL_CORRECTION_S_PER_LAP = 0.035;

const WEATHER_EFFECTS = {
  dry: {
    paceOffsetS: 0,
    degradationMultiplier: 1,
    pitLossOffsetS: 0,
    trafficPenaltyMultiplier: 1,
    compoundPenalty: { soft: 0, medium: 0, hard: 0, intermediate: 0.8, wet: 1.4 },
  },
  mixed: {
    paceOffsetS: 3.2,
    degradationMultiplier: 1.12,
    pitLossOffsetS: 0.9,
    trafficPenaltyMultiplier: 1.12,
    compoundPenalty: { soft: 0.85, medium: 0.45, hard: 0.2, intermediate: -0.4, wet: 0.35 },
  },
  wet: {
    paceOffsetS: 7.1,
    degradationMultiplier: 1.04,
    pitLossOffsetS: 1.8,
    trafficPenaltyMultiplier: 1.2,
    compoundPenalty: { soft: 1.8, medium: 1.05, hard: 0.7, intermediate: -0.6, wet: -1.1 },
  },
} as const;

export function fuelCorrectionS(globalLap: number, totalLaps: number, coefficient = DEFAULT_FUEL_CORRECTION_S_PER_LAP) {
  const remainingFuelLaps = Math.max(0, totalLaps - globalLap);
  const midpointFuelLaps = totalLaps / 2;
  return (remainingFuelLaps - midpointFuelLaps) * coefficient;
}

function tyreWarmupPenalty(compound: string, stintLap: number, trackTempC: number | null, weatherScenario: RaceScenarioInput["weatherScenario"]) {
  const base = compound === "hard" ? 0.32 : compound === "medium" ? 0.18 : 0.1;
  const coldTrack = trackTempC !== null && trackTempC < 28 ? 0.08 : 0;
  const wetPenalty = weatherScenario === "wet" ? 0.18 : weatherScenario === "mixed" ? 0.08 : 0;
  return stintLap <= 1 ? base + coldTrack + wetPenalty : stintLap === 2 ? (base + wetPenalty) * 0.42 : 0;
}

export function nonlinearTyreLossS(
  compound: string,
  stintLap: number,
  stintLaps: number,
  linearDegradationSPerLap: number,
  tyreManagementScore: number,
) {
  const phase = stintLap / Math.max(stintLaps, 1);
  const warmupRelief = stintLap <= 2 ? -0.35 : 0;
  const plateauMultiplier = phase < 0.45 ? 0.55 : phase < 0.78 ? 1.0 : 1.35;
  const cliffThreshold = compound === "soft" ? 0.82 : compound === "medium" ? 0.88 : 0.93;
  const cliffRisk = phase > cliffThreshold ? Math.pow((phase - cliffThreshold) / Math.max(1 - cliffThreshold, 0.01), 2) : 0;
  const managementRelief = 1.08 - tyreManagementScore * 0.2;
  return Math.max(0, (stintLap - 1) * linearDegradationSPerLap * (plateauMultiplier + warmupRelief) * managementRelief + cliffRisk * linearDegradationSPerLap * 8);
}

export function pitLossComponents(params: {
  basePitLossS: number;
  tyreAgeLaps: number;
  outCompound: string;
  trafficSensitivityScore: number;
  trackTempC: number | null;
  weatherScenario: RaceScenarioInput["weatherScenario"];
}) {
  const stationaryLossS = Math.max(2.2, params.basePitLossS * 0.12);
  const pitLaneBaselineS = Math.max(14, params.basePitLossS - stationaryLossS);
  const inLapTyreAgeLossS = Math.max(0, params.tyreAgeLaps - 16) * 0.018;
  const outLapWarmupLossS = tyreWarmupPenalty(params.outCompound, 1, params.trackTempC, params.weatherScenario);
  const rejoinTrafficPenaltyS = params.trafficSensitivityScore * 0.35;
  return { pitLaneBaselineS, stationaryLossS, inLapTyreAgeLossS, outLapWarmupLossS, rejoinTrafficPenaltyS };
}

export function trafficLossS(params: {
  gridPosition: number;
  racecraftScore: number;
  trafficSensitivityScore: number;
  overtakeDifficulty: number;
  paceAdvantageS: number;
}) {
  const followRisk = Math.max(0, params.gridPosition - 6) * 0.065 * params.overtakeDifficulty;
  const trappedBehind = params.paceAdvantageS < 0.45 ? 0.55 - params.paceAdvantageS : 0;
  return Math.max(0, (followRisk + trappedBehind) * params.trafficSensitivityScore * (1 - params.racecraftScore * 0.36));
}

function energyProxyAdjustmentS(season: number, energyDeploymentProxyScore: number | null, lapShare: number, proxyConfidence = 0.35) {
  if (season < 2026 || energyDeploymentProxyScore === null) {
    return 0;
  }
  return -(energyDeploymentProxyScore - 0.5) * (0.08 * proxyConfidence + 0.02) * lapShare;
}

function sensitivityExplanation(factor: string, entrant: StrategyLabRaceProduct["entrants"][number]) {
  switch (factor) {
    case "straight_line_strength":
      return (entrant.strategyFeature.straightLineStrength ?? 0.5) >= 0.55
        ? "Straight-line telemetry strength reduced overtaking and defending risk."
        : "Limited straight-line telemetry strength increased traffic exposure.";
    case "tyre_stress_proxy":
      return "Tyre-stress proxy adjusted degradation and finish-band confidence without replacing stint data.";
    case "track_position_sensitivity":
      return "Track-position archetype weighting changed traffic and rejoin penalties.";
    case "energy_proxy_confidence":
      return "Energy deployment is a speed-shape proxy only; lower confidence damped 2026 attack-mode effects.";
    case "traffic":
      return "Traffic penalty came from rejoin risk, overtaking attack score, and track-position sensitivity.";
    case "pit_loss":
      return "Pit-loss decomposition combined pit lane, stationary, in-lap, out-lap, and rejoin components.";
    case "weather":
      return "Weather grip hook adjusted pace and compound suitability using bounded scenario assumptions.";
    case "fuel_correction":
      return "Fuel correction separated fuel-burn lap improvement from tyre degradation.";
    case "tyre_degradation":
      return "Non-linear tyre phases produced warmup, plateau, degradation, and cliff-risk losses.";
    default:
      return "Bounded deterministic modifier from Strategy Lab inputs.";
  }
}

function sensitivityLabel(factor: string) {
  switch (factor) {
    case "tyre_degradation":
      return "Tyre degradation";
    case "traffic":
      return "Traffic and overtaking";
    case "pit_loss":
      return "Pit-loss model";
    case "weather":
      return "Weather grip";
    case "fuel_correction":
      return "Fuel correction";
    case "energy_proxy":
      return "Energy deployment proxy";
    case "straight_line_strength":
      return "Straight-line telemetry strength";
    case "tyre_stress_proxy":
      return "Tyre-stress proxy";
    case "track_position_sensitivity":
      return "Track-position sensitivity";
    case "energy_proxy_confidence":
      return "Energy proxy confidence";
    default:
      return factor.replaceAll("_", " ");
  }
}

function resolveComparisonTarget(
  input: RaceScenarioInput,
  entrants: StrategyLabRaceProduct["entrants"],
): ComparisonTarget | null {
  if (input.comparisonTargetType === "driver" && input.comparisonTargetId) {
    const entrant = entrants.find((candidate) => candidate.driverId === input.comparisonTargetId);
    if (!entrant) return null;
    return { type: "driver", id: entrant.driverId, label: entrant.fullName, entrantIds: [entrant.driverId] };
  }
  if (input.comparisonTargetType === "constructor" && input.comparisonTargetId) {
    const constructorEntrants = entrants.filter((candidate) => candidate.constructorId === input.comparisonTargetId);
    if (constructorEntrants.length === 0) return null;
    return {
      type: "constructor",
      id: input.comparisonTargetId,
      label: constructorEntrants[0]?.constructorName ?? input.comparisonTargetId,
      entrantIds: constructorEntrants.map((entrant) => entrant.driverId),
    };
  }
  if (input.constructorFocus.length === 1) {
    const constructorEntrants = entrants.filter((candidate) => candidate.constructorId === input.constructorFocus[0]);
    if (constructorEntrants.length > 0) {
      return {
        type: "constructor",
        id: input.constructorFocus[0],
        label: constructorEntrants[0]?.constructorName ?? input.constructorFocus[0],
        entrantIds: constructorEntrants.map((entrant) => entrant.driverId),
      };
    }
  }
  if (input.driverIds.length === 1) {
    const entrant = entrants.find((candidate) => candidate.driverId === input.driverIds[0]);
    if (entrant) {
      return { type: "driver", id: entrant.driverId, label: entrant.fullName, entrantIds: [entrant.driverId] };
    }
  }
  return null;
}

function clamp01(value: number | null | undefined, fallback = 0.5) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 0.66) return "high";
  if (score >= 0.42) return "medium";
  return "low";
}

function formatPositionBand(low: number, high: number) {
  return low === high ? `P${low}` : `P${low}-P${high}`;
}

function buildPositionTransitionBands(finishingOrder: RaceSimulationResponse["finishingOrder"]): RaceSimulationResponse["positionTransitionBands"] {
  return finishingOrder.map((entrant) => {
    const baselineLow = Math.max(1, Math.min(entrant.baselineFinish, entrant.finishBandLow));
    const baselineHigh = Math.max(baselineLow, Math.max(entrant.baselineFinish, entrant.finishBandHigh));
    return {
      driverId: entrant.driverId,
      fullName: entrant.fullName,
      constructorName: entrant.constructorName,
      baselineBand: formatPositionBand(baselineLow, baselineHigh),
      projectedBand: formatPositionBand(entrant.finishBandLow, entrant.finishBandHigh),
      transition: entrant.finishDelta > 0.25 ? "gain" : entrant.finishDelta < -0.25 ? "loss" : "stable",
      finishDelta: entrant.finishDelta,
      confidence: entrant.confidence,
    };
  });
}

function buildWeakestAssumption(
  input: Pick<RaceScenarioInput, "weatherScenario" | "safetyCarProbability" | "aggressionFactor" | "reliabilityBias">,
  entrants: StrategyLabRaceProduct["entrants"],
  confidenceScore: number,
): RaceSimulationResponse["weakestAssumption"] {
  const averageTelemetryConfidence =
    entrants.reduce((sum, entrant) => sum + clamp01(entrant.strategyFeature.telemetryProxyConfidence, 0.35), 0) / Math.max(entrants.length, 1);
  const averageTrackPositionSensitivity =
    entrants.reduce((sum, entrant) => sum + clamp01(entrant.strategyFeature.trackPositionSensitivityScore, 0.5), 0) / Math.max(entrants.length, 1);

  if (input.weatherScenario !== "dry") {
    return {
      factor: "weather",
      title: "Weather state is coarse",
      detail: "Mixed and wet running use bounded grip, compound, and pit-loss adjustments rather than a full wet-track evolution model.",
    };
  }

  if (input.safetyCarProbability >= 0.55) {
    return {
      factor: "safety_car",
      title: "Neutralization timing is not simulated",
      detail: "Safety-car pressure changes confidence and pit timing risk, but the model does not simulate exact interruption laps.",
    };
  }

  if (averageTelemetryConfidence < 0.55) {
    return {
      factor: "telemetry_proxy_confidence",
      title: "Telemetry proxy confidence is limited",
      detail: "Telemetry-derived strengths are used as bounded modifiers, so low proxy confidence should widen how the result is read.",
    };
  }

  if (averageTrackPositionSensitivity >= 0.72) {
    return {
      factor: "track_position_sensitivity",
      title: "Traffic timing is approximate",
      detail: "Track-position weighting affects rejoin and overtaking penalties, but exact car spacing is not simulated lap by lap.",
    };
  }

  if (Math.abs(input.aggressionFactor - 50) >= 28 || Math.abs(input.reliabilityBias) >= 18) {
    return {
      factor: "driver_mode",
      title: "Driver mode is a scenario control",
      detail: "Aggression and reliability bias are deterministic stress controls, not measured race intent.",
    };
  }

  if (confidenceScore < 0.5) {
    return {
      factor: "product_confidence",
      title: "Product signal is still building",
      detail: "The recommendation leans more heavily on priors when Strategy Lab product confidence is low.",
    };
  }

  return {
    factor: "pit_loss",
    title: "Rejoin timing is simplified",
    detail: "Pit loss is decomposed and track-aware, but exact rejoin gaps and lap-by-lap traffic trains remain approximations.",
  };
}

function buildConfidenceReason(
  label: ConfidenceLabel,
  input: Pick<RaceScenarioInput, "weatherScenario" | "safetyCarProbability" | "aggressionFactor" | "reliabilityBias">,
  weakestAssumption: RaceSimulationResponse["weakestAssumption"],
) {
  const varianceNotes = [
    input.weatherScenario !== "dry" ? "non-dry grip" : null,
    input.safetyCarProbability >= 0.55 ? "high neutralization pressure" : null,
    Math.abs(input.aggressionFactor - 50) >= 28 ? "aggressive driver-mode stress" : null,
    Math.abs(input.reliabilityBias) >= 18 ? "reliability-mode stress" : null,
  ].filter((item): item is string => item !== null);
  const varianceText = varianceNotes.length > 0 ? ` Main variance comes from ${varianceNotes.join(", ")}.` : "";
  return `${label[0].toUpperCase()}${label.slice(1)} scenario confidence means the finish bands are usable for relative strategy comparison, not exact finishing prediction.${varianceText} Weakest assumption: ${weakestAssumption.title.toLowerCase()}.`;
}

function buildWhatChangedOutcome(
  targetSummary: RaceSimulationResponse["targetSummary"],
  topSensitivityDrivers: SensitivityDriver[],
  weakestAssumption: RaceSimulationResponse["weakestAssumption"],
): RaceSimulationResponse["whatChangedOutcome"] {
  const headline = targetSummary
    ? targetSummary.narrative
    : "The scenario changed the field through bounded pace, tyre, pit-loss, and traffic modifiers.";
  const drivers = topSensitivityDrivers.map((driver) => `${sensitivityLabel(driver.factor)} moved the race by about ${driver.impactS.toFixed(1)}s on average: ${driver.explanation}`);
  drivers.push(`Read with care: ${weakestAssumption.detail}`);
  return { headline, drivers: drivers.slice(0, 4) };
}

function clampRange(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToNearest(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

function weatherCompoundAdjustment(
  weatherScenario: RaceScenarioInput["weatherScenario"],
  compound: string,
) {
  const penalties = WEATHER_EFFECTS[weatherScenario].compoundPenalty;
  return penalties[compound as keyof typeof penalties] ?? 0;
}

function describeWeatherMode(weatherScenario: RaceScenarioInput["weatherScenario"]) {
  if (weatherScenario === "mixed") {
    return "Mixed conditions slow the field, stretch pit-loss assumptions, and punish soft compounds more heavily.";
  }
  if (weatherScenario === "wet") {
    return "Wet conditions slow the field sharply and shrink the confidence in aggressive dry-compound calls.";
  }
  return "Dry running keeps the scenario close to the calibrated baseline.";
}

function normalizeTirePlan(totalLaps: number, tirePlan: RaceScenarioInput["tirePlan"]) {
  if (tirePlan.length === 0) {
    return [{ compound: "medium", laps: totalLaps }];
  }
  const plannedLaps = tirePlan.reduce((sum, stint) => sum + stint.laps, 0);
  const scale = plannedLaps > 0 ? totalLaps / plannedLaps : 1;
  const normalized = tirePlan.map((stint, index) => ({
    compound: stint.compound,
    laps: Math.max(1, Math.round(stint.laps * scale + (index === tirePlan.length - 1 ? totalLaps - Math.round(plannedLaps * scale) : 0))),
  }));
  const currentTotal = normalized.reduce((sum, stint) => sum + stint.laps, 0);
  normalized[normalized.length - 1]!.laps += totalLaps - currentTotal;
  return normalized;
}

function buildBaselinePlan(entrant: StrategyLabRaceProduct["entrants"][number]) {
  const windows = entrant.pitWindows
    .filter((item) => item.scenarioCode === (entrant.baselineStrategyCode ?? entrant.scenarios[0]?.scenarioCode))
    .sort((a, b) => (a.stopNumber ?? 0) - (b.stopNumber ?? 0));
  const matchingScenario =
    entrant.scenarios.find((scenario) => scenario.scenarioCode === (entrant.baselineStrategyCode ?? "")) ??
    entrant.scenarios[0];
  const compounds = (matchingScenario?.compoundSequence ?? "medium / hard").split(" / ");
  const totalLaps = entrant.strategyFeature.nominalRaceLaps ?? 57;
  if (windows.length === 0) {
    const equalLaps = Math.floor(totalLaps / compounds.length);
    return compounds.map((compound, index) => ({
      compound,
      laps: index === compounds.length - 1 ? totalLaps - equalLaps * (compounds.length - 1) : equalLaps,
    }));
  }
  let previousStop = 0;
  const plan = windows.map((window, index) => {
    const stopLap = Math.round(((window.windowStartLap ?? 1) + (window.windowEndLap ?? 1)) / 2);
    const laps = Math.max(1, stopLap - previousStop);
    previousStop = stopLap;
    return {
      compound: compounds[index] ?? "medium",
      laps,
    };
  });
  plan.push({
    compound: compounds[compounds.length - 1] ?? "hard",
    laps: Math.max(1, totalLaps - previousStop),
  });
  return plan;
}

function gridAdjustment(position: number, racecraftScore: number) {
  return (position - 10.5) * 0.16 - racecraftScore * 0.32;
}

function compoundProfile(
  entrant: StrategyLabRaceProduct["entrants"][number],
  compound: string,
) {
  switch (compound) {
    case "soft":
      return entrant.strategyFeature.compoundProfiles.soft;
    case "hard":
      return entrant.strategyFeature.compoundProfiles.hard;
    case "medium":
    default:
      return entrant.strategyFeature.compoundProfiles.medium;
  }
}

function simulateEntrant(
  entrant: StrategyLabRaceProduct["entrants"][number],
  plan: Array<{ compound: string; laps: number }>,
  input: Pick<RaceScenarioInput, "weatherScenario" | "safetyCarProbability" | "aggressionFactor" | "reliabilityBias">,
  targetApplied: boolean,
  qualifyingOverrides: Map<string, number>,
  raceSeason: number,
) {
  const totalLaps = entrant.strategyFeature.nominalRaceLaps ?? 57;
  const weather = WEATHER_EFFECTS[input.weatherScenario];
  const scenarioAggression = clamp01(input.aggressionFactor / 100, 0.5);
  const reliabilityMode = targetApplied ? clampRange(input.reliabilityBias / 25, -1, 1) : 0;
  const driverAggression = clamp01(entrant.driverProfile.aggressiveTendencyScore, 0.5);
  const effectiveAggression = targetApplied
    ? clamp01(driverAggression * 0.55 + scenarioAggression * 0.45, 0.5)
    : driverAggression;
  const operationalRobustness = clamp01(
    (entrant.constructorProfile.strategySuccessProxy ?? 0.5) * 0.45 +
      (entrant.constructorProfile.pitEfficiencyScore ?? 0.5) * 0.3 +
      (entrant.confidenceScore ?? 0.5) * 0.25,
    0.5,
  );
  const baseRacePaceS =
    (entrant.strategyFeature.baseRacePaceS ?? 90) +
    weather.paceOffsetS +
    Math.max(0, reliabilityMode) * 0.12;
  const paceEvolution = entrant.strategyFeature.paceEvolutionSPerLap ?? 0.018;
  const fuelCoefficient = entrant.strategyFeature.fuelCorrectionSPerLap ?? DEFAULT_FUEL_CORRECTION_S_PER_LAP;
  const overtakingAttack = clamp01(entrant.strategyFeature.overtakingAttackScore, 0.5);
  const defendingStrength = clamp01(entrant.strategyFeature.defendingStrengthScore, 0.5);
  const tyreStress = clamp01(entrant.strategyFeature.tyreStressProxy, 0.5);
  const undercutSuitability = clamp01(entrant.strategyFeature.undercutSuitabilityScore, 0.5);
  const trackPositionSensitivity = clamp01(entrant.strategyFeature.trackPositionSensitivityScore, 0.5);
  const telemetryProxyConfidence = clamp01(entrant.strategyFeature.telemetryProxyConfidence, 0.35);
  const trafficSensitivity = clamp01((entrant.strategyFeature.trafficSensitivityScore ?? 0.55) * 0.65 + trackPositionSensitivity * 0.25 + (1 - overtakingAttack) * 0.1, 0.55);
  const weatherSensitivity = clamp01(entrant.strategyFeature.weatherGripSensitivityScore, 0.5);
  const energyProxy = entrant.strategyFeature.energyDeploymentProxyScore;
  const trackTempC = null;
  const pitLoss =
    (entrant.strategyFeature.pitLossS ?? 22) +
    (entrant.constructorProfile.pitLossAdjustmentS ?? 0) +
    weather.pitLossOffsetS +
    Math.max(0, -reliabilityMode) * 0.45;
  const tyreManagement = clamp01(entrant.driverProfile.tyreManagementScore, 0.5);
  const racecraft = clamp01(entrant.driverProfile.racecraftProxyScore, 0.5);
  const gridPosition = qualifyingOverrides.get(entrant.driverId) ?? entrant.projectedFinish ?? 10;

  let totalRaceTimeS = 0;
  let globalLap = 0;
  const explanation: string[] = [];
  let degradationAccumulator = 0;
  const sensitivity: Record<string, number> = {
    tyre_degradation: 0,
    traffic: 0,
    pit_loss: 0,
    weather: 0,
    fuel_correction: 0,
    energy_proxy: 0,
    straight_line_strength: 0,
    tyre_stress_proxy: 0,
    track_position_sensitivity: 0,
    energy_proxy_confidence: 0,
  };

  for (let stintIndex = 0; stintIndex < plan.length; stintIndex += 1) {
    const stint = plan[stintIndex]!;
    const profile = compoundProfile(entrant, stint.compound);
    const baseDelta = (profile.deltaS ?? 0) + weatherCompoundAdjustment(input.weatherScenario, stint.compound);
    const degradation = Math.max(
      0.01,
      (profile.degradationSPerLap ?? 0.06) *
        weather.degradationMultiplier *
        (1.04 + (effectiveAggression - 0.5) * 0.28 - reliabilityMode * 0.12) *
        (1.08 - tyreManagement * 0.18) *
        (0.94 + tyreStress * 0.16),
    );
    degradationAccumulator += degradation;
    for (let lap = 1; lap <= stint.laps; lap += 1) {
      globalLap += 1;
      const fuelOffset = fuelCorrectionS(globalLap, totalLaps, fuelCoefficient);
      const paceDrift = globalLap * paceEvolution * (1 - effectiveAggression * 0.08);
      const attackOffset = targetApplied ? -(effectiveAggression - 0.5) * 0.26 + Math.min(0, reliabilityMode) * 0.14 : 0;
      const warmupPenalty = tyreWarmupPenalty(stint.compound, lap, trackTempC, input.weatherScenario);
      const tyreLoss = nonlinearTyreLossS(stint.compound, lap, stint.laps, degradation, tyreManagement);
      const energyAdjustment = energyProxyAdjustmentS(raceSeason, energyProxy ?? null, lap / Math.max(stint.laps, 1), telemetryProxyConfidence);
      const weatherGripLoss = input.weatherScenario === "dry" ? 0 : weatherSensitivity * (input.weatherScenario === "wet" ? 0.18 : 0.08);
      sensitivity.fuel_correction += Math.abs(fuelOffset);
      sensitivity.tyre_degradation += tyreLoss;
      sensitivity.weather += Math.abs(weatherGripLoss + weather.paceOffsetS / totalLaps);
      sensitivity.energy_proxy += Math.abs(energyAdjustment);
      sensitivity.tyre_stress_proxy += tyreStress * degradation * 0.08;
      sensitivity.energy_proxy_confidence += raceSeason >= 2026 ? (1 - telemetryProxyConfidence) * 0.01 : 0;
      totalRaceTimeS += baseRacePaceS + baseDelta + fuelOffset + paceDrift + attackOffset + warmupPenalty + tyreLoss + weatherGripLoss + energyAdjustment;
    }
    if (stintIndex < plan.length - 1) {
      const nextCompound = plan[stintIndex + 1]?.compound ?? "medium";
      const pitParts = pitLossComponents({
        basePitLossS: pitLoss - effectiveAggression * 0.35 + input.safetyCarProbability * 1.5,
        tyreAgeLaps: stint.laps,
        outCompound: nextCompound,
        trafficSensitivityScore: trafficSensitivity * (1.08 - undercutSuitability * 0.12),
        trackTempC,
        weatherScenario: input.weatherScenario,
      });
      const decomposedPitLoss = Object.values(pitParts).reduce((sum, value) => sum + value, 0);
      sensitivity.pit_loss += decomposedPitLoss;
      sensitivity.traffic += pitParts.rejoinTrafficPenaltyS;
      sensitivity.track_position_sensitivity += pitParts.rejoinTrafficPenaltyS * trackPositionSensitivity;
      totalRaceTimeS += Math.max(16, decomposedPitLoss);
    }
  }

  const trafficPenalty =
    trafficLossS({
      gridPosition,
      racecraftScore: racecraft,
      trafficSensitivityScore: trafficSensitivity * (1.04 - defendingStrength * 0.08),
      overtakeDifficulty: weather.trafficPenaltyMultiplier,
      paceAdvantageS: Math.max(0, (entrant.strategyFeature.baseRacePaceS ?? 90) - baseRacePaceS + effectiveAggression * 0.2 + overtakingAttack * 0.18),
    }) *
    (1 - (effectiveAggression - 0.5) * 0.16);
  const operationalPenalty =
    Math.max(0, -reliabilityMode) * (2.2 - operationalRobustness * 1.1) +
    Math.max(0, reliabilityMode) * 0.35;
  totalRaceTimeS += gridAdjustment(gridPosition, racecraft) + trafficPenalty + operationalPenalty;
  sensitivity.traffic += trafficPenalty;
  sensitivity.straight_line_strength += Math.max(0, (0.58 - clamp01(entrant.strategyFeature.straightLineStrength, 0.5))) * trafficPenalty;
  sensitivity.track_position_sensitivity += trafficPenalty * trackPositionSensitivity;
  const undercutImpact = roundTo((plan.length - 1) * 1.8 + effectiveAggression * 2.6 + input.safetyCarProbability * 3.1, 1);
  explanation.push(
    `${entrant.fullName} opens from P${gridPosition} with ${plan.length - 1} planned stops and a projected pit-loss baseline of ${pitLoss.toFixed(1)}s.`,
  );
  const reliabilityModeLabel = !targetApplied
    ? "baseline"
    : input.reliabilityBias > 0
      ? "safer"
      : input.reliabilityBias < 0
        ? "risk-on"
        : "neutral";
  explanation.push(
    `${describeWeatherMode(input.weatherScenario)} Aggression ${Math.round(effectiveAggression * 100)} and reliability mode ${reliabilityModeLabel} drive the pace-versus-tyre tradeoff in this run.`,
  );
  explanation.push(
    `Tyre management ${tyreManagement.toFixed(2)}, tyre-stress proxy ${tyreStress.toFixed(2)}, and an average degradation load of ${(degradationAccumulator / Math.max(plan.length, 1)).toFixed(3)}s/lap set the stability of the stint model.`,
  );
  explanation.push(
    `Track archetype ${entrant.strategyFeature.trackArchetype ?? "mixed"} applies bounded weights for straight-line strength ${clamp01(entrant.strategyFeature.straightLineStrength, 0.5).toFixed(2)}, traffic sensitivity ${trafficSensitivity.toFixed(2)}, and undercut suitability ${undercutSuitability.toFixed(2)}.`,
  );
  if (raceSeason >= 2026) {
    explanation.push("2026 energy behavior is treated only as a speed-shape deployment proxy, not true ERS or battery state.");
  }

  return {
    driverId: entrant.driverId,
    fullName: entrant.fullName,
    constructorId: entrant.constructorId,
    constructorName: entrant.constructorName,
    qualifyingPosition: gridPosition,
    undercutImpact,
    totalRaceTimeS: roundTo(totalRaceTimeS, 1),
    score: -roundTo(totalRaceTimeS, 1),
    averageStintDegradationS: roundTo(degradationAccumulator / Math.max(plan.length, 1), 3),
    explanation,
    sensitivity,
  };
}

function estimatePodiumProbability(index: number, confidenceScore: number | null) {
  const confidence = clamp01(confidenceScore, 0.35);
  return roundToNearest(Math.max(5, Math.min(85, 82 - index * 14 - (1 - confidence) * 20)), 5);
}

function estimateFinishBand(
  projectedFinish: number,
  fieldSize: number,
  confidenceScore: number | null,
  input: Pick<RaceScenarioInput, "weatherScenario" | "safetyCarProbability" | "aggressionFactor" | "reliabilityBias">,
  isTarget: boolean,
) {
  const confidence = clamp01(confidenceScore, 0.35);
  const span =
    1 +
    (confidence < 0.55 ? 1 : 0) +
    (input.weatherScenario !== "dry" ? 1 : 0) +
    (input.safetyCarProbability >= 0.55 ? 1 : 0) +
    (isTarget && (input.aggressionFactor >= 70 || input.aggressionFactor <= 35) ? 1 : 0) +
    (isTarget && Math.abs(input.reliabilityBias) >= 15 ? 1 : 0);

  return {
    low: Math.max(1, projectedFinish - span),
    high: Math.min(fieldSize, projectedFinish + span),
  };
}

function buildTargetSummary(
  finishingOrder: RaceSimulationResponse["finishingOrder"],
  target: ComparisonTarget | null,
): RaceSimulationResponse["targetSummary"] {
  if (!target) return null;
  const targetEntrants = finishingOrder.filter((entrant) => entrant.isTarget);
  if (targetEntrants.length === 0) return null;

  const averageFinishDelta = roundTo(targetEntrants.reduce((sum, entrant) => sum + entrant.finishDelta, 0) / targetEntrants.length, 2);
  const aggregatePointsDelta = roundTo(targetEntrants.reduce((sum, entrant) => sum + entrant.pointsDelta, 0), 1);

  return {
    title: `${target.label} strategy delta`,
    narrative:
      averageFinishDelta > 0
        ? `${target.label} gains an average of ${averageFinishDelta.toFixed(1)} places against the baseline field.`
        : averageFinishDelta < 0
          ? `${target.label} gives away ${Math.abs(averageFinishDelta).toFixed(1)} places against the baseline field.`
          : `${target.label} stays close to the baseline finish profile.`,
    averageFinishDelta,
    aggregatePointsDelta,
    entrants: targetEntrants.map((entrant) => ({
      driverId: entrant.driverId,
      fullName: entrant.fullName,
      constructorId: entrant.constructorId,
      constructorName: entrant.constructorName,
      qualifyingPosition: entrant.qualifyingPosition,
      baselineFinish: entrant.baselineFinish,
      projectedFinish: entrant.projectedFinish,
      projectedFinishBandLow: entrant.finishBandLow,
      projectedFinishBandHigh: entrant.finishBandHigh,
      finishDelta: entrant.finishDelta,
      baselinePoints: entrant.baselinePoints,
      projectedPoints: entrant.projectedPoints,
      pointsDelta: entrant.pointsDelta,
      podiumProbability: entrant.podiumProbability,
      undercutImpact: entrant.undercutImpact,
      confidence: entrant.confidence,
      explanationSummary: entrant.explanation.at(-1) ?? entrant.explanation[0] ?? "",
    })),
  };
}

export function simulateRaceScenario(
  input: RaceScenarioInput,
  product: StrategyLabRaceProduct,
): RaceSimulationResponse {
  const entrantMap = new Map(product.entrants.map((entrant) => [entrant.driverId, entrant]));
  const entrants = input.driverIds
    .map((driverId) => entrantMap.get(driverId))
    .filter((entrant): entrant is StrategyLabRaceProduct["entrants"][number] => entrant !== undefined);
  const qualifyingOverrides = new Map(input.qualifyingOverrides.map((item) => [item.driverId, item.position]));
  const target = resolveComparisonTarget(input, entrants);

  const baselineField = entrants
    .map((entrant) => ({
      entrant,
      sim: simulateEntrant(
        entrant,
        buildBaselinePlan(entrant),
        { weatherScenario: input.weatherScenario, safetyCarProbability: input.safetyCarProbability, aggressionFactor: 50, reliabilityBias: 0 },
        false,
        qualifyingOverrides,
        product.race.season,
      ),
    }))
    .sort((left, right) => left.sim.totalRaceTimeS - right.sim.totalRaceTimeS);

  const comparisonPlan = normalizeTirePlan(
    product.overview.nominalRaceLaps ?? product.entrants[0]?.strategyFeature.nominalRaceLaps ?? 57,
    input.tirePlan,
  );

  const comparisonField = entrants
    .map((entrant) => {
      const isTarget = target?.entrantIds.includes(entrant.driverId) ?? false;
      const plan = isTarget ? comparisonPlan : buildBaselinePlan(entrant);
      return {
        entrant,
        sim: simulateEntrant(
          entrant,
          plan,
          input,
          isTarget,
          qualifyingOverrides,
          product.race.season,
        ),
      };
    })
    .sort((left, right) => left.sim.totalRaceTimeS - right.sim.totalRaceTimeS);

  const baselineMap = new Map(
    baselineField.map((row, index) => [
      row.sim.driverId,
      {
        ...row.sim,
        projectedFinish: index + 1,
        projectedPoints: POINTS_BY_POSITION[index + 1] ?? 0,
      },
    ]),
  );

  const confidenceScore =
    clamp01(product.overview.confidenceScore, 0.3) * 0.5 +
    clamp01(
      entrants.reduce((sum, entrant) => sum + (entrant.confidenceScore ?? 0.3), 0) / Math.max(entrants.length, 1),
      0.3,
    ) * 0.35 +
    clamp01(
      1 -
        Math.abs(input.pitStopCount - 2) * 0.15 -
        (input.weatherScenario === "dry" ? 0 : 0.18) -
        (Math.abs(input.reliabilityBias) >= 15 ? 0.06 : 0) -
        (Math.abs(input.aggressionFactor - 50) >= 25 ? 0.06 : 0),
      0.25,
    ) * 0.15;

  const finishingOrder = comparisonField.map((row, index) => {
    const projectedFinish = index + 1;
    const baseline = baselineMap.get(row.sim.driverId)!;
    const isTarget = target?.entrantIds.includes(row.sim.driverId) ?? false;
    const confidence = confidenceLabel(confidenceScore * 0.65 + clamp01(row.entrant.confidenceScore, 0.3) * 0.35);
    const finishBand = estimateFinishBand(projectedFinish, comparisonField.length, row.entrant.confidenceScore, input, isTarget);
    return {
      ...row.sim,
      projectedFinish,
      finishBandLow: finishBand.low,
      finishBandHigh: finishBand.high,
      projectedPoints: POINTS_BY_POSITION[projectedFinish] ?? 0,
      podiumProbability: estimatePodiumProbability(index, row.entrant.confidenceScore),
      confidence,
      baselineFinish: baseline.projectedFinish,
      finishDelta: baseline.projectedFinish - projectedFinish,
      baselinePoints: baseline.projectedPoints,
      pointsDelta: (POINTS_BY_POSITION[projectedFinish] ?? 0) - baseline.projectedPoints,
      isTarget,
    };
  });

  const sensitivity = Object.entries(
    finishingOrder.reduce<Record<string, number>>((acc, entrant) => {
      for (const [factor, impact] of Object.entries(entrant.sensitivity)) {
        acc[factor] = (acc[factor] ?? 0) + impact;
      }
      return acc;
    }, {}),
  )
    .map(([factor, impactS]) => ({
      factor,
      impactS: roundTo(impactS / Math.max(finishingOrder.length, 1), 2),
      explanation: sensitivityExplanation(factor, target ? product.entrants.find((entrant) => target.entrantIds.includes(entrant.driverId)) ?? product.entrants[0]! : product.entrants[0]!),
    }))
    .sort((left, right) => right.impactS - left.impactS);
  const topSensitivityDrivers = sensitivity.filter((item) => item.impactS > 0).slice(0, 3);
  const weakestAssumption = buildWeakestAssumption(input, entrants, confidenceScore);
  const targetSummary = buildTargetSummary(finishingOrder, target);
  const confidence = confidenceLabel(confidenceScore);

  return {
    raceId: product.race.id,
    raceName: product.race.raceName,
    comparisonTarget: target
      ? { type: target.type, id: target.id, label: target.label, entrantCount: target.entrantIds.length }
      : null,
    scenarioSummary: {
      fieldSize: finishingOrder.length,
      selectedDrivers: finishingOrder.length,
      weatherScenario: input.weatherScenario,
      pitStopCount: input.pitStopCount,
      safetyCarProbability: input.safetyCarProbability,
      aggressionFactor: input.aggressionFactor,
      reliabilityBias: input.reliabilityBias,
      baselineMode: "Everyone else stays on the precomputed baseline strategy.",
    },
    confidence,
    confidenceReason: buildConfidenceReason(confidence, input, weakestAssumption),
    weakestAssumption,
    whatChangedOutcome: buildWhatChangedOutcome(targetSummary, topSensitivityDrivers, weakestAssumption),
    undercutNarrative:
      input.pitStopCount >= 3
        ? "This setup leans hard into undercut pressure and track-position swings."
        : input.pitStopCount === 2
          ? "This profile keeps the race in the normal undercut window while still giving pit timing room to matter."
          : "A one-stop profile leans more on tyre preservation and clean-air track position than on undercut aggression.",
    modelMeta: {
      simulatorVersion: STRATEGY_LAB_SIMULATOR_VERSION,
      scenarioTemplateVersion: product.overview.scenarioTemplateVersion ?? STRATEGY_LAB_SCENARIO_TEMPLATE_VERSION,
      featureBuildVersion: product.overview.featureBuildVersion ?? null,
      productBuildVersion: (product as StrategyLabRaceProduct & { runtime?: { buildVersion?: string | null } }).runtime?.buildVersion ?? null,
      assumptions: [
        "Deterministic lap-time accumulation with bounded tyre-degradation and pit-loss heuristics",
        "Weather adjusts pace, degradation, pit loss, and dry-compound suitability rather than simulating full wet-race dynamics",
        "Aggression and reliability bias trade pace against degradation and operational robustness only for the selected target",
        "Energy deployment is a 2026-era speed-shape proxy only, not true ERS or battery state",
        "Win and podium fields are rounded odds proxies, not calibrated probabilities",
      ],
    },
    targetSummary,
    sensitivity,
    topSensitivityDrivers,
    positionTransitionBands: buildPositionTransitionBands(finishingOrder),
    finishingOrder,
  };
}
