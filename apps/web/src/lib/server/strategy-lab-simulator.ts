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

  for (let stintIndex = 0; stintIndex < plan.length; stintIndex += 1) {
    const stint = plan[stintIndex]!;
    const profile = compoundProfile(entrant, stint.compound);
    const baseDelta = (profile.deltaS ?? 0) + weatherCompoundAdjustment(input.weatherScenario, stint.compound);
    const degradation = Math.max(
      0.01,
      (profile.degradationSPerLap ?? 0.06) *
        weather.degradationMultiplier *
        (1.04 + (effectiveAggression - 0.5) * 0.28 - reliabilityMode * 0.12) *
        (1.08 - tyreManagement * 0.18),
    );
    degradationAccumulator += degradation;
    for (let lap = 1; lap <= stint.laps; lap += 1) {
      globalLap += 1;
      const fuelOffset = ((totalLaps - globalLap) / totalLaps - 0.5) * 0.85;
      const paceDrift = globalLap * paceEvolution * (1 - effectiveAggression * 0.08);
      const attackOffset = targetApplied ? -(effectiveAggression - 0.5) * 0.26 + Math.min(0, reliabilityMode) * 0.14 : 0;
      const warmupPenalty =
        lap <= 2
          ? stint.compound === "hard"
            ? 0.18
            : stint.compound === "medium"
              ? 0.09
              : 0.04
          : 0;
      totalRaceTimeS += baseRacePaceS + baseDelta + fuelOffset + paceDrift + attackOffset + warmupPenalty + (lap - 1) * degradation;
    }
    if (stintIndex < plan.length - 1) {
      totalRaceTimeS += Math.max(16, pitLoss - effectiveAggression * 0.35 + input.safetyCarProbability * 1.5);
    }
  }

  const trafficPenalty =
    Math.max(0, (gridPosition - 6) * 0.09) *
    weather.trafficPenaltyMultiplier *
    (1 - racecraft * 0.42) *
    (1 - (effectiveAggression - 0.5) * 0.16);
  const operationalPenalty =
    Math.max(0, -reliabilityMode) * (2.2 - operationalRobustness * 1.1) +
    Math.max(0, reliabilityMode) * 0.35;
  totalRaceTimeS += gridAdjustment(gridPosition, racecraft) + trafficPenalty + operationalPenalty;
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
    `Tyre management ${tyreManagement.toFixed(2)}, racecraft ${racecraft.toFixed(2)}, and an average degradation load of ${(degradationAccumulator / Math.max(plan.length, 1)).toFixed(3)}s/lap set the stability of the stint model.`,
  );

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
    confidence: confidenceLabel(confidenceScore),
    confidenceReason:
      input.weatherScenario === "dry"
        ? "Confidence is anchored by Race Week strategy priors, precomputed pit windows, and how closely this scenario stays to the calibrated dry-running baseline."
        : "Confidence softens because mixed or wet assumptions are modeled as coarse pace and degradation adjustments rather than a fully weather-aware race simulator.",
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
      ],
    },
    targetSummary: buildTargetSummary(finishingOrder, target),
    finishingOrder,
  };
}
