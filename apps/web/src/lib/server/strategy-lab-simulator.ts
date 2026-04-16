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
    baselineMode: string;
  };
  confidence: ConfidenceLabel;
  confidenceReason: string;
  undercutNarrative: string;
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
  safetyCarProbability: number,
  qualifyingOverrides: Map<string, number>,
) {
  const totalLaps = entrant.strategyFeature.nominalRaceLaps ?? 57;
  const baseRacePaceS = entrant.strategyFeature.baseRacePaceS ?? 90;
  const paceEvolution = entrant.strategyFeature.paceEvolutionSPerLap ?? 0.018;
  const pitLoss = (entrant.strategyFeature.pitLossS ?? 22) + (entrant.constructorProfile.pitLossAdjustmentS ?? 0);
  const aggression = clamp01(entrant.driverProfile.aggressiveTendencyScore, 0.5);
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
    const baseDelta = profile.deltaS ?? 0;
    const degradation = Math.max(0.01, (profile.degradationSPerLap ?? 0.06) * (1.08 - tyreManagement * 0.18));
    degradationAccumulator += degradation;
    for (let lap = 1; lap <= stint.laps; lap += 1) {
      globalLap += 1;
      const fuelOffset = ((totalLaps - globalLap) / totalLaps - 0.5) * 0.85;
      const paceDrift = globalLap * paceEvolution * (1 - aggression * 0.08);
      totalRaceTimeS += baseRacePaceS + baseDelta + fuelOffset + paceDrift + (lap - 1) * degradation;
    }
    if (stintIndex < plan.length - 1) {
      totalRaceTimeS += Math.max(16, pitLoss - aggression * 0.35 + safetyCarProbability * 1.5);
    }
  }

  totalRaceTimeS += gridAdjustment(gridPosition, racecraft);
  const undercutImpact = roundTo((plan.length - 1) * 1.8 + aggression * 2.6 + safetyCarProbability * 3.1, 2);
  explanation.push(
    `${entrant.fullName} opens from P${gridPosition} with ${plan.length - 1} planned stops and a projected pit-loss baseline of ${pitLoss.toFixed(1)}s.`,
  );
  explanation.push(
    `Tyre management ${tyreManagement.toFixed(2)} and racecraft ${racecraft.toFixed(2)} shape the degradation and grid-offset assumptions in this run.`,
  );

  return {
    driverId: entrant.driverId,
    fullName: entrant.fullName,
    constructorId: entrant.constructorId,
    constructorName: entrant.constructorName,
    qualifyingPosition: gridPosition,
    undercutImpact,
    totalRaceTimeS: roundTo(totalRaceTimeS, 3),
    score: -roundTo(totalRaceTimeS, 3),
    averageStintDegradationS: roundTo(degradationAccumulator / Math.max(plan.length, 1), 4),
    explanation,
  };
}

function estimatePodiumProbability(index: number, confidenceScore: number | null) {
  const confidence = clamp01(confidenceScore, 0.35);
  return roundTo(Math.max(3, Math.min(92, 88 - index * 14 - (1 - confidence) * 18)), 1);
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
      sim: simulateEntrant(entrant, buildBaselinePlan(entrant), input.safetyCarProbability, qualifyingOverrides),
    }))
    .sort((left, right) => left.sim.totalRaceTimeS - right.sim.totalRaceTimeS);

  const comparisonPlan = normalizeTirePlan(
    product.overview.nominalRaceLaps ?? product.entrants[0]?.strategyFeature.nominalRaceLaps ?? 57,
    input.tirePlan,
  );

  const comparisonField = entrants
    .map((entrant) => {
      const plan = target?.entrantIds.includes(entrant.driverId) ? comparisonPlan : buildBaselinePlan(entrant);
      return { entrant, sim: simulateEntrant(entrant, plan, input.safetyCarProbability, qualifyingOverrides) };
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
    clamp01(1 - Math.abs(input.pitStopCount - 2) * 0.15 - (input.weatherScenario === "dry" ? 0 : 0.18), 0.25) * 0.15;

  const finishingOrder = comparisonField.map((row, index) => {
    const projectedFinish = index + 1;
    const baseline = baselineMap.get(row.sim.driverId)!;
    const confidence = confidenceLabel(confidenceScore * 0.65 + clamp01(row.entrant.confidenceScore, 0.3) * 0.35);
    return {
      ...row.sim,
      projectedFinish,
      projectedPoints: POINTS_BY_POSITION[projectedFinish] ?? 0,
      podiumProbability: estimatePodiumProbability(index, row.entrant.confidenceScore),
      confidence,
      baselineFinish: baseline.projectedFinish,
      finishDelta: baseline.projectedFinish - projectedFinish,
      baselinePoints: baseline.projectedPoints,
      pointsDelta: (POINTS_BY_POSITION[projectedFinish] ?? 0) - baseline.projectedPoints,
      isTarget: target?.entrantIds.includes(row.sim.driverId) ?? false,
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
      baselineMode: "Everyone else stays on the precomputed baseline strategy.",
    },
    confidence: confidenceLabel(confidenceScore),
    confidenceReason:
      input.weatherScenario === "dry"
        ? "Confidence is anchored by the Race Week strategy priors, precomputed pit windows, and the agreement between entrant-level strategy features."
        : "Confidence softens in mixed or wet scenarios because the current Strategy Lab priors are calibrated around dry-running baseline assumptions.",
    undercutNarrative:
      input.pitStopCount >= 3
        ? "This setup leans hard into undercut pressure and track-position swings."
        : input.pitStopCount === 2
          ? "This profile keeps the race in the normal undercut window while still giving pit timing room to matter."
          : "A one-stop profile leans more on tyre preservation and clean-air track position than on undercut aggression.",
    targetSummary: buildTargetSummary(finishingOrder, target),
    finishingOrder,
  };
}
